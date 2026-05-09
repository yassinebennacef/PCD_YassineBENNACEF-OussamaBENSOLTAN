"""
Module 3 — Context collection.
Captures network quality, user interactions (clicks, time, feedback signals)
to feed the recommendation engine.
"""

from django.db import models
from django.conf import settings


# ─── Network Quality ──────────────────────────────────────────────────────────

class NetworkQualityLog(models.Model):
    """Periodic network quality snapshot from a client."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='network_logs', null=True, blank=True
    )
    download_kbps = models.FloatField(default=0)
    latency_ms = models.FloatField(default=0)
    location_hint = models.CharField(max_length=100, blank=True)   # e.g. "campus-A"
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Log réseau'

    def __str__(self):
        return f'{self.user} — {self.download_kbps:.0f} kbps @ {self.timestamp:%H:%M}'


# ─── Campus Zone ─────────────────────────────────────────────────────────────

CAMPUS_ZONES = {
    'classroom':    {'label': 'Salle de cours',  'formats': ['pdf', 'html']},
    'library':      {'label': 'Bibliothèque',    'formats': ['pdf', 'html', 'audio']},
    'lab':          {'label': 'Laboratoire',     'formats': ['video', 'html', 'pdf']},
    'amphitheater': {'label': 'Amphithéâtre',    'formats': ['video', 'audio']},
    'common_area':  {'label': 'Espace commun',   'formats': ['audio', 'pdf']},
    'off_campus':   {'label': 'Hors campus',     'formats': ['pdf', 'audio', 'video']},
}

ZONE_CHOICES = [(k, v['label']) for k, v in CAMPUS_ZONES.items()]


class CampusLocation(models.Model):
    """Tracks the current campus zone of a user (one record per user, updated in place)."""
    user       = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='campus_location'
    )
    zone       = models.CharField(max_length=50, choices=ZONE_CHOICES, default='off_campus')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Localisation campus'

    def __str__(self):
        return f'{self.user} — {self.zone}'


# ─── User Interaction ─────────────────────────────────────────────────────────

class UserInteraction(models.Model):
    """
    Granular interaction event for recommendation signals.
    Types: view, click, search, download, complete, skip.
    """
    EVENT_TYPES = [
        ('view', 'Vue'),
        ('click', 'Clic'),
        ('download', 'Téléchargement'),
        ('search', 'Recherche'),
        ('complete', 'Complété'),
        ('skip', 'Ignoré'),
        ('feedback', 'Feedback'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='interactions'
    )
    resource = models.ForeignKey(
        'resources.Resource', on_delete=models.CASCADE,
        related_name='interactions', null=True, blank=True
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, db_index=True)
    session_id = models.CharField(max_length=64, blank=True, db_index=True)
    time_on_resource = models.PositiveIntegerField(default=0)   # seconds
    query_used = models.CharField(max_length=255, blank=True)   # for search events
    metadata = models.JSONField(default=dict, blank=True)       # extra context
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Interaction'
        indexes = [
            models.Index(fields=['user', 'resource', 'event_type']),
        ]

    def __str__(self):
        return f'{self.user.username} — {self.event_type} — {self.resource}'
