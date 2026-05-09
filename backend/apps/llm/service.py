import hashlib
import logging

from django.db import transaction

from apps.resources.models import Resource
from apps.authentication.models import StudentProfile, LearningProgress

from .client import get_llm_client, LLMError
from .extractors import extract_text_from_resource
from .prompts import (
    summarize_prompt,
    detailed_summary_prompt,
    simplify_prompt,
    variants_prompt,
    learning_path_prompt,
)

logger = logging.getLogger(__name__)


def _cache_key(*parts) -> str:
    raw = '|'.join(str(p) for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


def _from_cache(key: str):
    from .models import LLMCache
    return LLMCache.objects.filter(cache_key=key).first()


def _to_cache(key, task_type, text, provider, resource=None, level=''):
    from .models import LLMCache
    with transaction.atomic():
        LLMCache.objects.get_or_create(
            cache_key=key,
            defaults={
                'task_type':     task_type,
                'resource':      resource,
                'level':         level,
                'response_text': text,
                'provider':      provider,
            },
        )


def _cached_result(cached):
    return {'text': cached.response_text, 'cached': True, 'provider': cached.provider}


def summarize(resource: Resource, level: str) -> dict:
    key = _cache_key('summary', resource.id, level)
    cached = _from_cache(key)
    if cached:
        return _cached_result(cached)

    excerpt = extract_text_from_resource(resource)
    prompt  = summarize_prompt(resource.title, resource.description, level, excerpt)
    client  = get_llm_client()
    text    = client.generate(prompt)
    _to_cache(key, 'summary', text, client.provider_name, resource=resource, level=level)
    return {'text': text, 'cached': False, 'provider': client.provider_name}


def detailed_summarize(resource: Resource, level: str) -> dict:
    key = _cache_key('detailed_summary', resource.id, level)
    cached = _from_cache(key)
    if cached:
        return _cached_result(cached)

    excerpt       = extract_text_from_resource(resource)
    category_name = resource.category.name if resource.category else ''
    prompt = detailed_summary_prompt(
        title=resource.title,
        description=resource.description,
        level=level,
        category=category_name,
        content_excerpt=excerpt,
        resource_format=resource.format,
    )
    client = get_llm_client()
    text   = client.generate(prompt, max_tokens=2000)
    _to_cache(key, 'summary', text, client.provider_name, resource=resource, level=level)
    return {'text': text, 'cached': False, 'provider': client.provider_name}


def simplify(resource: Resource, target_level: str) -> dict:
    key = _cache_key('simplify', resource.id, resource.level, target_level)
    cached = _from_cache(key)
    if cached:
        return _cached_result(cached)

    excerpt = extract_text_from_resource(resource)
    prompt  = simplify_prompt(
        resource.title, resource.description,
        resource.level, target_level, excerpt,
    )
    client = get_llm_client()
    text   = client.generate(prompt)
    _to_cache(key, 'simplify', text, client.provider_name, resource=resource, level=target_level)
    return {'text': text, 'cached': False, 'provider': client.provider_name}


def get_variants(resource: Resource) -> dict:
    key = _cache_key('variants', resource.id)
    cached = _from_cache(key)
    if cached:
        return _cached_result(cached)

    category_name = resource.category.name if resource.category else ''
    prompt = variants_prompt(resource.title, resource.description, resource.level, category_name)
    client = get_llm_client()
    text   = client.generate(prompt)
    _to_cache(key, 'variants', text, client.provider_name, resource=resource)
    return {'text': text, 'cached': False, 'provider': client.provider_name}


def generate_learning_path(user) -> dict:
    try:
        profile = user.student_profile
    except StudentProfile.DoesNotExist:
        return {'error': 'Profil étudiant introuvable.'}

    completed_ids = list(
        LearningProgress.objects.filter(student=user, is_completed=True)
        .values_list('resource_id', flat=True)
    )
    completed_titles = list(
        LearningProgress.objects.filter(student=user, is_completed=True)
        .select_related('resource')
        .values_list('resource__title', flat=True)[:10]
    )

    candidates = list(
        Resource.objects.filter(
            is_active=True,
            is_validated=True,
            level=profile.level,
            language=profile.preferred_language,
        )
        .exclude(id__in=completed_ids)
        .select_related('category')
        .order_by('-average_rating', '-view_count')[:20]
    )

    if not candidates:
        candidates = list(
            Resource.objects.filter(is_active=True, is_validated=True)
            .exclude(id__in=completed_ids)
            .select_related('category')
            .order_by('-average_rating')[:20]
        )

    available = [
        {
            'title':    r.title,
            'level':    r.level,
            'format':   r.format,
            'category': r.category.name if r.category else 'Général',
        }
        for r in candidates
    ]

    key = _cache_key(
        'learning_path', user.id,
        profile.level, profile.field_of_study,
        len(completed_titles),
    )
    cached = _from_cache(key)
    if cached:
        return _cached_result(cached)

    prompt = learning_path_prompt(
        username=user.get_full_name() or user.username,
        level=profile.level,
        field=profile.field_of_study,
        goals=profile.learning_goals,
        completed_titles=completed_titles,
        available_resources=available,
    )
    client = get_llm_client()
    text   = client.generate(prompt)
    _to_cache(key, 'learning_path', text, client.provider_name, level=profile.level)
    return {'text': text, 'cached': False, 'provider': client.provider_name}
