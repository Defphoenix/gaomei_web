"""V2 WES report package ingest: multipart JSON + BAM/BAI → Patient/Report/ReportAsset.

Replaces the removed SampleBundle / PatientReportSlot / BundleFile path.
Auth is IngestApiKey via X-API-Key.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import date
from pathlib import Path
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from reports.id_format import (
    allocate_ids,
    normalize_patient_no,
    normalize_report_number,
    normalize_sample_id,
)
from reports.models import Patient, Report, ReportAsset, ReportStatus, SexChoices
from reports.wes_portal_sync import sync_portal_from_wes_payload
from wes_report.schemas import ReportData
from wes_report.services import write_html, write_pdf

from ..models import IngestEvent
from .report_ingest import IngestError

SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$")
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$")
MAX_FILE_BYTES = 100 * 1024 * 1024


def to_wes_report_id(sample_id: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (sample_id or "").strip())
    cleaned = cleaned.strip("_") or "sample"
    return cleaned[:100]


def bundle_root() -> Path:
    """Legacy sample_id bundle tree (kept for history / compat)."""
    return Path(settings.WES_BUNDLE_ROOT)


def data_root() -> Path:
    """Canonical per-report data tree: DATA_ROOT/<report.id>/."""
    return Path(settings.DATA_ROOT)


def report_data_dir(report_id: int) -> Path:
    return data_root() / str(int(report_id))


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


def _asset_type_for_name(name: str) -> str:
    lower = name.lower()
    if lower.endswith(".bam") or lower.endswith(".cram"):
        return ReportAsset.AssetType.BAM
    if lower.endswith(".bai") or lower.endswith(".crai"):
        return ReportAsset.AssetType.BAI
    if lower.endswith(".pdf"):
        return ReportAsset.AssetType.PDF
    if lower.endswith(".json"):
        return ReportAsset.AssetType.JSON
    if lower.endswith((".png", ".jpg", ".jpeg", ".svg", ".webp")):
        return ReportAsset.AssetType.IMAGE
    if lower.endswith(".vcf"):
        return ReportAsset.AssetType.VCF
    if lower.endswith(".bed"):
        return ReportAsset.AssetType.BED
    return ReportAsset.AssetType.OTHER


def _rel_to_media(abs_path: Path) -> str:
    root = Path(settings.MEDIA_ROOT).resolve()
    try:
        return abs_path.resolve().relative_to(root).as_posix()
    except ValueError:
        return str(abs_path)


def _upsert_patient(patient_no: str, patient_name: str, sample_payload: dict) -> Patient:
    sex_raw = str(sample_payload.get("sex") or "").strip().lower()
    sex = ""
    if sex_raw in {"male", "m", "男"}:
        sex = SexChoices.MALE
    elif sex_raw in {"female", "f", "女"}:
        sex = SexChoices.FEMALE

    name = (patient_name or sample_payload.get("name") or patient_no).strip()[:128]
    patient, created = Patient.objects.get_or_create(
        patient_no=patient_no,
        defaults={"name": name, "sex": sex or SexChoices.UNKNOWN},
    )
    if not created:
        changed = False
        if name and patient.name != name and (not patient.name or patient.name == patient.patient_no):
            patient.name = name
            changed = True
        if sex and not patient.sex:
            patient.sex = sex
            changed = True
        if changed:
            patient.save()
    return patient


def list_json_history(wes_report_id: str) -> list[dict[str, Any]]:
    """Disk-level history snapshots for current.json (editor + package overwrite)."""
    history_dir = report_data_root() / wes_report_id / "history"
    if not history_dir.is_dir():
        return []
    media_root = Path(settings.MEDIA_ROOT).resolve()
    rows = []
    for path in sorted(history_dir.glob("*.json"), reverse=True):
        try:
            rel = path.resolve().relative_to(media_root).as_posix()
        except ValueError:
            rel = str(path)
        rows.append({
            "filename": path.name,
            "size_bytes": path.stat().st_size,
            "mtime": path.stat().st_mtime,
            "path": rel,
        })
    return rows


def package_history_for_report(report: Report) -> dict[str, Any]:
    wes_id = str((report.analysis_data or {}).get("wes_report_id") or report.sample_id or "")
    events = list(
        IngestEvent.objects.filter(report=report)
        .select_related("api_key")
        .order_by("-created_at")[:50]
    )
    return {
        "report_id": report.id,
        "report_number": report.report_number,
        "sample_id": report.sample_id,
        "wes_report_id": wes_id,
        "status": report.status,
        "json_history": list_json_history(wes_id) if wes_id else [],
        "ingest_events": [
            {
                "id": e.id,
                "status": e.status,
                "external_source": e.external_source,
                "external_id": e.external_id,
                "api_key": e.api_key.name if e.api_key_id else "",
                "created_at": e.created_at.isoformat(),
                "error_detail": e.error_detail,
            }
            for e in events
        ],
        "assets": [
            {
                "id": a.id,
                "asset_type": a.asset_type,
                "name": a.name,
                "file_path": a.file_path,
                "sha256": a.sha256,
                "file_size": a.file_size,
                "download_url": f"/api/v1/reports/{report.id}/assets/{a.id}/download/",
            }
            for a in report.assets.all()
        ],
    }


class PackageIngestService:
    """Multipart clinical_v2 package → disk + V2 Patient/Report/ReportAsset."""

    def ingest(
        self,
        *,
        upload_id: str,
        patient_no: str,
        sample_id: str,
        manifest: dict[str, Any],
        uploaded_files: dict[str, Any],
        patient_name: str = "",
        report_number: str = "",
        node_id: str = "",
        api_key=None,
        force: bool = False,
    ) -> dict[str, Any]:
        upload_id = str(upload_id or "").strip()
        patient_no = normalize_patient_no(patient_no)
        sample_id = normalize_sample_id(sample_id)
        report_number = normalize_report_number(report_number)
        patient_name = str(patient_name or manifest.get("patient_name") or "").strip()
        node_id = str(node_id or "").strip()

        if not SAFE_ID.fullmatch(upload_id):
            raise IngestError("invalid_upload_id", "upload_id must be alphanumeric (plus _ . -)")
        if not patient_no:
            raise IngestError("patient_no_required", "patient_no is required")
        if not SAFE_ID.fullmatch(sample_id):
            raise IngestError("invalid_sample_id", "sample_id must be alphanumeric (plus _ . -)")

        if not report_number:
            allocated = allocate_ids(patient_no=patient_no, sample_id=sample_id, report_number="")
            # keep provided patient/sample; only fill report_number if missing
            report_number = allocated["report_number"]
            # If sample already has a report, reuse its report_number below

        if "report.json" not in uploaded_files and not any(
            name.lower() == "report.json" for name in uploaded_files
        ):
            raise IngestError("report_json_required", "report.json is required in the package")

        report_key = next(name for name in uploaded_files if name.lower() == "report.json")
        raw_json = uploaded_files[report_key].read()
        uploaded_files[report_key].seek(0)
        try:
            payload = json.loads(raw_json.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise IngestError("invalid_report_json", "report.json is not valid JSON") from exc

        try:
            report_data = ReportData.model_validate(payload)
        except Exception as exc:  # noqa: BLE001 — pydantic ValidationError
            raise IngestError("schema_validation_failed", str(exc)) from exc

        # Align disk id with sample_id
        if hasattr(report_data, "sample") and report_data.sample:
            # mutate storage payload sample_id to canonical
            pass
        storage_payload = json.loads(
            json.dumps(
                report_data.model_dump(mode="json", exclude_none=True),
                ensure_ascii=False,
            )
        )
        if isinstance(storage_payload.get("sample"), dict):
            storage_payload["sample"]["sample_id"] = sample_id
        # Keep portal extras from original payload (extra=ignore on ReportData)
        for key in ("portal_variants", "portal_organ_risks", "igv_tracks"):
            if key in payload:
                storage_payload[key] = payload[key]

        external_source = str(
            (api_key.scope if api_key and getattr(api_key, "scope", None) else None)
            or "wes_package"
        ).strip()
        external_id = upload_id
        req_hash = hashlib.sha256(raw_json + upload_id.encode()).hexdigest()

        # Idempotent: same upload_id already ingested
        existing_event = (
            IngestEvent.objects.filter(
                external_source=external_source,
                external_id=external_id,
                status__in=[
                    IngestEvent.Status.CREATED,
                    IngestEvent.Status.UPDATED,
                    IngestEvent.Status.UNCHANGED,
                ],
            )
            .select_related("report", "report__patient")
            .order_by("-created_at")
            .first()
        )
        if existing_event and existing_event.report_id:
            if existing_event.request_hash == req_hash:
                return self._response(
                    existing_event.report,
                    created=False,
                    idempotent=True,
                    action=IngestEvent.Status.UNCHANGED,
                    upload_id=upload_id,
                    wes_report_id=to_wes_report_id(sample_id),
                )
            # same upload_id, different content → conflict unless force on non-released
            if existing_event.report.status == ReportStatus.RELEASED and not force:
                raise IngestError(
                    "upload_id_conflict",
                    "upload_id already used for a released report",
                    409,
                )

        by_sample = (
            Report.objects.filter(sample_id=sample_id)
            .exclude(status=ReportStatus.VOID)
            .select_related("patient")
            .order_by("-updated_at")
            .first()
        )
        if by_sample:
            report_number = by_sample.report_number

        with transaction.atomic():
            sample_info = payload.get("sample") if isinstance(payload.get("sample"), dict) else {}
            patient = _upsert_patient(patient_no, patient_name, sample_info)

            report = Report.objects.filter(report_number=report_number).select_related("patient").first()
            if report is None and by_sample:
                report = by_sample

            if report and report.patient_id != patient.id:
                raise IngestError(
                    "report_patient_conflict",
                    "report already linked to another patient",
                    409,
                )

            if report and report.status == ReportStatus.RELEASED and not force:
                raise IngestError(
                    "released_report_immutable",
                    "released reports cannot be overwritten by package ingest",
                    409,
                )

            action = IngestEvent.Status.CREATED
            wes_report_id = to_wes_report_id(sample_id)

            title = str(
                (payload.get("report") or {}).get("title")
                or f"{patient.name} WES临床报告"
            )[:255]

            analysis_stub = {
                "schema_version": "wes_package_v1",
                "wes_report_id": wes_report_id,
                "last_upload_id": upload_id,
                "node_id": node_id,
            }

            if report is None:
                report = Report.objects.create(
                    patient=patient,
                    report_number=report_number,
                    external_source=external_source,
                    external_id=external_id,
                    product_code="WES_TN",
                    report_type="mutation",
                    title=title,
                    sample_id=sample_id,
                    tumor_sample_id=sample_id,
                    report_date=date.today(),
                    genome_build="GRCh38",
                    status=ReportStatus.REVIEW,
                    summary="已接收正式报告数据包，等待审核发布。",
                    analysis_data=analysis_stub,
                    data_schema_version="2.0",
                )
                action = IngestEvent.Status.CREATED
            else:
                report.external_source = external_source or report.external_source
                report.external_id = external_id
                report.title = title
                report.sample_id = sample_id
                report.tumor_sample_id = sample_id
                report.product_code = report.product_code or "WES_TN"
                if report.status == ReportStatus.DRAFT:
                    report.status = ReportStatus.REVIEW
                report.analysis_data = {
                    **(report.analysis_data or {}),
                    **analysis_stub,
                }
                report.updated_at = timezone.now()
                report.save()
                action = IngestEvent.Status.UPDATED

            # Canonical package dir: DATA_ROOT/<report.id>/
            root = report_data_dir(report.id)
            if root.exists():
                # Keep history/ and prior outputs; clear only package files we will replace
                for child in root.iterdir():
                    if child.name in {"history", "output"}:
                        continue
                    if child.is_file():
                        child.unlink()
                    elif child.is_dir() and child.name.startswith("upload_"):
                        shutil.rmtree(child)
            root.mkdir(parents=True, exist_ok=True)

            # Write package files (json/bam/bai…)
            written: list[Path] = []
            file_specs = manifest.get("files") if isinstance(manifest.get("files"), list) else []
            declared = {
                str(item.get("name") or ""): item
                for item in file_specs
                if isinstance(item, dict) and item.get("name")
            }

            for name, uploaded in uploaded_files.items():
                fname = Path(name).name
                if not SAFE_FILENAME.fullmatch(fname):
                    raise IngestError("unsafe_filename", f"unsafe filename: {fname}")
                if uploaded.size and uploaded.size > MAX_FILE_BYTES:
                    raise IngestError("file_too_large", f"{fname} exceeds {MAX_FILE_BYTES} bytes")
                target = root / fname
                with target.open("wb") as handle:
                    for chunk in uploaded.chunks():
                        handle.write(chunk)
                expected = str((declared.get(name) or declared.get(fname) or {}).get("sha256") or "").strip().lower()
                actual = _sha256_file(target)
                if expected and expected != actual:
                    raise IngestError("sha256_mismatch", f"sha256 mismatch for {fname}")
                written.append(target)

            # Also mirror validated JSON into wes_reports for HTML/PDF renderer / editor
            report_data_aligned = ReportData.model_validate(storage_payload)
            from wes_report.services import report_storage_payload as _compact

            compact = _compact(report_data_aligned)
            for key in ("portal_variants", "portal_organ_risks", "igv_tracks"):
                if key in storage_payload:
                    compact[key] = storage_payload[key]
            # Ensure report.json exists under data/<id>/ even if upload used another name
            report_json_path = root / "report.json"
            report_json_path.write_text(
                json.dumps(compact, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            if report_json_path not in written and not any(p.name == "report.json" for p in written):
                written.append(report_json_path)

            target = report_data_root() / wes_report_id / "current.json"
            target.parent.mkdir(parents=True, exist_ok=True)
            history_dir = target.parent / "history"
            if target.exists():
                history_dir.mkdir(parents=True, exist_ok=True)
                stamp = timezone.now().strftime("%Y%m%d-%H%M%S-%f")
                shutil.copy2(target, history_dir / f"{stamp}.json")
            temporary = target.with_suffix(".json.tmp")
            temporary.write_text(
                json.dumps(compact, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            import os as _os
            _os.replace(temporary, target)

            # Also keep a copy under data/<id>/history when overwriting report.json
            data_history = root / "history"
            if action == IngestEvent.Status.UPDATED:
                data_history.mkdir(parents=True, exist_ok=True)
                stamp = timezone.now().strftime("%Y%m%d-%H%M%S-%f")
                shutil.copy2(report_json_path, data_history / f"{stamp}.json")

            # Store folder hint on report analysis_data
            analysis_stub["data_dir"] = f"data/{report.id}"
            report.analysis_data = {
                **(report.analysis_data or {}),
                **analysis_stub,
            }
            report.save(update_fields=["analysis_data", "updated_at"])

            # Replace package file assets by filename
            names = {p.name for p in written}
            report.assets.filter(name__in=names).delete()
            report.assets.filter(
                asset_type__in=[
                    ReportAsset.AssetType.BAM,
                    ReportAsset.AssetType.BAI,
                    ReportAsset.AssetType.JSON,
                ],
            ).exclude(name__in=names).delete()

            for path in written:
                ReportAsset.objects.create(
                    report=report,
                    asset_type=_asset_type_for_name(path.name),
                    name=path.name,
                    storage_backend="local",
                    file_path=_rel_to_media(path),
                    sha256=_sha256_file(path),
                    file_size=path.stat().st_size,
                    mime_type="application/octet-stream",
                    metadata={
                        "upload_id": upload_id,
                        "role": "package",
                        "data_dir": f"data/{report.id}",
                    },
                )

            # Sync portal analysis + variants (uses BAM paths under report data dir)
            sync_portal_from_wes_payload(
                report,
                storage_payload,
                root,
                wes_report_id=wes_report_id,
            )
            # Re-attach upload markers after sync overwrote analysis_data
            analysis = dict(report.analysis_data or {})
            analysis["last_upload_id"] = upload_id
            analysis["wes_report_id"] = wes_report_id
            analysis["data_dir"] = f"data/{report.id}"
            if node_id:
                analysis["node_id"] = node_id
            report.analysis_data = analysis
            report.save(update_fields=["analysis_data", "updated_at"])

            # Patch variant BAM URLs to ACL download endpoints when possible
            self._bind_variant_bam_urls(report)

            outputs = self._generate_outputs(report, wes_report_id)

            IngestEvent.objects.create(
                api_key=api_key,
                report=report,
                external_source=external_source,
                external_id=external_id,
                request_hash=req_hash,
                status=action,
                error_detail={
                    "upload_id": upload_id,
                    "sample_id": sample_id,
                    "data_dir": f"data/{report.id}",
                    "files": [p.name for p in written],
                    "pdf_ready": outputs.get("pdf_ready"),
                },
            )

            if api_key is not None:
                api_key.mark_used()

        return self._response(
            report,
            created=(action == IngestEvent.Status.CREATED),
            idempotent=False,
            action=action,
            upload_id=upload_id,
            wes_report_id=wes_report_id,
            outputs=outputs,
        )

    def _bind_variant_bam_urls(self, report: Report) -> None:
        bam = report.assets.filter(asset_type=ReportAsset.AssetType.BAM, name__icontains="tumor").first()
        bai = report.assets.filter(asset_type=ReportAsset.AssetType.BAI, name__icontains="tumor").first()
        if not bam:
            bam = report.assets.filter(asset_type=ReportAsset.AssetType.BAM).first()
        if not bai:
            bai = report.assets.filter(asset_type=ReportAsset.AssetType.BAI).first()
        if not bam:
            return
        bam_url = f"/api/v1/reports/{report.id}/assets/{bam.id}/download/"
        bai_url = f"/api/v1/reports/{report.id}/assets/{bai.id}/download/" if bai else ""
        for variant in report.variants.all():
            data = dict(variant.data or {})
            data["bam_track_url"] = bam_url
            if bai_url:
                data["bam_index_url"] = bai_url
            variant.data = data
            variant.save(update_fields=["data"])

    def _generate_outputs(self, report: Report, wes_report_id: str) -> dict[str, Any]:
        from wes_report.services import load_report_data

        json_path = report_data_root() / wes_report_id / "current.json"
        data = load_report_data(json_path)
        html_path = report_output_root() / "html" / f"{wes_report_id}.html"
        pdf_path = report_output_root() / "pdf" / f"{wes_report_id}.pdf"
        write_html(data, html_path)
        pdf_error = ""
        try:
            write_pdf(data, pdf_path)
        except Exception as exc:  # noqa: BLE001
            pdf_error = str(exc)

        if pdf_path.is_file() and not pdf_error:
            # Also place PDF inside the report data folder
            data_pdf = report_data_dir(report.id) / pdf_path.name
            data_pdf.parent.mkdir(parents=True, exist_ok=True)
            try:
                shutil.copy2(pdf_path, data_pdf)
                asset_path = data_pdf
            except OSError:
                asset_path = pdf_path
            ReportAsset.objects.update_or_create(
                report=report,
                asset_type=ReportAsset.AssetType.PDF,
                name=pdf_path.name,
                defaults={
                    "storage_backend": "local",
                    "file_path": _rel_to_media(asset_path),
                    "sha256": _sha256_file(asset_path),
                    "file_size": asset_path.stat().st_size,
                    "mime_type": "application/pdf",
                    "metadata": {
                        "generated": True,
                        "wes_report_id": wes_report_id,
                        "data_dir": f"data/{report.id}",
                    },
                },
            )
        return {
            "html_path": str(html_path) if html_path.is_file() else "",
            "pdf_path": str(pdf_path) if pdf_path.is_file() else "",
            "pdf_ready": bool(pdf_path.is_file() and not pdf_error),
            "pdf_error": pdf_error,
        }

    def _response(
        self,
        report: Report,
        *,
        created: bool,
        idempotent: bool,
        action: str,
        upload_id: str,
        wes_report_id: str,
        outputs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        outputs = outputs or {}
        assets = [
            {
                "id": a.id,
                "asset_type": a.asset_type,
                "name": a.name,
                "file_path": a.file_path,
                "sha256": a.sha256,
                "file_size": a.file_size,
                "download_url": f"/api/v1/reports/{report.id}/assets/{a.id}/download/",
            }
            for a in report.assets.all()
        ]
        return {
            "status": action,
            "created": created,
            "idempotent": idempotent,
            "upload_id": upload_id,
            "patient_no": report.patient.patient_no,
            "patient_id": report.patient_id,
            "patient_bound_user": bool(report.patient.user_id),
            "report_id": report.id,
            "report_number": report.report_number,
            "sample_id": report.sample_id,
            "wes_report_id": wes_report_id,
            "report_status": report.status,
            "pdf_ready": outputs.get("pdf_ready", False),
            "pdf_error": outputs.get("pdf_error", ""),
            "preview_url": f"/wes/reports/{wes_report_id}/",
            "edit_url": f"/wes/reports/{wes_report_id}/edit/",
            "portal_report_url": f"/reports/{report.id}/",
            "history_url": f"/api/v1/ingest/reports/{report.id}/package-history/",
            "download_url": f"/wes/reports/{wes_report_id}/pdf/",
            "assets": assets,
            "json_history_count": len(list_json_history(wes_report_id)),
            "note": (
                "Patient.user may be null until admin binds a login account; "
                "customer sees report only after status=released."
            ),
        }
