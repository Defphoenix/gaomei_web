"""Report ingest service — upsert Patient + Report + assets/variants."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from reports.models import Patient, Report, ReportAsset, ReportStatus, ReportVariant

from ..models import IngestEvent


class IngestError(Exception):
    def __init__(self, code: str, detail: str = "", http_status: int = 400):
        self.code = code
        self.detail = detail
        self.http_status = http_status
        super().__init__(code)


def _norm_patient_no(value: str) -> str:
    return (value or "").strip().upper()


def _payload_hash(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ReportIngestService:
    def ingest(self, payload: dict[str, Any], api_key) -> tuple[Report, str, int]:
        """
        Returns (report, event_status, http_status).
        event_status in created|updated|unchanged
        """
        if not isinstance(payload, dict):
            raise IngestError("invalid_payload", "JSON object required")

        patient_data = payload.get("patient") or {}
        report_data = payload.get("report") or {}
        if not isinstance(patient_data, dict) or not isinstance(report_data, dict):
            raise IngestError("invalid_payload", "patient and report objects required")

        patient_no = _norm_patient_no(patient_data.get("patient_no") or "")
        report_number = str(report_data.get("report_number") or "").strip()
        sample_id = str(report_data.get("sample_id") or "").strip()

        # Auto-allocate canonical IDs when pipeline omits them
        if not patient_no or not report_number or not sample_id:
            from reports.id_format import allocate_ids

            allocated = allocate_ids(
                patient_no=patient_no,
                report_number=report_number,
                sample_id=sample_id,
            )
            patient_no = patient_no or allocated["patient_no"]
            report_number = report_number or allocated["report_number"]
            sample_id = sample_id or allocated["sample_id"]
            patient_data = {**patient_data, "patient_no": patient_no}
            report_data = {
                **report_data,
                "report_number": report_number,
                "sample_id": sample_id,
            }
        else:
            from reports.id_format import normalize_patient_no, normalize_report_number, normalize_sample_id

            patient_no = normalize_patient_no(patient_no)
            report_number = normalize_report_number(report_number)
            sample_id = normalize_sample_id(sample_id)
            patient_data = {**patient_data, "patient_no": patient_no}
            report_data = {
                **report_data,
                "report_number": report_number,
                "sample_id": sample_id,
            }

        external_source = str(report_data.get("external_source") or api_key.scope or "pipeline").strip()
        external_id = str(report_data.get("external_id") or "").strip()
        req_hash = _payload_hash(payload)

        with transaction.atomic():
            patient = self._upsert_patient(patient_no, patient_data)
            report, action = self._upsert_report(
                patient, report_number, external_source, external_id, report_data, payload,
            )
            self._sync_assets(report, payload.get("assets") or [])
            self._sync_variants(report, payload.get("variants") or [])
            IngestEvent.objects.create(
                api_key=api_key,
                report=report,
                external_source=external_source,
                external_id=external_id,
                request_hash=req_hash,
                status=action,
                error_detail={},
            )

        http = 201 if action == IngestEvent.Status.CREATED else 200
        return report, action, http

    def _upsert_patient(self, patient_no: str, data: dict) -> Patient:
        patient = Patient.objects.filter(patient_no=patient_no).first()
        name = str(data.get("name") or "").strip() or patient_no
        fields = {
            "name": name,
            "sex": str(data.get("sex") or "").strip(),
            "phone": str(data.get("phone") or "").strip(),
            "email": str(data.get("email") or "").strip(),
        }
        bd = data.get("birth_date")
        if bd:
            fields["birth_date"] = parse_date(str(bd)) if isinstance(bd, str) else bd
        if data.get("metadata") and isinstance(data["metadata"], dict):
            fields["metadata"] = data["metadata"]

        if patient is None:
            return Patient.objects.create(patient_no=patient_no, **fields)

        # Identity conflict: same patient_no but strongly different name already set
        incoming_name = name
        if patient.name and incoming_name and patient.name != incoming_name and patient.name != patient_no:
            # allow update if previous name was placeholder (= patient_no)
            if patient.name != patient.patient_no:
                raise IngestError(
                    "patient_identity_conflict",
                    f"patient_no {patient_no} exists as {patient.name!r}",
                    http_status=409,
                )

        for k, v in fields.items():
            if v not in (None, ""):
                setattr(patient, k, v)
        patient.save()
        return patient

    def _upsert_report(
        self,
        patient: Patient,
        report_number: str,
        external_source: str,
        external_id: str,
        report_data: dict,
        payload: dict,
    ) -> tuple[Report, str]:
        by_number = Report.objects.filter(report_number=report_number).select_related("patient").first()
        by_ext = None
        if external_id:
            by_ext = Report.objects.filter(
                external_source=external_source, external_id=external_id,
            ).select_related("patient").first()

        if by_number and by_ext and by_number.id != by_ext.id:
            raise IngestError("report_identity_conflict", "report_number and external_id point to different reports", 409)

        report = by_number or by_ext
        desired = {
            "patient": patient,
            "report_number": report_number,
            "external_source": external_source,
            "external_id": external_id,
            "product_code": str(report_data.get("product_code") or "").strip(),
            "report_type": str(report_data.get("report_type") or "mutation").strip(),
            "title": str(report_data.get("title") or "").strip(),
            "sample_id": str(report_data.get("sample_id") or "").strip(),
            "tumor_sample_id": str(report_data.get("tumor_sample_id") or "").strip(),
            "normal_sample_id": str(report_data.get("normal_sample_id") or "").strip(),
            "genome_build": str(report_data.get("genome_build") or "GRCh38").strip(),
            "summary": str(report_data.get("summary") or ""),
            "conclusion": str(report_data.get("conclusion") or ""),
            "analysis_data": report_data.get("analysis_data")
            if isinstance(report_data.get("analysis_data"), dict)
            else (payload.get("analysis_data") if isinstance(payload.get("analysis_data"), dict) else {}),
            "annotation_sources": report_data.get("annotation_sources")
            if isinstance(report_data.get("annotation_sources"), (dict, list))
            else {},
            "data_schema_version": str(report_data.get("data_schema_version") or "2.0"),
        }
        # Keep WES disk id aligned with sample_id when not explicitly set
        analysis = desired["analysis_data"] if isinstance(desired["analysis_data"], dict) else {}
        analysis = dict(analysis)
        if desired["sample_id"] and not analysis.get("wes_report_id"):
            analysis["wes_report_id"] = desired["sample_id"]
        desired["analysis_data"] = analysis
        rd = report_data.get("report_date")
        if rd:
            desired["report_date"] = parse_date(str(rd)) if isinstance(rd, str) else rd

        if report is None:
            report = Report.objects.create(status=ReportStatus.DRAFT, **desired)
            return report, IngestEvent.Status.CREATED

        if report.patient_id != patient.id:
            raise IngestError("report_patient_conflict", "report already linked to another patient", 409)

        if report.status == ReportStatus.RELEASED:
            # immutable unless identical content hash of key fields
            same = (
                report.title == desired["title"]
                and report.sample_id == desired["sample_id"]
                and report.analysis_data == desired["analysis_data"]
                and report.summary == desired["summary"]
            )
            if same:
                return report, IngestEvent.Status.UNCHANGED
            raise IngestError("released_report_immutable", "released reports cannot be modified", 409)

        changed = False
        for k, v in desired.items():
            if getattr(report, k) != v:
                setattr(report, k, v)
                changed = True
        if changed:
            report.save()
            return report, IngestEvent.Status.UPDATED
        return report, IngestEvent.Status.UNCHANGED

    def _sync_assets(self, report: Report, assets: list) -> None:
        if not isinstance(assets, list):
            return
        for item in assets:
            if not isinstance(item, dict):
                continue
            asset_type = str(item.get("asset_type") or "other").strip()
            name = str(item.get("name") or asset_type).strip()
            ReportAsset.objects.update_or_create(
                report=report,
                asset_type=asset_type,
                name=name,
                defaults={
                    "storage_backend": str(item.get("storage_backend") or "local"),
                    "file_path": str(item.get("file_path") or ""),
                    "external_url": str(item.get("external_url") or ""),
                    "sha256": str(item.get("sha256") or ""),
                    "file_size": item.get("file_size"),
                    "mime_type": str(item.get("mime_type") or ""),
                    "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
                },
            )

    def _sync_variants(self, report: Report, variants: list) -> None:
        if not isinstance(variants, list) or not variants:
            return
        report.variants.all().delete()
        bulk = []
        for item in variants:
            if not isinstance(item, dict):
                continue
            chrom = str(item.get("chromosome") or "").strip()
            pos = item.get("position")
            if not chrom or pos is None:
                continue
            bulk.append(ReportVariant(
                report=report,
                chromosome=chrom,
                position=int(pos),
                ref=str(item.get("ref") or ""),
                alt=str(item.get("alt") or ""),
                gene=str(item.get("gene") or ""),
                variant_type=str(item.get("variant_type") or ""),
                consequence=str(item.get("consequence") or ""),
                allele_frequency=item.get("allele_frequency"),
                data=item.get("data") if isinstance(item.get("data"), dict) else item,
            ))
        if bulk:
            ReportVariant.objects.bulk_create(bulk, batch_size=500)
