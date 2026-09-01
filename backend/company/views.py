from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompanyInfo, TeamMember, Service, ContactMessage
from .serializers import (
    CompanyInfoSerializer,
    TeamMemberSerializer,
    ServiceSerializer,
    ContactMessageCreateSerializer,
    ContactMessageAdminSerializer,
)


class CompanyInfoView(generics.RetrieveAPIView):
    serializer_class = CompanyInfoSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        return CompanyInfo.objects.first()


class TeamMemberListView(generics.ListAPIView):
    serializer_class = TeamMemberSerializer
    permission_classes = [permissions.AllowAny]
    queryset = TeamMember.objects.filter(is_active=True)
    pagination_class = None


class ServiceListView(generics.ListAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Service.objects.filter(is_active=True)
    pagination_class = None


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        role = getattr(getattr(user, "profile", None), "role", "")
        return role in {"admin", "analyst", "reviewer"}


class ContactMessageCreateView(generics.CreateAPIView):
    """Public leave-a-message endpoint."""
    serializer_class = ContactMessageCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        return Response(
            {"ok": True, "id": message.id, "detail": "留言已提交，我们将尽快电话联系您。"},
            status=status.HTTP_201_CREATED,
        )


class ContactMessageListView(generics.ListAPIView):
    serializer_class = ContactMessageAdminSerializer
    permission_classes = [IsStaffUser]
    pagination_class = None

    def get_queryset(self):
        qs = ContactMessage.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter in {"new", "read", "done"}:
            qs = qs.filter(status=status_filter)
        return qs


class ContactMessageDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ContactMessageAdminSerializer
    permission_classes = [IsStaffUser]
    queryset = ContactMessage.objects.all()


class ContactMessageStatsView(APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        return Response({
            "total": ContactMessage.objects.count(),
            "new": ContactMessage.objects.filter(status="new").count(),
            "read": ContactMessage.objects.filter(status="read").count(),
            "done": ContactMessage.objects.filter(status="done").count(),
        })


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def homepage_data(request):
    """首页聚合数据"""
    from blog.models import Post
    from blog.serializers import PostListSerializer

    company = CompanyInfo.objects.first()
    company_data = CompanyInfoSerializer(company).data if company else None

    services = Service.objects.filter(is_active=True)[:4]
    services_data = ServiceSerializer(services, many=True).data

    team = TeamMember.objects.filter(is_active=True)[:3]
    team_data = TeamMemberSerializer(team, many=True).data

    latest_posts = Post.objects.filter(
        status="published",
        show_on_homepage=True,
    ).order_by("homepage_order", "-published_at")[:3]
    posts_data = PostListSerializer(latest_posts, many=True).data

    return Response({
        "company": company_data,
        "services": services_data,
        "team": team_data,
        "latest_posts": posts_data,
    })
