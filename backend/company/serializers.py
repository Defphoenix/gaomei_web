from rest_framework import serializers
from .models import CompanyInfo, TeamMember, Service, ContactMessage


class CompanyInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInfo
        fields = "__all__"


class TeamMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamMember
        fields = ["id", "name", "position", "bio", "expertise", "photo", "order", "is_active"]


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "title", "description", "icon", "order"]


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["name", "phone", "category", "product", "content"]
        extra_kwargs = {
            "content": {"required": False, "allow_blank": True},
            "product": {"required": False, "allow_blank": True},
        }

    def validate_phone(self, value: str) -> str:
        cleaned = (value or "").strip()
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        if len(digits) < 7:
            raise serializers.ValidationError("请填写有效的联系电话")
        return cleaned

    def validate_content(self, value: str) -> str:
        return (value or "").strip()

    def validate(self, attrs):
        category = attrs.get("category") or "product"
        content = attrs.get("content") or ""
        if category == "interpret" and not content:
            attrs["content"] = "预约产品解读"
        elif len(content) < 4:
            raise serializers.ValidationError({"content": "请填写留言内容"})
        return attrs


class ContactMessageAdminSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ContactMessage
        fields = [
            "id",
            "name",
            "phone",
            "category",
            "category_label",
            "product",
            "content",
            "status",
            "status_label",
            "admin_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "name",
            "phone",
            "category",
            "category_label",
            "product",
            "content",
            "created_at",
            "updated_at",
            "status_label",
        ]
