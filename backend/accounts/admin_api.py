"""Admin-facing account management APIs (CRUD for portal users)."""
from __future__ import annotations

from typing import Optional

from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

ROLE_CHOICES = {"customer", "analyst", "reviewer", "admin"}


class IsPortalAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        role = getattr(getattr(request.user, "profile", None), "role", "customer")
        return role == "admin"


def _linked_patient_no(user: User) -> str:
    patient = getattr(user, "patient_profile", None)
    return patient.patient_no if patient else ""


def _serialize_user(user: User) -> dict:
    profile = getattr(user, "profile", None)
    role = "admin" if user.is_staff else getattr(profile, "role", "customer")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email or "",
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "role": role,
        "patient_no": _linked_patient_no(user),
        "is_bioinfo": bool(getattr(profile, "is_bioinfo", False)),
        "date_joined": user.date_joined.isoformat() if user.date_joined else "",
        "last_login": user.last_login.isoformat() if user.last_login else "",
    }


class AdminUserListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsPortalAdmin]

    def get(self, request):
        q = str(request.query_params.get("q") or "").strip().lower()
        users = User.objects.select_related("profile", "patient_profile").order_by("-date_joined")
        rows = [_serialize_user(u) for u in users]
        if q:
            rows = [
                r for r in rows
                if q in r["username"].lower()
                or q in r["email"].lower()
                or q in str(r["patient_no"]).lower()
                or q in r["role"].lower()
            ]
        return Response(rows)

    @transaction.atomic
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        username = str(data.get("username") or "").strip()
        password = str(data.get("password") or "")
        email = str(data.get("email") or "").strip()
        role = str(data.get("role") or "customer").strip()
        is_active = bool(data.get("is_active", True))
        is_bioinfo = bool(data.get("is_bioinfo", False))

        if not username:
            return Response({"detail": "username is required"}, status=400)
        if len(password) < 8:
            return Response({"detail": "password must be at least 8 characters"}, status=400)
        if role not in ROLE_CHOICES:
            return Response({"detail": f"role must be one of {sorted(ROLE_CHOICES)}"}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "username already exists"}, status=400)

        user = User.objects.create_user(username=username, email=email, password=password)
        user.is_active = is_active
        user.is_staff = role == "admin"
        user.save(update_fields=["is_active", "is_staff", "email"])
        profile = user.profile
        profile.role = role
        profile.is_bioinfo = is_bioinfo or role in {"admin", "analyst", "reviewer"}
        profile.save(update_fields=["role", "is_bioinfo"])

        # Optional bind existing Patient by patient_no (does not create Patient here)
        patient_no = str(data.get("patient_no") or "").strip().upper()
        if patient_no:
            from reports.models import Patient
            patient = Patient.objects.filter(patient_no=patient_no).first()
            if not patient:
                return Response({"detail": "patient_no not found; create Patient in Admin first"}, status=400)
            if patient.user_id and patient.user_id != user.id:
                return Response({"detail": "patient_no already linked to another user"}, status=400)
            patient.user = user
            patient.save(update_fields=["user", "updated_at"])

        return Response(_serialize_user(user), status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPortalAdmin]

    def get_object(self, pk: int) -> Optional[User]:
        return User.objects.select_related("profile", "patient_profile").filter(pk=pk).first()

    def get(self, request, pk: int):
        user = self.get_object(pk)
        if not user:
            return Response({"detail": "not found"}, status=404)
        return Response(_serialize_user(user))

    @transaction.atomic
    def patch(self, request, pk: int):
        user = self.get_object(pk)
        if not user:
            return Response({"detail": "not found"}, status=404)
        if user.id == request.user.id and (
            request.data.get("is_active") is False
            or str(request.data.get("role") or "") not in {"", "admin"}
        ):
            if request.data.get("is_active") is False:
                return Response({"detail": "cannot deactivate yourself"}, status=400)
            if "role" in request.data and str(request.data.get("role")) != "admin":
                return Response({"detail": "cannot demote yourself"}, status=400)

        data = request.data if isinstance(request.data, dict) else {}
        profile = user.profile
        changed_user = []
        if "email" in data:
            user.email = str(data.get("email") or "").strip()
            changed_user.append("email")
        if "is_active" in data:
            user.is_active = bool(data.get("is_active"))
            changed_user.append("is_active")
        if "password" in data and str(data.get("password") or ""):
            password = str(data.get("password"))
            if len(password) < 8:
                return Response({"detail": "password must be at least 8 characters"}, status=400)
            user.set_password(password)
            changed_user.append("password")
        if "role" in data:
            role = str(data.get("role") or "").strip()
            if role not in ROLE_CHOICES:
                return Response({"detail": f"role must be one of {sorted(ROLE_CHOICES)}"}, status=400)
            profile.role = role
            user.is_staff = role == "admin"
            changed_user.append("is_staff")
            profile.save(update_fields=["role"])
        if "patient_no" in data:
            from reports.models import Patient
            patient_no = str(data.get("patient_no") or "").strip().upper()
            current = getattr(user, "patient_profile", None)
            if not patient_no:
                if current:
                    current.user = None
                    current.save(update_fields=["user", "updated_at"])
            else:
                patient = Patient.objects.filter(patient_no=patient_no).first()
                if not patient:
                    return Response({"detail": "patient_no not found; create Patient in Admin first"}, status=400)
                if patient.user_id and patient.user_id != user.id:
                    return Response({"detail": "patient_no already linked to another user"}, status=400)
                if current and current.id != patient.id:
                    current.user = None
                    current.save(update_fields=["user", "updated_at"])
                patient.user = user
                patient.save(update_fields=["user", "updated_at"])
        if "is_bioinfo" in data:
            profile.is_bioinfo = bool(data.get("is_bioinfo"))
            profile.save(update_fields=["is_bioinfo"])
        if changed_user:
            fields = [f for f in changed_user if f != "password"]
            if fields:
                user.save(update_fields=fields)
            elif "password" in changed_user:
                user.save()
        return Response(_serialize_user(user))

    def delete(self, request, pk: int):
        user = self.get_object(pk)
        if not user:
            return Response({"detail": "not found"}, status=404)
        if user.id == request.user.id:
            return Response({"detail": "cannot delete yourself"}, status=400)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
