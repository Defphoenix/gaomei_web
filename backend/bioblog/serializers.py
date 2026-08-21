from rest_framework import serializers
from .models import BioCategory, BioTag, BioPost, BioComment


class BioCategorySerializer(serializers.ModelSerializer):
    post_count = serializers.SerializerMethodField()

    class Meta:
        model = BioCategory
        fields = ["id", "name", "slug", "description", "icon", "color", "order", "post_count"]

    def get_post_count(self, obj):
        return obj.biopost_set.filter(status="published").count()


class BioTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = BioTag
        fields = ["id", "name", "slug"]


class BioPostListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    category_slug = serializers.CharField(source="category.slug", read_only=True, default="")
    tags = BioTagSerializer(many=True, read_only=True)
    featured_image_url = serializers.ImageField(source="featured_image", read_only=True)

    class Meta:
        model = BioPost
        fields = [
            "id", "title", "slug", "author_name", "category_name", "category_slug",
            "tags", "summary", "featured_image", "featured_image_url", "views",
            "status", "is_pinned", "published_at", "created_at",
        ]


class BioPostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    category_slug = serializers.CharField(source="category.slug", read_only=True, default="")
    tags = BioTagSerializer(many=True, read_only=True)
    featured_image_url = serializers.ImageField(source="featured_image", read_only=True)

    class Meta:
        model = BioPost
        fields = [
            "id", "title", "slug", "author_name", "category_name", "category_slug",
            "tags", "content", "summary", "featured_image", "featured_image_url",
            "views", "status", "is_pinned", "published_at", "created_at", "updated_at",
        ]


class BioPostCreateUpdateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = BioPost
        fields = [
            "title", "slug", "category", "tags", "content",
            "summary", "featured_image", "status", "is_pinned", "published_at",
        ]


class BioCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    author_role = serializers.SerializerMethodField()

    class Meta:
        model = BioComment
        fields = ["id", "post", "author_name", "author_role", "content", "parent", "created_at", "updated_at"]
        read_only_fields = ["id", "post", "author_name", "author_role", "created_at", "updated_at"]

    def get_author_role(self, obj):
        if obj.author.is_staff:
            return "admin"
        return getattr(getattr(obj.author, "profile", None), "role", "customer")
