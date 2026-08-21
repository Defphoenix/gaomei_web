from django.contrib import admin
from .models import Category, Tag, Post

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "category", "status", "show_on_homepage", "homepage_order", "views", "published_at"]
    list_filter = ["status", "show_on_homepage", "category"]
    list_editable = ["show_on_homepage", "homepage_order"]
    prepopulated_fields = {"slug": ("title",)}

admin.site.register(Category)
admin.site.register(Tag)
