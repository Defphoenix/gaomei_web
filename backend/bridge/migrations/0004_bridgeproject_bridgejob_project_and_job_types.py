import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bridge", "0003_bridgeuploadrevision_bridgeupload_updated_at"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="BridgeProject",
            fields=[
                ("project_uuid", models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ("project_code", models.CharField(db_index=True, max_length=80, unique=True)),
                ("project_name", models.CharField(max_length=160)),
                ("patient_no", models.CharField(db_index=True, max_length=80)),
                ("patient_name", models.CharField(max_length=80)),
                ("origin", models.CharField(default="node9", max_length=20)),
                ("status", models.CharField(default="draft", max_length=30)),
                ("status_label", models.CharField(blank=True, max_length=80)),
                ("sync_status", models.CharField(choices=[("pending_create", "等待node9创建"), ("syncing", "同步中"), ("synced", "已同步"), ("pending_update", "等待更新"), ("pending_delete", "等待删除确认"), ("conflict", "数据冲突"), ("failed", "同步失败"), ("archived", "已归档")], default="pending_create", max_length=30)),
                ("sync_version", models.PositiveIntegerField(default=1)),
                ("current_revision", models.PositiveIntegerField(default=0)),
                ("samples", models.JSONField(blank=True, default=list)),
                ("parameters", models.JSONField(blank=True, default=dict)),
                ("source_manifest", models.JSONField(blank=True, default=dict)),
                ("sync_error", models.TextField(blank=True)),
                ("last_synced_at", models.DateTimeField(blank=True, null=True)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="bridge_projects", to=settings.AUTH_USER_MODEL)),
                ("node", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="projects", to="bridge.bridgenode")),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.AddField(
            model_name="bridgejob",
            name="project",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="jobs", to="bridge.bridgeproject"),
        ),
        migrations.AlterField(
            model_name="bridgejob",
            name="job_type",
            field=models.CharField(choices=[("smoke", "安全烟测"), ("project_create", "创建WES项目"), ("tumor_normal", "肿瘤-正常WES分析")], max_length=30),
        ),
    ]
