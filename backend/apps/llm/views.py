from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from django.conf import settings

from apps.resources.models import Resource
from .client import LLMError
from . import service

VALID_LEVELS = {'beginner', 'intermediate', 'advanced'}


class LLMStatusView(APIView):
    """GET /api/llm/status/ — check if the configured LLM provider is reachable."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        provider = getattr(settings, 'LLM_PROVIDER', 'ollama')
        model    = getattr(settings, 'LLM_MODEL', 'qwen2:1.5b')
        base_url = getattr(settings, 'LLM_BASE_URL', 'http://localhost:11434')

        reachable = False
        if provider == 'ollama':
            try:
                import requests
                resp = requests.get(f'{base_url.rstrip("/")}/api/tags', timeout=5)
                reachable = resp.status_code == 200
            except Exception:
                pass
        else:
            reachable = bool(getattr(settings, 'LLM_API_KEY', ''))

        return Response({
            'provider': provider,
            'model':    model,
            'reachable': reachable,
            'base_url': base_url if provider == 'ollama' else None,
        })


class SummarizeView(APIView):
    """GET /api/llm/summarize/<resource_id>/?level=beginner"""

    def get(self, request, resource_id):
        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)

        profile = getattr(request.user, 'student_profile', None)
        default_level = profile.level if profile else 'beginner'
        level = request.query_params.get('level', default_level)
        if level not in VALID_LEVELS:
            return Response(
                {'error': 'level must be beginner, intermediate or advanced.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = service.summarize(resource, level)
        except LLMError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'resource_id': resource.id,
            'title':       resource.title,
            'level':       level,
            **result,
        })


class DetailedSummaryView(APIView):
    """GET /api/llm/detailed-summary/<resource_id>/ — structured study sheet for PDF export."""

    def get(self, request, resource_id):
        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)
        profile = getattr(request.user, 'student_profile', None)
        default_level = profile.level if profile else 'beginner'
        level = request.query_params.get('level', default_level)
        if level not in VALID_LEVELS:
            return Response({'error': 'level must be beginner, intermediate or advanced.'}, status=400)
        try:
            result = service.detailed_summarize(resource, level)
        except LLMError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            'resource_id': resource.id,
            'title':       resource.title,
            'level':       level,
            'category':    resource.category.name if resource.category else '',
            'format':      resource.format,
            **result,
        })


class SimplifyView(APIView):
    """GET /api/llm/simplify/<resource_id>/?level=beginner"""

    def get(self, request, resource_id):
        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)

        target_level = request.query_params.get('level', 'beginner')
        if target_level not in VALID_LEVELS:
            return Response(
                {'error': 'level must be beginner, intermediate or advanced.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = service.simplify(resource, target_level)
        except LLMError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'resource_id':    resource.id,
            'title':          resource.title,
            'original_level': resource.level,
            'target_level':   target_level,
            **result,
        })


class VariantsView(APIView):
    """GET /api/llm/variants/<resource_id>/"""

    def get(self, request, resource_id):
        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)

        try:
            result = service.get_variants(resource)
        except LLMError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'resource_id': resource.id,
            'title':       resource.title,
            'level':       resource.level,
            **result,
        })


class SimplerResourceView(APIView):
    """
    GET /api/llm/simpler/<resource_id>/
    Returns the best lower-level alternative resource, taking network quality into account.
    Falls back to an LLM-generated simplified text if no suitable resource exists.
    """

    _LEVEL_ORDER = {'beginner': 0, 'intermediate': 1, 'advanced': 2}

    def get(self, request, resource_id):
        from apps.resources.serializers import ResourceDetailSerializer
        from apps.context.models import NetworkQualityLog

        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)

        net = NetworkQualityLog.objects.filter(user=request.user).first()
        slow_network = bool(net and net.download_kbps < 512)

        current_order = self._LEVEL_ORDER.get(resource.level, 1)
        lower_levels = [k for k, v in self._LEVEL_ORDER.items() if v < current_order]

        # On slow network avoid heavy formats; on good network prefer video
        light_formats  = ['pdf', 'html']
        heavy_formats  = ['video', 'audio']
        preferred_fmts = light_formats if slow_network else ([resource.format] + light_formats + heavy_formats)

        base = Resource.objects.filter(
            is_active=True, is_validated=True
        ).exclude(id=resource_id).select_related('category')

        category_name = resource.category.name if resource.category else None
        candidate = None

        if lower_levels:
            # 1. Same category name + lower level + same format (exact match)
            if category_name:
                candidate = (
                    base.filter(category__name=category_name, level__in=lower_levels,
                                format=resource.format)
                    .order_by('-average_rating', '-view_count').first()
                )
            # 2. Same category name + lower level + preferred formats
            if not candidate and category_name:
                candidate = (
                    base.filter(category__name=category_name, level__in=lower_levels,
                                format__in=preferred_fmts)
                    .order_by('-average_rating', '-view_count').first()
                )
            # 3. Same category name + lower level (any format)
            if not candidate and category_name:
                candidate = (
                    base.filter(category__name=category_name, level__in=lower_levels)
                    .order_by('-average_rating', '-view_count').first()
                )
            # 4. Any category + lower level + same format
            if not candidate:
                candidate = (
                    base.filter(level__in=lower_levels, format=resource.format)
                    .order_by('-average_rating', '-view_count').first()
                )
            # 5. Any category + lower level + preferred formats
            if not candidate:
                candidate = (
                    base.filter(level__in=lower_levels, format__in=preferred_fmts)
                    .order_by('-average_rating', '-view_count').first()
                )

        # 6. Same category name, any level, lighter format (last resort)
        if not candidate and category_name:
            candidate = (
                base.filter(category__name=category_name, format__in=light_formats)
                .order_by('-average_rating', '-view_count').first()
            )

        if candidate:
            return Response({
                'found':        True,
                'slow_network': slow_network,
                'resource':     ResourceDetailSerializer(candidate, context={'request': request}).data,
            })

        # No suitable resource — fall back to LLM simplification
        target = lower_levels[0] if lower_levels else resource.level
        result = service.simplify(resource, target)
        return Response({
            'found':        False,
            'slow_network': slow_network,
            'text':         result['text'],
            'provider':     result['provider'],
        })


def _user_level(user):
    try:
        return user.student_profile.level or 'beginner'
    except Exception:
        return 'beginner'


class GenerateVideoView(APIView):
    """POST /api/llm/video/<resource_id>/generate/ — start background video generation."""

    def post(self, request, resource_id):
        from .models import GeneratedVideo
        from .video_service import generate_video_async

        resource = get_object_or_404(Resource, id=resource_id, is_active=True, is_validated=True)
        level = _user_level(request.user)

        gv, created = GeneratedVideo.objects.get_or_create(resource=resource, level=level)

        if not created:
            if gv.status == 'ready':
                return Response({'status': 'ready', 'url': request.build_absolute_uri(gv.file.url)})
            if gv.status == 'generating':
                return Response({'status': 'generating'})
            # failed — allow retry
            gv.status = 'generating'
            gv.error = ''
            gv.file = None
            gv.save()
        else:
            gv.status = 'generating'
            gv.save()

        generate_video_async(resource_id, level)
        return Response({'status': 'generating'}, status=status.HTTP_202_ACCEPTED)


class VideoStatusView(APIView):
    """GET /api/llm/video/<resource_id>/ — check generation status and get URL."""

    def get(self, request, resource_id):
        from .models import GeneratedVideo

        level = _user_level(request.user)
        try:
            gv = GeneratedVideo.objects.get(resource_id=resource_id, level=level)
        except GeneratedVideo.DoesNotExist:
            return Response({'status': 'not_started'})

        resp = {'status': gv.status}
        if gv.status == 'ready' and gv.file:
            resp['url'] = request.build_absolute_uri(gv.file.url)
        if gv.status == 'failed':
            resp['error'] = gv.error
        return Response(resp)


class LearningPathView(APIView):
    """GET /api/llm/learning-path/"""

    def get(self, request):
        if request.user.role != 'student':
            return Response(
                {'error': 'Seuls les étudiants peuvent demander un parcours d\'apprentissage.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            result = service.generate_learning_path(request.user)
        except LLMError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if 'error' in result:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)
