from django.db import models
from django.conf import settings


class Category(models.Model):
    """Thematic category (e.g. Mathématiques, Informatique)."""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)   # icon class name

    class Meta:
        verbose_name = 'Catégorie'
        ordering = ['name']

    def __str__(self):
        return self.name


class Resource(models.Model):
    """
    Educational resource stored locally on the Raspberry Pi.
    Metadata follows DCAT standard where applicable.
    """

    LEVELS = [
        ('beginner', 'Débutant'),
        ('intermediate', 'Intermédiaire'),
        ('advanced', 'Avancé'),
    ]

    FORMATS = [
        ('pdf', 'PDF'),
        ('video', 'Vidéo'),
        ('audio', 'Audio'),
        ('html', 'Page Web'),
        ('image', 'Image'),
        ('zip', 'Archive'),
        ('other', 'Autre'),
    ]

    LANGUAGES = [
        ('fr', 'Français'),
        ('ar', 'Arabe'),
        ('en', 'Anglais'),
    ]

    # ── Core fields ────────────────────────────────────────────────────────────
    title = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='resources/', null=True, blank=True)
    thumbnail = models.ImageField(upload_to='thumbnails/', null=True, blank=True)
    external_url = models.URLField(blank=True)

    # ── Classification ─────────────────────────────────────────────────────────
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, related_name='resources'
    )
    level = models.CharField(max_length=20, choices=LEVELS, default='beginner', db_index=True)
    format = models.CharField(max_length=20, choices=FORMATS, default='pdf', db_index=True)
    language = models.CharField(max_length=5, choices=LANGUAGES, default='fr')
    tags = models.JSONField(default=list, blank=True)   # free-form tags for Whoosh indexing

    # ── DCAT metadata ──────────────────────────────────────────────────────────
    dcat_identifier = models.CharField(max_length=255, blank=True)   # dct:identifier
    dcat_publisher = models.CharField(max_length=255, blank=True)     # dct:publisher
    dcat_license = models.CharField(max_length=255, blank=True)       # dct:license
    dcat_issued = models.DateField(null=True, blank=True)             # dct:issued
    dcat_modified = models.DateField(null=True, blank=True)           # dct:modified
    dcat_keywords = models.JSONField(default=list, blank=True)        # dcat:keyword

    # ── Ownership & status ─────────────────────────────────────────────────────
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='uploaded_resources'
    )
    is_validated = models.BooleanField(default=False, db_index=True)   # teacher validation
    is_active = models.BooleanField(default=True)

    # ── Metrics ────────────────────────────────────────────────────────────────
    view_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    average_rating = models.FloatField(default=0.0)
    rating_count = models.PositiveIntegerField(default=0)

    # ── Timestamps ─────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Ressource'
        indexes = [
            models.Index(fields=['level', 'format', 'language']),
            models.Index(fields=['is_validated', 'is_active']),
        ]

    def __str__(self):
        return self.title

    def increment_views(self):
        Resource.objects.filter(pk=self.pk).update(view_count=models.F('view_count') + 1)

    def recalculate_rating(self):
        from apps.feedback.models import Rating
        result = Rating.objects.filter(resource=self).aggregate(
            avg=models.Avg('score'), count=models.Count('id')
        )
        Resource.objects.filter(pk=self.pk).update(
            average_rating=result['avg'] or 0.0,
            rating_count=result['count'] or 0,
        )
