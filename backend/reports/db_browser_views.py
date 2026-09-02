"""Portal DB browser — admin-facing CRUD for V2 business tables (no Django Admin required)."""
from __future__ import annotations

from django.contrib.auth.models import User
from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import is_internal_operator, user_role
from .models import Patient, Report, ReportAsset, ReportStatus, ReportVariant, SexChoices


class _BrowserGate(APIView):
    """Internal can read; only admin/staff can write."""

    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not is_internal_operator(request.user):
            self.permission_denied(request)

    def _require_admin(self, request):
        role = user_role(request.user)
        if not (request.user.is_staff or role == "admin" or request.user.is_superuser):
            self.permission_denied(request)


def _patient_row(p: Patient) -> dict:
    meta = p.metadata if isinstance(p.metadata, dict) else {}
    return {
        "id": p.id,
        "patient_no": p.patient_no,
        "name": p.name,
        "sex": p.sex or "",
        "birth_date": p.birth_date.isoformat() if p.birth_date else "",
        "phone": p.phone or "",
        "email": p.email or "",
        "id_card": str(meta.get("id_card") or ""),
        "address": str(meta.get("address") or ""),
        "remarks": str(meta.get("remarks") or ""),
        "username": p.user.username if p.user_id else "",
        "user_id": p.user_id or "",
        "is_active": p.is_active,
        "report_count": p.reports.count(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else "",
        "created_at": p.created_at.isoformat() if p.created_at else "",
    }


def _report_row(r: Report, *, detail: bool = False) -> dict:
    analysis = r.analysis_data if isinstance(r.analysis_data, dict) else {}
    wes_id = str(analysis.get("wes_report_id") or r.sample_id or "")
    row = {
        "id": r.id,
        "report_number": r.report_number,
        "title": r.title or "",
        "patient_id": r.patient_id,
        "patient_no": r.patient.patient_no,
        "patient_name": r.patient.name,
        "patient_username": r.patient.user.username if r.patient.user_id else "",
        "status": r.status,
        "product_code": r.product_code or "",
        "report_type": r.report_type or "",
        "sample_id": r.sample_id or "",
        "tumor_sample_id": r.tumor_sample_id or "",
        "normal_sample_id": r.normal_sample_id or "",
        "wes_report_id": wes_id,
        "genome_build": r.genome_build or "",
        "report_date": r.report_date.isoformat() if r.report_date else "",
        "released_at": r.released_at.isoformat() if r.released_at else "",
        "asset_count": r.assets.count(),
        "variant_count": r.variants.count(),
        "portal_report_url": f"/reports/{r.id}/",
        "portal_igv_url": f"/browser?report={r.id}",
        "preview_url": f"/wes/reports/{wes_id}/" if wes_id else "",
        "updated_at": r.updated_at.isoformat() if r.updated_at else "",
    }
    if detail:
        row["summary"] = r.summary or ""
        row["conclusion"] = r.conclusion or ""
        row["assets"] = [_asset_row(a) for a in r.assets.all()[:50]]
    return row


def _asset_row(a: ReportAsset) -> dict:
    return {
        "id": a.id,
        "report_id": a.report_id,
        "report_number": a.report.report_number,
        "sample_id": a.report.sample_id,
        "asset_type": a.asset_type,
        "name": a.name,
        "file_path": a.file_path or "",
        "external_url": a.external_url or "",
        "sha256": a.sha256 or "",
        "file_size": a.file_size,
        "mime_type": a.mime_type or "",
        "download_url": f"/api/v1/reports/{a.report_id}/assets/{a.id}/download/",
        "created_at": a.created_at.isoformat() if a.created_at else "",
    }


class DbBrowserCatalogView(_BrowserGate):
    def get(self, request):
        return Response({
            "tables": [
                {
                    "key": "users",
                    "label": "用户与权限",
                    "model": "auth.User",
                    "editable": True,
                    "description": "登录账号；可通过 patient_no 绑定受检者",
                },
                {
                    "key": "patients",
                    "label": "患者管理",
                    "model": "reports.Patient",
                    "editable": True,
                    "description": "Patient 台账；可绑定登录用户",
                },
                {
                    "key": "reports",
                    "label": "报告管理",
                    "model": "reports.Report",
                    "editable": True,
                    "description": "报告状态、样本、摘要结论与附件",
                },
                {
                    "key": "assets",
                    "label": "文件管理",
                    "model": "reports.ReportAsset",
                    "editable": True,
                    "description": "PDF/BAM/BAI 等报告附件元数据",
                },
                {
                    "key": "variants",
                    "label": "变异管理",
                    "model": "reports.ReportVariant",
                    "editable": False,
                    "description": "位点索引（只读；完整编辑请走 WES JSON）",
                },
                {
                    "key": "access_logs",
                    "label": "访问日志",
                    "model": "reports.ReportAccessLog",
                    "editable": False,
                    "description": "报告查看与下载审计",
                },
                {
                    "key": "ingest_events",
                    "label": "导入管理",
                    "model": "ingest.IngestEvent",
                    "editable": False,
                    "description": "API Key / 报告包导入审计",
                },
                {
                    "key": "api_keys",
                    "label": "导入 API Key",
                    "model": "ingest.IngestApiKey",
                    "editable": True,
                    "description": "启停 Key；明文仅创建时可见",
                },
            ],
            "notice": "Gomics 后台管理（V2）。admin 可写；analyst/reviewer 只读。",
        })


class PatientDbView(_BrowserGate):
    def get(self, request):
        qs = Patient.objects.select_related("user").order_by("-updated_at")[:500]
        return Response([_patient_row(p) for p in qs])

    @transaction.atomic
    def post(self, request):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        patient_no = str(data.get("patient_no") or "").strip().upper()
        name = str(data.get("name") or "").strip()
        if not patient_no or not name:
            return Response({"detail": "patient_no and name are required"}, status=400)
        if Patient.objects.filter(patient_no=patient_no).exists():
            return Response({"detail": "patient_no already exists"}, status=400)
        sex = str(data.get("sex") or "").strip()
        if sex and sex not in {c.value for c in SexChoices}:
            return Response({"detail": f"sex must be one of {[c.value for c in SexChoices]}"}, status=400)
        patient = Patient.objects.create(
            patient_no=patient_no,
            name=name[:128],
            sex=sex or "",
            phone=str(data.get("phone") or "")[:32],
            email=str(data.get("email") or "")[:254],
            is_active=bool(data.get("is_active", True)),
            metadata={
                "id_card": str(data.get("id_card") or "").strip(),
                "address": str(data.get("address") or "").strip(),
                "remarks": str(data.get("remarks") or "").strip(),
            },
        )
        bd = data.get("birth_date")
        if bd:
            patient.birth_date = parse_date(str(bd)) if isinstance(bd, str) else bd
            patient.save(update_fields=["birth_date"])
        err = self._bind_username(patient, data.get("username"))
        if err:
            return Response({"detail": err}, status=400)
        return Response(_patient_row(patient), status=201)

    @transaction.atomic
    def patch(self, request):
        """PATCH with body.id (also supports /patients/<id>/ via detail view)."""
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        pk = data.get("id")
        if not pk:
            return Response({"detail": "id is required"}, status=400)
        return self._update(int(pk), data)

    def _bind_username(self, patient: Patient, username) -> str:
        username = str(username or "").strip()
        if not username:
            if patient.user_id:
                patient.user = None
                patient.save(update_fields=["user", "updated_at"])
            return ""
        user = User.objects.filter(username=username).first()
        if not user:
            return f"username '{username}' not found"
        other = Patient.objects.filter(user=user).exclude(pk=patient.pk).first()
        if other:
            return f"username already linked to patient {other.patient_no}"
        patient.user = user
        patient.save(update_fields=["user", "updated_at"])
        return ""

    def _update(self, pk: int, data: dict):
        patient = Patient.objects.select_related("user").filter(pk=pk).first()
        if not patient:
            return Response({"detail": "not found"}, status=404)
        fields = []
        if "patient_no" in data:
            new_no = str(data.get("patient_no") or "").strip().upper()
            if not new_no:
                return Response({"detail": "patient_no cannot be empty"}, status=400)
            if Patient.objects.filter(patient_no=new_no).exclude(pk=pk).exists():
                return Response({"detail": "patient_no already exists"}, status=400)
            patient.patient_no = new_no
            fields.append("patient_no")
        for key, attr, cast in [
            ("name", "name", lambda v: str(v or "").strip()[:128]),
            ("phone", "phone", lambda v: str(v or "")[:32]),
            ("email", "email", lambda v: str(v or "")[:254]),
            ("sex", "sex", lambda v: str(v or "").strip()),
        ]:
            if key in data:
                val = cast(data.get(key))
                if key == "sex" and val and val not in {c.value for c in SexChoices}:
                    return Response({"detail": "invalid sex"}, status=400)
                if key == "name" and not val:
                    return Response({"detail": "name cannot be empty"}, status=400)
                setattr(patient, attr, val)
                fields.append(attr)
        if "is_active" in data:
            patient.is_active = bool(data.get("is_active"))
            fields.append("is_active")
        if "birth_date" in data:
            raw = data.get("birth_date")
            patient.birth_date = parse_date(str(raw)) if raw else None
            fields.append("birth_date")
        if any(k in data for k in ("id_card", "address", "remarks")):
            meta = dict(patient.metadata or {})
            for mk in ("id_card", "address", "remarks"):
                if mk in data:
                    meta[mk] = str(data.get(mk) or "").strip()
            patient.metadata = meta
            fields.append("metadata")
        if fields:
            patient.save(update_fields=list(dict.fromkeys(fields + ["updated_at"])))
        if "username" in data:
            err = self._bind_username(patient, data.get("username"))
            if err:
                return Response({"detail": err}, status=400)
        patient.refresh_from_db()
        return Response(_patient_row(patient))


class PatientDbDetailView(_BrowserGate):
    def get(self, request, pk: int):
        patient = Patient.objects.select_related("user").filter(pk=pk).first()
        if not patient:
            return Response({"detail": "not found"}, status=404)
        return Response(_patient_row(patient))

    def patch(self, request, pk: int):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        return PatientDbView()._update(pk, data)

    def delete(self, request, pk: int):
        self._require_admin(request)
        patient = Patient.objects.filter(pk=pk).first()
        if not patient:
            return Response({"detail": "not found"}, status=404)
        if patient.reports.exists():
            return Response(
                {"detail": "patient has reports; reassign or void reports first"},
                status=400,
            )
        patient.delete()
        return Response(status=204)


class ReportDbView(_BrowserGate):
    def get(self, request):
        qs = Report.objects.select_related("patient", "patient__user").order_by("-updated_at")[:500]
        return Response([_report_row(r) for r in qs])

    @transaction.atomic
    def post(self, request):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        patient_no = str(data.get("patient_no") or "").strip().upper()
        report_number = str(data.get("report_number") or "").strip().upper()
        if not patient_no or not report_number:
            return Response({"detail": "patient_no and report_number are required"}, status=400)
        patient = Patient.objects.filter(patient_no=patient_no).first()
        if not patient:
            return Response({"detail": "patient_no not found"}, status=400)
        if Report.objects.filter(report_number=report_number).exists():
            return Response({"detail": "report_number already exists"}, status=400)
        sample_id = str(data.get("sample_id") or "").strip().upper()
        wes_id = str(data.get("wes_report_id") or sample_id).strip()
        status_val = str(data.get("status") or ReportStatus.DRAFT).strip()
        if status_val not in {c.value for c in ReportStatus}:
            return Response({"detail": "invalid status"}, status=400)
        report = Report.objects.create(
            patient=patient,
            report_number=report_number,
            title=str(data.get("title") or "")[:255],
            product_code=str(data.get("product_code") or "")[:64],
            report_type=str(data.get("report_type") or "mutation")[:32],
            sample_id=sample_id[:128],
            tumor_sample_id=str(data.get("tumor_sample_id") or sample_id)[:128],
            normal_sample_id=str(data.get("normal_sample_id") or "")[:128],
            genome_build=str(data.get("genome_build") or "GRCh38")[:32],
            status=status_val,
            analysis_data={"wes_report_id": wes_id} if wes_id else {},
        )
        rd = data.get("report_date")
        if rd:
            report.report_date = parse_date(str(rd)) if isinstance(rd, str) else rd
            report.save(update_fields=["report_date"])
        return Response(_report_row(report), status=201)

    def patch(self, request):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        pk = data.get("id")
        if not pk:
            return Response({"detail": "id is required"}, status=400)
        return self._update(int(pk), data)

    def _update(self, pk: int, data: dict):
        report = Report.objects.select_related("patient", "patient__user").filter(pk=pk).first()
        if not report:
            return Response({"detail": "not found"}, status=404)
        fields = []
        if "patient_no" in data:
            patient_no = str(data.get("patient_no") or "").strip().upper()
            patient = Patient.objects.filter(patient_no=patient_no).first()
            if not patient:
                return Response({"detail": "patient_no not found"}, status=400)
            report.patient = patient
            fields.append("patient")
        if "report_number" in data:
            new_no = str(data.get("report_number") or "").strip().upper()
            if not new_no:
                return Response({"detail": "report_number cannot be empty"}, status=400)
            if Report.objects.filter(report_number=new_no).exclude(pk=pk).exists():
                return Response({"detail": "report_number already exists"}, status=400)
            report.report_number = new_no
            fields.append("report_number")
        if "status" in data:
            status_val = str(data.get("status") or "").strip()
            if status_val not in {c.value for c in ReportStatus}:
                return Response({"detail": "invalid status"}, status=400)
            report.status = status_val
            fields.append("status")
        for key in (
            "title", "product_code", "report_type", "sample_id",
            "tumor_sample_id", "normal_sample_id", "genome_build", "summary", "conclusion",
        ):
            if key in data:
                setattr(report, key, str(data.get(key) or ""))
                fields.append(key)
        if "report_date" in data:
            raw = data.get("report_date")
            report.report_date = parse_date(str(raw)) if raw else None
            fields.append("report_date")
        if "wes_report_id" in data:
            analysis = dict(report.analysis_data or {})
            analysis["wes_report_id"] = str(data.get("wes_report_id") or "").strip()
            report.analysis_data = analysis
            fields.append("analysis_data")
        if fields:
            report.save(update_fields=list(dict.fromkeys(fields + ["updated_at"])))
        report.refresh_from_db()
        return Response(_report_row(report))


class ReportDbDetailView(_BrowserGate):
    def get(self, request, pk: int):
        report = (
            Report.objects.select_related("patient", "patient__user")
            .prefetch_related("assets")
            .filter(pk=pk)
            .first()
        )
        if not report:
            return Response({"detail": "not found"}, status=404)
        return Response(_report_row(report, detail=True))

    def patch(self, request, pk: int):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        return ReportDbView()._update(pk, data)

    def delete(self, request, pk: int):
        self._require_admin(request)
        report = Report.objects.filter(pk=pk).first()
        if not report:
            return Response({"detail": "not found"}, status=404)
        if report.status == ReportStatus.RELEASED:
            return Response({"detail": "void released reports instead of deleting"}, status=400)
        report.delete()
        return Response(status=204)


class AssetDbView(_BrowserGate):
    def get(self, request):
        qs = ReportAsset.objects.select_related("report").order_by("-created_at")[:500]
        return Response([_asset_row(a) for a in qs])

    def patch(self, request):
        self._require_admin(request)
        data = request.data if isinstance(request.data, dict) else {}
        pk = data.get("id")
        if not pk:
            return Response({"detail": "id is required"}, status=400)
        asset = ReportAsset.objects.select_related("report").filter(pk=pk).first()
        if not asset:
            return Response({"detail": "not found"}, status=404)
        for key in ("name", "file_path", "external_url", "mime_type", "asset_type"):
            if key in data:
                setattr(asset, key, str(data.get(key) or ""))
        asset.save()
        return Response(_asset_row(asset))


class AssetDbDetailView(_BrowserGate):
    def patch(self, request, pk: int):
        self._require_admin(request)
        body = request.data if isinstance(request.data, dict) else {}
        asset = ReportAsset.objects.select_related("report").filter(pk=pk).first()
        if not asset:
            return Response({"detail": "not found"}, status=404)
        for key in ("name", "file_path", "external_url", "mime_type", "asset_type"):
            if key in body:
                setattr(asset, key, str(body.get(key) or ""))
        asset.save()
        return Response(_asset_row(asset))

    def delete(self, request, pk: int):
        self._require_admin(request)
        asset = ReportAsset.objects.filter(pk=pk).first()
        if not asset:
            return Response({"detail": "not found"}, status=404)
        asset.delete()
        return Response(status=204)


class VariantDbView(_BrowserGate):
    def get(self, request):
        qs = ReportVariant.objects.select_related("report").order_by("report_id", "chromosome", "position")[:1000]
        return Response([
            {
                "id": v.id,
                "report_id": v.report_id,
                "report_number": v.report.report_number,
                "gene": v.gene,
                "chromosome": v.chromosome,
                "position": v.position,
                "ref": v.ref,
                "alt": v.alt,
                "variant_type": v.variant_type,
                "allele_frequency": v.allele_frequency,
                "consequence": v.consequence,
            }
            for v in qs
        ])


class IngestEventDbView(_BrowserGate):
    def get(self, request):
        from ingest.models import IngestEvent
        qs = IngestEvent.objects.select_related("api_key", "report").order_by("-created_at")[:500]
        return Response([
            {
                "id": e.id,
                "status": e.status,
                "external_source": e.external_source,
                "external_id": e.external_id,
                "report_id": e.report_id or "",
                "report_number": e.report.report_number if e.report_id else "",
                "api_key": e.api_key.name if e.api_key_id else "",
                "error_detail": e.error_detail,
                "created_at": e.created_at.isoformat() if e.created_at else "",
            }
            for e in qs
        ])


class AccessLogDbView(_BrowserGate):
    def get(self, request):
        from .models import ReportAccessLog
        qs = ReportAccessLog.objects.select_related("report", "user").order_by("-created_at")[:500]
        return Response([
            {
                "id": e.id,
                "report_id": e.report_id,
                "report_number": e.report.report_number if e.report_id else "",
                "username": e.user.username if e.user_id else "",
                "action": e.action,
                "ip_address": e.ip_address or "",
                "user_agent": (e.user_agent or "")[:120],
                "created_at": e.created_at.isoformat() if e.created_at else "",
            }
            for e in qs
        ])


class ApiKeyDbView(_BrowserGate):
    def get(self, request):
        from ingest.models import IngestApiKey
        qs = IngestApiKey.objects.order_by("-created_at")[:200]
        return Response([
            {
                "id": k.id,
                "name": k.name,
                "key_prefix": k.key_prefix,
                "scope": k.scope,
                "is_active": k.is_active,
                "last_used_at": k.last_used_at.isoformat() if k.last_used_at else "",
                "expires_at": k.expires_at.isoformat() if k.expires_at else "",
                "created_at": k.created_at.isoformat() if k.created_at else "",
            }
            for k in qs
        ])

    @transaction.atomic
    def post(self, request):
        """Create API key; returns raw_key once."""
        self._require_admin(request)
        from ingest.models import IngestApiKey, generate_api_key
        data = request.data if isinstance(request.data, dict) else {}
        name = str(data.get("name") or "").strip()
        if not name:
            return Response({"detail": "name is required"}, status=400)
        if IngestApiKey.objects.filter(name=name).exists():
            return Response({"detail": "name already exists"}, status=400)
        raw, prefix, key_hash = generate_api_key()
        key = IngestApiKey.objects.create(
            name=name,
            key_prefix=prefix,
            key_hash=key_hash,
            scope=str(data.get("scope") or "wes_package")[:64],
            is_active=bool(data.get("is_active", True)),
            created_by=request.user,
        )
        return Response({
            "id": key.id,
            "name": key.name,
            "key_prefix": key.key_prefix,
            "scope": key.scope,
            "is_active": key.is_active,
            "raw_key": raw,
            "notice": "Save raw_key now; it will not be shown again.",
        }, status=201)

    def patch(self, request):
        self._require_admin(request)
        from ingest.models import IngestApiKey
        data = request.data if isinstance(request.data, dict) else {}
        pk = data.get("id")
        if not pk:
            return Response({"detail": "id is required"}, status=400)
        key = IngestApiKey.objects.filter(pk=pk).first()
        if not key:
            return Response({"detail": "not found"}, status=404)
        if "is_active" in data:
            key.is_active = bool(data.get("is_active"))
        if "scope" in data:
            key.scope = str(data.get("scope") or "")[:64]
        if "name" in data:
            name = str(data.get("name") or "").strip()
            if name and name != key.name:
                if IngestApiKey.objects.filter(name=name).exclude(pk=pk).exists():
                    return Response({"detail": "name already exists"}, status=400)
                key.name = name
        key.save()
        return Response({
            "id": key.id,
            "name": key.name,
            "key_prefix": key.key_prefix,
            "scope": key.scope,
            "is_active": key.is_active,
            "last_used_at": key.last_used_at.isoformat() if key.last_used_at else "",
            "expires_at": key.expires_at.isoformat() if key.expires_at else "",
            "created_at": key.created_at.isoformat() if key.created_at else "",
        })
