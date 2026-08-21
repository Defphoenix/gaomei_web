from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone

from .models import Category, Tag, Post
from .serializers import (
    CategorySerializer, TagSerializer,
    PostListSerializer, PostDetailSerializer, PostCreateUpdateSerializer,
)


class PostListView(generics.ListAPIView):
    """已发布文章列表（分页）"""
    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None  # 返回所有，前端自行分页

    def get_queryset(self):
        qs = Post.objects.all()
        # 管理员可以查看包括草稿的所有文章
        include_drafts = self.request.query_params.get("include_drafts")
        if include_drafts and self.request.user.is_authenticated and self.request.user.is_staff:
            pass  # 返回所有文章
        else:
            qs = qs.filter(status="published")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__slug=category)
        tag = self.request.query_params.get("tag")
        if tag:
            qs = qs.filter(tags__slug=tag)
        return qs.order_by("-created_at")


class PostDetailView(generics.RetrieveAPIView):
    """文章详情"""
    serializer_class = PostDetailSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        # 管理员可以查看所有文章（包括草稿）
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return Post.objects.all()
        return Post.objects.filter(status="published")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.views += 1
        instance.save(update_fields=["views"])
        return super().retrieve(request, *args, **kwargs)


class PostCreateView(generics.CreateAPIView):
    """创建文章（管理员）"""
    serializer_class = PostCreateUpdateSerializer
    permission_classes = [permissions.IsAdminUser]

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        if post.status == "published" and not post.published_at:
            post.published_at = timezone.now()
            post.save(update_fields=["published_at"])


class PostUpdateView(generics.UpdateAPIView):
    """更新文章（管理员）"""
    serializer_class = PostCreateUpdateSerializer
    permission_classes = [permissions.IsAdminUser]
    lookup_field = "slug"

    def get_queryset(self):
        return Post.objects.all()


class PostDeleteView(generics.DestroyAPIView):
    """删除文章（管理员）"""
    permission_classes = [permissions.IsAdminUser]
    lookup_field = "slug"

    def get_queryset(self):
        return Post.objects.all()


class LatestPostsView(generics.ListAPIView):
    """管理员选择的首页推荐文章"""
    serializer_class = PostListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Post.objects.filter(status="published", show_on_homepage=True).order_by("homepage_order", "-published_at")[:3]


class CategoryListView(generics.ListAPIView):
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = Category.objects.all()
    pagination_class = None


class TagListView(generics.ListAPIView):
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Tag.objects.all()
    pagination_class = None
