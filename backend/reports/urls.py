from django.urls import path
from .views import (
    ReportDetailView, ReportItemsView, ReportListView,
    report_access_summary, report_pdf_download,
)
from .wes_views import PatientReportSlotListView

urlpatterns = [
    path("", ReportListView.as_view(), name="report_list"),
    path("access-summary/", report_access_summary, name="report_access_summary"),
    path("patient-slots/", PatientReportSlotListView.as_view(), name="patient_report_slots"),
    path("<int:pk>/", ReportDetailView.as_view(), name="report_detail"),
    path("<int:report_id>/pdf/", report_pdf_download, name="report_pdf_download"),
    path("<int:report_id>/items/", ReportItemsView.as_view(), name="report_items"),
]
