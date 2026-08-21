import hashlib
import hmac
import csv
import io
import json
import re
import secrets
import uuid
from datetime import date, timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reports.models import Report, ReportItem

from .models import (
    BridgeJob, BridgeJobLog, BridgeNode, BridgeProject, BridgeUpload, BridgeUploadRevision,
)


SAFE_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,120}$")
SAFE_PROJECT_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$")
PROJECT_CSV_FIELDS = (
    "project_code", "project_name", "patient_no", "patient_name", "received_at",
    "tumor_sample_id", "tumor_fastq_dir", "normal_sample_id", "normal_fastq_dir",
    "reference_profile", "interval_bed", "threads", "memory_gb", "min_tumor_af",
    "min_tlod", "run_bqsr", "run_hla_typing", "run_hla_binding", "run_neoantigen",
    "run_cnv", "run_msi", "run_sv", "auto_submit", "previous_project_code", "notes",
)


class HasBridgeToken(BasePermission):
    def has_permission(self, request, view):
        expected = settings.GAOMEI_BRIDGE_TOKEN_SHA256.strip().lower()
        token = request.headers.get("X-Gaomei-Bridge-Token", "").strip()
        if not expected or not token:
            return False
        actual = hashlib.sha256(token.encode("utf-8")).hexdigest()
        return hmac.compare_digest(actual, expected)


