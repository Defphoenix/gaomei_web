"""Read-only database browser APIs for portal admins / operators."""
from __future__ import annotations

from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BundleFile, PatientReportSlot, Report, SampleBundle


class IsInternalOperator(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        role = getattr(getattr(request.user, "profile", None), "role", "customer")
        return role in {"admin", "analyst", "reviewer"}


class IsPortalAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        role = getattr(getattr(request.user, "profile", None), "role", "customer")
        return role == "admin"


def _limit(request, default: int = 200) -> int:
    try:
        n = int(request.query_params.get("limit") or default)
    except ValueError:
        n = default
    return max(1, min(n, 500))


class DbBrowserCatalogView(APIView):
    """List available tables and edit policy for the portal DB browser."""

    permission_classes = [IsAuthenticated, IsInternalOperator]

    def get(self, request):
        is_admin = IsPortalAdmin().has_permission(request, self)
        tables = [
            {
                "key": "users",
                "label": "用户与权限",
                "model": "auth.User + accounts.UserProfile",
                "editable": is_admin,
                "description": "账号、角色、患者编号关联（仅管理员可增删改）",
            },
            {
                "key": "patient_slots",
                "label": "患者报告台账",
                "model": "reports.PatientReportSlot",
                "editable": False,
                "description": "每个患者编号一行，指向当前报告与 active bundle",
            },
            {
                "key": "sample_bundles",
                "label": "样本报告包",
                "model": "reports.SampleBundle",
                "editable": False,
                "description": "每次上传一个版本目录（active / superseded）",
            },
            {
                "key": "bundle_files",
                "label": "报告包文件路径",
                "model": "reports.BundleFile",
                "editable": False,
                "description": "包内每个文件的路径映射（JSON / BAM / PDF 等）",
            },
            {
                "key": "reports",
                "label": "门户报告",
                "model": "reports.Report",
                "editable": False,
                "description": "患者可见的报告记录与发布状态",
            },
        ]
        return Response({"tables": tables})


class PatientSlotDbView(APIView):
    permission_classes = [IsAuthenticated, IsInternalOperator]

    def get(self, request):
        rows = []
        for slot in PatientReportSlot.objects.select_related(
            "report", "active_bundle", "user",
        ).order_by("-updated_at")[: _limit(request)]:
            bundle = slot.active_bundle
            rows.append({
                "id": slot.id,
                "patient_no": slot.patient_no,
                "patient_name": slot.patient_name,
                "user_id": slot.user_id,
                "username": slot.user.username if slot.user_id else "",
                "report_id": slot.report_id,
                "report_status": slot.report.status if slot.report_id else "",
                "active_bundle_id": slot.active_bundle_id,
                "sample_id": bundle.sample_id if bundle else "",
                "upload_id": bundle.upload_id if bundle else "",
                "root_dir": bundle.root_dir if bundle else "",
                "bundle_status": bundle.status if bundle else "",
                "updated_at": slot.updated_at.isoformat() if slot.updated_at else "",
            })
        return Response(rows)


class SampleBundleDbView(APIView):
    permission_classes = [IsAuthenticated, IsInternalOperator]

    def get(self, request):
        rows = []
        for b in SampleBundle.objects.select_related("slot").order_by("-created_at")[: _limit(request)]:
            rows.append({
                "id": b.id,
                "patient_no": b.slot.patient_no if b.slot_id else "",
                "sample_id": b.sample_id,
                "upload_id": b.upload_id,
                "wes_report_id": b.wes_report_id,
                "status": b.status,
                "root_dir": b.root_dir,
                "pdf_ready": b.pdf_ready,
                "pdf_error": (b.pdf_error or "")[:200],
                "node_id": b.node_id,
                "payload_sha256": b.payload_sha256,
                "created_at": b.created_at.isoformat() if b.created_at else "",
                "superseded_at": b.superseded_at.isoformat() if b.superseded_at else "",
            })
        return Response(rows)


class BundleFileDbView(APIView):
    permission_classes = [IsAuthenticated, IsInternalOperator]

    def get(self, request):
        rows = []
        qs = BundleFile.objects.select_related("bundle", "bundle__slot").order_by("-id")
        sample = str(request.query_params.get("sample_id") or "").strip()
        if sample:
            qs = qs.filter(bundle__sample_id=sample)
        for f in qs[: _limit(request)]:
            rows.append({
                "id": f.id,
                "bundle_id": f.bundle_id,
                "patient_no": f.bundle.slot.patient_no if f.bundle_id and f.bundle.slot_id else "",
                "sample_id": f.bundle.sample_id if f.bundle_id else "",
                "upload_id": f.bundle.upload_id if f.bundle_id else "",
                "role": f.role,
                "original_name": f.original_name,
                "rel_path": f.rel_path,
                "abs_path": f.abs_path,
                "sha256": f.sha256,
                "size_bytes": f.size_bytes,
                "content_type": f.content_type,
                "created_at": f.created_at.isoformat() if f.created_at else "",
            })
        return Response(rows)


class ReportDbView(APIView):
    permission_classes = [IsAuthenticated, IsInternalOperator]

    def get(self, request):
        rows = []
        for r in Report.objects.select_related("user").order_by("-created_at")[: _limit(request)]:
            rows.append({
                "id": r.id,
                "report_number": r.report_number,
                "title": r.title,
                "sample_id": r.sample_id,
                "status": r.status,
                "user_id": r.user_id,
                "username": r.user.username if r.user_id else "",
                "patient_no": (r.patient_info or {}).get("patient_no", ""),
                "patient_name": (r.patient_info or {}).get("name", ""),
                "has_pdf": bool(r.report_pdf_file),
                "pdf_url": r.report_pdf_file.url if r.report_pdf_file else (r.report_pdf_url or ""),
                "reviewed_by": r.reviewed_by,
                "released_at": r.released_at.isoformat() if r.released_at else "",
                "created_at": r.created_at.isoformat() if r.created_at else "",
            })
        return Response(rows)
