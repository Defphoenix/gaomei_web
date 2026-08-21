from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """用户扩展信息"""
    ROLE_CHOICES = [
        ("customer", "客户"),
        ("analyst", "生信分析员"),
        ("reviewer", "审核员"),
        ("admin", "管理员"),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    is_bioinfo = models.BooleanField("生信组成员", default=False, help_text="勾选后该用户可访问生信博客")
    role = models.CharField("用户角色", max_length=20, choices=ROLE_CHOICES, default="customer")
    patient_no = models.CharField("患者编号", max_length=80, null=True, blank=True, unique=True, db_index=True)

    class Meta:
        verbose_name = "用户扩展"
        verbose_name_plural = "用户扩展"

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


class GenomicTrack(models.Model):
    """存储可用的基因组 track 配置"""
    TRACK_TYPES = [
        ("alignment", "Alignment"),
        ("variant", "Variant"),
        ("annotation", "Annotation"),
    ]
    FILE_FORMATS = [
        ("bam", "BAM"),
        ("cram", "CRAM"),
        ("vcf", "VCF"),
        ("bed", "BED"),
        ("bigwig", "BigWig"),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    track_type = models.CharField(max_length=50, choices=TRACK_TYPES)
    genome = models.CharField(max_length=20, default="hg38")
    url = models.URLField(max_length=500, help_text="BAM/CRAM/VCF 文件 URL")
    index_url = models.URLField(max_length=500, help_text="BAI/CRAI/TBI 索引 URL")
    file_format = models.CharField(max_length=20, choices=FILE_FORMATS)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.track_type})"
