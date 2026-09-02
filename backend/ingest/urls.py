from django.urls import path

from .views import ReportIngestView, ReportPackageHistoryView, ReportPackageIngestView

urlpatterns = [
    path("reports/", ReportIngestView.as_view(), name="ingest_reports"),
    path("reports/package/", ReportPackageIngestView.as_view(), name="ingest_reports_package"),
    path(
        "reports/<int:pk>/package-history/",
        ReportPackageHistoryView.as_view(),
        name="ingest_report_package_history",
    ),
]
