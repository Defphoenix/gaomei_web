from django.contrib import admin
from .models import Report, ReportAccessLog, ReportItem

class ReportItemInline(admin.TabularInline):
    model = ReportItem
    extra = 0

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ["title", "user", "report_type", "sample_id", "report_date"]
    list_filter = ["report_type", "report_date"]
    inlines = [ReportItemInline]


admin.site.register(ReportAccessLog)
