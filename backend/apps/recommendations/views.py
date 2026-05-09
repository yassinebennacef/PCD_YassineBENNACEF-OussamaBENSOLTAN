from rest_framework.views import APIView
from rest_framework.response import Response
from django.urls import path

from .engine import get_recommendations, _base_queryset, collaborative_scores
from apps.resources.serializers import ResourceListSerializer
from apps.context.models import UserInteraction, CAMPUS_ZONES
from apps.authentication.models import StudentProfile


def _serialize(qs_or_list, request):
    return ResourceListSerializer(qs_or_list, many=True, context={'request': request}).data


class RecommendationsView(APIView):
    """GET /api/recommendations/ — flat personalised list."""

    def get(self, request):
        n = int(request.query_params.get('n', 12))
        diversity = request.query_params.get('diversity', 'true').lower() == 'true'
        resources = get_recommendations(request.user, n=n, diversity=diversity)
        serializer = ResourceListSerializer(resources, many=True, context={'request': request})
        return Response({'recommendations': serializer.data, 'count': len(serializer.data)})


class RecommendationSectionsView(APIView):
    """
    GET /api/recommendations/sections/
    Returns recommendations grouped by reason:
      - by_level   : resources matching the user's level
      - by_field   : resources matching the user's field of study (via category keywords)
      - by_peers   : what peers with same level+field are studying
      - history    : recently viewed resources (for "continue where you left off")
      - popular    : trending resources (fallback / extra)
    """

    def get(self, request):
        user = request.user
        profile = None
        if user.role == 'student':
            profile, _ = StudentProfile.objects.get_or_create(user=user)

        # ── History: last 6 distinct resources the user viewed ──────────────
        from django.db.models import Max
        viewed_ids_ordered = list(
            UserInteraction.objects.filter(user=user, event_type='view', resource__isnull=False)
            .values('resource_id')
            .annotate(last_view=Max('timestamp'))
            .order_by('-last_view')
            .values_list('resource_id', flat=True)[:6]
        )
        history_qs = _base_queryset()
        history_resources = []
        if viewed_ids_ordered:
            history_map = {r.id: r for r in history_qs.filter(id__in=viewed_ids_ordered)}
            history_resources = [history_map[rid] for rid in viewed_ids_ordered if rid in history_map]

        # ── By level ────────────────────────────────────────────────────────
        level = profile.level if profile else None
        by_level = []
        if level:
            by_level = list(
                _base_queryset()
                .filter(level=level)
                .order_by('-average_rating', '-view_count')[:8]
            )

        # ── By field: match field_of_study keyword against category name ────
        by_field = []
        field = (profile.field_of_study or '').strip() if profile else ''
        if field:
            from django.db.models import Q
            keywords = [w.strip().lower() for w in field.replace(',', ' ').split() if len(w.strip()) > 2]
            q = Q()
            for kw in keywords:
                q |= Q(category__name__icontains=kw) | Q(tags__icontains=kw) | Q(title__icontains=kw)
            by_field = list(
                _base_queryset()
                .filter(q)
                .order_by('-average_rating', '-view_count')
                .distinct()[:8]
            )

        # ── By peers (collaborative) ─────────────────────────────────────────
        by_peers = []
        if profile:
            peer_scores = collaborative_scores(user, profile, exclude_ids=set(viewed_ids_ordered))
            if peer_scores:
                top_peer_ids = sorted(peer_scores, key=peer_scores.get, reverse=True)[:8]
                peer_map = {r.id: r for r in _base_queryset().filter(id__in=top_peer_ids)}
                by_peers = [peer_map[rid] for rid in top_peer_ids if rid in peer_map]

        # ── Popular (global fallback / extra) ───────────────────────────────
        popular = list(
            _base_queryset()
            .exclude(id__in=viewed_ids_ordered)
            .order_by('-view_count', '-average_rating')[:8]
        )

        # ── By location (campus zone) ────────────────────────────────────────
        zone = None
        zone_label = None
        by_location = []
        try:
            loc = user.campus_location
            zone = loc.zone
            zone_label = CAMPUS_ZONES.get(zone, {}).get('label')
            preferred_formats = CAMPUS_ZONES.get(zone, {}).get('formats', [])
            if preferred_formats:
                by_location = list(
                    _base_queryset()
                    .filter(format__in=preferred_formats)
                    .order_by('-average_rating', '-view_count')[:8]
                )
        except Exception:
            pass

        return Response({
            'profile': {
                'level': level,
                'field': field,
                'preferred_formats': profile.preferred_formats if profile else [],
                'preferred_language': profile.preferred_language if profile else None,
            } if profile else None,
            'zone': {'id': zone, 'label': zone_label} if zone else None,
            'sections': {
                'history':     _serialize(history_resources, request),
                'by_level':    _serialize(by_level, request),
                'by_field':    _serialize(by_field, request),
                'by_peers':    _serialize(by_peers, request),
                'popular':     _serialize(popular, request),
                'by_location': _serialize(by_location, request),
            },
        })


urlpatterns = [
    path('', RecommendationsView.as_view(), name='recommendations'),
    path('sections/', RecommendationSectionsView.as_view(), name='recommendation_sections'),
]
