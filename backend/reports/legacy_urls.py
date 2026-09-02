"""Legacy /api/reports/* aliases → V2 handlers (test cutover)."""
from django.urls import path

from .db_browser_views import (
    AccessLogDbView,
    ApiKeyDbView,
    AssetDbDetailView,
    AssetDbView,
    DbBrowserCatalogView,
    IngestEventDbView,
    PatientDbDetailView,
    PatientDbView,
    ReportDbDetailView,
    ReportDbView,
    VariantDbView,
)
from .views_v1 import (
    MeReportListView,
    ReportAccessSummaryView,
    ReportDetailView,
    ReportVariantListView,
)

urlpatterns = [
    path("", MeReportListView.as_view(), name="legacy_report_list"),
    path("access-summary/", ReportAccessSummaryView.as_view(), name="legacy_report_access_summary"),
    path("db-browser/", DbBrowserCatalogView.as_view(), name="legacy_db_browser_catalog"),
    path("db-browser/patients/", PatientDbView.as_view(), name="legacy_db_browser_patients"),
    path("db-browser/patients/<int:pk>/", PatientDbDetailView.as_view(), name="legacy_db_browser_patient_detail"),
    path("db-browser/reports/", ReportDbView.as_view(), name="legacy_db_browser_reports"),
    path("db-browser/reports/<int:pk>/", ReportDbDetailView.as_view(), name="legacy_db_browser_report_detail"),
    path("db-browser/assets/", AssetDbView.as_view(), name="legacy_db_browser_assets"),
    path("db-browser/assets/<int:pk>/", AssetDbDetailView.as_view(), name="legacy_db_browser_asset_detail"),
    path("db-browser/variants/", VariantDbView.as_view(), name="legacy_db_browser_variants"),
    path("db-browser/access-logs/", AccessLogDbView.as_view(), name="legacy_db_browser_access_logs"),
    path("db-browser/ingest-events/", IngestEventDbView.as_view(), name="legacy_db_browser_ingest_events"),
    path("db-browser/api-keys/", ApiKeyDbView.as_view(), name="legacy_db_browser_api_keys"),
    path("<int:pk>/", ReportDetailView.as_view(), name="legacy_report_detail"),
    path("<int:pk>/items/", ReportVariantListView.as_view(), name="legacy_report_items"),
]
