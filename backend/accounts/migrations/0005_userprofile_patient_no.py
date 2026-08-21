from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_ensure_user_profiles")]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="patient_no",
            field=models.CharField(blank=True, db_index=True, max_length=80, null=True, unique=True, verbose_name="患者编号"),
        ),
    ]