class IsInternalRole(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        role = getattr(getattr(request.user, "profile", None), "role", "customer")
        return request.user.is_staff or role in {"admin", "analyst", "reviewer"}


def valid_id(value):
    value = str(value or "")
    return value if SAFE_ID.fullmatch(value) else ""


def normalize_patient_no(value):
    return str(value or "").strip().translate(str.maketrans("０１２３４５６７８９", "0123456789")).upper()


def as_bool(value, default=False):
    text = str(value or "").strip().lower()
    if not text:
        return default
    if text in {"1", "true", "yes", "y", "是"}:
        return True
    if text in {"0", "false", "no", "n", "否"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def bridge_project_dict(project):
    latest_job = project.jobs.select_related("assigned_node").first()
    return {
        "id": str(project.project_uuid),
        "project_uuid": str(project.project_uuid),
        "project_code": project.project_code,
        "project_name": project.project_name,
        "patient_no": project.patient_no,
        "patient_name": project.patient_name,
        "origin": project.origin,
        "status": project.status,
        "status_label": project.status_label or project.status,
        "sync_status": project.sync_status,
        "sync_status_label": project.get_sync_status_display(),
        "sync_version": project.sync_version,
        "current_revision": project.current_revision,
        "samples": project.samples,
        "parameters": project.parameters,
        "sync_error": project.sync_error,
        "node_id": project.node.node_id if project.node_id else "",
        "last_synced_at": project.last_synced_at,
        "updated_at": project.updated_at,
        "latest_job": job_dict(latest_job, include_payload=True) if latest_job else None,
    }


def normalize_project_payload(data):
    code = str(data.get("project_code") or data.get("code") or "").strip()
    if not SAFE_PROJECT_CODE.fullmatch(code):
        raise ValueError("Invalid project_code")
    name = str(data.get("project_name") or data.get("name") or "").strip()
    patient_no = normalize_patient_no(data.get("patient_no"))
    patient_name = str(data.get("patient_name") or "").strip()
    if not name or not patient_no or not patient_name:
        raise ValueError("project_name, patient_no and patient_name are required")
    samples = data.get("samples") if isinstance(data.get("samples"), list) else [
        {
            "sample_id": str(data.get("normal_sample_id") or "").strip(),
            "role": "normal", "local_path": str(data.get("normal_fastq_dir") or "").strip(),
            "received_at": str(data.get("received_at") or "").strip(),
        },
        {
            "sample_id": str(data.get("tumor_sample_id") or "").strip(),
            "role": "tumor", "local_path": str(data.get("tumor_fastq_dir") or "").strip(),
            "received_at": str(data.get("received_at") or "").strip(),
        },
    ]
    normal = [item for item in samples if item.get("role") == "normal"]
    tumors = [item for item in samples if item.get("role") == "tumor"]
    if len(normal) != 1 or not tumors:
        raise ValueError("Exactly one normal sample and at least one tumor sample are required")
    for sample in samples:
        if not str(sample.get("sample_id") or "").strip() or not str(sample.get("local_path") or "").strip():
            raise ValueError("Every sample requires sample_id and node9 local_path")
    parameters = data.get("parameters") if isinstance(data.get("parameters"), dict) else {
        "reference_profile": str(data.get("reference_profile") or "grch38_wes"),
        "interval_bed": str(data.get("interval_bed") or ""),
        "threads": as_int(data.get("threads")) or 8,
        "memory_gb": as_int(data.get("memory_gb")) or 32,
        "min_tumor_af": as_float(data.get("min_tumor_af")) if data.get("min_tumor_af") not in (None, "") else 0.02,
        "min_tlod": as_float(data.get("min_tlod")) if data.get("min_tlod") not in (None, "") else 6.3,
        "run_bqsr": as_bool(data.get("run_bqsr"), True),
        "run_hla_typing": as_bool(data.get("run_hla_typing"), True),
        "run_hla_binding": as_bool(data.get("run_hla_binding"), True),
        "run_neoantigen": as_bool(data.get("run_neoantigen"), True),
        "run_cnv": as_bool(data.get("run_cnv"), True),
        "run_msi": as_bool(data.get("run_msi"), False),
        "run_sv": as_bool(data.get("run_sv"), False),
    }
    return {
        "project_code": code, "project_name": name,
        "patient_no": patient_no, "patient_name": patient_name,
        "samples": samples, "parameters": parameters,
        "auto_submit": as_bool(data.get("auto_submit"), False),
        "notes": str(data.get("notes") or "")[:1000],
    }


def create_cloud_project(data, user, node):
    normalized = normalize_project_payload(data)
    project_uuid = uuid.UUID(str(data.get("project_uuid"))) if data.get("project_uuid") else uuid.uuid4()
    if BridgeProject.objects.filter(project_code=normalized["project_code"]).exists():
        raise ValueError("project_code already exists")
    project = BridgeProject.objects.create(
        project_uuid=project_uuid, project_code=normalized["project_code"],
        project_name=normalized["project_name"], patient_no=normalized["patient_no"],
        patient_name=normalized["patient_name"], origin="cloud", status="draft",
        sync_status=BridgeProject.SyncStatus.PENDING_CREATE, samples=normalized["samples"],
        parameters=normalized["parameters"], node=node, created_by=user,
    )
    job = BridgeJob.objects.create(
        created_by=user, assigned_node=node, project=project,
        job_type=BridgeJob.JobType.PROJECT_CREATE,
        payload={**normalized, "project_uuid": str(project.project_uuid)},
    )
    return project, job


def upsert_node(data):
    node_id = valid_id(data.get("node_id"))
    if not node_id:
        raise ValueError("Invalid node_id")
    node, _ = BridgeNode.objects.update_or_create(
        node_id=node_id,
        defaults={
            "display_name": str(data.get("display_name") or node_id)[:200],
            "software_version": str(data.get("software_version") or "")[:100],
            "status": "online",
            "metadata": data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
            "last_seen_at": timezone.now(),
        },
    )
    return node


def as_int(value):
    try:
        return int(float(value)) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def as_float(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def significance(variant):
    annotations = variant.get("annotations") or {}
    text = " ".join(str(annotations.get(key, "")) for key in (
        "CLINVAR_CLNSIG", "ANNOVAR_CLNSIG", "ClinVar", "VEP_CLIN_SIG"
    )).lower()
    if "pathogenic" in text and "likely" not in text:
        return "pathogenic"
    if "likely_pathogenic" in text or "likely pathogenic" in text:
        return "likely_pathogenic"
    if "benign" in text and "likely" not in text:
        return "benign"
    if "likely_benign" in text or "likely benign" in text:
        return "likely_benign"
    return "vus"


def variant_type(variant):
    raw = str(variant.get("variant_type") or "").lower()
    if "indel" in raw or len(str(variant.get("ref", ""))) != len(str(variant.get("alt", ""))):
        return "InDel"
    return "SNP"


def therapies(variant):
    direct = variant.get("therapies")
    if isinstance(direct, list):
        return direct
    annotations = variant.get("annotations") or {}
    evidence = {
        key: value for key, value in annotations.items()
        if key.startswith(("ONCOKB_", "CIVIC_", "DGIDB_")) and value not in (None, "", ".")
    }
    return [evidence] if evidence else []


def job_dict(job, include_payload=False):
    last_log_sequence = (
        job.logs.order_by("-sequence").values_list("sequence", flat=True).first() or 0
    )
    data = {
        "id": str(job.id),
        "job_type": job.job_type,
        "job_type_label": job.get_job_type_display(),
        "status": job.status,
        "status_label": job.get_status_display(),
        "assigned_node": job.assigned_node.node_id,
        "progress_percent": job.progress_percent,
        "progress_step": job.progress_step,
        "message": job.message,
        "result": job.result,
        "created_by": job.created_by.username,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "finished_at": job.finished_at,
        "last_log_sequence": last_log_sequence,
    }
    if include_payload:
        data["payload"] = job.payload
    return data


def leased_job(request, job_id):
    node_id = request.headers.get("X-Gaomei-Node-Id", "").strip()
    lease = request.headers.get("X-Gaomei-Job-Lease", "").strip()
    if not node_id or not lease:
        return None
    lease_sha256 = hashlib.sha256(lease.encode("utf-8")).hexdigest()
    return BridgeJob.objects.select_related("assigned_node", "created_by").filter(
        id=job_id,
        assigned_node__node_id=node_id,
        lease_sha256=lease_sha256,
    ).first()


class RegisterNodeView(APIView):
    permission_classes = [HasBridgeToken]

    def post(self, request):
        try:
            node = upsert_node(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"node_id": node.node_id, "status": node.status, "server_time": timezone.now()})


class HeartbeatView(APIView):
    permission_classes = [HasBridgeToken]

    def post(self, request):
        try:
            node = upsert_node(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"node_id": node.node_id, "accepted": True, "server_time": timezone.now()})


class InternalProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request):
        query = str(request.query_params.get("q") or "").strip()
        projects = BridgeProject.objects.select_related("node", "created_by").filter(archived_at__isnull=True)
        if query:
            projects = projects.filter(
                models.Q(project_code__icontains=query)
                | models.Q(project_name__icontains=query)
                | models.Q(patient_no__icontains=query)
                | models.Q(patient_name__icontains=query)
            )
        return Response([bridge_project_dict(project) for project in projects[:500]])

    @transaction.atomic
    def post(self, request):
        node_id = valid_id(request.data.get("node_id") or "node9-wes-executor")
        try:
            node = BridgeNode.objects.get(node_id=node_id, status="online")
            project, job = create_cloud_project(request.data, request.user, node)
        except BridgeNode.DoesNotExist:
            return Response({"detail": "Target node is unavailable"}, status=409)
        except (TypeError, ValueError) as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({**bridge_project_dict(project), "command_job_id": str(job.id)}, status=201)


class InternalProjectTemplateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request):
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=PROJECT_CSV_FIELDS)
        writer.writeheader()
        writer.writerow({
            "project_code": "GM-WES-202608-0001", "project_name": "肿瘤配对WES",
            "patient_no": "P2026080001", "patient_name": "测试患者",
            "received_at": "2026-08-11 09:30:00", "tumor_sample_id": "T2026080001",
            "tumor_fastq_dir": "/PUBLIC/gomics/guofenghua/data/T2026080001",
            "normal_sample_id": "N2026080001",
            "normal_fastq_dir": "/PUBLIC/gomics/guofenghua/data/N2026080001",
            "reference_profile": "grch38_wes", "threads": 8, "memory_gb": 32,
            "min_tumor_af": 0.02, "min_tlod": 6.3, "run_bqsr": "true",
            "run_hla_typing": "true", "run_hla_binding": "true",
            "run_neoantigen": "true", "run_cnv": "true", "run_msi": "false",
            "run_sv": "false", "auto_submit": "false",
        })
        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = "attachment; filename=gaomei_wes_project_template.csv"
        return response


class InternalProjectImportView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "CSV file is required"}, status=400)
        try:
            rows = list(csv.DictReader(io.StringIO(upload.read().decode("utf-8-sig"))))
        except (UnicodeDecodeError, csv.Error) as exc:
            return Response({"detail": f"CSV parse failed: {exc}"}, status=400)
        if not rows or len(rows) > 500:
            return Response({"detail": "CSV must contain 1-500 data rows"}, status=400)
        node_id = valid_id(request.data.get("node_id") or "node9-wes-executor")
        node = BridgeNode.objects.filter(node_id=node_id, status="online").first()
        if not node:
            return Response({"detail": "Target node is unavailable"}, status=409)
        validate_only = as_bool(request.data.get("validate_only"), False)
        seen = set()
        results = []
        for line_no, row in enumerate(rows, 2):
            code = str(row.get("project_code") or "").strip()
            try:
                if code in seen:
                    raise ValueError("duplicate project_code in CSV")
                seen.add(code)
                normalized = normalize_project_payload(row)
                if BridgeProject.objects.filter(project_code=normalized["project_code"]).exists():
                    raise ValueError("project_code already exists")
                if validate_only:
                    results.append({"row": line_no, "project_code": code, "status": "valid"})
                else:
                    with transaction.atomic():
                        project, job = create_cloud_project(row, request.user, node)
                    results.append({"row": line_no, "project_code": code, "status": "created", "id": str(project.project_uuid), "command_job_id": str(job.id)})
            except (TypeError, ValueError) as exc:
                results.append({"row": line_no, "project_code": code, "status": "error", "error": str(exc)})
        return Response({
            "validate_only": validate_only, "total": len(results),
            "success": sum(item["status"] in {"valid", "created"} for item in results),
            "failed": sum(item["status"] == "error" for item in results), "items": results,
        })


