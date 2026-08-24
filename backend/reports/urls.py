from django.urls import path
from .views import (
    ReportDetailView, ReportItemsView, ReportListView,
    report_access_summary, report_pdf_download,
)
from .wes_views import PatientReportSlotListView
from .db_browser_views import (
    BundleFileDbView,
    DbBrowserCatalogView,
    PatientSlotDbView,
    ReportDbView,
    SampleBundleDbView,
)

urlpatterns = [
    path("", ReportListView.as_view(), name="report_list"),
    path("access-summary/", report_access_summary, name="report_access_summary"),
    path("patient-slots/", PatientReportSlotListView.as_view(), name="patient_report_slots"),
    path("db-browser/", DbBrowserCatalogView.as_view(), name="db_browser_catalog"),
    path("db-browser/patient-slots/", PatientSlotDbView.as_view(), name="db_browser_patient_slots"),
    path("db-browser/sample-bundles/", SampleBundleDbView.as_view(), name="db_browser_sample_bundles"),
    path("db-browser/bundle-files/", BundleFileDbView.as_view(), name="db_browser_bundle_files"),
    path("db-browser/reports/", ReportDbView.as_view(), name="db_browser_reports"),
    path("<int:pk>/", ReportDetailView.as_view(), name="report_detail"),
    path("<int:report_id>/pdf/", report_pdf_download, name="report_pdf_download"),
    path("<int:report_id>/items/", ReportItemsView.as_view(), name="report_items"),
]
