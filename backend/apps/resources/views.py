import mimetypes
from rest_framework import generics, status, permissions, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db.models import Q
from django.http import FileResponse
from django_filters.rest_framework import DjangoFilterBackend

from .models import Resource, Category
from .serializers import (
    ResourceListSerializer, ResourceDetailSerializer,
    ResourceCreateUpdateSerializer, CategorySerializer,
)
from .indexer import search_resources, index_resource, remove_resource


def _profile_score(resource, user_level, user_language, user_formats, field_words, user_themes):
    score = 0.5
    if user_level    and resource.level    == user_level:    score += 0.30
    if user_language and resource.language == user_language: score += 0.20
    if user_formats  and resource.format   in user_formats:  score += 0.20

    title_lower = resource.title.lower()
    cat_lower   = resource.category.name.lower() if resource.category else ''

    if field_words and any(w in title_lower or w in cat_lower for w in field_words):
        score += 0.40
    for theme in user_themes:
        if theme in title_lower or theme in cat_lower:
            score += 0.20
            break

    score += min(resource.view_count / 2000, 0.10)
    return score


def _build_suggestions(q, user):
    user_level = user_language = field_of_study = ''
    user_formats = []
    user_themes  = []

    if user.role == 'student':
        try:
            p             = user.student_profile
            user_level    = p.level or ''
            user_language = p.preferred_language or ''
            user_formats  = p.preferred_formats or []
            user_themes   = [t.lower() for t in (p.preferred_themes or [])]
            field_of_study = (p.field_of_study or '').lower()
        except Exception:
            pass

    field_words = [w for w in field_of_study.split() if len(w) > 2]
    base_qs     = Resource.objects.filter(is_active=True, is_validated=True).select_related('category')
    suggestions = []
    seen        = set()

    for r in base_qs.filter(title__icontains=q).order_by('-view_count')[:15]:
        if ('res', r.id) in seen:
            continue
        seen.add(('res', r.id))
        score = _profile_score(r, user_level, user_language, user_formats, field_words, user_themes)
        suggestions.append({
            'text':        r.title,
            'type':        'resource',
            'resource_id': r.id,
            'category':    r.category.name if r.category else None,
            'format':      r.format,
            'level':       r.level,
            'score':       score,
        })

    for cat in Category.objects.filter(name__icontains=q)[:5]:
        if ('cat', cat.id) in seen:
            continue
        seen.add(('cat', cat.id))
        cat_lower = cat.name.lower()
        score = 0.45
        if any(t in cat_lower for t in user_themes):  score += 0.25
        if any(w in cat_lower for w in field_words):  score += 0.30
        count = base_qs.filter(category=cat).count()
        suggestions.append({
            'text':        cat.name,
            'type':        'category',
            'category_id': cat.id,
            'count':       count,
            'score':       score,
        })

    tag_freq = {}
    for r in base_qs.filter(Q(tags__icontains=q) | Q(dcat_keywords__icontains=q))[:25]:
        for tag in (r.tags or []) + (r.dcat_keywords or []):
            if q.lower() in tag.lower():
                tag_freq[tag] = tag_freq.get(tag, 0) + 1

    for tag, freq in sorted(tag_freq.items(), key=lambda x: -x[1])[:4]:
        key = ('tag', tag.lower())
        if key in seen:
            continue
        seen.add(key)
        tag_lower = tag.lower()
        score = 0.35 + min(freq * 0.04, 0.20)
        if any(t in tag_lower for t in user_themes): score += 0.20
        if any(w in tag_lower for w in field_words): score += 0.20
        suggestions.append({'text': tag, 'type': 'tag', 'count': freq, 'score': score})

    suggestions.sort(key=lambda x: -x.pop('score'))
    return suggestions[:8]


class IsTeacherOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('teacher', 'admin')


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class CategoryListView(generics.ListCreateAPIView):
    queryset         = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]


class ResourceListView(generics.ListAPIView):
    serializer_class  = ResourceListSerializer
    filter_backends   = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields  = ['level', 'format', 'language', 'category', 'is_validated']
    ordering_fields   = ['created_at', 'average_rating', 'view_count', 'title']
    ordering          = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs   = Resource.objects.filter(is_active=True).select_related('category', 'uploaded_by')
        if user.role == 'student':
            qs = qs.filter(is_validated=True)
        return qs

    def list(self, request, *args, **kwargs):
        cache_key = f'resource_list_{request.user.role}_{request.GET.urlencode()}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, response.data, timeout=300)
        return response


