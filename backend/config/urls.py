from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from config.media_serve import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/', include('apps.authentication.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Core modules
    path('api/resources/', include('apps.resources.urls')),
    path('api/context/', include('apps.context.urls')),
    path('api/recommendations/', include('apps.recommendations.urls')),
    path('api/feedback/', include('apps.feedback.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/llm/',       include('apps.llm.urls')),
]

if settings.DEBUG:
    # Range-aware media serving so video seeking works for large files
    urlpatterns += [path('media/<path:path>', serve_media)]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
