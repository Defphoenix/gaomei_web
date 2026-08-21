from django.urls import path
from .views import (
    PostListView, PostDetailView, PostCreateView, PostUpdateView, PostDeleteView,
    LatestPostsView, CategoryListView, TagListView,
)

urlpatterns = [
    path("posts/", PostListView.as_view(), name="post_list"),
    path("latest/", LatestPostsView.as_view(), name="latest_posts"),
    path("categories/", CategoryListView.as_view(), name="category_list"),
    path("tags/", TagListView.as_view(), name="tag_list"),
    path("posts/create/", PostCreateView.as_view(), name="post_create"),
    path("posts/<slug:slug>/", PostDetailView.as_view(), name="post_detail"),
    path("posts/<slug:slug>/update/", PostUpdateView.as_view(), name="post_update"),
    path("posts/<slug:slug>/delete/", PostDeleteView.as_view(), name="post_delete"),
]
