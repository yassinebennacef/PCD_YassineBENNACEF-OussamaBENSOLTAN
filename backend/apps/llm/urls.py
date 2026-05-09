from django.urls import path
from .views import (
    LLMStatusView, SummarizeView, DetailedSummaryView, SimplifyView,
    VariantsView, LearningPathView, SimplerResourceView,
    GenerateVideoView, VideoStatusView,
)

urlpatterns = [
    path('status/',                              LLMStatusView.as_view(),       name='llm_status'),
    path('summarize/<int:resource_id>/',         SummarizeView.as_view(),       name='llm_summarize'),
    path('detailed-summary/<int:resource_id>/',  DetailedSummaryView.as_view(), name='llm_detailed_summary'),
    path('simplify/<int:resource_id>/',          SimplifyView.as_view(),        name='llm_simplify'),
    path('variants/<int:resource_id>/',          VariantsView.as_view(),        name='llm_variants'),
    path('simpler/<int:resource_id>/',           SimplerResourceView.as_view(), name='llm_simpler'),
    path('learning-path/',                       LearningPathView.as_view(),    name='llm_learning_path'),
    path('video/<int:resource_id>/',             VideoStatusView.as_view(),     name='llm_video_status'),
    path('video/<int:resource_id>/generate/',    GenerateVideoView.as_view(),   name='llm_video_generate'),
]
