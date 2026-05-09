from django.db.models import Count
from django.core.cache import cache

from apps.resources.models import Resource
from apps.context.models import NetworkQualityLog, UserInteraction
from apps.authentication.models import StudentProfile, LearningProgress

W_POPULARITY = 0.20
W_CONTENT    = 0.35
W_COLLAB     = 0.25
W_CONTEXT    = 0.10
W_LOCATION   = 0.10


def _get_student_profile(user):
    try:
        return user.student_profile
    except StudentProfile.DoesNotExist:
        return None


def _get_network_quality(user):
    return NetworkQualityLog.objects.filter(user=user).order_by('-timestamp').first()


def _already_viewed(user):
    return set(
        UserInteraction.objects.filter(
            user=user, event_type='view'
        ).values_list('resource_id', flat=True)
    )


def _base_queryset(exclude_ids=None):
    qs = Resource.objects.filter(is_active=True, is_validated=True)
    if exclude_ids:
        qs = qs.exclude(id__in=exclude_ids)
    return qs.select_related('category')


def popularity_scores(exclude_ids=None, top_n=50):
    qs = _base_queryset(exclude_ids)
    max_views = qs.order_by('-view_count').values_list('view_count', flat=True).first() or 1
    results = {}
    for r in qs[:top_n]:
        view_norm   = r.view_count / max_views
        rating_norm = r.average_rating / 5.0
        results[r.id] = view_norm * 0.5 + rating_norm * 0.5
    return results


def content_scores(profile, exclude_ids=None, top_n=100):
    if not profile:
        return {}
    qs = _base_queryset(exclude_ids)
    results = {}
    for r in qs[:top_n]:
        score = 0.0
        if r.level == profile.level:
            score += 0.4
        if r.format in (profile.preferred_formats or []):
            score += 0.3
        preferred_themes = [t.lower() for t in (profile.preferred_themes or [])]
        if r.category and r.category.name.lower() in preferred_themes:
            score += 0.2
        if r.language == profile.preferred_language:
            score += 0.1
        results[r.id] = score
    return results


def collaborative_scores(user, profile, exclude_ids=None, top_n=50):
    if not profile:
        return {}

    peer_ids = (
        StudentProfile.objects
        .filter(level=profile.level, field_of_study=profile.field_of_study)
        .exclude(user=user)
        .values_list('user_id', flat=True)[:50]
    )
    if not peer_ids:
        return {}

    peer_interactions = (
        UserInteraction.objects
        .filter(user_id__in=peer_ids, event_type__in=['view', 'download', 'complete'])
        .exclude(resource_id__in=(exclude_ids or []))
        .values('resource_id')
        .annotate(count=Count('id'))
        .order_by('-count')[:top_n]
    )

    max_count = peer_interactions[0]['count'] if peer_interactions else 1
    return {row['resource_id']: row['count'] / max_count for row in peer_interactions}


def location_scores(user, exclude_ids=None, top_n=100):
    from apps.context.models import CAMPUS_ZONES
    try:
        zone = user.campus_location.zone
    except Exception:
        return {}

    preferred = CAMPUS_ZONES.get(zone, {}).get('formats', [])
    if not preferred:
        return {}

    results = {}
    for r in _base_queryset(exclude_ids)[:top_n]:
        if r.format in preferred:
            idx = preferred.index(r.format)
            results[r.id] = max(0.0, 1.0 - idx * 0.25)
    return results


def context_penalty(resource, network_log):
    if not network_log:
        return 0.0
    heavy = {'video', 'audio', 'zip'}
    if resource.format in heavy and network_log.download_kbps < 512:
        return 0.8
    if resource.format in heavy and network_log.download_kbps < 2048:
        return 0.3
    return 0.0


def get_recommendations(user, n=12, diversity=True):
    cache_key = f'reco_{user.id}_{n}'
    cached = cache.get(cache_key)
    if cached:
        return Resource.objects.filter(id__in=cached, is_active=True, is_validated=True)

    profile     = _get_student_profile(user) if user.role == 'student' else None
    network_log = _get_network_quality(user)
    exclude_ids = _already_viewed(user) if diversity else None

    popularity = popularity_scores(exclude_ids)
    content    = content_scores(profile, exclude_ids)
    collab     = collaborative_scores(user, profile, exclude_ids)
    location   = location_scores(user, exclude_ids)

    all_ids = set(popularity) | set(content) | set(collab) | set(location)
    if not all_ids:
        return Resource.objects.filter(
            is_active=True, is_validated=True
        ).order_by('-view_count')[:n]

    candidates = {
        r.id: r for r in Resource.objects.filter(
            id__in=all_ids, is_active=True, is_validated=True
        ).select_related('category')
    }

    scores = {}
    for rid in all_ids:
        if rid not in candidates:
            continue
        r = candidates[rid]
        scores[rid] = (
            W_POPULARITY * popularity.get(rid, 0.0)
            + W_CONTENT  * content.get(rid, 0.0)
            + W_COLLAB   * collab.get(rid, 0.0)
            + W_LOCATION * location.get(rid, 0.0)
            - W_CONTEXT  * context_penalty(r, network_log)
        )

    top_ids = sorted(scores, key=scores.get, reverse=True)[:n]
    cache.set(cache_key, top_ids, timeout=180)
    return [candidates[rid] for rid in top_ids if rid in candidates]
