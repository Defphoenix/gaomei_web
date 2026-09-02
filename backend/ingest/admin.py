from django.contrib import admin
from .models import IngestApiKey, IngestEvent, generate_api_key


@admin.register(IngestApiKey)
class IngestApiKeyAdmin(admin.ModelAdmin):
    list_display = ["name", "key_prefix", "scope", "is_active", "last_used_at", "expires_at", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "key_prefix", "scope"]
    readonly_fields = ["key_prefix", "key_hash", "created_at", "last_used_at"]

    def save_model(self, request, obj, form, change):
        if not change and not obj.key_hash:
            raw, prefix, key_hash = generate_api_key()
            obj.key_prefix = prefix
            obj.key_hash = key_hash
            obj.created_by = request.user
            super().save_model(request, obj, form, change)
            self.message_user(
                request,
                f"API Key 已创建。请立即保存明文（仅显示一次）：{raw}",
            )
        else:
            super().save_model(request, obj, form, change)


@admin.register(IngestEvent)
class IngestEventAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "external_source", "external_id", "report", "api_key", "created_at"]
    list_filter = ["status", "external_source"]
    search_fields = ["external_id", "request_hash", "report__report_number"]
    readonly_fields = [
        "api_key", "report", "external_source", "external_id",
        "request_hash", "status", "error_detail", "created_at",
    ]
