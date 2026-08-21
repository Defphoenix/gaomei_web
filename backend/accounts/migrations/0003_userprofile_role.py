from django.db import migrations, models


def migrate_existing_roles(apps, schema_editor):
    UserProfile = apps.get_model("accounts", "UserProfile")
    for profile in UserProfile.objects.select_related("user"):
        if profile.user.is_staff:
            profile.role = "admin"
        elif profile.is_bioinfo:
            profile.role = "analyst"
        else:
            profile.role = "customer"
        profile.save(update_fields=["role"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="role",
            field=models.CharField(
                choices=[("customer", "客户"), ("analyst", "生信分析员"), ("reviewer", "审核员"), ("admin", "管理员")],
                default="customer",
                max_length=20,
                verbose_name="用户角色",
            ),
        ),
        migrations.RunPython(migrate_existing_roles, migrations.RunPython.noop),
    ]
