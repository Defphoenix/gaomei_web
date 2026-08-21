from django.urls import path

from .views import (
    ClaimJobView, HeartbeatView, InternalJobCancelView, InternalJobDetailView,
    InternalJobListCreateView, InternalJobLogsView, NodeJobControlView,
    NodeJobLogsView, NodeJobStatusView, RegisterNodeView, ReportImportView,
    ReportPackageUploadView, ReportPdfUploadView, InternalProjectListCreateView,
    InternalProjectTemplateView, InternalProjectImportView, InternalProjectRunView,
    NodeProjectSyncView,
)


urlpatterns = [
    path("register/", RegisterNodeView.as_view(), name="bridge_register"),
    path("heartbeat/", HeartbeatView.as_view(), name="bridge_heartbeat"),
    path("projects/", InternalProjectListCreateView.as_view(), name="bridge_projects"),
    path("projects/template.csv", InternalProjectTemplateView.as_view(), name="bridge_project_template"),
    path("projects/import/", InternalProjectImportView.as_view(), name="bridge_project_import"),
    path("projects/<uuid:project_id>/run/", InternalProjectRunView.as_view(), name="bridge_project_run"),
    path("node/projects/sync/", NodeProjectSyncView.as_view(), name="bridge_project_sync"),
    path("reports/import/", ReportImportView.as_view(), name="bridge_report_import"),
    path("reports/package/", ReportPackageUploadView.as_view(), name="bridge_report_package"),
    path("reports/<str:upload_id>/pdf/", ReportPdfUploadView.as_view(), name="bridge_report_pdf"),
    path("jobs/", InternalJobListCreateView.as_view(), name="bridge_jobs"),
    path("jobs/<uuid:job_id>/", InternalJobDetailView.as_view(), name="bridge_job_detail"),
    path("jobs/<uuid:job_id>/logs/", InternalJobLogsView.as_view(), name="bridge_job_logs"),
    path("jobs/<uuid:job_id>/cancel/", InternalJobCancelView.as_view(), name="bridge_job_cancel"),
    path("node/jobs/claim/", ClaimJobView.as_view(), name="bridge_job_claim"),
    path("node/jobs/<uuid:job_id>/status/", NodeJobStatusView.as_view(), name="bridge_job_status"),
    path("node/jobs/<uuid:job_id>/logs/", NodeJobLogsView.as_view(), name="bridge_job_node_logs"),
    path("node/jobs/<uuid:job_id>/control/", NodeJobControlView.as_view(), name="bridge_job_control"),
]
