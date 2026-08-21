from django.db import migrations, models


def keep_only_three_homepage_posts(apps, schema_editor):
    Post = apps.get_model("blog", "Post")
    recommended_ids = list(
        Post.objects.filter(status="published", show_on_homepage=True)
        .order_by("homepage_order", "-published_at", "-created_at")
        .values_list("id", flat=True)[:3]
    )
    Post.objects.filter(show_on_homepage=True).exclude(id__in=recommended_ids).update(
        show_on_homepage=False
    )


class Migration(migrations.Migration):

    dependencies = [
        ("blog", "0004_post_homepage_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="post",
            name="show_on_homepage",
            field=models.BooleanField(
                default=False,
                help_text="是否展示在官网首页资讯区域",
                verbose_name="首页推荐",
            ),
        ),
        migrations.RunPython(
            keep_only_three_homepage_posts,
            migrations.RunPython.noop,
        ),
    ]
