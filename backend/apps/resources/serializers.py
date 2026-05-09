from rest_framework import serializers
from .models import Resource, Category


class CategorySerializer(serializers.ModelSerializer):
    resource_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'icon', 'resource_count']

    def get_resource_count(self, obj):
        return obj.resources.filter(is_active=True, is_validated=True).count()


class ResourceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for lists / search results."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True
    )

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'thumbnail', 'category_name',
            'level', 'format', 'language', 'tags',
            'view_count', 'average_rating', 'rating_count',
            'is_validated', 'uploaded_by_name', 'created_at',
        ]


class ResourceDetailSerializer(serializers.ModelSerializer):
    """Full serializer for the resource detail page."""
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source='category', write_only=True, required=False
    )
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True
    )

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'file', 'thumbnail', 'external_url',
            'category', 'category_id',
            'level', 'format', 'language', 'tags',
            # DCAT
            'dcat_identifier', 'dcat_publisher', 'dcat_license',
            'dcat_issued', 'dcat_modified', 'dcat_keywords',
            # Ownership
            'uploaded_by_name', 'is_validated', 'is_active',
            # Metrics
            'view_count', 'download_count', 'average_rating', 'rating_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['view_count', 'download_count', 'average_rating',
                            'rating_count', 'created_at', 'updated_at']


class ResourceCreateUpdateSerializer(serializers.ModelSerializer):
    """Used by teachers/admins when creating or editing a resource."""

    class Meta:
        model = Resource
        fields = [
            'title', 'description', 'file', 'thumbnail', 'external_url',
            'category', 'level', 'format', 'language', 'tags',
            'dcat_identifier', 'dcat_publisher', 'dcat_license',
            'dcat_issued', 'dcat_modified', 'dcat_keywords',
        ]

    def create(self, validated_data):
        resource = super().create(validated_data)
        from .indexer import index_resource
        from .thumbnails import generate_thumbnail
        index_resource(resource)
        generate_thumbnail(resource)
        return resource

    def update(self, instance, validated_data):
        file_changed = 'file' in validated_data
        resource = super().update(instance, validated_data)
        from .indexer import index_resource
        from .thumbnails import generate_thumbnail
        index_resource(resource)
        if file_changed:
            generate_thumbnail(resource, force=True)
        return resource
