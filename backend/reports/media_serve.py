"""Serve WES BAM/BAI (and other report media) with HTTP Range for IGV.js."""
from __future__ import annotations

import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse
from django.views.decorators.http import require_http_methods

SAFE_REL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
ALLOWED_PREFIXES = ("wes_bundles/", "wes_output/", "reports/", "wes_reports/")
ALLOWED_SUFFIXES = (
    ".bam", ".bai", ".cram", ".crai",
    ".pdf", ".png", ".jpg", ".jpeg", ".svg",
    ".json", ".html", ".tsv", ".vcf", ".bed",
)


def _resolve_media(rel: str) -> Path:
    rel = (rel or "").lstrip("/")
    if not rel or ".." in rel.split("/") or not SAFE_REL.match(rel):
        raise Http404("invalid media path")
    if not rel.startswith(ALLOWED_PREFIXES):
        raise Http404("media path not allowed")
    if not rel.lower().endswith(ALLOWED_SUFFIXES):
        raise Http404("file type not allowed")
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / rel).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise Http404("outside media root") from exc
    if not target.is_file():
        raise Http404("file not found")
    return target


def _content_type(path: Path) -> str:
    lower = path.name.lower()
    if lower.endswith(".bam"):
        return "application/octet-stream"
    if lower.endswith(".bai"):
        return "application/octet-stream"
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


@require_http_methods(["GET", "HEAD"])
def serve_media_range(request, path: str):
    """Public media serve with Accept-Ranges (IGV needs Range).

    Production Apache Alias usually handles /media first. This view covers
    local Vite→Gunicorn and any direct Gunicorn access.
    """
    file_path = _resolve_media(path)
    file_size = file_path.stat().st_size
    content_type = _content_type(file_path)
    range_header = request.META.get("HTTP_RANGE", "").strip()

    if request.method == "HEAD":
        response = HttpResponse(content_type=content_type)
        response["Accept-Ranges"] = "bytes"
        response["Content-Length"] = str(file_size)
        response["Cache-Control"] = "private, max-age=300"
        return response

    if not range_header:
        response = FileResponse(file_path.open("rb"), content_type=content_type)
        response["Accept-Ranges"] = "bytes"
        response["Content-Length"] = str(file_size)
        response["Cache-Control"] = "private, max-age=300"
        return response

    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        return HttpResponse(status=416)

    start_s, end_s = match.group(1), match.group(2)
    start = int(start_s) if start_s else 0
    end = int(end_s) if end_s else file_size - 1
    if start >= file_size or end >= file_size or start > end:
        response = HttpResponse(status=416)
        response["Content-Range"] = f"bytes */{file_size}"
        return response

    length = end - start + 1
    with file_path.open("rb") as handle:
        handle.seek(start)
        data = handle.read(length)

    response = HttpResponse(data, status=206, content_type=content_type)
    response["Accept-Ranges"] = "bytes"
    response["Content-Length"] = str(length)
    response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
    response["Cache-Control"] = "private, max-age=300"
    return response
