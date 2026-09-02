"""Report visibility helpers — queryset-layer ACL (Data V2)."""
from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser

from .models import Report, ReportStatus


def user_role(user) -> str:
    if not user or not getattr(user, "is_authenticated", False):
        return "anonymous"
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return "admin"
    return getattr(getattr(user, "profile", None), "role", "customer") or "customer"


def is_internal_operator(user) -> bool:
    return user_role(user) in {"admin", "analyst", "reviewer"}


def visible_reports_for_user(user: AbstractBaseUser):
    """Unified report ACL. Customers: own Patient + released only."""
    qs = Report.objects.select_related("patient", "patient__user", "reviewed_by")
    if not user or not getattr(user, "is_authenticated", False):
        return qs.none()
    if getattr(user, "is_superuser", False):
        return qs
    role = user_role(user)
    if role in {"admin", "analyst", "reviewer"}:
        return qs
    return qs.filter(patient__user=user, status=ReportStatus.RELEASED)


def build_patient_snapshot(patient) -> dict:
    return {
        "patient_no": patient.patient_no,
        "name": patient.name,
        "sex": patient.sex,
        "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
        "phone": patient.phone,
        "email": patient.email,
    }
