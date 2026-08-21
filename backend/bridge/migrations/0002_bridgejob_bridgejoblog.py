from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [("bridge", "0001_initial"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="BridgeJob",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("job_type", models.CharField(choices=[("smoke", "安全烟测")], max_length=30)),
                ("status", models.CharField(choices=[("queued", "等待领取"), ("claimed", "已领取"), ("running", "运行中"), ("cancel_requested", "请求取消"), ("canceled", "已取消"), ("succeeded", "成功"), ("failed", "失败")], default="queued", max_length=30)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("result", models.JSONField(blank=True, default=dict)),
                ("progress_percent", models.PositiveSmallIntegerField(default=0)),
                ("progress_step", models.CharField(blank=True, max_length=120)),
                ("message", models.TextField(blank=True)),
                ("lease_sha256", models.CharField(blank=True, max_length=64)),
                ("claimed_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assigned_node", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="jobs", to="bridge.bridgenode")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="bridge_jobs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="BridgeJobLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sequence", models.PositiveIntegerField()),
                ("stream", models.CharField(default="stdout", max_length=20)),
                ("message", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("job", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="logs", to="bridge.bridgejob")),
            ],
            options={"ordering": ["sequence"]},
        ),
        migrations.AddConstraint(
            model_name="bridgejoblog",
            constraint=models.UniqueConstraint(fields=("job", "sequence"), name="unique_bridge_job_log_sequence"),
        ),
    ]
