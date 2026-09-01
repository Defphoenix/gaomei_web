from django.urls import path
from .views import (
    CompanyInfoView,
    TeamMemberListView,
    ServiceListView,
    homepage_data,
    ContactMessageCreateView,
    ContactMessageListView,
    ContactMessageDetailView,
    ContactMessageStatsView,
)

urlpatterns = [
    path("info/", CompanyInfoView.as_view(), name="company_info"),
    path("team/", TeamMemberListView.as_view(), name="team_list"),
    path("services/", ServiceListView.as_view(), name="service_list"),
    path("homepage/", homepage_data, name="homepage_data"),
    path("messages/", ContactMessageCreateView.as_view(), name="contact_message_create"),
    path("messages/inbox/", ContactMessageListView.as_view(), name="contact_message_inbox"),
    path("messages/stats/", ContactMessageStatsView.as_view(), name="contact_message_stats"),
    path("messages/<int:pk>/", ContactMessageDetailView.as_view(), name="contact_message_detail"),
]
