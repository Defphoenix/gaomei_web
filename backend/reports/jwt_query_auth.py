"""JWT auth that also accepts ?access_token= for browser <a href> downloads."""
from __future__ import annotations

from rest_framework_simplejwt.authentication import JWTAuthentication


class BearerOrQueryJWTAuthentication(JWTAuthentication):
    """Prefer Authorization header; fall back to access_token query (asset downloads)."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw = ""
        try:
            raw = str(request.query_params.get("access_token") or "").strip()
        except Exception:
            raw = str(getattr(request, "GET", {}).get("access_token") or "").strip()
        if not raw:
            return None
        validated_token = self.get_validated_token(raw)
        return self.get_user(validated_token), validated_token
