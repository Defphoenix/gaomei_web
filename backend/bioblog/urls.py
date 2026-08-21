from django.urls import path
from .views import (
    BioCategoryListView, BioTagListView,
    BioPostListView, BioPostDetailView,
    BioPostCreateView, BioPostUpdateView, BioPostDeleteView, BioCommentListCreateView,
)

urlpatterns = [
    path("categories/", BioCategoryListView.as_view(), name="bio_category_list"),
    path("tags/", BioTagListView.as_view(), name="bio_tag_list"),
    path("posts/", BioPostListView.as_view(), name="bio_post_list"),
    path("posts/create/", BioPostCreateView.as_view(), name="bio_post_create"),
    path("posts/<slug:slug>/", BioPostDetailView.as_view(), name="bio_post_detail"),
    path("posts/<slug:slug>/update/", BioPostUpdateView.as_view(), name="bio_post_update"),
    path("posts/<slug:slug>/delete/", BioPostDeleteView.as_view(), name="bio_post_delete"),
    path("posts/<slug:slug>/comments/", BioCommentListCreateView.as_view(), name="bio_post_comments"),
]
