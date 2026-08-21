from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("bridge", "0002_bridgejob_bridgejoblog")]

    operations = [
        migrations.AddField(
            model_name="bridgeupload",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.CreateModel(
            name="BridgeUploadRevision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("revision", models.PositiveIntegerField()),
                ("payload_sha256", models.CharField(max_length=64)),
                ("received_at", models.DateTimeField(auto_now_add=True)),
                ("upload", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="revisions", to="bridge.bridgeupload")),
            ],
            options={"ordering": ["revision"]},
        ),
        migrations.AddConstraint(
            model_name="bridgeuploadrevision",
            constraint=models.UniqueConstraint(fields=("upload", "revision"), name="unique_bridge_upload_revision"),
        ),
    ]
