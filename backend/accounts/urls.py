from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import DevelopmentPasswordResetView, RegisterView, MeView, TrackListView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("password-reset/", DevelopmentPasswordResetView.as_view(), name="password_reset"),
    path("me/", MeView.as_view(), name="me"),
    path("tracks/", TrackListView.as_view(), name="track_list"),
]
