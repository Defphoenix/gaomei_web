import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, prefix, hash). Raw shown once at creation."""
    raw = "gm_" + secrets.token_urlsafe(32)
    prefix = raw[:12]
    return raw, prefix, hash_api_key(raw)


class IngestApiKey(models.Model):
    name = models.CharField(max_length=128, unique=True)
    key_prefix = models.CharField(max_length=32, db_index=True)
    key_hash = models.CharField(max_length=128, unique=True)
    scope = models.CharField(max_length=64, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ingest_api_keys_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "导入 API Key"
        verbose_name_plural = "导入 API Key"

    def __str__(self):
        return f"{self.name} ({self.key_prefix}…)"

    def mark_used(self):
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at"])

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and self.expires_at <= timezone.now())


class IngestEvent(models.Model):
    class Status(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        UNCHANGED = "unchanged", "Unchanged"
        REJECTED = "rejected", "Rejected"
        FAILED = "failed", "Failed"

    api_key = models.ForeignKey(
        IngestApiKey,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
    )
    report = models.ForeignKey(
        "reports.Report",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ingest_events",
    )
    external_source = models.CharField(max_length=64, blank=True, default="", db_index=True)
    external_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    request_hash = models.CharField(max_length=64, blank=True, default="", db_index=True)
    status = models.CharField(max_length=32, choices=Status.choices, db_index=True)
    error_detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "导入事件"
        verbose_name_plural = "导入事件"
