"""
Module 4 — Hybrid Recommendation Engine (non-LLM part).

Combines four signals:
  1. Popularity   — globally most-viewed / highest-rated resources
  2. Content-based — match resource attributes to student profile preferences
  3. Collaborative  — other students with similar profiles liked these
  4. Context       — filter by network quality (avoid heavy files on slow connections)

A weighted score is computed and the top-N resources are returned.
"""

from django.db.models import Count, Avg, Q
from django.core.cache import cache

from apps.resources.models import Resource
from apps.context.models import NetworkQualityLog, UserInteraction
from apps.authentication.models import StudentProfile, LearningProgress


# ─── Weights ──────────────────────────────────────────────────────────────────

W_POPULARITY  = 0.20
W_CONTENT     = 0.35
W_COLLAB      = 0.25
W_CONTEXT     = 0.10
W_LOCATION    = 0.10


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_student_profile(user):
    try:
        return user.student_profile
    except StudentProfile.DoesNotExist:
        return None


def _get_network_quality(user):
    log = NetworkQualityLog.objects.filter(user=user).order_by('-timestamp').first()
    if not log:
        return None
    return log


def _already_viewed(user):
    """Set of resource IDs the user has already seen (for diversity)."""
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


# ─── Signal 1: Popularity ─────────────────────────────────────────────────────

def popularity_scores(exclude_ids=None, top_n=50):
    """Normalised popularity score based on views and ratings."""
    qs = _base_queryset(exclude_ids)
    max_views = qs.order_by('-view_count').values_list('view_count', flat=True).first() or 1
    results = {}
    for r in qs[:top_n]:
        view_norm  = r.view_count / max_views
        rating_norm = r.average_rating / 5.0
        results[r.id] = (view_norm * 0.5 + rating_norm * 0.5)
    return results


# ─── Signal 2: Content-based ──────────────────────────────────────────────────

def content_scores(profile, exclude_ids=None, top_n=100):
    """Score resources by how well they match the student's declared preferences."""
    if not profile:
        return {}

    qs = _base_queryset(exclude_ids)
    results = {}

    for r in qs[:top_n]:
        score = 0.0
        # Level match
        if r.level == profile.level:
            score += 0.4
        # Format preference
        if r.format in (profile.preferred_formats or []):
            score += 0.3
        # Theme / category
        preferred_themes = [t.lower() for t in (profile.preferred_themes or [])]
        if r.category and r.category.name.lower() in preferred_themes:
            score += 0.2
        # Language match
        if r.language == profile.preferred_language:
            score += 0.1
        results[r.id] = score

    return results


# ─── Signal 3: Collaborative filtering (item-based, lightweight) ──────────────

def collaborative_scores(user, profile, exclude_ids=None, top_n=50):
    """
    Find peers (same level + field) who viewed resources and return
    what they liked that the current user hasn't seen.
    Lightweight version suitable for Raspberry Pi.
    """
    if not profile:
        return {}

    # Find peers
    peer_ids = StudentProfile.objects.filter(
        level=profile.level,
        field_of_study=profile.field_of_study,
    ).exclude(user=user).values_list('user_id', flat=True)[:50]

    if not peer_ids:
        return {}

    # What peers interacted with
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


# ─── Signal 4: Location (campus zone) ────────────────────────────────────────

def location_scores(user, exclude_ids=None, top_n=100):
    """Boost resources whose format fits the user's current campus zone."""
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


# ─── Signal 5: Context (network quality) ─────────────────────────────────────

def context_penalty(resource, network_log):
    """
    Penalise heavy resources when bandwidth is low.
    Returns a score reduction between 0 and 1.
    """
    if not network_log:
        return 0.0
    heavy_formats = {'video', 'audio', 'zip'}
    if resource.format in heavy_formats and network_log.download_kbps < 512:
        return 0.8   # strong penalty
    if resource.format in heavy_formats and network_log.download_kbps < 2048:
        return 0.3
    return 0.0


# ─── Main Engine ──────────────────────────────────────────────────────────────

def get_recommendations(user, n=12, diversity=True):
    """
    Return a list of Resource objects ranked by the hybrid score.

    :param user:      Authenticated user.
    :param n:         Number of recommendations to return.
    :param diversity: If True, exclude already-viewed resources.
    """
    cache_key = f'reco_{user.id}_{n}'
    cached = cache.get(cache_key)
    if cached:
        return Resource.objects.filter(id__in=cached, is_active=True, is_validated=True)

    profile = _get_student_profile(user) if user.role == 'student' else None
    network_log = _get_network_quality(user)
    exclude_ids = _already_viewed(user) if diversity else None

    # Gather scores from each signal
    popularity  = popularity_scores(exclude_ids)
    content     = content_scores(profile, exclude_ids)
    collab      = collaborative_scores(user, profile, exclude_ids)
    location    = location_scores(user, exclude_ids)

    # Union of all candidate resource IDs
    all_ids = set(popularity) | set(content) | set(collab) | set(location)
    if not all_ids:
        # Fallback: return most popular validated resources
        return Resource.objects.filter(
            is_active=True, is_validated=True
        ).order_by('-view_count')[:n]

    # Fetch candidates
    candidates = {r.id: r for r in Resource.objects.filter(
        id__in=all_ids, is_active=True, is_validated=True
    ).select_related('category')}

    # Compute weighted scores
    scores = {}
    for rid in all_ids:
        if rid not in candidates:
            continue
        resource = candidates[rid]
        s = (
            W_POPULARITY * popularity.get(rid, 0.0)
            + W_CONTENT   * content.get(rid, 0.0)
            + W_COLLAB    * collab.get(rid, 0.0)
            + W_LOCATION  * location.get(rid, 0.0)
            - W_CONTEXT   * context_penalty(resource, network_log)
        )
        scores[rid] = s

    top_ids = sorted(scores, key=scores.get, reverse=True)[:n]
    cache.set(cache_key, top_ids, timeout=180)   # 3-minute cache

    return [candidates[rid] for rid in top_ids if rid in candidates]
