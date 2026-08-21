from django.contrib import admin
from .models import (
    BundleFile, PatientReportSlot, Report, ReportAccessLog, ReportItem, SampleBundle,
)


class ReportItemInline(admin.TabularInline):
    model = ReportItem
    extra = 0


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "report_type", "sample_id", "report_date", "status"]
    list_filter = ["report_type", "report_date", "status"]
    inlines = [ReportItemInline]


class BundleFileInline(admin.TabularInline):
    model = BundleFile
    extra = 0
    readonly_fields = ["role", "original_name", "rel_path", "abs_path", "sha256", "size_bytes"]


@admin.register(SampleBundle)
class SampleBundleAdmin(admin.ModelAdmin):
    list_display = ["sample_id", "upload_id", "status", "pdf_ready", "node_id", "created_at"]
    list_filter = ["status", "pdf_ready"]
    search_fields = ["sample_id", "upload_id", "wes_report_id"]
    inlines = [BundleFileInline]


@admin.register(PatientReportSlot)
class PatientReportSlotAdmin(admin.ModelAdmin):
    list_display = ["patient_no", "patient_name", "active_bundle", "report", "updated_at"]
    search_fields = ["patient_no", "patient_name"]


admin.site.register(ReportAccessLog)
admin.site.register(BundleFile)
