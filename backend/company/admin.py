from django.contrib import admin
from .models import CompanyInfo, TeamMember, Service

admin.site.register(CompanyInfo)
admin.site.register(Service)


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ["name", "position", "is_active", "order"]
    list_editable = ["is_active", "order"]
    search_fields = ["name", "position", "bio", "expertise"]
