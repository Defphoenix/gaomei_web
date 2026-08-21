from pathlib import Path

from django.http import FileResponse
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import Report, ReportAccessLog, ReportItem
from .serializers import ReportSerializer, ReportDetailSerializer, ReportItemSerializer


def user_role(user):
    if user.is_staff:
        return "admin"
    return getattr(getattr(user, "profile", None), "role", "customer")


def accessible_reports(user):
    if user_role(user) in {"admin", "analyst", "reviewer"}:
        return Report.objects.select_related("user").all()
    return Report.objects.select_related("user").filter(user=user, status="released")


class ReportListView(generics.ListAPIView):
    """当前用户的报告列表"""
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return accessible_reports(self.request.user)


class ReportDetailView(generics.RetrieveAPIView):
    """报告详情（含变异位点）"""
    serializer_class = ReportDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return accessible_reports(self.request.user)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        report = self.get_object()
        ReportAccessLog.objects.create(
            report=report, user=request.user, action=ReportAccessLog.Action.VIEW,
            ip_address=request.META.get("REMOTE_ADDR") or None,
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
        )
        return response


class ReportItemsView(generics.ListAPIView):
    """报告的变异位点列表"""
    serializer_class = ReportItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReportItem.objects.filter(
            report__in=accessible_reports(self.request.user),
            report_id=self.kwargs["report_id"],
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def report_access_summary(request):
    role = user_role(request.user)
    return Response({
        "count": accessible_reports(request.user).count(),
        "can_view_all": role in {"admin", "analyst", "reviewer"},
        "role": role,
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def report_pdf_download(request, report_id):
    report = accessible_reports(request.user).filter(id=report_id).first()
    if not report or not report.report_pdf_file:
        from rest_framework.exceptions import NotFound
        raise NotFound("PDF report is not available")
    ReportAccessLog.objects.create(
        report=report, user=request.user, action=ReportAccessLog.Action.DOWNLOAD_PDF,
        ip_address=request.META.get("REMOTE_ADDR") or None,
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
    )
    filename = Path(report.report_pdf_file.name).name
    return FileResponse(
        report.report_pdf_file.open("rb"), as_attachment=True,
        filename=filename, content_type="application/pdf",
    )
