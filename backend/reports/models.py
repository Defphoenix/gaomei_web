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
