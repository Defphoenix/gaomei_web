"""Map WES clinical_v2 report JSON (current.json) into portal Report fields."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from django.conf import settings

from .models import Report, ReportVariant

CONSEQUENCE_LABELS = {
    "missense_variant": "错义突变",
    "frameshift_variant": "移码突变",
    "stop_gained": "终止获得",
    "splice_acceptor_variant": "剪接受体变异",
    "splice_donor_variant": "剪接供体变异",
    "inframe_insertion": "框内插入",
    "inframe_deletion": "框内缺失",
}

GENE_ORGAN_HINTS: dict[str, list[tuple[str, float]]] = {
    "TP53": [("liver", 7.5), ("colon", 6.8), ("trachea", 5.5)],
    "KRAS": [("pancreas", 7.2), ("colon", 6.5), ("trachea", 5.0)],
    "PIK3CA": [("colon", 6.0), ("bladder", 4.5)],
    "APC": [("colon", 7.8)],
    "ERBB2": [("gallbladder", 5.5), ("bladder", 4.0)],
    "AR": [("prostate", 7.0)],
    "PTEN": [("prostate", 6.5)],
    "VHL": [("kidney", 6.5)],
}


def _media_url_for(abs_path: Path) -> str:
    media_root = Path(settings.MEDIA_ROOT).resolve()
    try:
        rel = abs_path.resolve().relative_to(media_root)
    except ValueError:
        return ""
    return f"/media/{rel.as_posix()}"


def _table_rows(module: dict[str, Any] | None) -> list[list[str]]:
    if not isinstance(module, dict):
        return []
    rows: list[list[str]] = []
    for section in module.get("sections") or []:
        if not isinstance(section, dict):
            continue
        for table in section.get("tables") or []:
            if isinstance(table, dict):
                rows.extend(table.get("rows") or [])
    if module.get("table") and isinstance(module["table"], dict):
        rows.extend(module["table"].get("rows") or [])
    return rows


def _find_row_value(rows: list[list[str]], *needles: str) -> str:
    lowered = [n.lower() for n in needles]
    for row in rows:
        joined = " ".join(str(cell) for cell in row).lower()
        if all(needle in joined for needle in lowered):
            for cell in row[1:]:
                text = str(cell or "").strip()
                if text and text not in {"--", "-", "未判定", "未检测"}:
                    return text
    for row in rows:
        if row and any(needle in str(row[0]).lower() for needle in lowered):
            for cell in row[1:]:
                text = str(cell or "").strip()
                if text and text not in {"--", "-"}:
                    return text
    return ""


def _parse_float(text: str) -> float | None:
    match = re.search(r"(-?\d+(?:\.\d+)?)", text or "")
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _qc_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    qc_module = payload.get("quality_control") if isinstance(payload.get("quality_control"), dict) else {}
    samples = qc_module.get("samples") or []
    tumor = next((s for s in samples if isinstance(s, dict) and "肿瘤" in str(s.get("role"))), {})
    normal = next((s for s in samples if isinstance(s, dict) and "正常" in str(s.get("role"))), {})

    def pct(value: Any) -> float | None:
        if value is None:
            return None
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None
        return round(num * 100, 2) if num <= 1 else round(num, 2)

    tumor_20x = pct(tumor.get("pct_target_bases_20x"))
    normal_20x = pct(normal.get("pct_target_bases_20x"))
    target_20x = tumor_20x if tumor_20x is not None else normal_20x
    status = "PASS"
    if target_20x is not None and target_20x < 90:
        status = "REVIEW"
    return {
        "status": status,
        "tumor_mean_depth": tumor.get("mean_target_coverage"),
        "normal_mean_depth": normal.get("mean_target_coverage"),
        "tumor_mapping_rate": pct(tumor.get("pct_unique_reads_aligned")),
        "normal_mapping_rate": pct(normal.get("pct_unique_reads_aligned")),
        "tumor_duplication_rate": pct(tumor.get("duplication_rate")),
        "normal_duplication_rate": pct(normal.get("duplication_rate")),
        "target_20x": target_20x,
        "target_100x": pct(tumor.get("pct_target_bases_100x")),
    }


def _biomarkers_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    immuno = payload.get("immunotherapy") if isinstance(payload.get("immunotherapy"), dict) else {}
    rows = _table_rows(immuno)
    tmb_text = _find_row_value(rows, "tmb")
    msi_text = _find_row_value(rows, "msi状态", "msi")
    variant_count_text = _find_row_value(rows, "纳入编码变异")
    tmb = _parse_float(tmb_text)
    tmb_class = ""
    if "tmb-h" in tmb_text.lower():
        tmb_class = "TMB-H"
    elif "tmb-l" in tmb_text.lower():
        tmb_class = "TMB-L"
    msi_status = msi_text or "未检测"
    if msi_status in {"--", "-"}:
        msi_status = "未检测"
    return {
        "tmb": tmb,
        "tmb_unit": "mut/Mb",
        "tmb_class": tmb_class,
        "tmb_variant_count": int(_parse_float(variant_count_text) or 0) or None,
        "msi_status": msi_status,
        "msi_score": None,
    }


def _consequence_counts(variants: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        key = variant.get("consequence") or "unknown"
        label = CONSEQUENCE_LABELS.get(str(key), str(key))
        counts[label] = counts.get(label, 0) + 1
    return counts


def _derive_organ_risks(variants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scores: dict[str, dict[str, Any]] = {}
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        gene = str(variant.get("gene") or "").upper()
        for organ_key, base in GENE_ORGAN_HINTS.get(gene, []):
            af = float(variant.get("tumor_af") or 0)
            score = min(10.0, base + af * 3)
            current = scores.get(organ_key)
            if not current or score > current["score"]:
                genes = set(current["genes"]) if current else set()
                genes.add(gene)
                scores[organ_key] = {
                    "key": organ_key,
                    "name": {
                        "liver": "肝脏",
                        "prostate": "前列腺",
                        "pancreas": "胰腺",
                        "colon": "结直肠",
                        "bladder": "膀胱",
                        "gallbladder": "胆囊",
                        "kidney": "肾脏",
                        "trachea": "气管",
                    }.get(organ_key, organ_key),
                    "score": round(score, 1),
                    "genes": sorted(genes),
                    "evidence": f"体细胞变异 {gene} 关联器官证据",
                    "recommendation": "需结合病理、影像与专业审核综合解释。",
                }
    return sorted(scores.values(), key=lambda item: item["score"], reverse=True)


def _organ_risks_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    explicit = payload.get("portal_organ_risks")
    if isinstance(explicit, list) and explicit:
        return [item for item in explicit if isinstance(item, dict) and item.get("key")]
    variants = payload.get("portal_variants") if isinstance(payload.get("portal_variants"), list) else []
    derived = _derive_organ_risks(variants)
    return derived


def _overview_summary(payload: dict[str, Any]) -> str:
    overview = payload.get("overview") if isinstance(payload.get("overview"), dict) else {}
    for section in overview.get("sections") or []:
        if not isinstance(section, dict):
            continue
        for paragraph in section.get("paragraphs") or []:
            text = str(paragraph or "").strip()
            if text:
                return text
    sample = payload.get("sample") if isinstance(payload.get("sample"), dict) else {}
    diagnosis = sample.get("clinical_diagnosis") or "肿瘤"
    return f"本次 {diagnosis} 相关全外显子组测序报告，详见各模块解读。"


def _module_snapshot(module: dict[str, Any] | None, *, max_sections: int = 4) -> dict[str, Any] | None:
    if not isinstance(module, dict):
        return None
    sections = []
    for section in (module.get("sections") or [])[:max_sections]:
        if not isinstance(section, dict):
            continue
        tables = []
        for table in (section.get("tables") or [])[:3]:
            if not isinstance(table, dict):
                continue
            tables.append({
                "title": table.get("title") or "",
                "columns": table.get("columns") or [],
                "rows": (table.get("rows") or [])[:12],
                "note": table.get("note") or "",
            })
        sections.append({
            "section_id": section.get("section_id") or "",
            "number": section.get("number") or "",
            "title": section.get("title") or "",
            "paragraphs": (section.get("paragraphs") or [])[:3],
            "tables": tables,
            "notes": (section.get("notes") or [])[:3],
        })
    snap: dict[str, Any] = {
        "number": module.get("number") or "",
        "title": module.get("title") or "",
        "subtitle": module.get("subtitle") or "",
        "sections": sections,
    }
    if module.get("samples"):
        snap["samples"] = module.get("samples")
    if isinstance(module.get("table"), dict):
        snap["table"] = {
            "title": module["table"].get("title") or "",
            "columns": module["table"].get("columns") or [],
            "rows": (module["table"].get("rows") or [])[:20],
        }
    return snap


def build_portal_analysis_data(
    payload: dict[str, Any],
    *,
    bundle_root_path: Path | None = None,
    wes_report_id: str = "",
) -> dict[str, Any]:
    igv = payload.get("igv_tracks") if isinstance(payload.get("igv_tracks"), dict) else {}
    bundle_root_path = bundle_root_path or Path()
    tumor_bam = bundle_root_path / Path(str(igv.get("tumor_bam") or "tumor.report.bam")).name
    tumor_bai = bundle_root_path / Path(str(igv.get("tumor_bai") or "tumor.report.bam.bai")).name
    normal_bam = bundle_root_path / Path(str(igv.get("normal_bam") or "normal.report.bam")).name
    normal_bai = bundle_root_path / Path(str(igv.get("normal_bai") or "normal.report.bam.bai")).name

    variants = payload.get("portal_variants") if isinstance(payload.get("portal_variants"), list) else []
    report_meta = payload.get("report") if isinstance(payload.get("report"), dict) else {}
    layout = payload.get("layout") if isinstance(payload.get("layout"), dict) else {}
    sample = payload.get("sample") if isinstance(payload.get("sample"), dict) else {}

    default_locus = igv.get("default_locus") or ""
    if not default_locus and variants:
        first = variants[0]
        chrom = str(first.get("chrom") or "").removeprefix("chr")
        pos = int(first.get("pos") or 0)
        if chrom and pos:
            default_locus = f"chr{chrom}:{max(1, pos - 150)}-{pos + 150}"

    modules = {
        "overview": _module_snapshot(payload.get("overview") if isinstance(payload.get("overview"), dict) else None),
        "targeted_therapy": _module_snapshot(
            payload.get("targeted_therapy") if isinstance(payload.get("targeted_therapy"), dict) else None
        ),
        "quality_control": _module_snapshot(
            payload.get("quality_control") if isinstance(payload.get("quality_control"), dict) else None
        ),
        "somatic_variants": _module_snapshot(
            payload.get("somatic_variants") if isinstance(payload.get("somatic_variants"), dict) else None
        ),
        "immunotherapy": _module_snapshot(
            payload.get("immunotherapy") if isinstance(payload.get("immunotherapy"), dict) else None
        ),
        "neoantigens": _module_snapshot(
            payload.get("neoantigens") if isinstance(payload.get("neoantigens"), dict) else None
        ),
        "hereditary_risk": _module_snapshot(
            payload.get("hereditary_risk") if isinstance(payload.get("hereditary_risk"), dict) else None
        ),
        "pharmacogenomics": _module_snapshot(
            payload.get("pharmacogenomics") if isinstance(payload.get("pharmacogenomics"), dict) else None
        ),
    }

    return {
        "schema_version": payload.get("schema_version") or "wes_package_v1",
        "document_type": layout.get("document_type") or "clinical_v2",
        "wes_report_id": wes_report_id,
        "pipeline_version": report_meta.get("template_version") or "clinical_v2",
        "analysis_date": report_meta.get("generated_at") or "",
        "assay": "肿瘤-正常配对全外显子组测序",
        "sample": {
            "sample_id": sample.get("sample_id") or "",
            "name": sample.get("name") or "",
            "sex": sample.get("sex") or "",
            "age": sample.get("age") or "",
            "specimen_type": sample.get("specimen_type") or "",
            "clinical_diagnosis": sample.get("clinical_diagnosis") or "",
        },
        "qc": _qc_from_payload(payload),
        "biomarkers": _biomarkers_from_payload(payload),
        "counts": {
            "reportable": len(variants),
            "snv": sum(1 for v in variants if isinstance(v, dict) and len(str(v.get("ref") or "N")) == 1 and len(str(v.get("alt") or "N")) == 1),
            "indel": sum(1 for v in variants if isinstance(v, dict) and not (len(str(v.get("ref") or "N")) == 1 and len(str(v.get("alt") or "N")) == 1)),
        },
        "consequence_counts": _consequence_counts(variants),
        "organ_risks": _organ_risks_from_payload(payload),
        "portal_modules": {key: value for key, value in modules.items() if value},
        "igv_tracks": {
            "tumor_bam": _media_url_for(tumor_bam) if tumor_bam.is_file() else "",
            "tumor_bai": _media_url_for(tumor_bai) if tumor_bai.is_file() else "",
            "normal_bam": _media_url_for(normal_bam) if normal_bam.is_file() else "",
            "normal_bai": _media_url_for(normal_bai) if normal_bai.is_file() else "",
            "default_locus": str(default_locus or "").replace(",", ""),
        },
        "notices": (payload.get("notices") or [])[:8] if isinstance(payload.get("notices"), list) else [],
        "limitations": (payload.get("limitations") or [])[:8] if isinstance(payload.get("limitations"), list) else [],
    }


def sync_portal_from_wes_payload(
    report: Report,
    payload: dict[str, Any],
    bundle_root_path: Path,
    *,
    wes_report_id: str = "",
) -> None:
    """Persist portal-facing analysis_data and ReportVariant rows from WES JSON."""
    wes_report_id = wes_report_id or str((report.analysis_data or {}).get("wes_report_id") or "")
    analysis = build_portal_analysis_data(
        payload,
        bundle_root_path=bundle_root_path,
        wes_report_id=wes_report_id,
    )

    sample = payload.get("sample") if isinstance(payload.get("sample"), dict) else {}
    report_meta = payload.get("report") if isinstance(payload.get("report"), dict) else {}

    # Keep a light patient snapshot for display (formal bind is Patient.user separately)
    snap = dict(report.patient_snapshot or {})
    snap.update({
        "name": sample.get("name") or snap.get("name") or report.patient.name,
        "sex": sample.get("sex") or snap.get("sex") or "",
        "age": sample.get("age") or snap.get("age") or "",
        "clinical_diagnosis": sample.get("clinical_diagnosis") or snap.get("clinical_diagnosis") or "",
        "specimen_type": sample.get("specimen_type") or snap.get("specimen_type") or "",
        "patient_no": report.patient.patient_no,
    })

    report.analysis_data = analysis
    report.patient_snapshot = snap
    report.tumor_sample_id = str(sample.get("sample_id") or report.sample_id)[:100]
    report.title = str(report_meta.get("title") or report.title)[:200]
    report.summary = _overview_summary(payload)[:2000]
    report.conclusion = str(payload.get("result_summary") or report.conclusion)[:2000]
    report.genome_build = "GRCh38"

    samples = payload.get("samples") if isinstance(payload.get("samples"), list) else []
    for item in samples:
        if isinstance(item, dict) and "正常" in str(item.get("role") or ""):
            report.normal_sample_id = str(item.get("sample_id") or "")[:100]

    report.save(update_fields=[
        "analysis_data", "patient_snapshot", "tumor_sample_id", "normal_sample_id",
        "title", "summary", "conclusion", "genome_build",
    ])

    igv = analysis.get("igv_tracks") or {}
    tumor_bam_url = igv.get("tumor_bam") or ""
    tumor_bai_url = igv.get("tumor_bai") or ""
    normal_bam_url = igv.get("normal_bam") or ""
    normal_bai_url = igv.get("normal_bai") or ""

    if "portal_variants" in payload:
        variants = payload.get("portal_variants") if isinstance(payload.get("portal_variants"), list) else []
        report.variants.all().delete()
        rows: list[ReportVariant] = []
        for variant in variants:
            if not isinstance(variant, dict):
                continue
            chrom = str(variant.get("chrom") or "").removeprefix("chr")
            try:
                pos = int(variant.get("pos"))
            except (TypeError, ValueError):
                continue
            if not chrom:
                continue
            significance = str(variant.get("significance") or "vus")
            if significance not in {"pathogenic", "likely_pathogenic", "vus", "likely_benign", "benign"}:
                significance = "vus"
            ref = str(variant.get("ref") or "N")
            alt = str(variant.get("alt") or "N")
            af = float(variant["tumor_af"]) if variant.get("tumor_af") is not None else None
            rows.append(ReportVariant(
                report=report,
                chromosome=chrom[:32],
                position=pos,
                ref=ref[:512],
                alt=alt[:512],
                gene=str(variant.get("gene") or "-")[:64],
                variant_type="SNP" if len(ref) == 1 and len(alt) == 1 else "InDel",
                consequence=str(variant.get("consequence") or "")[:128],
                allele_frequency=af,
                data={
                    "end_position": pos + max(len(ref), 1) - 1,
                    "significance": significance,
                    "annotation": str(variant.get("clinical_summary") or variant.get("hgvsp") or ""),
                    "transcript": str(variant.get("transcript") or "")[:100],
                    "hgvs_c": str(variant.get("hgvsc") or "")[:200],
                    "hgvs_p": str(variant.get("hgvsp") or "")[:200],
                    "tumor_depth": int(variant["tumor_dp"]) if variant.get("tumor_dp") is not None else None,
                    "tumor_alt_reads": int(variant["tumor_alt_reads"]) if variant.get("tumor_alt_reads") is not None else None,
                    "normal_depth": int(variant["normal_dp"]) if variant.get("normal_dp") is not None else None,
                    "normal_alt_reads": int(variant["normal_alt_reads"]) if variant.get("normal_alt_reads") is not None else None,
                    "tlod": float(variant["tlod"]) if variant.get("tlod") is not None else None,
                    "filter_status": "REPORTABLE",
                    "bam_track_url": tumor_bam_url,
                    "bam_index_url": tumor_bai_url,
                    "annotations": {
                        "normal_bam_url": normal_bam_url,
                        "normal_bam_index_url": normal_bai_url,
                    },
                },
            ))
        if rows:
            ReportVariant.objects.bulk_create(rows)
    elif tumor_bam_url:
        for variant in report.variants.all():
            data = dict(variant.data or {})
            if not data.get("bam_track_url"):
                data["bam_track_url"] = tumor_bam_url
                data["bam_index_url"] = tumor_bai_url
                variant.data = data
                variant.save(update_fields=["data"])


def load_wes_report_json(wes_report_id: str) -> dict[str, Any] | None:
    if not wes_report_id:
        return None
    path = Path(settings.WES_REPORT_DATA_DIR) / wes_report_id / "current.json"
    if not path.is_file():
        return None
    import json
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
