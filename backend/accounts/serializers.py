from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import GenomicTrack


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "password_confirm"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "两次密码不一致"})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user


class DevelopmentPasswordResetSerializer(serializers.Serializer):
    username = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_username(self, value):
        try:
            return User.objects.get(username=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("未找到该用户名")

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "两次密码不一致"})
        validate_password(attrs["new_password"], user=attrs["username"])
        return attrs

    def save(self):
        user = self.validated_data["username"]
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class UserSerializer(serializers.ModelSerializer):
    is_bioinfo = serializers.BooleanField(source="profile.is_bioinfo", read_only=True)
    role = serializers.SerializerMethodField()
    report_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "date_joined", "is_staff", "is_bioinfo", "role", "report_count"]
        read_only_fields = fields

    def get_role(self, obj):
        if obj.is_staff:
            return "admin"
        return getattr(getattr(obj, "profile", None), "role", "customer")

    def get_report_count(self, obj):
        from reports.access import visible_reports_for_user
        return visible_reports_for_user(obj).count()


class GenomicTrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = GenomicTrack
        fields = ["id", "name", "description", "track_type", "genome",
                  "url", "index_url", "file_format", "is_public"]
        read_only_fields = ["id"]
