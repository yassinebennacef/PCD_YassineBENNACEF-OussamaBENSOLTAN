from django.urls import path
from .models import RateResourceView, ResourceCommentsView, CommentUpdateDeleteView, ContentSuggestionView, ReviewSuggestionView

urlpatterns = [
    path('rate/<int:resource_id>/', RateResourceView.as_view(), name='rate_resource'),
    path('comments/<int:resource_id>/', ResourceCommentsView.as_view(), name='resource_comments'),
    path('comments/edit/<int:pk>/', CommentUpdateDeleteView.as_view(), name='comment_edit'),
    path('suggestions/', ContentSuggestionView.as_view(), name='suggestions'),
    path('suggestions/<int:pk>/review/', ReviewSuggestionView.as_view(), name='review_suggestion'),
]
