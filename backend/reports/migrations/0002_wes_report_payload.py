from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="report",
            name="analysis_data",
            field=models.JSONField(blank=True, default=dict, verbose_name="分析结果数据"),
        ),
        migrations.AddField(
            model_name="report",
            name="annotation_sources",
            field=models.JSONField(blank=True, default=list, verbose_name="注释数据来源"),
        ),
        migrations.AddField(
            model_name="report",
            name="genome_build",
            field=models.CharField(default="GRCh38", max_length=20, verbose_name="参考组装"),
        ),
        migrations.AddField(
            model_name="report",
            name="normal_sample_id",
            field=models.CharField(blank=True, max_length=100, verbose_name="正常样本编号"),
        ),
        migrations.AddField(
            model_name="report",
            name="patient_info",
            field=models.JSONField(blank=True, default=dict, verbose_name="受检者信息"),
        ),
        migrations.AddField(
            model_name="report",
            name="released_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="发布时间"),
        ),
        migrations.AddField(
            model_name="report",
            name="report_number",
            field=models.CharField(blank=True, max_length=100, verbose_name="报告编号"),
        ),
        migrations.AddField(
            model_name="report",
            name="report_pdf_url",
            field=models.CharField(blank=True, max_length=500, verbose_name="正式PDF地址"),
        ),
        migrations.AddField(
            model_name="report",
            name="reviewed_by",
            field=models.CharField(blank=True, max_length=100, verbose_name="审核人"),
        ),
        migrations.AddField(
            model_name="report",
            name="status",
            field=models.CharField(
                choices=[("draft", "分析中"), ("review", "待审核"), ("released", "已发布")],
                default="draft",
                max_length=20,
                verbose_name="报告状态",
            ),
        ),
        migrations.AddField(
            model_name="report",
            name="tumor_sample_id",
            field=models.CharField(blank=True, max_length=100, verbose_name="肿瘤样本编号"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="annotations",
            field=models.JSONField(blank=True, default=dict, verbose_name="多数据库注释"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="consequence",
            field=models.CharField(blank=True, max_length=100, verbose_name="变异后果"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="filter_status",
            field=models.CharField(blank=True, max_length=100, verbose_name="过滤状态"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="hgvs_c",
            field=models.CharField(blank=True, max_length=200, verbose_name="核酸HGVS"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="hgvs_p",
            field=models.CharField(blank=True, max_length=200, verbose_name="蛋白HGVS"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="neoantigens",
            field=models.JSONField(blank=True, default=list, verbose_name="新抗原候选"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="normal_alt_reads",
            field=models.IntegerField(blank=True, null=True, verbose_name="正常ALT支持数"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="normal_depth",
            field=models.IntegerField(blank=True, null=True, verbose_name="正常深度"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="review_status",
            field=models.CharField(default="pending", max_length=50, verbose_name="审核状态"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="therapies",
            field=models.JSONField(blank=True, default=list, verbose_name="药物与临床证据"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="tlod",
            field=models.FloatField(blank=True, null=True, verbose_name="TLOD"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="transcript",
            field=models.CharField(blank=True, max_length=100, verbose_name="转录本"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="tumor_alt_reads",
            field=models.IntegerField(blank=True, null=True, verbose_name="肿瘤ALT支持数"),
        ),
        migrations.AddField(
            model_name="reportitem",
            name="tumor_depth",
            field=models.IntegerField(blank=True, null=True, verbose_name="肿瘤深度"),
        ),
    ]
