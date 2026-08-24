"""正式 WES 报告包落盘、关联表更新与 HTML/PDF 生成。"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import date
from pathlib import Path
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files import File
from django.db import transaction
from django.utils import timezone

from wes_report.schemas import ReportData
from wes_report.services import load_report_data, save_report_data, write_html, write_pdf

from .models import BundleFile, PatientReportSlot, Report, ReportItem, SampleBundle

SAFE_SAMPLE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")
SAFE_UPLOAD = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$")
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$")
MAX_FILE_BYTES = 100 * 1024 * 1024


def normalize_patient_no(value: str) -> str:
    return str(value or "").strip().translate(
        str.maketrans("０１２３４５６７８９", "0123456789")
    ).upper()


def to_wes_report_id(sample_id: str) -> str:
    """wes_report 只允许字母数字下划线连字符。"""
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", sample_id.strip())
    cleaned = cleaned.strip("_") or "sample"
    return cleaned[:100]


def bundle_root() -> Path:
    return Path(settings.WES_BUNDLE_ROOT)


def report_data_root() -> Path:
    return Path(settings.WES_REPORT_DATA_DIR)


def report_output_root() -> Path:
    return Path(settings.WES_REPORT_OUTPUT_DIR)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _role_for_name(name: str, declared: str | None = None) -> str:
    if declared:
        allowed = {choice.value for choice in BundleFile.Role}
        if declared in allowed:
            return declared
    lower = name.lower()
    if lower in {"report.json", "current.json"} or lower.endswith(".json"):
        return BundleFile.Role.REPORT_JSON
    if lower.endswith((".bam", ".bai", ".cram", ".crai")):
        return BundleFile.Role.ATTACHMENT
    if lower.endswith((".png", ".jpg", ".jpeg", ".svg", ".pdf")) and "qc" in lower:
        return BundleFile.Role.QC_PLOT
    return BundleFile.Role.ATTACHMENT if declared is None else BundleFile.Role.OTHER


def _resolve_or_create_patient(patient_no: str, patient_name: str = "") -> User:
    patient = User.objects.filter(profile__patient_no=patient_no).first()
    if patient:
        return patient
    username = f"patient_{hashlib.sha256(patient_no.encode()).hexdigest()[:16]}"
    patient = User.objects.create(username=username, is_active=False)
    patient.set_unusable_password()
    patient.save(update_fields=["password"])
    patient.profile.patient_no = patient_no
    patient.profile.role = "customer"
    patient.profile.save(update_fields=["patient_no", "role"])
    return patient


def _ensure_portal_report(patient: User, patient_no: str, sample_id: str, patient_name: str) -> Report:
    report_number = f"WES:{sample_id}"[:100]
    title_name = patient_name or patient.username
    report, _ = Report.objects.update_or_create(
        report_number=report_number,
        defaults={
            "user": patient,
            "title": f"{title_name} WES正式报告",
            "report_type": "mutation",
            "sample_id": sample_id[:100],
            "report_date": date.today(),
            "summary": "已接收正式报告数据包，等待审核发布。",
            "conclusion": "",
            "status": "review",
            "genome_build": "GRCh38",
            "tumor_sample_id": sample_id[:100],
            "patient_info": {
                "name": title_name,
                "patient_no": patient_no,
            },
            "analysis_data": {
                "schema_version": "wes_package_v1",
                "wes_report_id": to_wes_report_id(sample_id),
            },
            "reviewed_by": "",
            "released_at": None,
        },
    )
    return report


def _record_file(
    bundle: SampleBundle,
    *,
    role: str,
    original_name: str,
    abs_path: Path,
    rel_path: str,
    content_type: str = "",
) -> BundleFile:
    sha = _sha256_file(abs_path) if abs_path.is_file() else ""
    size = abs_path.stat().st_size if abs_path.is_file() else 0
    obj, _ = BundleFile.objects.update_or_create(
        bundle=bundle,
        rel_path=rel_path,
        defaults={
            "role": role,
            "original_name": original_name[:255],
            "abs_path": str(abs_path),
            "sha256": sha,
            "size_bytes": size,
            "content_type": (content_type or "")[:120],
        },
    )
    return obj


def _media_url_for(abs_path: Path) -> str:
    media_root = Path(settings.MEDIA_ROOT).resolve()
    try:
        rel = abs_path.resolve().relative_to(media_root)
    except ValueError:
        return ""
    return f"/media/{rel.as_posix()}"


def _sync_portal_variants(
    report: Report,
    payload: dict[str, Any],
    bundle_root_path: Path,
) -> None:
    """Create ReportItem rows + IGV track URLs from package JSON extras."""
    igv = payload.get("igv_tracks") if isinstance(payload.get("igv_tracks"), dict) else {}
    tumor_bam = bundle_root_path / Path(str(igv.get("tumor_bam") or "tumor.report.bam")).name
    tumor_bai = bundle_root_path / Path(str(igv.get("tumor_bai") or "tumor.report.bam.bai")).name
    normal_bam = bundle_root_path / Path(str(igv.get("normal_bam") or "normal.report.bam")).name
    normal_bai = bundle_root_path / Path(str(igv.get("normal_bai") or "normal.report.bam.bai")).name
    tumor_bam_url = _media_url_for(tumor_bam) if tumor_bam.is_file() else ""
    tumor_bai_url = _media_url_for(tumor_bai) if tumor_bai.is_file() else ""
    normal_bam_url = _media_url_for(normal_bam) if normal_bam.is_file() else ""
    normal_bai_url = _media_url_for(normal_bai) if normal_bai.is_file() else ""

    analysis = dict(report.analysis_data or {})
    analysis["schema_version"] = payload.get("schema_version") or "wes_package_v1"
    analysis["wes_report_id"] = to_wes_report_id(report.sample_id)
    analysis["document_type"] = (payload.get("layout") or {}).get("document_type") or "clinical_v2"
    analysis["igv_tracks"] = {
        "tumor_bam": tumor_bam_url,
        "tumor_bai": tumor_bai_url,
        "normal_bam": normal_bam_url,
        "normal_bai": normal_bai_url,
        "default_locus": igv.get("default_locus") or "",
    }
    report.analysis_data = analysis
    report.tumor_sample_id = str((payload.get("sample") or {}).get("sample_id") or report.sample_id)[:100]
    samples = payload.get("samples") if isinstance(payload.get("samples"), list) else []
    for sample in samples:
        if isinstance(sample, dict) and "正常" in str(sample.get("role") or ""):
            report.normal_sample_id = str(sample.get("sample_id") or "")[:100]
    report.summary = "已接收 clinical_v2 正式报告包，等待审核发布。"
    report.save(update_fields=[
        "analysis_data", "tumor_sample_id", "normal_sample_id", "summary",
    ])

    variants = payload.get("portal_variants") if isinstance(payload.get("portal_variants"), list) else []
    report.items.all().delete()
    items = []
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        chrom = str(variant.get("chrom") or "").removeprefix("chr")
        pos = variant.get("pos")
        try:
            pos = int(pos)
        except (TypeError, ValueError):
            continue
        if not chrom:
            continue
        significance = str(variant.get("significance") or "vus")
        if significance not in {"pathogenic", "likely_pathogenic", "vus", "likely_benign", "benign"}:
            significance = "vus"
        items.append(ReportItem(
            report=report,
            gene=str(variant.get("gene") or "-")[:50],
            chromosome=chrom[:10],
            position=pos,
            end_position=pos + max(len(str(variant.get("ref") or "N")), 1) - 1,
            ref_allele=str(variant.get("ref") or "")[:500],
            alt_allele=str(variant.get("alt") or "")[:500],
            variant_type="SNP" if len(str(variant.get("ref") or "N")) == 1 and len(str(variant.get("alt") or "N")) == 1 else "InDel",
            significance=significance,
            af=float(variant["tumor_af"]) if variant.get("tumor_af") is not None else None,
            annotation=str(variant.get("clinical_summary") or ""),
            transcript=str(variant.get("transcript") or "")[:100],
            hgvs_c=str(variant.get("hgvsc") or "")[:200],
            hgvs_p=str(variant.get("hgvsp") or "")[:200],
            consequence=str(variant.get("consequence") or "")[:100],
            tumor_depth=int(variant["tumor_dp"]) if variant.get("tumor_dp") is not None else None,
            tumor_alt_reads=int(variant["tumor_alt_reads"]) if variant.get("tumor_alt_reads") is not None else None,
            normal_depth=int(variant["normal_dp"]) if variant.get("normal_dp") is not None else None,
            normal_alt_reads=int(variant["normal_alt_reads"]) if variant.get("normal_alt_reads") is not None else None,
            tlod=float(variant["tlod"]) if variant.get("tlod") is not None else None,
            filter_status="REPORTABLE",
            bam_track_url=tumor_bam_url,
            bam_index_url=tumor_bai_url,
            annotations={
                "normal_bam_url": normal_bam_url,
                "normal_bam_index_url": normal_bai_url,
            },
        ))
    if items:
        ReportItem.objects.bulk_create(items)


def generate_outputs_for_bundle(bundle: SampleBundle) -> dict[str, Any]:
    """从当前 current.json 生成 HTML/PDF，并写回 BundleFile / Report。"""
    wes_id = bundle.wes_report_id
    json_path = report_data_root() / wes_id / "current.json"
    if not json_path.exists():
        raise FileNotFoundError(f"missing current.json for {wes_id}")

    data = load_report_data(json_path)
    html_path = report_output_root() / "html" / f"{wes_id}.html"
    pdf_path = report_output_root() / "pdf" / f"{wes_id}.pdf"
    write_html(data, html_path)
    _record_file(
        bundle,
        role=BundleFile.Role.GENERATED_HTML,
        original_name=html_path.name,
        abs_path=html_path,
        rel_path=f"generated/{html_path.name}",
        content_type="text/html",
    )

    pdf_error = ""
    try:
        write_pdf(data, pdf_path)
        _record_file(
            bundle,
            role=BundleFile.Role.GENERATED_PDF,
            original_name=pdf_path.name,
            abs_path=pdf_path,
            rel_path=f"generated/{pdf_path.name}",
            content_type="application/pdf",
        )
        slot = bundle.slot
        if slot.report_id:
            report = slot.report
            with pdf_path.open("rb") as handle:
                if report.report_pdf_file:
                    report.report_pdf_file.delete(save=False)
                report.report_pdf_file.save(f"{wes_id}.pdf", File(handle), save=False)
            report.report_pdf_sha256 = _sha256_file(pdf_path)
            report.report_pdf_url = f"/api/reports/{report.pk}/pdf/"
            report.save(update_fields=["report_pdf_file", "report_pdf_sha256", "report_pdf_url"])
        bundle.pdf_ready = True
        bundle.pdf_error = ""
        bundle.save(update_fields=["pdf_ready", "pdf_error"])
    except Exception as exc:  # noqa: BLE001 — 上传仍应成功，PDF 可稍后重试
        pdf_error = str(exc)
        bundle.pdf_ready = False
        bundle.pdf_error = pdf_error[:2000]
        bundle.save(update_fields=["pdf_ready", "pdf_error"])

    return {
        "html_path": str(html_path),
        "pdf_path": str(pdf_path) if bundle.pdf_ready else "",
        "pdf_ready": bundle.pdf_ready,
        "pdf_error": pdf_error,
    }


@transaction.atomic
def ingest_report_package(
    *,
    upload_id: str,
    node_id: str,
    patient_no: str,
    sample_id: str,
    manifest: dict[str, Any],
    uploaded_files: dict[str, Any],
    patient_name: str = "",
) -> dict[str, Any]:
    patient_no = normalize_patient_no(patient_no)
    sample_id = str(sample_id or "").strip()
    upload_id = str(upload_id or "").strip()
    patient_name = str(patient_name or manifest.get("patient_name") or "").strip()

    if not patient_no:
        raise ValueError("patient_no is required")
    if not SAFE_SAMPLE.fullmatch(sample_id):
        raise ValueError("sample_id must be alphanumeric (plus _ . -)")
    if not SAFE_UPLOAD.fullmatch(upload_id):
        raise ValueError("upload_id must be alphanumeric (plus _ . -)")

    existing = SampleBundle.objects.filter(upload_id=upload_id).select_related("slot").first()
    if existing:
        return package_response(existing, created=False, idempotent=True)

    file_specs = manifest.get("files") if isinstance(manifest.get("files"), list) else []
    declared = {
        str(item.get("name") or ""): item
        for item in file_specs
        if isinstance(item, dict) and item.get("name")
    }
    if not declared and uploaded_files:
        declared = {name: {"name": name, "role": None} for name in uploaded_files}

    if "report.json" not in uploaded_files and not any(
        name.lower() == "report.json" for name in uploaded_files
    ):
        raise ValueError("report.json is required in the package")

    report_key = next(name for name in uploaded_files if name.lower() == "report.json")
    raw_json = uploaded_files[report_key].read()
    uploaded_files[report_key].seek(0)
    try:
        payload = json.loads(raw_json.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("report.json is not valid JSON") from exc
    report_data = ReportData.model_validate(payload)

    # package content hash for idempotency of future identical retries with new upload_id is not needed
    canonical = json.dumps(
        {"upload_id": upload_id, "sample_id": sample_id, "manifest": manifest},
        ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    )
    payload_sha256 = hashlib.sha256(canonical.encode("utf-8") + raw_json).hexdigest()

    patient = _resolve_or_create_patient(patient_no, patient_name)
    portal_report = _ensure_portal_report(patient, patient_no, sample_id, patient_name)
    slot, _ = PatientReportSlot.objects.get_or_create(
        patient_no=patient_no,
        defaults={"patient_name": patient_name, "user": patient, "report": portal_report},
    )
    slot.patient_name = patient_name or slot.patient_name
    slot.user = patient
    slot.report = portal_report
    slot.save(update_fields=["patient_name", "user", "report", "updated_at"])

    wes_report_id = to_wes_report_id(sample_id)
    root = bundle_root() / sample_id / upload_id
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)

    now = timezone.now()
    SampleBundle.objects.filter(
        sample_id=sample_id, status=SampleBundle.Status.ACTIVE,
    ).exclude(upload_id=upload_id).update(
        status=SampleBundle.Status.SUPERSEDED,
        superseded_at=now,
    )

    bundle = SampleBundle.objects.create(
        slot=slot,
        sample_id=sample_id,
        upload_id=upload_id,
        wes_report_id=wes_report_id,
        root_dir=str(root),
        status=SampleBundle.Status.ACTIVE,
        manifest=manifest,
        payload_sha256=payload_sha256,
        node_id=node_id,
    )
    slot.active_bundle = bundle
    slot.save(update_fields=["active_bundle", "updated_at"])

    for name, uploaded in uploaded_files.items():
        if not SAFE_FILENAME.fullmatch(Path(name).name):
            raise ValueError(f"unsafe filename: {name}")
        if uploaded.size and uploaded.size > MAX_FILE_BYTES:
            raise ValueError(f"{name} exceeds {MAX_FILE_BYTES} bytes")
        target = root / Path(name).name
        with target.open("wb") as handle:
            for chunk in uploaded.chunks():
                handle.write(chunk)
        spec = declared.get(name) or declared.get(Path(name).name) or {}
        role = _role_for_name(Path(name).name, spec.get("role"))
        if Path(name).name.lower() == "report.json":
            role = BundleFile.Role.REPORT_JSON
        expected = str(spec.get("sha256") or "").strip().lower()
        actual = _sha256_file(target)
        if expected and expected != actual:
            raise ValueError(f"sha256 mismatch for {name}")
        _record_file(
            bundle,
            role=role,
            original_name=Path(name).name,
            abs_path=target,
            rel_path=Path(name).name,
            content_type=getattr(uploaded, "content_type", "") or "",
        )

    save_report_data(report_data_root(), wes_report_id, report_data)
    active_json = report_data_root() / wes_report_id / "current.json"
    _record_file(
        bundle,
        role=BundleFile.Role.REPORT_JSON,
        original_name="current.json",
        abs_path=active_json,
        rel_path="wes_active/current.json",
        content_type="application/json",
    )

    _sync_portal_variants(portal_report, payload, root)

    outputs = generate_outputs_for_bundle(bundle)
    return package_response(bundle, created=True, idempotent=False, outputs=outputs)


def package_response(
    bundle: SampleBundle,
    *,
    created: bool,
    idempotent: bool,
    outputs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    files = [
        {
            "role": item.role,
            "original_name": item.original_name,
            "rel_path": item.rel_path,
            "abs_path": item.abs_path,
            "sha256": item.sha256,
            "size_bytes": item.size_bytes,
        }
        for item in bundle.files.all()
    ]
    slot = bundle.slot
    return {
        "upload_id": bundle.upload_id,
        "patient_no": slot.patient_no,
        "sample_id": bundle.sample_id,
        "bundle_id": bundle.pk,
        "wes_report_id": bundle.wes_report_id,
        "root_dir": bundle.root_dir,
        "status": bundle.status,
        "created": created,
        "idempotent": idempotent,
        "pdf_ready": bundle.pdf_ready,
        "pdf_error": bundle.pdf_error,
        "report_id": slot.report_id,
        "download_url": f"/api/reports/{slot.report_id}/pdf/" if slot.report_id else "",
        "preview_url": f"/wes/reports/{bundle.wes_report_id}/",
        "edit_url": f"/wes/reports/{bundle.wes_report_id}/edit/",
        "files": files,
        "outputs": outputs or {},
    }


def slot_list_payload() -> list[dict[str, Any]]:
    rows = []
    for slot in PatientReportSlot.objects.select_related(
        "active_bundle", "report", "user",
    ).prefetch_related("bundles"):
        bundle = slot.active_bundle
        rows.append({
            "patient_no": slot.patient_no,
            "patient_name": slot.patient_name,
            "sample_id": bundle.sample_id if bundle else "",
            "wes_report_id": bundle.wes_report_id if bundle else "",
            "upload_id": bundle.upload_id if bundle else "",
            "bundle_status": bundle.status if bundle else "",
            "pdf_ready": bool(bundle and bundle.pdf_ready),
            "pdf_error": bundle.pdf_error if bundle else "",
            "report_id": slot.report_id,
            "report_status": slot.report.status if slot.report_id else "",
            "updated_at": slot.updated_at.isoformat(),
            "preview_url": f"/wes/reports/{bundle.wes_report_id}/" if bundle else "",
            "edit_url": f"/wes/reports/{bundle.wes_report_id}/edit/" if bundle else "",
            "download_url": f"/api/reports/{slot.report_id}/pdf/" if slot.report_id else "",
            "file_count": bundle.files.count() if bundle else 0,
            "bundle_count": slot.bundles.count(),
        })
    return rows
