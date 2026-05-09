from django.urls import path
from .views import NetworkQualityLogView, UserInteractionLogView

urlpatterns = [
    path('network/', NetworkQualityLogView.as_view(), name='context_network'),
    path('interactions/', UserInteractionLogView.as_view(), name='context_interactions'),
]
