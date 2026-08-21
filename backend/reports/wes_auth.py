"""JWT / cookie gate for /wes/ HTML editor pages (internal roles only)."""
from __future__ import annotations

from functools import wraps

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponseForbidden, HttpResponseRedirect
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
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if auth.lower().startswith("bearer "):
        user = _authenticate_jwt(auth.split(" ", 1)[1].strip())
        if user:
            return user
    cookie = request.COOKIES.get(COOKIE_NAME, "").strip()
    if cookie:
        user = _authenticate_jwt(cookie)
        if user:
            return user
    token = request.GET.get("access_token", "").strip()
    if token:
        return _authenticate_jwt(token)
    return AnonymousUser()


def staff_wes_required(view_func):
    """Allow admin/analyst/reviewer; strip access_token from URL into HttpOnly cookie."""

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        query_token = request.GET.get("access_token", "").strip()
        user = resolve_wes_user(request)
        request.user = user
        if not is_internal(user):
            return HttpResponseForbidden(
                "需要管理员 / 分析员 / 审核员登录后才能访问正式报告编辑页。",
                content_type="text/plain; charset=utf-8",
            )
        if query_token:
            remaining = request.GET.copy()
            remaining.pop("access_token", None)
            target = request.path
            if remaining:
                target = f"{request.path}?{remaining.urlencode()}"
            response = HttpResponseRedirect(target)
            response.set_cookie(
                COOKIE_NAME,
                query_token,
                httponly=True,
                samesite="Lax",
                secure=request.is_secure(),
                max_age=60 * 60 * 8,
                path="/",
            )
            return response
        return view_func(request, *args, **kwargs)

    return wrapper


def wrap_wes_views():
    """Apply staff gate + post-save PDF refresh to wes_report views."""
    from wes_report import views as wes_views

    if getattr(wes_views, "_gaomei_wes_wrapped", False):
        return

    protected = [
        "home",
        "report_preview",
        "report_edit",
        "report_design_page",
        "report_data",
        "report_render",
        "report_save",
        "report_pdf",
        "template_source",
        "template_source_raw",
    ]
    for name in protected:
        setattr(wes_views, name, staff_wes_required(getattr(wes_views, name)))

    gated_save = wes_views.report_save

    @wraps(gated_save)
    def save_and_refresh(request, report_id: str, *args, **kwargs):
        response = gated_save(request, report_id, *args, **kwargs)
        if getattr(response, "status_code", 500) == 200:
            try:
                from .models import SampleBundle
                from .wes_storage import generate_outputs_for_bundle

                bundle = (
                    SampleBundle.objects.filter(
                        wes_report_id=report_id, status=SampleBundle.Status.ACTIVE,
                    )
                    .order_by("-created_at")
                    .first()
                )
                if bundle:
                    generate_outputs_for_bundle(bundle)
            except Exception:
                pass
        return response

    wes_views.report_save = save_and_refresh
    wes_views._gaomei_wes_wrapped = True
