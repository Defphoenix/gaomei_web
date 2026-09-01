from rest_framework import generics, permissions
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404

from .models import BioCategory, BioTag, BioPost, BioComment
from .serializers import (
    BioCategorySerializer, BioTagSerializer,
    BioPostListSerializer, BioPostDetailSerializer, BioPostCreateUpdateSerializer, BioCommentSerializer,
)


def check_bioinfo_access(user):
    """检查是否为生信组成员或管理员"""
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    role = getattr(getattr(user, "profile", None), "role", "customer")
    return role in {"analyst", "reviewer", "admin"} or getattr(getattr(user, "profile", None), "is_bioinfo", False)


class IsBioinfoMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return check_bioinfo_access(request.user)


class BioCategoryListView(generics.ListAPIView):
    serializer_class = BioCategorySerializer
    permission_classes = [IsBioinfoMember]
    queryset = BioCategory.objects.all()
    pagination_class = None


class BioTagListView(generics.ListAPIView):
    serializer_class = BioTagSerializer
    permission_classes = [IsBioinfoMember]
    queryset = BioTag.objects.all()
    pagination_class = None


class BioPostListView(generics.ListAPIView):
    serializer_class = BioPostListSerializer
    permission_classes = [IsBioinfoMember]
    pagination_class = None

    def get_queryset(self):
        qs = BioPost.objects.all()
        # 管理员/生信组成员可查看所有文章（含草稿）
        include_drafts = self.request.query_params.get("include_drafts")
        if include_drafts and self.request.user.is_authenticated and check_bioinfo_access(self.request.user):
            pass
        else:
            qs = qs.filter(status="published")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__slug=tag)
        return qs


class BioPostDetailView(generics.RetrieveAPIView):
    serializer_class = BioPostDetailSerializer
    permission_classes = [IsBioinfoMember]
    lookup_field = "slug"

    def get_queryset(self):
        if self.request.user.is_authenticated and check_bioinfo_access(self.request.user):
            return BioPost.objects.all()
        return BioPost.objects.filter(status="published")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.views += 1
        instance.save(update_fields=["views"])
        return super().retrieve(request, *args, **kwargs)


class BioPostCreateView(generics.CreateAPIView):
    serializer_class = BioPostCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if not check_bioinfo_access(request.user):
            self.permission_denied(request, message="仅生信组成员可创建文章")

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        if post.status == "published" and not post.published_at:
            post.published_at = timezone.now()
            post.save(update_fields=["published_at"])


class BioPostUpdateView(generics.UpdateAPIView):
    serializer_class = BioPostCreateUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "slug"

    def check_permissions(self, request):
        super().check_permissions(request)
        if not check_bioinfo_access(request.user):
            self.permission_denied(request, message="仅生信组成员可编辑文章")

    def get_queryset(self):
        if self.request.user.is_staff:
            return BioPost.objects.all()
        return BioPost.objects.filter(author=self.request.user)


class BioPostDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "slug"

    def check_permissions(self, request):
        super().check_permissions(request)
        if not check_bioinfo_access(request.user):
            self.permission_denied(request, message="仅生信组成员可删除文章")

    def get_queryset(self):
        if self.request.user.is_staff:
            return BioPost.objects.all()
        return BioPost.objects.filter(author=self.request.user)


class BioCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = BioCommentSerializer
    permission_classes = [IsBioinfoMember]

    def get_queryset(self):
        return BioComment.objects.filter(post__slug=self.kwargs["slug"]).select_related("author", "author__profile")

    def perform_create(self, serializer):
        post = get_object_or_404(BioPost, slug=self.kwargs["slug"], status="published")
        serializer.save(author=self.request.user, post=post)
