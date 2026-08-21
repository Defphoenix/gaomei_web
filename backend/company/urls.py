from django.urls import path
from .views import CompanyInfoView, TeamMemberListView, ServiceListView, homepage_data

urlpatterns = [
    path("info/", CompanyInfoView.as_view(), name="company_info"),
    path("team/", TeamMemberListView.as_view(), name="team_list"),
    path("services/", ServiceListView.as_view(), name="service_list"),
    path("homepage/", homepage_data, name="homepage_data"),
]
