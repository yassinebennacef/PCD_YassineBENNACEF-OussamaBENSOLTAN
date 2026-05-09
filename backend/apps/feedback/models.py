"""
Module 7 — User Feedback
Rating, comments, and content suggestions.
"""

from django.db import models
from django.conf import settings
from rest_framework import generics, serializers, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.urls import path

from apps.resources.models import Resource


# ══════════════════════════════════════════════════════════════════════════════
# Models
# ══════════════════════════════════════════════════════════════════════════════

class Rating(models.Model):
    """1–5 star rating for a resource."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ratings'
    )
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='ratings')
    score = models.PositiveSmallIntegerField()   # 1 – 5

    class Meta:
        unique_together = ('user', 'resource')
        verbose_name = 'Note'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.resource.recalculate_rating()

    def delete(self, *args, **kwargs):
        resource = self.resource
        super().delete(*args, **kwargs)
        resource.recalculate_rating()

    def __str__(self):
        return f'{self.user.username} → {self.resource.title}: {self.score}★'


class Comment(models.Model):
    """Free-text comment on a resource."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments'
    )
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Commentaire'

    def __str__(self):
        return f'{self.user.username} on {self.resource.title}'


class ContentSuggestion(models.Model):
    """User suggests a new resource or topic."""
    TYPES = [
        ('topic', 'Nouveau sujet'),
        ('resource', 'Ressource externe'),
        ('improvement', 'Amélioration'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='suggestions'
    )
    suggestion_type = models.CharField(max_length=20, choices=TYPES, default='topic')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    is_reviewed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Suggestion'

    def __str__(self):
        return f'{self.user.username}: {self.title}'


# ══════════════════════════════════════════════════════════════════════════════
# Serializers
# ══════════════════════════════════════════════════════════════════════════════

class RatingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Rating
        fields = ['id', 'username', 'score', 'resource']
        read_only_fields = ['id', 'username']

    def validate_score(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('La note doit être entre 1 et 5.')
        return value


class CommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    avatar = serializers.ImageField(source='user.avatar', read_only=True)

    class Meta:
        model = Comment
        fields = ['id', 'username', 'full_name', 'avatar', 'text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'username', 'full_name', 'created_at', 'updated_at']


class ContentSuggestionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ContentSuggestion
        fields = ['id', 'username', 'suggestion_type', 'title', 'description',
                  'url', 'is_reviewed', 'created_at']
        read_only_fields = ['id', 'username', 'is_reviewed', 'created_at']


# ══════════════════════════════════════════════════════════════════════════════
# Views
# ══════════════════════════════════════════════════════════════════════════════

class RateResourceView(APIView):
    """POST to rate, DELETE to remove rating."""

    def post(self, request, resource_id):
        resource = get_object_or_404(Resource, pk=resource_id, is_active=True)
        score = request.data.get('score')
        if not score:
            return Response({'error': 'score requis.'}, status=status.HTTP_400_BAD_REQUEST)
        rating, created = Rating.objects.update_or_create(
            user=request.user, resource=resource,
            defaults={'score': int(score)},
        )
        return Response(
            {'score': rating.score, 'created': created,
             'average_rating': resource.average_rating},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, resource_id):
        resource = get_object_or_404(Resource, pk=resource_id)
        Rating.objects.filter(user=request.user, resource=resource).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResourceCommentsView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer

    def get_queryset(self):
        return Comment.objects.filter(
            resource_id=self.kwargs['resource_id']
        ).select_related('user')

    def perform_create(self, serializer):
        resource = get_object_or_404(Resource, pk=self.kwargs['resource_id'])
        serializer.save(user=self.request.user, resource=resource)


class CommentUpdateDeleteView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CommentSerializer

    def get_queryset(self):
        return Comment.objects.filter(user=self.request.user)


class ContentSuggestionView(generics.ListCreateAPIView):
    serializer_class = ContentSuggestionSerializer

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return ContentSuggestion.objects.select_related('user').all()
        return ContentSuggestion.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ReviewSuggestionView(APIView):
    def patch(self, request, pk):
        from django.shortcuts import get_object_or_404
        suggestion = get_object_or_404(ContentSuggestion, pk=pk)
        suggestion.is_reviewed = True
        suggestion.save(update_fields=['is_reviewed'])
        return Response({'message': 'Suggestion traitée.'})


# ══════════════════════════════════════════════════════════════════════════════
# URLs
# ══════════════════════════════════════════════════════════════════════════════

urlpatterns = [
    path('rate/<int:resource_id>/', RateResourceView.as_view(), name='rate_resource'),
    path('comments/<int:resource_id>/', ResourceCommentsView.as_view(), name='resource_comments'),
    path('comments/edit/<int:pk>/', CommentUpdateDeleteView.as_view(), name='comment_edit'),
    path('suggestions/', ContentSuggestionView.as_view(), name='suggestions'),
    path('suggestions/<int:pk>/review/', ReviewSuggestionView.as_view(), name='review_suggestion'),
]