class ResourceDetailView(generics.RetrieveAPIView):
    serializer_class = ResourceDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs   = Resource.objects.filter(is_active=True).select_related('category', 'uploaded_by')
        if user.role == 'student':
            qs = qs.filter(is_validated=True)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.increment_views()
        return Response(self.get_serializer(instance).data)


class ResourceCreateView(generics.CreateAPIView):
    serializer_class  = ResourceCreateUpdateSerializer
    permission_classes = [IsTeacherOrAdmin]

    def perform_create(self, serializer):
        is_validated = self.request.user.role == 'admin'
        serializer.save(uploaded_by=self.request.user, is_validated=is_validated)


class ResourceUpdateView(generics.UpdateAPIView):
    serializer_class  = ResourceCreateUpdateSerializer
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Resource.objects.all()
        return Resource.objects.filter(uploaded_by=user)


class ResourceDeleteView(generics.DestroyAPIView):
    permission_classes = [IsTeacherOrAdmin]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Resource.objects.all()
        return Resource.objects.filter(uploaded_by=self.request.user)

    def perform_destroy(self, instance):
        remove_resource(instance.id)
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class ResourceValidateView(APIView):
    permission_classes = [IsTeacherOrAdmin]

    def post(self, request, pk):
        resource = get_object_or_404(Resource, pk=pk)
        resource.is_validated = True
        resource.save(update_fields=['is_validated'])
        index_resource(resource)
        return Response({'message': 'Ressource validée.', 'id': resource.id})


class ResourceSearchView(APIView):
    def get(self, request):
        q        = request.query_params.get('q', '')
        level    = request.query_params.get('level')
        format_  = request.query_params.get('format')
        language = request.query_params.get('language')
        sort_by  = request.query_params.get('sort_by', 'relevance')
        page     = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 20))

        cache_key = f'search_{q}_{level}_{format_}_{language}_{sort_by}_{page}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        ids = search_resources(
            query_str=q, level=level, format_=format_,
            language=language, sort_by=sort_by, page=page, per_page=per_page,
        )
        resources = {r.id: r for r in Resource.objects.filter(
            id__in=ids, is_active=True, is_validated=True
        ).select_related('category')}
        ordered    = [resources[i] for i in ids if i in resources]
        serializer = ResourceListSerializer(ordered, many=True, context={'request': request})
        data       = {'query': q, 'results': serializer.data, 'count': len(serializer.data)}
        cache.set(cache_key, data, timeout=120)
        return Response(data)


class SearchSuggestView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if len(q) < 2:
            return Response([])

        cache_key = f'suggest_{request.user.id}_{q.lower()}'
        cached    = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        data = _build_suggestions(q, request.user)
        cache.set(cache_key, data, timeout=60)
        return Response(data)


class ResourceFileView(APIView):
    def get(self, request, pk):
        resource = get_object_or_404(Resource, pk=pk, is_active=True)
        if request.user.role == 'student' and not resource.is_validated:
            return Response({'detail': 'Ressource non disponible.'}, status=status.HTTP_403_FORBIDDEN)
        if not resource.file:
            return Response({'detail': 'Aucun fichier associé.'}, status=status.HTTP_404_NOT_FOUND)

        file_path = resource.file.path
        mime_type, _ = mimetypes.guess_type(file_path)
        mime_type = mime_type or 'application/octet-stream'
        filename  = resource.file.name.rsplit('/', 1)[-1]

        response = FileResponse(open(file_path, 'rb'), content_type=mime_type)
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def popular_resources(request):
    resources  = Resource.objects.filter(is_active=True, is_validated=True).order_by('-view_count')[:10]
    serializer = ResourceListSerializer(resources, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recent_resources(request):
    resources  = Resource.objects.filter(is_active=True, is_validated=True).order_by('-created_at')[:10]
    serializer = ResourceListSerializer(resources, many=True, context={'request': request})
    return Response(serializer.data)