class InternalProjectRunView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def post(self, request, project_id):
        project = BridgeProject.objects.select_related("node").filter(project_uuid=project_id).first()
        if not project:
            return Response({"detail": "Project not found"}, status=404)
        if project.sync_status != BridgeProject.SyncStatus.SYNCED:
            return Response({"detail": "Project must be synced to node9 before analysis"}, status=409)
        parameters = {**project.parameters, **(request.data.get("parameters") if isinstance(request.data.get("parameters"), dict) else {})}
        job = BridgeJob.objects.create(
            created_by=request.user, assigned_node=project.node, project=project,
            job_type=BridgeJob.JobType.TUMOR_NORMAL,
            payload={"project_uuid": str(project.project_uuid), "parameters": parameters},
        )
        project.status = "pending"
        project.parameters = parameters
        project.save(update_fields=["status", "parameters", "updated_at"])
        return Response(job_dict(job, include_payload=True), status=201)


class NodeProjectSyncView(APIView):
    permission_classes = [HasBridgeToken]

    @transaction.atomic
    def post(self, request):
        node_id = valid_id(request.data.get("node_id"))
        projects = request.data.get("projects") if isinstance(request.data.get("projects"), list) else []
        node = BridgeNode.objects.filter(node_id=node_id).first()
        if not node:
            return Response({"detail": "Bridge node is not registered"}, status=409)
        accepted = []
        conflicts = []
        for snapshot in projects[:1000]:
            try:
                project_uuid = uuid.UUID(str(snapshot.get("project_uuid") or snapshot.get("id")))
                code = str(snapshot.get("project_code") or snapshot.get("code") or "").strip()
                if not SAFE_PROJECT_CODE.fullmatch(code):
                    raise ValueError("invalid project_code")
                by_code = BridgeProject.objects.filter(project_code=code).first()
                if by_code and by_code.project_uuid != project_uuid:
                    by_code.sync_status = BridgeProject.SyncStatus.CONFLICT
                    by_code.sync_error = f"node9 UUID {project_uuid} conflicts with cloud UUID {by_code.project_uuid}"
                    by_code.save(update_fields=["sync_status", "sync_error", "updated_at"])
                    conflicts.append({"project_code": code, "error": by_code.sync_error})
                    continue
                defaults = {
                    "project_code": code,
                    "project_name": str(snapshot.get("project_name") or snapshot.get("name") or code)[:160],
                    "patient_no": normalize_patient_no(snapshot.get("patient_no")),
                    "patient_name": str(snapshot.get("patient_name") or "")[:80],
                    "origin": str(snapshot.get("origin") or "node9")[:20],
                    "status": str(snapshot.get("status") or "draft")[:30],
                    "status_label": str(snapshot.get("status_label") or "")[:80],
                    "sync_status": BridgeProject.SyncStatus.SYNCED,
                    "sync_version": max(1, as_int(snapshot.get("sync_version")) or 1),
                    "current_revision": max(0, as_int(snapshot.get("current_revision")) or 0),
                    "samples": snapshot.get("samples") if isinstance(snapshot.get("samples"), list) else [],
                    "parameters": (
                        snapshot.get("parameters")
                        if isinstance(snapshot.get("parameters"), dict) and snapshot.get("parameters")
                        else (by_code.parameters if by_code else {})
                    ),
                    "source_manifest": snapshot,
                    "node": node, "sync_error": "", "last_synced_at": timezone.now(),
                }
                project, _ = BridgeProject.objects.update_or_create(project_uuid=project_uuid, defaults=defaults)
                accepted.append(str(project.project_uuid))
            except (TypeError, ValueError) as exc:
                conflicts.append({"project_code": str(snapshot.get("project_code") or ""), "error": str(exc)})
        archived = []
        authoritative_ids = set(accepted)
        stale_projects = BridgeProject.objects.filter(
            node=node,
            sync_status=BridgeProject.SyncStatus.SYNCED,
            archived_at__isnull=True,
        ).exclude(project_uuid__in=authoritative_ids)
        for project in stale_projects:
            project.sync_status = BridgeProject.SyncStatus.ARCHIVED
            project.status = "archived"
            project.status_label = "已在node9删除"
            project.archived_at = timezone.now()
            project.sync_error = "Project is absent from the authoritative node9 filesystem snapshot"
            project.save(update_fields=[
                "sync_status", "status", "status_label", "archived_at", "sync_error", "updated_at",
            ])
            archived.append(str(project.project_uuid))
        return Response({
            "accepted": accepted, "archived": archived, "conflicts": conflicts,
            "server_time": timezone.now(),
        })


class InternalJobListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request):
        jobs = BridgeJob.objects.select_related("assigned_node", "created_by")[:100]
        return Response([job_dict(job, include_payload=True) for job in jobs])

    def post(self, request):
        job_type = str(request.data.get("job_type") or "")
        node_id = valid_id(request.data.get("node_id"))
        payload = request.data.get("payload") if isinstance(request.data.get("payload"), dict) else {}
        if job_type != BridgeJob.JobType.SMOKE:
            return Response({"detail": "Only the smoke job type is enabled in phase 2"}, status=400)
        try:
            node = BridgeNode.objects.get(node_id=node_id, status="online")
        except BridgeNode.DoesNotExist:
            return Response({"detail": "Target node is unavailable"}, status=409)
        duration = as_int(payload.get("duration_seconds")) or 3
        if duration < 1 or duration > 30:
            return Response({"detail": "duration_seconds must be between 1 and 30"}, status=400)
        job = BridgeJob.objects.create(
            created_by=request.user,
            assigned_node=node,
            job_type=job_type,
            payload={
                "duration_seconds": duration,
                "label": str(payload.get("label") or "bridge smoke")[:100],
            },
        )
        return Response(job_dict(job, include_payload=True), status=201)


class InternalJobDetailView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request, job_id):
        job = BridgeJob.objects.select_related("assigned_node", "created_by").filter(id=job_id).first()
        return Response(job_dict(job, include_payload=True)) if job else Response({"detail": "Not found"}, status=404)


class InternalJobLogsView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def get(self, request, job_id):
        after = as_int(request.query_params.get("after")) or 0
        job = BridgeJob.objects.select_related("assigned_node", "created_by").filter(id=job_id).first()
        if not job:
            return Response({"detail": "Not found"}, status=404)
        rows = job.logs.filter(sequence__gt=after)[:1000]
        return Response({
            "job": job_dict(job),
            "chunks": [
                {"sequence": row.sequence, "stream": row.stream, "message": row.message, "created_at": row.created_at}
                for row in rows
            ],
        })


class InternalJobCancelView(APIView):
    permission_classes = [IsAuthenticated, IsInternalRole]

    def post(self, request, job_id):
        job = BridgeJob.objects.select_related("assigned_node", "created_by").filter(id=job_id).first()
        if not job:
            return Response({"detail": "Not found"}, status=404)
        if job.status == BridgeJob.Status.QUEUED:
            job.status = BridgeJob.Status.CANCELED
            job.finished_at = timezone.now()
        elif job.status in {BridgeJob.Status.CLAIMED, BridgeJob.Status.RUNNING}:
            job.status = BridgeJob.Status.CANCEL_REQUESTED
        else:
            return Response({"detail": "Job cannot be canceled in its current state"}, status=409)
        job.save(update_fields=["status", "finished_at", "updated_at"])
        return Response(job_dict(job))


class ClaimJobView(APIView):
    permission_classes = [HasBridgeToken]

    @transaction.atomic
    def post(self, request):
        node_id = valid_id(request.data.get("node_id"))
        try:
            node = BridgeNode.objects.get(node_id=node_id)
        except BridgeNode.DoesNotExist:
            return Response({"detail": "Node is not registered"}, status=409)
        job = BridgeJob.objects.select_for_update().filter(
            assigned_node=node, status=BridgeJob.Status.QUEUED,
        ).order_by("created_at").first()
        resumed = False
        if not job:
            stale_before = timezone.now() - timedelta(seconds=120)
            job = BridgeJob.objects.select_for_update().filter(
                assigned_node=node,
                status__in=[BridgeJob.Status.CLAIMED, BridgeJob.Status.RUNNING],
                updated_at__lt=stale_before,
            ).order_by("updated_at").first()
            resumed = bool(job)
        if not job:
            return Response(status=204)
        lease = secrets.token_urlsafe(32)
        job.lease_sha256 = hashlib.sha256(lease.encode("utf-8")).hexdigest()
        job.status = BridgeJob.Status.CLAIMED
        job.claimed_at = timezone.now()
        job.message = "node resumed stale job" if resumed else "node claimed job"
        job.save(update_fields=["lease_sha256", "status", "claimed_at", "message", "updated_at"])
        return Response({"job": job_dict(job, include_payload=True), "lease_token": lease})


