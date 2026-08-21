from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("company", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="teammember",
            name="expertise",
            field=models.CharField(blank=True, help_text="多个标签使用中文逗号分隔", max_length=300, verbose_name="专业方向"),
        ),
        migrations.AddField(
            model_name="teammember",
            name="is_active",
            field=models.BooleanField(default=True, verbose_name="首页展示"),
        ),
    ]
