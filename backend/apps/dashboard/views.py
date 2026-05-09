from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Sum, Q
from django.db.models.functions import TruncDay, TruncWeek
from django.utils import timezone
from datetime import timedelta
from django.urls import path

from apps.authentication.models import User, StudentProfile, LearningProgress
from apps.resources.models import Resource, Category
from apps.context.models import UserInteraction, NetworkQualityLog
from apps.feedback.models import Rating, Comment, ContentSuggestion


class IsAdmin(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'admin'


class DashboardOverviewView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        now     = timezone.now()
        last_30 = now - timedelta(days=30)
        last_7  = now - timedelta(days=7)

        return Response({
            'users': {
                'total':          User.objects.count(),
                'students':       User.objects.filter(role='student').count(),
                'teachers':       User.objects.filter(role='teacher').count(),
                'new_last_7_days': User.objects.filter(date_joined__gte=last_7).count(),
            },
            'resources': {
                'total':     Resource.objects.filter(is_active=True).count(),
                'validated': Resource.objects.filter(is_active=True, is_validated=True).count(),
                'pending':   Resource.objects.filter(is_active=True, is_validated=False).count(),
                'by_format': list(
                    Resource.objects.filter(is_active=True, is_validated=True)
                    .values('format').annotate(count=Count('id'))
                ),
                'by_level': list(
                    Resource.objects.filter(is_active=True, is_validated=True)
                    .values('level').annotate(count=Count('id'))
                ),
            },
            'interactions': {
                'total_last_30_days': UserInteraction.objects.filter(timestamp__gte=last_30).count(),
                'by_type': list(
                    UserInteraction.objects.filter(timestamp__gte=last_30)
                    .values('event_type').annotate(count=Count('id'))
                ),
            },
            'feedback': {
                'total_ratings':      Rating.objects.count(),
                'avg_rating':         Rating.objects.aggregate(avg=Avg('score'))['avg'] or 0,
                'total_comments':     Comment.objects.count(),
                'suggestions_pending': ContentSuggestion.objects.filter(is_reviewed=False).count(),
            },
        })


class UsageTimelineView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        days        = int(request.query_params.get('days', 30))
        since       = timezone.now() - timedelta(days=days)
        granularity = request.query_params.get('granularity', 'day')
        trunc_fn    = TruncDay if granularity == 'day' else TruncWeek

        data = (
            UserInteraction.objects
            .filter(timestamp__gte=since)
            .annotate(period=trunc_fn('timestamp'))
            .values('period', 'event_type')
            .annotate(count=Count('id'))
            .order_by('period')
        )
        return Response(list(data))


class StudentProfileStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        profiles = StudentProfile.objects.select_related('user').all()

        top_students = list(
            profiles.order_by('-total_time_spent').values(
                'user__username', 'user__first_name', 'user__last_name',
                'level', 'total_time_spent'
            )[:10]
        )
        completion = (
            LearningProgress.objects
            .values('student__student_profile__level')
            .annotate(avg_completion=Avg('completion_percentage'))
        )

        return Response({
            'level_distribution':    list(profiles.values('level').annotate(count=Count('id'))),
            'language_distribution': list(profiles.values('preferred_language').annotate(count=Count('id'))),
            'field_distribution':    list(profiles.exclude(field_of_study='').values('field_of_study').annotate(count=Count('id')).order_by('-count')[:10]),
            'top_students_by_time':  top_students,
            'completion_by_level':   list(completion),
        })


class ResourceStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        base = Resource.objects.filter(is_active=True, is_validated=True)

        top_viewed = list(
            base.order_by('-view_count')
            .values('id', 'title', 'view_count', 'download_count', 'average_rating', 'format', 'level')[:15]
        )
        top_rated = list(
            base.filter(rating_count__gte=3).order_by('-average_rating')
            .values('id', 'title', 'average_rating', 'rating_count', 'format')[:10]
        )
        by_category = list(
            Category.objects.annotate(
                resource_count=Count('resources', filter=Q(resources__is_active=True, resources__is_validated=True)),
                total_views=Sum('resources__view_count'),
            ).values('name', 'resource_count', 'total_views')
        )
        pending = list(
            Resource.objects.filter(is_active=True, is_validated=False)
            .select_related('uploaded_by', 'category')
            .values('id', 'title', 'format', 'level', 'uploaded_by__username', 'created_at')[:20]
        )

        return Response({
            'top_viewed':         top_viewed,
            'top_rated':          top_rated,
            'by_category':        by_category,
            'pending_validation': pending,
        })


class NetworkMonitorView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        since = timezone.now() - timedelta(hours=24)

        timeline = (
            NetworkQualityLog.objects
            .filter(timestamp__gte=since)
            .annotate(period=TruncDay('timestamp'))
            .values('period', 'location_hint')
            .annotate(avg_download=Avg('download_kbps'), avg_latency=Avg('latency_ms'), sample_count=Count('id'))
            .order_by('period')
        )
        summary = NetworkQualityLog.objects.filter(timestamp__gte=since).aggregate(
            avg_download=Avg('download_kbps'),
            avg_latency=Avg('latency_ms'),
            total_samples=Count('id'),
        )

        return Response({'timeline': list(timeline), 'summary': summary})


urlpatterns = [
    path('overview/',  DashboardOverviewView.as_view(),    name='dashboard_overview'),
    path('usage/',     UsageTimelineView.as_view(),        name='dashboard_usage'),
    path('students/',  StudentProfileStatsView.as_view(),  name='dashboard_students'),
    path('resources/', ResourceStatsView.as_view(),        name='dashboard_resources'),
    path('network/',   NetworkMonitorView.as_view(),       name='dashboard_network'),
]
