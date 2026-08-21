from rest_framework import serializers
from .models import Category, Tag, Post


class CategorySerializer(serializers.ModelSerializer):
    post_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description", "post_count"]

    def get_post_count(self, obj):
        return obj.post_set.filter(status="published").count()


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class PostListSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    category_slug = serializers.CharField(source="category.slug", read_only=True, default="")
    tags = TagSerializer(many=True, read_only=True)
    featured_image_url = serializers.ImageField(source="featured_image", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id", "title", "slug", "author_name", "category_name", "category_slug",
            "tags", "summary", "featured_image", "featured_image_url", "views", "status",
            "wechat_link", "show_on_homepage", "homepage_order", "published_at", "created_at",
        ]


class PostDetailSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True, default="")
    category_slug = serializers.CharField(source="category.slug", read_only=True, default="")
    tags = TagSerializer(many=True, read_only=True)
    featured_image_url = serializers.ImageField(source="featured_image", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id", "title", "slug", "author_name", "category_name", "category_slug",
            "tags", "content", "summary", "featured_image", "featured_image_url", "views",
            "wechat_link", "status", "show_on_homepage", "homepage_order",
            "published_at", "created_at", "updated_at",
        ]


class PostCreateUpdateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Post
        fields = [
            "title", "slug", "category", "tags", "content",
            "summary", "featured_image", "wechat_link", "status", "published_at",
            "show_on_homepage", "homepage_order",
        ]

    def validate(self, attrs):
        current = self.instance
        homepage_selected = attrs.get(
            "show_on_homepage",
            current.show_on_homepage if current else False,
        )
        publish_status = attrs.get(
            "status",
            current.status if current else "draft",
        )

        if homepage_selected and publish_status != "published":
            raise serializers.ValidationError({
                "show_on_homepage": "只有已发布的资讯才能推荐到首页。"
            })

        if homepage_selected:
            recommended = Post.objects.filter(
                status="published",
                show_on_homepage=True,
            )
            if current:
                recommended = recommended.exclude(pk=current.pk)
            if recommended.count() >= 3:
                raise serializers.ValidationError({
                    "show_on_homepage": "首页最多推荐 3 篇资讯。"
                })

        return attrs
