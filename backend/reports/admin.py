from django.contrib import admin
from .models import Patient, Report, ReportAccessLog, ReportAsset, ReportVariant


class ReportAssetInline(admin.TabularInline):
    model = ReportAsset
    extra = 0


class ReportVariantInline(admin.TabularInline):
    model = ReportVariant
    extra = 0
    fields = ["gene", "chromosome", "position", "ref", "alt", "variant_type", "allele_frequency"]


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ["patient_no", "name", "phone", "user", "is_active", "updated_at"]
    search_fields = ["patient_no", "name", "phone", "email", "user__username"]
    list_filter = ["is_active", "sex"]
    autocomplete_fields = ["user"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = [
        "report_number", "patient", "product_code", "report_type",
        "status", "sample_id", "report_date", "released_at",
    ]
    list_filter = ["status", "report_type", "product_code"]
    search_fields = ["report_number", "title", "sample_id", "patient__patient_no", "patient__name"]
    autocomplete_fields = ["patient", "reviewed_by"]
    inlines = [ReportAssetInline, ReportVariantInline]
    readonly_fields = ["created_at", "updated_at", "patient_snapshot"]


@admin.register(ReportAsset)
class ReportAssetAdmin(admin.ModelAdmin):
    list_display = ["id", "report", "asset_type", "name", "storage_backend", "file_size", "created_at"]
    list_filter = ["asset_type", "storage_backend"]
    search_fields = ["name", "file_path", "report__report_number"]
    autocomplete_fields = ["report"]


@admin.register(ReportVariant)
class ReportVariantAdmin(admin.ModelAdmin):
    list_display = ["id", "report", "gene", "chromosome", "position", "variant_type", "allele_frequency"]
    list_filter = ["variant_type"]
    search_fields = ["gene", "chromosome", "report__report_number"]
    autocomplete_fields = ["report"]


@admin.register(ReportAccessLog)
class ReportAccessLogAdmin(admin.ModelAdmin):
    list_display = ["id", "report", "user", "action", "ip_address", "created_at"]
    list_filter = ["action"]
    search_fields = ["report__report_number", "user__username"]
    readonly_fields = ["report", "user", "action", "ip_address", "user_agent", "created_at"]
