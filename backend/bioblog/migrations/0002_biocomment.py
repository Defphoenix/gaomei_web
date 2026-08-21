from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("bioblog", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="BioComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField(max_length=2000, verbose_name="评论内容")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="bio_comments", to=settings.AUTH_USER_MODEL, verbose_name="作者")),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="replies", to="bioblog.biocomment", verbose_name="回复")),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="bioblog.biopost", verbose_name="文章")),
            ],
            options={"verbose_name": "生信讨论", "verbose_name_plural": "生信讨论", "ordering": ["created_at"]},
        ),
    ]
