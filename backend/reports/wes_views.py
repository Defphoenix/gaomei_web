"""管理员正式报告台账 API。"""
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .wes_auth import is_internal
from .wes_storage import slot_list_payload


class IsInternalRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_internal(request.user))


class PatientReportSlotListView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request):
        return Response(slot_list_payload())
