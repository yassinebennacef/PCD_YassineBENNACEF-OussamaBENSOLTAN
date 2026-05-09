from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import User, StudentProfile, TeacherProfile, LearningProgress


# ─── JWT Custom Claims ────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        return token


# ─── User ─────────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'avatar', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


# ─── Student Profile ──────────────────────────────────────────────────────────

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = ['id', 'level', 'field_of_study', 'preferred_language',
                  'learning_goals', 'preferred_formats', 'preferred_themes',
                  'total_time_spent', 'updated_at']
        read_only_fields = ['id', 'total_time_spent', 'updated_at']


class StudentProfileDetailSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StudentProfile
        fields = '__all__'


# ─── Teacher Profile ──────────────────────────────────────────────────────────

class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = ['id', 'department', 'bio']


# ─── Registration ─────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True,
                                     validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='Confirm password')

    # Profile fields — optional
    level = serializers.ChoiceField(
        choices=StudentProfile.LEVELS, required=False, default='beginner'
    )
    field_of_study = serializers.CharField(required=False, allow_blank=True)
    preferred_language = serializers.ChoiceField(
        choices=StudentProfile.LANGUAGES, required=False, default='fr'
    )
    department = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name',
                  'password', 'password2', 'role',
                  'level', 'field_of_study', 'preferred_language', 'department']

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password2'):
            raise serializers.ValidationError({'password': 'Les mots de passe ne correspondent pas.'})
        return attrs

    def create(self, validated_data):
        role = validated_data.get('role', 'student')
        # Extract profile fields
        level = validated_data.pop('level', 'beginner')
        field_of_study = validated_data.pop('field_of_study', '')
        preferred_language = validated_data.pop('preferred_language', 'fr')
        department = validated_data.pop('department', '')

        user = User.objects.create_user(**validated_data)

        if role == 'student':
            StudentProfile.objects.create(
                user=user,
                level=level,
                field_of_study=field_of_study,
                preferred_language=preferred_language,
            )
        elif role == 'teacher':
            TeacherProfile.objects.create(user=user, department=department)

        return user


# ─── Learning Progress ────────────────────────────────────────────────────────

class LearningProgressSerializer(serializers.ModelSerializer):
    resource_title = serializers.CharField(source='resource.title', read_only=True)
    resource_id = serializers.IntegerField(source='resource.id', read_only=True)

    class Meta:
        model = LearningProgress
        fields = ['id', 'resource_id', 'resource_title', 'completion_percentage',
                  'last_accessed', 'time_spent', 'is_completed', 'bookmarked',
                  'last_position_seconds']
        read_only_fields = ['id', 'last_accessed']
