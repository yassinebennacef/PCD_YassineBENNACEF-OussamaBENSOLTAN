from django.urls import path
from .views import (
    CustomTokenObtainPairView, RegisterView, MeView,
    LearningProgressListView, LearningProgressUpdateView,
    BookmarkToggleView, BookmarkedResourcesView, VideoStateView,
    ActivityView, CompleteToggleView, list_users,
)

urlpatterns = [
    path('login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('me/', MeView.as_view(), name='auth_me'),

    # Progress tracking
    path('progress/', LearningProgressListView.as_view(), name='progress_list'),
    path('progress/<int:resource_id>/', LearningProgressUpdateView.as_view(), name='progress_update'),
    path('bookmark/<int:resource_id>/', BookmarkToggleView.as_view(), name='bookmark_toggle'),
    path('bookmarks/', BookmarkedResourcesView.as_view(), name='bookmarks_list'),

    # Activity & completion
    path('activity/', ActivityView.as_view(), name='activity'),
    path('complete/<int:resource_id>/', CompleteToggleView.as_view(), name='complete_toggle'),

    path('video-state/<int:resource_id>/', VideoStateView.as_view(), name='video_state'),

    # Admin
    path('users/', list_users, name='admin_users'),
]