class NodeJobStatusView(APIView):
    permission_classes = [HasBridgeToken]

    def post(self, request, job_id):
        job = leased_job(request, job_id)
        if not job:
            return Response({"detail": "Invalid job lease"}, status=403)
        new_status = str(request.data.get("status") or job.status)
        allowed = {
            BridgeJob.Status.RUNNING, BridgeJob.Status.SUCCEEDED,
            BridgeJob.Status.FAILED, BridgeJob.Status.CANCELED,
        }
        if new_status not in allowed:
            return Response({"detail": "Invalid status transition"}, status=400)
        job.status = new_status
        job.progress_percent = max(0, min(as_int(request.data.get("progress_percent")) or 0, 100))
        job.progress_step = str(request.data.get("progress_step") or "")[:120]
        job.message = str(request.data.get("message") or "")[:5000]
        if isinstance(request.data.get("result"), dict):
            job.result = request.data["result"]
        if new_status in {BridgeJob.Status.SUCCEEDED, BridgeJob.Status.FAILED, BridgeJob.Status.CANCELED}:
            job.finished_at = timezone.now()
        job.save(update_fields=[
            "status", "progress_percent", "progress_step", "message",
            "result", "finished_at", "updated_at",
        ])
        if job.project_id:
            project = job.project
            if new_status == BridgeJob.Status.RUNNING:
                project.status = "running"
                project.sync_status = BridgeProject.SyncStatus.SYNCING
            elif new_status == BridgeJob.Status.SUCCEEDED:
                project.sync_status = BridgeProject.SyncStatus.SYNCED
                project.sync_error = ""
                if job.job_type == BridgeJob.JobType.PROJECT_CREATE:
                    project.status = "draft"
                else:
                    project.status = "running"
            elif new_status in {BridgeJob.Status.FAILED, BridgeJob.Status.CANCELED}:
                project.sync_status = BridgeProject.SyncStatus.FAILED
                project.sync_error = job.message
                project.status = "failed"
            project.last_synced_at = timezone.now()
            project.save(update_fields=[
                "status", "sync_status", "sync_error", "last_synced_at", "updated_at",
            ])
        return Response(job_dict(job))


class NodeJobLogsView(APIView):
    permission_classes = [HasBridgeToken]

    def post(self, request, job_id):
        job = leased_job(request, job_id)
        if not job:
            return Response({"detail": "Invalid job lease"}, status=403)
        chunks = request.data.get("chunks") if isinstance(request.data.get("chunks"), list) else []
        if len(chunks) > 100:
            return Response({"detail": "Too many log chunks"}, status=400)
        rows = []
        for chunk in chunks:
            sequence = as_int(chunk.get("sequence")) if isinstance(chunk, dict) else None
            if sequence is None or sequence < 1:
                continue
            rows.append(BridgeJobLog(
                job=job,
                sequence=sequence,
                stream=str(chunk.get("stream") or "stdout")[:20],
                message=str(chunk.get("message") or "")[:20000],
            ))
        BridgeJobLog.objects.bulk_create(rows, ignore_conflicts=True)
        return Response({"accepted": len(rows)})


class NodeJobControlView(APIView):
    permission_classes = [HasBridgeToken]

    def get(self, request, job_id):
        job = leased_job(request, job_id)
        if not job:
            return Response({"detail": "Invalid job lease"}, status=403)
        return Response({
            "status": job.status,
            "cancel_requested": job.status == BridgeJob.Status.CANCEL_REQUESTED,
        })


