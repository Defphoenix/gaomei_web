import uuid

from django.contrib.auth.models import User
from django.db import models


class BridgeNode(models.Model):
    node_id = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    software_version = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, default="online")
    metadata = models.JSONField(default=dict, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField()

    class Meta:
        ordering = ["node_id"]

    def __str__(self):
        return self.display_name


class BridgeProject(models.Model):
    class SyncStatus(models.TextChoices):
        PENDING_CREATE = "pending_create", "等待node9创建"
        SYNCING = "syncing", "同步中"
        SYNCED = "synced", "已同步"
        PENDING_UPDATE = "pending_update", "等待更新"
        PENDING_DELETE = "pending_delete", "等待删除确认"
        CONFLICT = "conflict", "数据冲突"
        FAILED = "failed", "同步失败"
        ARCHIVED = "archived", "已归档"

    project_uuid = models.UUIDField(primary_key=True, editable=False)
    project_code = models.CharField(max_length=80, unique=True, db_index=True)
    project_name = models.CharField(max_length=160)
    patient_no = models.CharField(max_length=80, db_index=True)
    patient_name = models.CharField(max_length=80)
    origin = models.CharField(max_length=20, default="node9")
    status = models.CharField(max_length=30, default="draft")
    status_label = models.CharField(max_length=80, blank=True)
    sync_status = models.CharField(
        max_length=30, choices=SyncStatus.choices, default=SyncStatus.PENDING_CREATE,
    )
    sync_version = models.PositiveIntegerField(default=1)
    current_revision = models.PositiveIntegerField(default=0)
    samples = models.JSONField(default=list, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    source_manifest = models.JSONField(default=dict, blank=True)
    node = models.ForeignKey(
        BridgeNode, null=True, blank=True, on_delete=models.SET_NULL, related_name="projects"
    )
    created_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="bridge_projects"
    )
    sync_error = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.project_code} {self.patient_no}"


class BridgeUpload(models.Model):
    upload_id = models.CharField(max_length=120, unique=True)
    node = models.ForeignKey(BridgeNode, on_delete=models.PROTECT, related_name="uploads")
    report = models.ForeignKey("reports.Report", on_delete=models.CASCADE, related_name="bridge_uploads")
    payload_sha256 = models.CharField(max_length=64)
    received_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at"]

    def __str__(self):
        return self.upload_id


class BridgeUploadRevision(models.Model):
    upload = models.ForeignKey(
        BridgeUpload, on_delete=models.CASCADE, related_name="revisions"
    )
    revision = models.PositiveIntegerField()
    payload_sha256 = models.CharField(max_length=64)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["revision"]
        constraints = [
            models.UniqueConstraint(
                fields=["upload", "revision"], name="unique_bridge_upload_revision"
            )
        ]

    def __str__(self):
        return f"{self.upload.upload_id}:r{self.revision}"


class BridgeJob(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "等待领取"
        CLAIMED = "claimed", "已领取"
        RUNNING = "running", "运行中"
        CANCEL_REQUESTED = "cancel_requested", "请求取消"
        CANCELED = "canceled", "已取消"
        SUCCEEDED = "succeeded", "成功"
        FAILED = "failed", "失败"

    class JobType(models.TextChoices):
        SMOKE = "smoke", "安全烟测"
        PROJECT_CREATE = "project_create", "创建WES项目"
        TUMOR_NORMAL = "tumor_normal", "肿瘤-正常WES分析"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="bridge_jobs")
    project = models.ForeignKey(
        BridgeProject, null=True, blank=True, on_delete=models.PROTECT, related_name="jobs"
    )
    assigned_node = models.ForeignKey(BridgeNode, on_delete=models.PROTECT, related_name="jobs")
    job_type = models.CharField(max_length=30, choices=JobType.choices)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.QUEUED)
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)
    progress_step = models.CharField(max_length=120, blank=True)
    message = models.TextField(blank=True)
    lease_sha256 = models.CharField(max_length=64, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class BridgeJobLog(models.Model):
    job = models.ForeignKey(BridgeJob, on_delete=models.CASCADE, related_name="logs")
    sequence = models.PositiveIntegerField()
    stream = models.CharField(max_length=20, default="stdout")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence"]
        constraints = [
            models.UniqueConstraint(fields=["job", "sequence"], name="unique_bridge_job_log_sequence")
        ]
