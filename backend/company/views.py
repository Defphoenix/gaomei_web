from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import CompanyInfo, TeamMember, Service
from .serializers import CompanyInfoSerializer, TeamMemberSerializer, ServiceSerializer


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

    team = TeamMember.objects.filter(is_active=True)[:4]
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