class ReportImportView(APIView):
    permission_classes = [HasBridgeToken]

    @transaction.atomic
    def post(self, request):
        upload_id = valid_id(request.data.get("upload_id"))
        node_id = valid_id(request.data.get("node_id"))
        patient_username = str(request.data.get("patient_username") or "").strip()
        requested_patient_no = normalize_patient_no(request.data.get("patient_no"))
        payload = request.data.get("report")
        if not upload_id or not node_id or (not patient_username and not requested_patient_no) or not isinstance(payload, dict):
            return Response(
                {"detail": "upload_id, node_id, patient_no or patient_username, and report are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            node = BridgeNode.objects.get(node_id=node_id)
        except BridgeNode.DoesNotExist:
            return Response({"detail": "Bridge node is not registered"}, status=status.HTTP_409_CONFLICT)

        project_payload = payload.get("project") if isinstance(payload.get("project"), dict) else {}
        patient_no = requested_patient_no or normalize_patient_no(project_payload.get("patient_no"))
        patient = None
        if patient_no:
            patient = User.objects.filter(profile__patient_no=patient_no).first()
        if patient_username:
            by_username = User.objects.filter(username=patient_username).first()
            if patient and by_username and patient.id != by_username.id:
                return Response({"detail": "patient_no and patient_username refer to different users"}, status=409)
            patient = patient or by_username
        if patient is None:
            if not patient_no:
                return Response({"detail": "Patient account not found and patient_no is missing"}, status=404)
            username = f"patient_{hashlib.sha256(patient_no.encode()).hexdigest()[:16]}"
            patient = User.objects.create(username=username, is_active=False)
            patient.set_unusable_password()
            patient.save(update_fields=["password"])
            patient.profile.patient_no = patient_no
            patient.profile.role = "customer"
            patient.profile.save(update_fields=["patient_no", "role"])
        elif patient_no and patient.profile.patient_no not in {None, "", patient_no}:
            return Response({"detail": "Patient number conflict"}, status=409)
        elif patient_no and not patient.profile.patient_no:
            patient.profile.patient_no = patient_no
            patient.profile.save(update_fields=["patient_no"])

        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        payload_sha256 = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        previous = (
            BridgeUpload.objects.select_for_update()
            .select_related("report")
            .filter(upload_id=upload_id)
            .first()
        )
        if previous:
            if previous.payload_sha256 != payload_sha256:
                if previous.node_id != node.id:
                    return Response(
                        {"detail": "upload_id belongs to another bridge node"}, status=409
                    )
                if previous.report.user_id != patient.id:
                    return Response(
                        {"detail": "upload_id belongs to another patient"}, status=409
                    )
            else:
                return Response({
                    "upload_id": upload_id,
                    "report_id": previous.report_id,
                    "created": False,
                    "updated": False,
                    "idempotent": True,
                    "revision": previous.revisions.count() or 1,
                })

        project = project_payload
        if str(project.get("assembly") or "GRCh38") != "GRCh38":
            return Response({"detail": "Only GRCh38 reports are accepted"}, status=400)
        project_code = valid_id(project.get("code")) or upload_id
        pair_id = valid_id(project.get("pair_id")) or project_code
        report_number = f"{project_code}:{pair_id}"[:100]
        variants = payload.get("variants") if isinstance(payload.get("variants"), list) else []
        summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
        patient_info = {
            "name": project.get("patient_name") or patient.username,
            "patient_no": patient_no,
            "source_node": node.node_id,
        }
        analysis_data = {
            "schema_version": payload.get("schema_version"),
            "generated_at": payload.get("generated_at"),
            "pipeline_version": project.get("pipeline_version"),
            "summary": summary,
            "counts": {"reportable": len(variants)},
            "germline": payload.get("germline") or {},
            "educational_traits": payload.get("educational_traits") or {},
            "neoantigens": payload.get("neoantigens") or [],
            "extensions": payload.get("extensions") or {},
            "bridge": {"node_id": node.node_id, "upload_id": upload_id},
        }
        report, created = Report.objects.update_or_create(
            report_number=report_number,
            defaults={
                "user": patient,
                "title": f"{patient_info['name']} WES综合报告",
                "report_type": "mutation",
                "sample_id": str(project.get("tumor_sample") or pair_id)[:100],
                "report_date": date.today(),
                "summary": f"共导入{len(variants)}条最终报告变异，等待分析员和管理员审核。",
                "conclusion": "",
                "status": "review",
                "genome_build": "GRCh38",
                "tumor_sample_id": str(project.get("tumor_sample") or "")[:100],
                "normal_sample_id": str(project.get("normal_sample") or "")[:100],
                "patient_info": patient_info,
                "analysis_data": analysis_data,
                "annotation_sources": payload.get("annotation_sources") or [],
                "reviewed_by": "",
                "released_at": None,
            },
        )
        report.items.all().delete()
        items = []
        for variant in variants:
            if not isinstance(variant, dict):
                continue
            chrom = str(variant.get("chrom") or "").removeprefix("chr")
            pos = as_int(variant.get("pos"))
            if not chrom or pos is None:
                continue
            annotations = variant.get("annotations") if isinstance(variant.get("annotations"), dict) else {}
            items.append(ReportItem(
                report=report,
                gene=str(variant.get("gene") or "-")[:50],
                chromosome=chrom[:10],
                position=pos,
                end_position=pos + max(len(str(variant.get("ref") or "")), 1) - 1,
                ref_allele=str(variant.get("ref") or "")[:500],
                alt_allele=str(variant.get("alt") or "")[:500],
                variant_type=variant_type(variant),
                significance=significance(variant),
                af=as_float(variant.get("tumor_af")),
                annotation=str(variant.get("clinical_summary") or ""),
                transcript=str(variant.get("transcript") or "")[:100],
                hgvs_c=str(variant.get("hgvsc") or "")[:200],
                hgvs_p=str(variant.get("hgvsp") or "")[:200],
                consequence=str(variant.get("consequence") or "")[:100],
                tumor_depth=as_int(variant.get("tumor_dp")),
                tumor_alt_reads=as_int(variant.get("tumor_alt_reads")),
                normal_depth=as_int(variant.get("normal_dp")),
                normal_alt_reads=as_int(variant.get("normal_alt_reads")),
                tlod=as_float(variant.get("tlod")),
                filter_status="REPORTABLE" if variant.get("reportable", True) else "NOT_REPORTABLE",
                annotations=annotations,
                therapies=therapies(variant),
                neoantigens=variant.get("neoantigens") if isinstance(variant.get("neoantigens"), list) else [],
            ))
        ReportItem.objects.bulk_create(items)
        if previous:
            if not previous.revisions.exists():
                BridgeUploadRevision.objects.create(
                    upload=previous, revision=1,
                    payload_sha256=previous.payload_sha256,
                )
            revision = previous.revisions.count() + 1
            previous.node = node
            previous.report = report
            previous.payload_sha256 = payload_sha256
            previous.save(update_fields=["node", "report", "payload_sha256", "updated_at"])
            bridge_upload = previous
            BridgeUploadRevision.objects.create(
                upload=bridge_upload, revision=revision,
                payload_sha256=payload_sha256,
            )
        else:
            bridge_upload = BridgeUpload.objects.create(
                upload_id=upload_id,
                node=node,
                report=report,
                payload_sha256=payload_sha256,
            )
            revision = 1
            BridgeUploadRevision.objects.create(
                upload=bridge_upload, revision=revision,
                payload_sha256=payload_sha256,
            )
        return Response({
            "upload_id": upload_id,
            "report_id": report.id,
            "created": created,
            "updated": bool(previous),
            "revision": revision,
            "variant_count": len(items),
            "status": report.status,
        }, status=(status.HTTP_200_OK if previous else status.HTTP_201_CREATED))


class ReportPdfUploadView(APIView):
    permission_classes = [HasBridgeToken]

    def post(self, request, upload_id):
        upload_id = valid_id(upload_id)
        bridge_upload = BridgeUpload.objects.select_related("report").filter(upload_id=upload_id).first()
        if not bridge_upload:
            return Response({"detail": "Report upload_id not found"}, status=404)
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "PDF file is required"}, status=400)
        if uploaded.size > 100 * 1024 * 1024:
            return Response({"detail": "PDF exceeds 100 MB limit"}, status=413)
        header = uploaded.read(5)
        uploaded.seek(0)
        if header != b"%PDF-":
            return Response({"detail": "Uploaded file is not a PDF"}, status=400)
        digest = hashlib.sha256()
        for chunk in uploaded.chunks():
            digest.update(chunk)
        uploaded.seek(0)
        report = bridge_upload.report
        safe_name = f"{report.report_number.replace(':', '_')}.pdf"
        if report.report_pdf_file:
            report.report_pdf_file.delete(save=False)
        report.report_pdf_file.save(safe_name, uploaded, save=False)
        report.report_pdf_sha256 = digest.hexdigest()
        report.report_pdf_url = f"/api/reports/{report.pk}/pdf/"
        report.save(update_fields=["report_pdf_file", "report_pdf_sha256", "report_pdf_url"])
        return Response({
            "upload_id": upload_id,
            "report_id": report.pk,
            "pdf_sha256": report.report_pdf_sha256,
            "download_url": report.report_pdf_url,
        })


