from django.db import models
from apps.resources.models import Resource


class GeneratedVideo(models.Model):
    STATUS_CHOICES = [
        ('generating', 'En cours'),
        ('ready',      'Prêt'),
        ('failed',     'Échec'),
    ]
    resource   = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='generated_videos')
    level      = models.CharField(max_length=20, default='beginner')
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating')
    file       = models.FileField(upload_to='generated_videos/', null=True, blank=True)
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('resource', 'level')]
        verbose_name = 'Vidéo générée'
        verbose_name_plural = 'Vidéos générées'

    def __str__(self):
        return f'{self.resource.title} [{self.level}] — {self.status}'


class LLMCache(models.Model):
    TASK_CHOICES = [
        ('summary',       'Résumé'),
        ('simplify',      'Simplification'),
        ('variants',      'Variantes pédagogiques'),
        ('learning_path', "Parcours d'apprentissage"),
    ]

    resource    = models.ForeignKey(
        Resource, on_delete=models.CASCADE,
        null=True, blank=True, related_name='llm_cache',
    )
    task_type   = models.CharField(max_length=20, choices=TASK_CHOICES)
    level       = models.CharField(max_length=20, blank=True)
    cache_key   = models.CharField(max_length=64, unique=True, db_index=True)
    response_text = models.TextField()
    provider    = models.CharField(max_length=60, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cache LLM'
        verbose_name_plural = 'Cache LLM'
        ordering = ['-created_at']

    def __str__(self):
        label = self.resource.title if self.resource else 'parcours'
        return f'{self.task_type} — {label} ({self.level or "any"})'
