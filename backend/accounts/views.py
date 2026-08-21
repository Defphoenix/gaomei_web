from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings

from .models import GenomicTrack
from .serializers import (
    DevelopmentPasswordResetSerializer,
    RegisterSerializer,
    UserSerializer,
    GenomicTrackSerializer,
)


class RegisterView(generics.CreateAPIView):
    """用户注册"""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    """获取当前用户信息"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class DevelopmentPasswordResetView(APIView):
    """仅供本地开发环境快速重置密码；生产环境必须关闭。"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not settings.DEBUG or not getattr(settings, "ALLOW_INSECURE_PASSWORD_RESET", False):
            return Response(
                {"detail": "快速修改密码仅在本地开发环境开放。"},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = DevelopmentPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "密码已修改，请使用新密码登录。"})


class TrackListView(generics.ListAPIView):
    """获取可用的基因组 track 列表"""
    serializer_class = GenomicTrackSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return GenomicTrack.objects.filter(is_public=True)
