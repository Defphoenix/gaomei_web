from django.urls import path

from . import views

app_name = "wes_report"

urlpatterns = [
    path("", views.home, name="home"),
    path("reports/<str:report_id>/", views.report_preview, name="preview"),
    path("reports/<str:report_id>/edit/", views.report_edit, name="edit"),
    path("reports/<str:report_id>/data/", views.report_data, name="data"),
    path("reports/<str:report_id>/render/", views.report_render, name="render"),
    path("reports/<str:report_id>/save/", views.report_save, name="save"),
    path("reports/<str:report_id>/pdf/", views.report_pdf, name="pdf"),
    path("reports/<str:report_id>/pdf/regenerate/", views.report_pdf_regenerate, name="pdf_regenerate"),
    path("reports/<str:report_id>/pdf/upload/", views.report_pdf_upload, name="pdf_upload"),
    path("reports/<str:report_id>/design/<str:page_name>/", views.report_design_page, name="design_page"),
    path("template-source/", views.template_source, name="template_source"),
    path("template-source/raw/", views.template_source_raw, name="template_source_raw"),
]
