from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from reports.media_serve import serve_media_range
from reports.wes_auth import wrap_wes_views

wrap_wes_views()

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/v1/", include("reports.urls")),
    path("api/v1/ingest/", include("ingest.urls")),
    # Temporary aliases so existing frontend keeps working during cutover
    path("api/reports/", include("reports.legacy_urls")),
    path("api/blog/", include("blog.urls")),
    path("api/bioblog/", include("bioblog.urls")),
    path("api/company/", include("company.urls")),
    path("wes/", include("wes_report.urls")),
    path("media/<path:path>", serve_media_range, name="media_range"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
