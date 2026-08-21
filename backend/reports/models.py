from django.db import models
from django.contrib.auth.models import User


class Report(models.Model):
    """检测报告"""
    REPORT_TYPES = [
        ("methylation", "甲基化"),
        ("mutation", "突变"),
        ("msi", "MSI"),
        ("cnv", "CNV"),
    ]
    REPORT_STATUS = [
        ("draft", "分析中"),
        ("review", "待审核"),
        ("released", "已发布"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reports")
    title = models.CharField("报告标题", max_length=200)
    report_type = models.CharField("报告类型", max_length=20, choices=REPORT_TYPES)
    sample_id = models.CharField("样本编号", max_length=100)
    report_date = models.DateField("报告日期")
    summary = models.TextField("摘要", blank=True)
    conclusion = models.TextField("结论", blank=True)
    report_number = models.CharField("报告编号", max_length=100, blank=True)
    status = models.CharField("报告状态", max_length=20, choices=REPORT_STATUS, default="draft")
    genome_build = models.CharField("参考组装", max_length=20, default="GRCh38")
    tumor_sample_id = models.CharField("肿瘤样本编号", max_length=100, blank=True)
    normal_sample_id = models.CharField("正常样本编号", max_length=100, blank=True)
    patient_info = models.JSONField("受检者信息", default=dict, blank=True)
    analysis_data = models.JSONField("分析结果数据", default=dict, blank=True)
    annotation_sources = models.JSONField("注释数据来源", default=list, blank=True)
    report_pdf_url = models.CharField("正式PDF地址", max_length=500, blank=True)
    report_pdf_file = models.FileField("正式PDF文件", upload_to="reports/%Y/%m/", blank=True)
    report_pdf_sha256 = models.CharField("PDF SHA256", max_length=64, blank=True)
    reviewed_by = models.CharField("审核人", max_length=100, blank=True)
    released_at = models.DateTimeField("发布时间", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-report_date"]
        verbose_name = "检测报告"
        verbose_name_plural = "检测报告"

    def __str__(self):
        return f"{self.title} ({self.get_report_type_display()})"


class ReportItem(models.Model):
    """报告中的每个变异位点"""
    VARIANT_TYPES = [
        ("SNP", "SNP"),
        ("InDel", "InDel"),
        ("Methylation", "甲基化"),
        ("Amplification", "扩增"),
        ("Deletion", "缺失"),
    ]
    SIGNIFICANCE = [
        ("pathogenic", "致病性"),
        ("likely_pathogenic", "可能致病"),
        ("vus", "意义未明"),
        ("likely_benign", "可能良性"),
        ("benign", "良性"),
    ]

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="items")
    gene = models.CharField("基因名", max_length=50)
    chromosome = models.CharField("染色体", max_length=10)
    position = models.IntegerField("位置")
    end_position = models.IntegerField("终止位置", null=True, blank=True)
    ref_allele = models.CharField("参考等位基因", max_length=500, blank=True)
    alt_allele = models.CharField("变异等位基因", max_length=500, blank=True)
    variant_type = models.CharField("变异类型", max_length=50, choices=VARIANT_TYPES)
    significance = models.CharField("临床意义", max_length=50, choices=SIGNIFICANCE, default="vus")
    af = models.FloatField("等位基因频率", null=True, blank=True)
    methylation_level = models.FloatField("甲基化水平", null=True, blank=True)
    cnv_ratio = models.FloatField("CNV比值", null=True, blank=True)
    annotation = models.TextField("注释", blank=True)
    transcript = models.CharField("转录本", max_length=100, blank=True)
    hgvs_c = models.CharField("核酸HGVS", max_length=200, blank=True)
    hgvs_p = models.CharField("蛋白HGVS", max_length=200, blank=True)
    consequence = models.CharField("变异后果", max_length=100, blank=True)
    tumor_depth = models.IntegerField("肿瘤深度", null=True, blank=True)
    tumor_alt_reads = models.IntegerField("肿瘤ALT支持数", null=True, blank=True)
    normal_depth = models.IntegerField("正常深度", null=True, blank=True)
    normal_alt_reads = models.IntegerField("正常ALT支持数", null=True, blank=True)
    tlod = models.FloatField("TLOD", null=True, blank=True)
    filter_status = models.CharField("过滤状态", max_length=100, blank=True)
    review_status = models.CharField("审核状态", max_length=50, default="pending")
    annotations = models.JSONField("多数据库注释", default=dict, blank=True)
    therapies = models.JSONField("药物与临床证据", default=list, blank=True)
    neoantigens = models.JSONField("新抗原候选", default=list, blank=True)
    bam_track_url = models.CharField("BAM Track URL", max_length=500, blank=True)
    bam_index_url = models.CharField("BAM Index URL", max_length=500, blank=True)
    vcf_track_url = models.CharField("VCF Track URL", max_length=500, blank=True)
    vcf_index_url = models.CharField("VCF Index URL", max_length=500, blank=True)

    class Meta:
        ordering = ["chromosome", "position"]
        verbose_name = "变异位点"
        verbose_name_plural = "变异位点"

    def __str__(self):
        return f"{self.gene} {self.chromosome}:{self.position}"

    @property
    def locus(self):
        end = self.end_position or self.position
        return f"chr{self.chromosome}:{self.position}-{end}"

    @property
    def ucsc_url(self):
        return f"https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position={self.locus}"


class ReportAccessLog(models.Model):
    class Action(models.TextChoices):
        VIEW = "view", "查看"
        DOWNLOAD_PDF = "download_pdf", "下载PDF"

    report = models.ForeignKey(Report, on_delete=models.CASCADE, related_name="access_logs")
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=30, choices=Action.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PatientReportSlot(models.Model):
    """一行一个患者编号：管理员正式报告台账。"""

    patient_no = models.CharField("患者编号", max_length=80, unique=True, db_index=True)
    patient_name = models.CharField("患者姓名", max_length=80, blank=True)
    user = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="report_slots",
    )
    report = models.ForeignKey(
        Report, null=True, blank=True, on_delete=models.SET_NULL, related_name="patient_slots",
    )
    active_bundle = models.ForeignKey(
        "SampleBundle",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="active_for_slots",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "患者报告台账"
        verbose_name_plural = "患者报告台账"

    def __str__(self):
        return self.patient_no


class SampleBundle(models.Model):
    """一次 node9 上传对应的样本版本目录。"""

    class Status(models.TextChoices):
        ACTIVE = "active", "当前有效"
        SUPERSEDED = "superseded", "已作废"

    slot = models.ForeignKey(PatientReportSlot, on_delete=models.CASCADE, related_name="bundles")
    sample_id = models.CharField("样本编号", max_length=100, db_index=True)
    upload_id = models.CharField("上传ID", max_length=120, unique=True)
    wes_report_id = models.CharField("WES报告ID", max_length=100, db_index=True)
    root_dir = models.CharField("版本目录", max_length=500)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True,
    )
    manifest = models.JSONField(default=dict, blank=True)
    payload_sha256 = models.CharField(max_length=64, blank=True)
    node_id = models.CharField(max_length=100, blank=True)
    pdf_ready = models.BooleanField(default=False)
    pdf_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    superseded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "样本报告包"
        verbose_name_plural = "样本报告包"
        indexes = [
            models.Index(fields=["sample_id", "status"]),
        ]

    def __str__(self):
        return f"{self.sample_id}:{self.upload_id} ({self.status})"


class BundleFile(models.Model):
    """包内每个文件一条路径映射。"""

    class Role(models.TextChoices):
        REPORT_JSON = "report_json", "报告JSON"
        GENERATED_PDF = "generated_pdf", "生成PDF"
        GENERATED_HTML = "generated_html", "生成HTML"
        QC_PLOT = "qc_plot", "质控图"
        ATTACHMENT = "attachment", "附件"
        OTHER = "other", "其他"

    bundle = models.ForeignKey(SampleBundle, on_delete=models.CASCADE, related_name="files")
    role = models.CharField(max_length=40, choices=Role.choices, default=Role.OTHER)
    original_name = models.CharField(max_length=255)
    rel_path = models.CharField(max_length=500)
    abs_path = models.CharField(max_length=1000)
    sha256 = models.CharField(max_length=64, blank=True)
    size_bytes = models.BigIntegerField(default=0)
    content_type = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        verbose_name = "报告包文件"
        verbose_name_plural = "报告包文件"
        constraints = [
            models.UniqueConstraint(
                fields=["bundle", "rel_path"], name="unique_bundle_file_rel_path",
            ),
        ]

    def __str__(self):
        return f"{self.bundle_id}:{self.rel_path}"
