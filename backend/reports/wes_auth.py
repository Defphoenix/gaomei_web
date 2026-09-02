"""JWT / cookie gate for /wes/ HTML editor pages (internal roles; released preview for patients)."""
from __future__ import annotations

from functools import wraps

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponseForbidden, HttpResponseRedirect, Http404
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

COOKIE_NAME = "gaomei_wes_access"
INTERNAL_ROLES = {"admin", "analyst", "reviewer"}


def user_role(user) -> str:
    if not user or not user.is_authenticated:
        return ""
    if user.is_staff:
        return "admin"
    return getattr(getattr(user, "profile", None), "role", "customer") or "customer"


def is_internal(user) -> bool:
    return user_role(user) in INTERNAL_ROLES


def _authenticate_jwt(raw_token: str):
    if not raw_token:
        return None
    authenticator = JWTAuthentication()
    try:
        validated = authenticator.get_validated_token(raw_token)
        return authenticator.get_user(validated)
    except (InvalidToken, TokenError, Exception):
        return None


def resolve_wes_user(request):
    if getattr(request, "user", None) and request.user.is_authenticated:
        return request.user
    raw = (
        request.GET.get("access_token")
        or request.META.get("HTTP_AUTHORIZATION", "").removeprefix("Bearer ").strip()
        or request.COOKIES.get(COOKIE_NAME)
    )
    user = _authenticate_jwt(raw)
    if user:
        request.user = user
    return user or AnonymousUser()


def _patient_may_view_wes(user, report_id: str) -> bool:
    """Customers may open HTML/PDF for their own released reports only."""
    from .models import Report, ReportStatus

    qs = Report.objects.filter(
        status=ReportStatus.RELEASED,
        patient__user=user,
    )
    return qs.filter(
        models_q_wes_id(report_id)
    ).exists()


def models_q_wes_id(report_id: str):
    from django.db.models import Q
    return (
        Q(analysis_data__wes_report_id=report_id)
        | Q(sample_id=report_id)
        | Q(report_number=report_id)
    )


def staff_wes_required(view_func):
    """Internal roles for all WES tools; customers get preview/pdf for own released only."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user = resolve_wes_user(request)
        report_id = kwargs.get("report_id") or ""
        view_name = getattr(view_func, "__name__", "")

        if is_internal(user):
            response = view_func(request, *args, **kwargs)
            token = request.GET.get("access_token")
            if token and hasattr(response, "set_cookie"):
                response.set_cookie(
                    COOKIE_NAME, token, max_age=60 * 60 * 12, httponly=True, samesite="Lax",
                )
            return response

        # Customer: only HTML preview + PDF for own released report
        if user and user.is_authenticated and view_name in {"report_preview", "report_pdf"}:
            if report_id and _patient_may_view_wes(user, report_id):
                return view_func(request, *args, **kwargs)
            raise Http404()

        if not user or not user.is_authenticated:
            return HttpResponseRedirect(f"/login?next={request.get_full_path()}")
        return HttpResponseForbidden("需要内部角色或已发布报告权限才能访问 WES 报告页")

    return wrapper


def wrap_wes_views():
    """Apply auth gate + post-save portal sync for V2 Report rows."""
    from wes_report import views as wes_views

    protected = [
        "home",
        "report_preview",
        "report_edit",
        "report_design_page",
        "report_data",
        "report_render",
        "report_save",
        "report_pdf",
        "report_pdf_regenerate",
        "report_pdf_upload",
        "template_source",
        "template_source_raw",
    ]
    for name in protected:
        view = getattr(wes_views, name)
        if getattr(view, "_gaomei_wes_gated", False):
            continue
        wrapped = staff_wes_required(view)
        wrapped._gaomei_wes_gated = True
        setattr(wes_views, name, wrapped)

    if getattr(wes_views, "_gaomei_wes_save_hooked", False):
        return

    gated_save = wes_views.report_save

    @wraps(gated_save)
    def save_and_refresh(request, report_id: str, *args, **kwargs):
        response = gated_save(request, report_id, *args, **kwargs)
        if getattr(response, "status_code", 500) == 200:
            try:
                import json
                from pathlib import Path

                from django.conf import settings

                from .models import Report, ReportAsset
                from wes_report.services import write_pdf

                payload = json.loads(request.body.decode("utf-8"))
                report = (
                    Report.objects.filter(models_q_wes_id(report_id))
                    .order_by("-updated_at")
                    .first()
                )
                if report:
                    data = report.analysis_data if isinstance(report.analysis_data, dict) else {}
                    data = {**data, **payload} if isinstance(payload, dict) else data
                    data["wes_report_id"] = report_id
                    report.analysis_data = data
                    report.save(update_fields=["analysis_data", "updated_at"])

                    output = Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{report_id}.pdf"
                    output.parent.mkdir(parents=True, exist_ok=True)
                    manual_marker = output.with_name(f"{report_id}.pdf.manual")
                    try:
                        from wes_report.services import load_report_data, current_report_path
                        wes_path = current_report_path(settings.WES_REPORT_DATA_DIR, report_id)
                        # Respect manual PDF override until operator clicks regenerate.
                        if wes_path.exists() and not manual_marker.is_file():
                            write_pdf(load_report_data(wes_path), output)
                            rel = str(output.relative_to(Path(settings.MEDIA_ROOT))) if str(output).startswith(str(settings.MEDIA_ROOT)) else str(output)
                            ReportAsset.objects.update_or_create(
                                report=report,
                                asset_type="pdf",
                                name=f"{report_id}.pdf",
                                defaults={
                                    "storage_backend": "local",
                                    "file_path": rel,
                                    "mime_type": "application/pdf",
                                    "file_size": output.stat().st_size if output.exists() else None,
                                },
                            )
                    except Exception:
                        pass
            except Exception:
                pass
        return response

    save_and_refresh._gaomei_wes_gated = True
    wes_views.report_save = save_and_refresh
    wes_views._gaomei_wes_save_hooked = True
