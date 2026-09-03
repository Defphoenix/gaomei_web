from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.access import is_internal_operator, visible_reports_for_user
from reports.serializers import ReportDetailSerializer

from .authentication import IngestApiKeyAuthentication
from .models import IngestEvent
from .services.package_ingest import PackageIngestService, package_history_for_report
from .services.report_ingest import IngestError, ReportIngestService


class HasIngestApiKey:
    """Permission: request authenticated via IngestApiKeyAuthentication."""

    def has_permission(self, request, view):
        return getattr(request, "ingest_api_key", None) is not None


class ReportIngestView(APIView):
    authentication_classes = [IngestApiKeyAuthentication]
    permission_classes = [HasIngestApiKey]

    def post(self, request):
        api_key = request.ingest_api_key
        payload = request.data if isinstance(request.data, dict) else {}
        try:
            report, action, http_status = ReportIngestService().ingest(payload, api_key)
        except IngestError as exc:
            IngestEvent.objects.create(
                api_key=api_key,
                report=None,
                external_source=str((payload.get("report") or {}).get("external_source") or ""),
                external_id=str((payload.get("report") or {}).get("external_id") or ""),
                status=IngestEvent.Status.REJECTED if exc.http_status < 500 else IngestEvent.Status.FAILED,
                error_detail={"code": exc.code, "detail": exc.detail},
            )
            return Response(
                {"error": {"code": exc.code, "detail": exc.detail}},
                status=exc.http_status,
            )
        return Response(
            {
                "status": action,
                "report": ReportDetailSerializer(report).data,
            },
            status=http_status,
        )


class ReportPackageIngestView(APIView):
    """Multipart WES package: report.json + BAM/BAI (+ optional assets).

    Auth: X-API-Key (IngestApiKey).
    Form fields: upload_id, patient_no, sample_id, patient_name?, report_number?,
                 node_id?, manifest (JSON), force?, files[]
    """

    authentication_classes = [IngestApiKeyAuthentication]
    permission_classes = [HasIngestApiKey]

    def post(self, request):
        api_key = request.ingest_api_key
        upload_id = str(request.data.get("upload_id") or "").strip()
        patient_no = str(request.data.get("patient_no") or "").strip()
        sample_id = str(request.data.get("sample_id") or "").strip()
        patient_name = str(request.data.get("patient_name") or "").strip()
        report_number = str(request.data.get("report_number") or "").strip()
        product_code = str(request.data.get("product_code") or "").strip()
        node_id = str(request.data.get("node_id") or "").strip()
        force = str(request.data.get("force") or "").strip().lower() in {"1", "true", "yes"}

        raw_manifest = request.data.get("manifest") or "{}"
        if isinstance(raw_manifest, (bytes, bytearray)):
            raw_manifest = raw_manifest.decode("utf-8")
        if isinstance(raw_manifest, str):
            import json
            try:
                manifest = json.loads(raw_manifest)
            except json.JSONDecodeError:
                return Response(
                    {"error": {"code": "invalid_manifest", "detail": "manifest must be valid JSON"}},
                    status=400,
                )
        elif isinstance(raw_manifest, dict):
            manifest = raw_manifest
        else:
            return Response(
                {"error": {"code": "invalid_manifest", "detail": "manifest must be a JSON object"}},
                status=400,
            )

        uploaded_files = {}
        for key, uploaded in request.FILES.items():
            uploaded_files[uploaded.name or key] = uploaded
        for uploaded in request.FILES.getlist("files"):
            uploaded_files[uploaded.name] = uploaded

        if not uploaded_files:
            return Response(
                {"error": {"code": "files_required", "detail": "at least one file is required"}},
                status=400,
            )

        try:
            result = PackageIngestService().ingest(
                upload_id=upload_id,
                patient_no=patient_no,
                sample_id=sample_id,
                manifest=manifest if isinstance(manifest, dict) else {},
                uploaded_files=uploaded_files,
                patient_name=patient_name,
                report_number=report_number,
                product_code=product_code,
                node_id=node_id,
                api_key=api_key,
                force=force,
            )
        except IngestError as exc:
            IngestEvent.objects.create(
                api_key=api_key,
                report=None,
                external_source=getattr(api_key, "scope", "") or "wes_package",
                external_id=upload_id,
                status=IngestEvent.Status.REJECTED if exc.http_status < 500 else IngestEvent.Status.FAILED,
                error_detail={"code": exc.code, "detail": exc.detail},
            )
            return Response(
                {"error": {"code": exc.code, "detail": exc.detail}},
                status=exc.http_status,
            )
        except Exception as exc:  # noqa: BLE001
            IngestEvent.objects.create(
                api_key=api_key,
                report=None,
                external_source=getattr(api_key, "scope", "") or "wes_package",
                external_id=upload_id,
                status=IngestEvent.Status.FAILED,
                error_detail={"code": "package_ingest_failed", "detail": str(exc)},
            )
            return Response(
                {"error": {"code": "package_ingest_failed", "detail": str(exc)}},
                status=500,
            )

        code = status.HTTP_200_OK if result.get("idempotent") or not result.get("created") else status.HTTP_201_CREATED
        return Response(result, status=code)


class ReportPackageHistoryView(APIView):
    """JSON history + ingest events + assets for a report (internal or owner ACL)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        report = visible_reports_for_user(request.user).select_related("patient").filter(pk=pk).first()
        if not report:
            if is_internal_operator(request.user):
                from reports.models import Report
                report = Report.objects.filter(pk=pk).select_related("patient").first()
            if not report:
                return Response({"detail": "Not found"}, status=404)
        return Response(package_history_for_report(report))
