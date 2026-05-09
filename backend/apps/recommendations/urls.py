from django.urls import path
from .views import RecommendationsView, RecommendationSectionsView

urlpatterns = [
    path('', RecommendationsView.as_view(), name='recommendations'),
    path('sections/', RecommendationSectionsView.as_view(), name='recommendation_sections'),
]
