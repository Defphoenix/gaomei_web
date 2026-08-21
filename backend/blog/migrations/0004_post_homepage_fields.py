from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("blog", "0003_make_content_blankable"),
    ]

    operations = [
        migrations.AddField(
            model_name="post",
            name="show_on_homepage",
            field=models.BooleanField(default=True, help_text="是否展示在官网首页资讯区域", verbose_name="首页推荐"),
        ),
        migrations.AddField(
            model_name="post",
            name="homepage_order",
            field=models.PositiveIntegerField(default=0, help_text="数值越小越靠前", verbose_name="首页排序"),
        ),
    ]
