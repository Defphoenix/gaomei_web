from django.contrib import admin
from .models import BioCategory, BioTag, BioPost, BioComment

admin.site.register(BioCategory)
admin.site.register(BioTag)
admin.site.register(BioComment)

@admin.register(BioPost)
class BioPostAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "status", "is_pinned", "published_at"]
    list_filter = ["status", "is_pinned", "category"]
    search_fields = ["title", "content"]
    prepopulated_fields = {"slug": ("title",)}
from django.contrib import admin

# Register your models here.
