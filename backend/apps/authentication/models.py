from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Extended user supporting Student / Teacher / Admin roles."""

    ROLES = [
        ('student', 'Étudiant'),
        ('teacher', 'Enseignant'),
        ('admin', 'Administrateur'),
    ]

    role = models.CharField(max_length=20, choices=ROLES, default='student')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f'{self.get_full_name() or self.username} ({self.role})'


# ─── Student Profile ──────────────────────────────────────────────────────────

class StudentProfile(models.Model):
    LEVELS = [
        ('beginner', 'Débutant'),
        ('intermediate', 'Intermédiaire'),
        ('advanced', 'Avancé'),
    ]

    LANGUAGES = [
        ('fr', 'Français'),
        ('ar', 'Arabe'),
        ('en', 'Anglais'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='student_profile'
    )
    level = models.CharField(max_length=20, choices=LEVELS, default='beginner')
    field_of_study = models.CharField(max_length=150, blank=True)
    preferred_language = models.CharField(max_length=5, choices=LANGUAGES, default='fr')
    learning_goals = models.TextField(blank=True)
    preferred_formats = models.JSONField(default=list, blank=True)   # ['pdf', 'video', ...]
    preferred_themes = models.JSONField(default=list, blank=True)    # ['math', 'info', ...]
    total_time_spent = models.PositiveIntegerField(default=0)        # seconds
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Profil étudiant'

    def __str__(self):
        return f'Profil de {self.user.username}'


# ─── Teacher Profile ──────────────────────────────────────────────────────────

class TeacherProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='teacher_profile'
    )
    department = models.CharField(max_length=150, blank=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Profil enseignant'

    def __str__(self):
        return f'Profil de {self.user.username}'


# ─── Learning Progress ────────────────────────────────────────────────────────

class LearningProgress(models.Model):
    student = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='learning_progress'
    )
    resource = models.ForeignKey(
        'resources.Resource', on_delete=models.CASCADE, related_name='progress_entries'
    )
    completion_percentage = models.FloatField(default=0.0)
    last_accessed = models.DateTimeField(auto_now=True)
    time_spent = models.PositiveIntegerField(default=0)   # seconds
    is_completed = models.BooleanField(default=False)
    bookmarked = models.BooleanField(default=False)
    last_position_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('student', 'resource')
        verbose_name = 'Progression'
        ordering = ['-last_accessed']

    def __str__(self):
        return f'{self.student.username} → {self.resource.title} ({self.completion_percentage:.0f}%)'
