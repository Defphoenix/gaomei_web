from django.db import migrations


def ensure_profiles(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserProfile = apps.get_model("accounts", "UserProfile")
    for user in User.objects.all():
        role = "admin" if user.is_staff else "customer"
        UserProfile.objects.get_or_create(
            user_id=user.id,
            defaults={"role": role, "is_bioinfo": False},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_userprofile_role"),
    ]

    operations = [
        migrations.RunPython(ensure_profiles, migrations.RunPython.noop),
    ]
