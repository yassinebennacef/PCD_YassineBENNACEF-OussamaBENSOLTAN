from django.urls import path
from .views import (
    CategoryListView,
    ResourceListView, ResourceDetailView, ResourceCreateView,
    ResourceUpdateView, ResourceDeleteView, ResourceValidateView,
    ResourceFileView, ResourceSearchView, SearchSuggestView,
    popular_resources, recent_resources,
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category_list'),
    path('suggest/', SearchSuggestView.as_view(), name='resource_suggest'),
    path('', ResourceListView.as_view(), name='resource_list'),
    path('<int:pk>/', ResourceDetailView.as_view(), name='resource_detail'),
    path('create/', ResourceCreateView.as_view(), name='resource_create'),
    path('<int:pk>/update/', ResourceUpdateView.as_view(), name='resource_update'),
    path('<int:pk>/delete/', ResourceDeleteView.as_view(), name='resource_delete'),
    path('<int:pk>/validate/', ResourceValidateView.as_view(), name='resource_validate'),
    path('<int:pk>/file/', ResourceFileView.as_view(), name='resource_file'),
    path('search/', ResourceSearchView.as_view(), name='resource_search'),
    path('popular/', popular_resources, name='resource_popular'),
    path('recent/', recent_resources, name='resource_recent'),
]