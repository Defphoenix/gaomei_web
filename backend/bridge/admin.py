from django.contrib import admin

from .models import (
    BridgeJob, BridgeJobLog, BridgeNode, BridgeProject, BridgeUpload, BridgeUploadRevision,
)


@admin.register(BridgeNode)
class BridgeNodeAdmin(admin.ModelAdmin):
    list_display = ["node_id", "display_name", "status", "software_version", "last_seen_at"]
    search_fields = ["node_id", "display_name"]


@admin.register(BridgeUpload)
class BridgeUploadAdmin(admin.ModelAdmin):
    list_display = ["upload_id", "node", "report", "payload_sha256", "received_at"]
    search_fields = ["upload_id", "report__report_number"]


admin.site.register(BridgeJob)
admin.site.register(BridgeJobLog)
admin.site.register(BridgeProject)
admin.site.register(BridgeUploadRevision)
