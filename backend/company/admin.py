from django.contrib import admin
from .models import CompanyInfo, TeamMember, Service, ContactMessage

admin.site.register(CompanyInfo)
admin.site.register(Service)


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ["name", "position", "is_active", "order"]
    list_editable = ["is_active", "order"]
    search_fields = ["name", "position", "bio", "expertise"]


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "category", "status", "product", "created_at"]
    list_filter = ["status", "category", "created_at"]
    search_fields = ["name", "phone", "content", "product", "admin_note"]
    readonly_fields = ["created_at", "updated_at"]
    list_editable = ["status"]
