from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from django.shortcuts import get_object_or_404

from .models import User, StudentProfile, TeacherProfile, LearningProgress
from .serializers import (
    CustomTokenObtainPairSerializer, RegisterSerializer,
    UserSerializer, StudentProfileSerializer, TeacherProfileSerializer,
    LearningProgressSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT login — returns access + refresh tokens with embedded role."""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """Public registration endpoint."""
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {'message': 'Compte créé avec succès.', 'username': user.username},
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    """Return the authenticated user's profile."""

    def get(self, request):
        user_data = UserSerializer(request.user).data
        profile_data = {}

        if request.user.role == 'student':
            profile, _ = StudentProfile.objects.get_or_create(user=request.user)
            profile_data = StudentProfileSerializer(profile).data
        elif request.user.role == 'teacher':
            profile, _ = TeacherProfile.objects.get_or_create(user=request.user)
            profile_data = TeacherProfileSerializer(profile).data

        return Response({'user': user_data, 'profile': profile_data})

    def patch(self, request):
        """Update user + profile in one call."""
        user = request.user
        user_serializer = UserSerializer(user, data=request.data, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user_serializer.save()

        if user.role == 'student':
            profile, _ = StudentProfile.objects.get_or_create(user=user)
            profile_serializer = StudentProfileSerializer(profile, data=request.data, partial=True)
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

        elif user.role == 'teacher':
            profile, _ = TeacherProfile.objects.get_or_create(user=user)
            profile_serializer = TeacherProfileSerializer(profile, data=request.data, partial=True)
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

        return Response({'message': 'Profil mis à jour avec succès.'})


class LearningProgressListView(generics.ListAPIView):
    """All learning progress entries for the current student."""
    serializer_class = LearningProgressSerializer

    def get_queryset(self):
        return LearningProgress.objects.filter(
            student=self.request.user
        ).select_related('resource').order_by('-last_accessed')


class LearningProgressUpdateView(APIView):
    """Upsert a progress entry for a resource."""

    def post(self, request, resource_id):
        from apps.resources.models import Resource
        resource = get_object_or_404(Resource, pk=resource_id)
        progress, _ = LearningProgress.objects.get_or_create(
            student=request.user, resource=resource
        )
        serializer = LearningProgressSerializer(progress, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Update total time on the student profile
        if request.user.role == 'student':
            profile, _ = StudentProfile.objects.get_or_create(user=request.user)
            delta = request.data.get('time_spent', 0)
            if delta:
                StudentProfile.objects.filter(pk=profile.pk).update(
                    total_time_spent=profile.total_time_spent + int(delta)
                )

        return Response(serializer.data)


class BookmarkToggleView(APIView):
    """Toggle bookmark on a resource."""

    def post(self, request, resource_id):
        from apps.resources.models import Resource
        resource = get_object_or_404(Resource, pk=resource_id)
        progress, _ = LearningProgress.objects.get_or_create(
            student=request.user, resource=resource
        )
        progress.bookmarked = not progress.bookmarked
        progress.save(update_fields=['bookmarked'])
        return Response({'bookmarked': progress.bookmarked})


class BookmarkedResourcesView(generics.ListAPIView):
    """Resources bookmarked by the current user."""
    serializer_class = LearningProgressSerializer

    def get_queryset(self):
        return LearningProgress.objects.filter(
            student=self.request.user, bookmarked=True
        ).select_related('resource')


_LEVEL_ORDER = {'beginner': 0, 'intermediate': 1, 'advanced': 2}


class VideoStateView(APIView):
    """
    GET /api/auth/video-state/<resource_id>/
    Single call that returns everything the player needs to resume smartly:
      - last saved playback position
      - latest network quality for the user
      - whether the student's level is below the resource's difficulty
    """

    def get(self, request, resource_id):
        from apps.resources.models import Resource
        from apps.context.models import NetworkQualityLog

        resource = get_object_or_404(Resource, pk=resource_id)

        progress = LearningProgress.objects.filter(
            student=request.user, resource=resource
        ).first()
        last_position = progress.last_position_seconds if progress else 0

        net_log = NetworkQualityLog.objects.filter(user=request.user).first()
        network_quality = (
            {'download_kbps': net_log.download_kbps, 'latency_ms': net_log.latency_ms}
            if net_log else None
        )

        level_gap = False
        student_level = None
        if request.user.role == 'student':
            try:
                profile = request.user.student_profile
                student_level = profile.level
                level_gap = (
                    _LEVEL_ORDER.get(student_level, 0) <
                    _LEVEL_ORDER.get(resource.level, 0)
                )
            except StudentProfile.DoesNotExist:
                pass

        return Response({
            'last_position_seconds': last_position,
            'network_quality':       network_quality,
            'level_gap':             level_gap,
            'resource_level':        resource.level,
            'student_level':         student_level,
        })


class ActivityView(APIView):
    """
    GET /api/auth/activity/
    Returns stats and resource lists for the profile page.
    """

    def get(self, request):
        from apps.context.models import UserInteraction
        from apps.resources.models import Resource
        from django.db.models import Max

        user = request.user

        # Distinct viewed resources ordered by most recent
        viewed_qs = (
            UserInteraction.objects
            .filter(user=user, event_type='view', resource__isnull=False)
            .values('resource_id')
            .annotate(last_view=Max('timestamp'))
            .order_by('-last_view')
        )
        viewed_count = viewed_qs.count()
        recent_ids = list(viewed_qs.values_list('resource_id', flat=True)[:10])

        resource_map = {
            r.id: r
            for r in Resource.objects.filter(id__in=recent_ids).select_related('category')
        }
        recent_viewed = []
        for rid in recent_ids:
            r = resource_map.get(rid)
            if r:
                recent_viewed.append({
                    'id': r.id,
                    'title': r.title,
                    'format': r.format,
                    'category_name': r.category.name if r.category else '',
                    'thumbnail': r.thumbnail.url if r.thumbnail else None,
                })

        # Completed resources from LearningProgress
        completed_qs = (
            LearningProgress.objects
            .filter(student=user, is_completed=True)
            .select_related('resource__category')
            .order_by('-last_accessed')
        )
        completed_count = completed_qs.count()
        completed_list = []
        for p in completed_qs:
            r = p.resource
            completed_list.append({
                'id': r.id,
                'title': r.title,
                'format': r.format,
                'category_name': r.category.name if r.category else '',
                'thumbnail': r.thumbnail.url if r.thumbnail else None,
                'completed_at': p.last_accessed,
            })

        return Response({
            'viewed_count':    viewed_count,
            'completed_count': completed_count,
            'recent_viewed':   recent_viewed,
            'completed_list':  completed_list,
        })


class CompleteToggleView(APIView):
    """POST /api/auth/complete/<resource_id>/ — toggle the completed pin."""

    def post(self, request, resource_id):
        from apps.resources.models import Resource
        resource = get_object_or_404(Resource, pk=resource_id)
        progress, _ = LearningProgress.objects.get_or_create(
            student=request.user, resource=resource
        )
        progress.is_completed = not progress.is_completed
        progress.save()   # full save so auto_now updates last_accessed
        return Response({'completed': progress.is_completed})

    def get(self, request, resource_id):
        from apps.resources.models import Resource
        resource = get_object_or_404(Resource, pk=resource_id)
        progress = LearningProgress.objects.filter(
            student=request.user, resource=resource
        ).first()
        return Response({'completed': progress.is_completed if progress else False})


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def list_users(request):
    """Admin: list all users with basic info."""
    users = User.objects.select_related('student_profile', 'teacher_profile').all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)
