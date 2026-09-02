"""Data V2 report APIs under /api/v1/."""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import build_patient_snapshot, is_internal_operator, user_role, visible_reports_for_user
from .models import Patient, Report, ReportAccessLog, ReportAsset, ReportStatus
from .serializers import (
    PatientSerializer,
    ReportDetailSerializer,
    ReportListSerializer,
)


class MePatientView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        patient = Patient.objects.filter(user=request.user).first()
        if not patient:
            return Response({"patient": None})
        return Response({"patient": PatientSerializer(patient).data})


class MeReportListView(APIView):
    """Customer history: own patient + released only (also works for internal via ACL)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = visible_reports_for_user(request.user).prefetch_related("assets")
        # Customers already filtered to released; internal sees all unless ?mine=1
        mine = str(request.query_params.get("mine") or "").lower() in {"1", "true", "yes"}
        if mine or not is_internal_operator(request.user):
            qs = qs.filter(patient__user=request.user, status=ReportStatus.RELEASED)
        qs = qs.order_by("-report_date", "-released_at", "-created_at")
        return Response(ReportListSerializer(qs, many=True).data)


class ReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        report = visible_reports_for_user(request.user).prefetch_related(
            "assets", "variants",
        ).filter(pk=pk).first()
        if not report:
            raise Http404()
        ReportAccessLog.objects.create(
            report=report,
            user=request.user,
            action=ReportAccessLog.Action.VIEW,
            ip_address=request.META.get("REMOTE_ADDR") or None,
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:500],
        )
        return Response(ReportDetailSerializer(report).data)


class ReportVariantListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        report = visible_reports_for_user(request.user).filter(pk=pk).first()
        if not report:
            raise Http404()
        from .serializers import variant_as_report_item
        return Response([variant_as_report_item(v) for v in report.variants.all()])


class ReportAssetListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        report = visible_reports_for_user(request.user).filter(pk=pk).first()
        if not report:
            raise Http404()
        from .serializers import ReportAssetSerializer
        return Response(ReportAssetSerializer(report.assets.all(), many=True).data)


class ReportAssetDownloadView(APIView):
    """ACL-gated asset download; supports HTTP Range for BAM/BAI (IGV)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, asset_id):
        report = visible_reports_for_user(request.user).filter(pk=pk).first()
        if not report:
            raise Http404()
        asset = report.assets.filter(pk=asset_id).first()
        if not asset:
            raise Http404()
        if asset.external_url:
            from django.shortcuts import redirect
            return redirect(asset.external_url)
        if not asset.file_path:
            raise Http404()
        root = Path(settings.MEDIA_ROOT)
        path = Path(asset.file_path)
        if not path.is_absolute():
            path = root / path
        path = path.resolve()
        try:
            path.relative_to(root.resolve())
        except ValueError as exc:
            raise Http404() from exc
        if not path.is_file():
            raise Http404()
        action = (
            ReportAccessLog.Action.DOWNLOAD_PDF
            if asset.asset_type == "pdf"
            else ReportAccessLog.Action.DOWNLOAD_ASSET
        )
        ReportAccessLog.objects.create(
            report=report,
            user=request.user,
            action=action,
            ip_address=request.META.get("REMOTE_ADDR") or None,
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:500],
        )

        content_type = asset.mime_type or "application/octet-stream"
        file_size = path.stat().st_size
        range_header = (request.META.get("HTTP_RANGE") or "").strip()
        as_attachment = asset.asset_type not in {"bam", "bai", "vcf"}

        if not range_header:
            response = FileResponse(
                path.open("rb"),
                as_attachment=as_attachment,
                filename=asset.name or path.name,
                content_type=content_type,
            )
            response["Accept-Ranges"] = "bytes"
            response["Content-Length"] = str(file_size)
            return response

        import re
        from django.http import HttpResponse

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not match:
            return HttpResponse(status=416)
        start_s, end_s = match.group(1), match.group(2)
        start = int(start_s) if start_s else 0
        end = int(end_s) if end_s else file_size - 1
        if start >= file_size or end >= file_size or start > end:
            resp = HttpResponse(status=416)
            resp["Content-Range"] = f"bytes */{file_size}"
            return resp
        length = end - start + 1
        with path.open("rb") as handle:
            handle.seek(start)
            data = handle.read(length)
        resp = HttpResponse(data, status=206, content_type=content_type)
        resp["Accept-Ranges"] = "bytes"
        resp["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        resp["Content-Length"] = str(length)
        return resp


class ReportReleaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if user_role(request.user) not in {"admin", "reviewer"} and not request.user.is_superuser:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        report = visible_reports_for_user(request.user).select_related("patient").filter(pk=pk).first()
        if not report:
            raise Http404()
        if report.status == ReportStatus.VOID:
            return Response({"detail": "report_void"}, status=status.HTTP_409_CONFLICT)
        if report.status == ReportStatus.RELEASED:
            return Response({"detail": "already_released", "id": report.id})
        report.status = ReportStatus.RELEASED
        report.released_at = timezone.now()
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.patient_snapshot = build_patient_snapshot(report.patient)
        report.save()
        return Response(ReportDetailSerializer(report).data)


class ReportSubmitReviewView(APIView):
    """draft → review (analyst / admin)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if user_role(request.user) not in {"admin", "analyst", "reviewer"} and not request.user.is_superuser:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        report = visible_reports_for_user(request.user).filter(pk=pk).first()
        if not report:
            raise Http404()
        if report.status == ReportStatus.RELEASED:
            return Response({"detail": "already_released"}, status=status.HTTP_409_CONFLICT)
        if report.status == ReportStatus.VOID:
            return Response({"detail": "report_void"}, status=status.HTTP_409_CONFLICT)
        report.status = ReportStatus.REVIEW
        report.save(update_fields=["status", "updated_at"])
        return Response(ReportDetailSerializer(report).data)


class ReportVoidView(APIView):
    """Mark report void (admin / reviewer). Not visible to customers."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if user_role(request.user) not in {"admin", "reviewer"} and not request.user.is_superuser:
            return Response({"detail": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
        report = visible_reports_for_user(request.user).filter(pk=pk).first()
        if not report:
            raise Http404()
        if report.status == ReportStatus.VOID:
            return Response({"detail": "already_void", "id": report.id})
        report.status = ReportStatus.VOID
        report.save(update_fields=["status", "updated_at"])
        return Response(ReportDetailSerializer(report).data)


class ReportAccessSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role = user_role(request.user)
        return Response({
            "count": visible_reports_for_user(request.user).count(),
            "can_view_all": is_internal_operator(request.user),
            "role": role,
        })
