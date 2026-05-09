from django.urls import path
from .views import (
    DashboardOverviewView, UsageTimelineView,
    StudentProfileStatsView, ResourceStatsView, NetworkMonitorView,
)

urlpatterns = [
    path('overview/', DashboardOverviewView.as_view(), name='dashboard_overview'),
    path('usage/', UsageTimelineView.as_view(), name='dashboard_usage'),
    path('students/', StudentProfileStatsView.as_view(), name='dashboard_students'),
    path('resources/', ResourceStatsView.as_view(), name='dashboard_resources'),
    path('network/', NetworkMonitorView.as_view(), name='dashboard_network'),
]
