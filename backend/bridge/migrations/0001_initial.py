from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [("reports", "0002_wes_report_payload")]

    operations = [
        migrations.CreateModel(
            name="BridgeNode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("node_id", models.CharField(max_length=100, unique=True)),
                ("display_name", models.CharField(max_length=200)),
                ("software_version", models.CharField(blank=True, max_length=100)),
                ("status", models.CharField(default="online", max_length=30)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("registered_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField()),
            ],
            options={"ordering": ["node_id"]},
        ),
        migrations.CreateModel(
            name="BridgeUpload",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("upload_id", models.CharField(max_length=120, unique=True)),
                ("payload_sha256", models.CharField(max_length=64)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("node", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploads", to="bridge.bridgenode")),
                ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bridge_uploads", to="reports.report")),
            ],
            options={"ordering": ["-received_at"]},
        ),
    ]
