"""API Key authentication for ingest endpoints."""
from __future__ import annotations

from rest_framework import authentication, exceptions

from .models import IngestApiKey, hash_api_key


class PipelinePrincipal:
    """Non-User principal representing a successful API-key auth."""

    is_authenticated = True
    is_anonymous = False
    is_staff = False
    is_superuser = False
    pk = None
    id = None

    def __str__(self):
        return "ingest-pipeline"


class IngestApiKeyAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        raw = request.headers.get("X-API-Key") or ""
        if not raw:
            auth = authentication.get_authorization_header(request).decode("utf-8")
            if auth.lower().startswith("bearer "):
                raw = auth[7:].strip()
            elif auth.lower().startswith("apikey "):
                raw = auth[7:].strip()
        if not raw:
            return None
        key_hash = hash_api_key(raw)
        api_key = IngestApiKey.objects.filter(key_hash=key_hash, is_active=True).first()
        if not api_key:
            raise exceptions.AuthenticationFailed("invalid_api_key")
        if api_key.is_expired:
            raise exceptions.AuthenticationFailed("api_key_expired")
        api_key.mark_used()
        request.ingest_api_key = api_key
        return (PipelinePrincipal(), api_key)
