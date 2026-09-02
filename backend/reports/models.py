"""Gomics Data V2 core models: Patient 1:N Report (+ assets/variants/access logs)."""
from django.conf import settings
from django.db import models


class SexChoices(models.TextChoices):
    MALE = "male", "男"
    FEMALE = "female", "女"
    OTHER = "other", "其他"
    UNKNOWN = "unknown", "未知"


class Patient(models.Model):
    """受检者主数据。User 可选 1:1 绑定；可先有报告再绑账号。"""

    patient_no = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patient_profile",
    )
    name = models.CharField(max_length=128, db_index=True)
    sex = models.CharField(
        max_length=16, choices=SexChoices.choices, blank=True, default="",
    )
    birth_date = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=32, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "受检者"
        verbose_name_plural = "受检者"

    def __str__(self):
        return f"{self.patient_no} · {self.name}"


class ReportStatus(models.TextChoices):
    DRAFT = "draft", "分析中"
    REVIEW = "review", "待审核"
    RELEASED = "released", "已发布"
    VOID = "void", "已作废"


class Report(models.Model):
    """检测报告：Patient 1:N。权限以 patient.user + status 为准。"""

    patient = models.ForeignKey(
        Patient, on_delete=models.PROTECT, related_name="reports",
    )
    report_number = models.CharField(max_length=64, unique=True, db_index=True)
    external_source = models.CharField(max_length=64, blank=True, default="", db_index=True)
    external_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    product_code = models.CharField(max_length=64, blank=True, default="", db_index=True)
    report_type = models.CharField(max_length=32, db_index=True)
    title = models.CharField(max_length=255, blank=True, default="")
    sample_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    tumor_sample_id = models.CharField(max_length=128, blank=True, default="")
    normal_sample_id = models.CharField(max_length=128, blank=True, default="")
    report_date = models.DateField(null=True, blank=True, db_index=True)
    genome_build = models.CharField(max_length=32, blank=True, default="GRCh38")
    status = models.CharField(
        max_length=16,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
        db_index=True,
    )
    summary = models.TextField(blank=True, default="")
    conclusion = models.TextField(blank=True, default="")
    patient_snapshot = models.JSONField(default=dict, blank=True)
    analysis_data = models.JSONField(default=dict, blank=True)
    annotation_sources = models.JSONField(default=dict, blank=True)
    data_schema_version = models.CharField(max_length=32, default="2.0")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_reports",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-report_date", "-released_at", "-created_at"]
        verbose_name = "检测报告"
        verbose_name_plural = "检测报告"
        constraints = [
            models.UniqueConstraint(
                fields=["external_source", "external_id"],
                condition=~models.Q(external_id=""),
                name="uniq_report_external_source_external_id",
            ),
        ]

    def __str__(self):
        return f"{self.report_number} ({self.status})"


class ReportAsset(models.Model):
    """报告附件元数据（PDF/BAM 等）；二进制不进库。"""

    class AssetType(models.TextChoices):
        PDF = "pdf", "PDF"
        BAM = "bam", "BAM"
        BAI = "bai", "BAI"
        VCF = "vcf", "VCF"
        BED = "bed", "BED"
        IMAGE = "image", "Image"
        JSON = "json", "JSON"
        OTHER = "other", "Other"

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="assets")
    asset_type = models.CharField(max_length=32, choices=AssetType.choices, db_index=True)
    name = models.CharField(max_length=255)
    storage_backend = models.CharField(max_length=32, default="local")
    file_path = models.CharField(max_length=1024, blank=True, default="")
    external_url = models.URLField(max_length=2048, blank=True, default="")
    sha256 = models.CharField(max_length=64, blank=True, default="", db_index=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=128, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "报告附件"
        verbose_name_plural = "报告附件"

    def __str__(self):
        return f"{self.report_id}:{self.asset_type}:{self.name}"


class ReportVariant(models.Model):
    """可检索变异索引；完整结果仍在 analysis_data。"""

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="variants")
    chromosome = models.CharField(max_length=32, db_index=True)
    position = models.BigIntegerField(db_index=True)
    ref = models.CharField(max_length=512, blank=True, default="")
    alt = models.CharField(max_length=512, blank=True, default="")
    gene = models.CharField(max_length=64, blank=True, default="", db_index=True)
    variant_type = models.CharField(max_length=32, blank=True, default="", db_index=True)
    consequence = models.CharField(max_length=128, blank=True, default="")
    allele_frequency = models.FloatField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["chromosome", "position"]
        verbose_name = "报告变异"
        verbose_name_plural = "报告变异"
        indexes = [
            models.Index(fields=["report", "gene"]),
            models.Index(fields=["chromosome", "position"]),
        ]

    def __str__(self):
        return f"{self.gene} {self.chromosome}:{self.position}"


class ReportAccessLog(models.Model):
    class Action(models.TextChoices):
        VIEW = "view", "查看"
        DOWNLOAD_PDF = "download_pdf", "下载PDF"
        DOWNLOAD_ASSET = "download_asset", "下载附件"

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="access_logs")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "报告访问日志"
        verbose_name_plural = "报告访问日志"