class ReportPackageUploadView(APIView):
    """node9 上传正式报告包：JSON + 附属文件；云端落盘、建关联、生成 PDF。"""

    permission_classes = [HasBridgeToken]

    def post(self, request):
        from reports.wes_storage import ingest_report_package

        upload_id = valid_id(request.data.get("upload_id"))
        node_id = valid_id(request.data.get("node_id"))
        patient_no = normalize_patient_no(request.data.get("patient_no"))
        sample_id = str(request.data.get("sample_id") or "").strip()
        patient_name = str(request.data.get("patient_name") or "").strip()
        raw_manifest = request.data.get("manifest") or "{}"
        if isinstance(raw_manifest, (bytes, bytearray)):
            raw_manifest = raw_manifest.decode("utf-8")
        if isinstance(raw_manifest, str):
            try:
                manifest = json.loads(raw_manifest)
            except json.JSONDecodeError:
                return Response({"detail": "manifest must be valid JSON"}, status=400)
        elif isinstance(raw_manifest, dict):
            manifest = raw_manifest
        else:
            return Response({"detail": "manifest must be a JSON object"}, status=400)

        if not upload_id or not node_id or not patient_no or not sample_id:
            return Response(
                {"detail": "upload_id, node_id, patient_no, and sample_id are required"},
                status=400,
            )
        if not BridgeNode.objects.filter(node_id=node_id).exists():
            # Auto-register lightweight node row so upload-only agents need not call /register/.
            BridgeNode.objects.create(
                node_id=node_id,
                display_name=node_id,
                last_seen_at=timezone.now(),
            )
        else:
            BridgeNode.objects.filter(node_id=node_id).update(last_seen_at=timezone.now())

        uploaded_files = {}
        for key, uploaded in request.FILES.items():
            uploaded_files[uploaded.name or key] = uploaded
        for uploaded in request.FILES.getlist("files"):
            uploaded_files[uploaded.name] = uploaded

        if not uploaded_files:
            return Response({"detail": "at least one file is required"}, status=400)

        try:
            result = ingest_report_package(
                upload_id=upload_id,
                node_id=node_id,
                patient_no=patient_no,
                sample_id=sample_id,
                manifest=manifest,
                uploaded_files=uploaded_files,
                patient_name=patient_name,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"package ingest failed: {exc}"}, status=500)

        code = status.HTTP_200_OK if result.get("idempotent") or not result.get("created") else status.HTTP_201_CREATED
        return Response(result, status=code)
