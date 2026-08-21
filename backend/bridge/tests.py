import csv
import hashlib
import io
import tempfile
import uuid
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from reports.models import Report

from .models import (
    BridgeJob, BridgeJobLog, BridgeNode, BridgeProject, BridgeUpload, BridgeUploadRevision,
)


TOKEN = "bridge-test-token"
TOKEN_HASH = hashlib.sha256(TOKEN.encode()).hexdigest()


@override_settings(GAOMEI_BRIDGE_TOKEN_SHA256=TOKEN_HASH)
class BridgeApiTests(APITestCase):
    def setUp(self):
        self.patient = User.objects.create_user("bridge-patient", password="patient-pass-123")
        self.headers = {"HTTP_X_GAOMEI_BRIDGE_TOKEN": TOKEN}
        self.report = {
            "schema_version": "1.1",
            "generated_at": "2026-08-10T00:00:00Z",
            "project": {
                "code": "BRIDGE-SMOKE-001",
                "pair_id": "T01_vs_N01",
                "tumor_sample": "T01",
                "normal_sample": "N01",
                "assembly": "GRCh38",
                "pipeline_version": "3.0.0",
            },
            "summary": {"reportable_variant_count": 1},
            "annotation_sources": [{"name": "VEP", "version": "115", "status": "available"}],
            "variants": [{
                "chrom": "chr17", "pos": 7674220, "ref": "C", "alt": "T",
                "gene": "TP53", "hgvsc": "c.743G>A", "hgvsp": "p.R248Q",
                "consequence": "missense_variant", "tumor_dp": 100,
                "tumor_alt_reads": 25, "tumor_af": 0.25, "normal_dp": 80,
                "normal_alt_reads": 0, "tlod": 30.1, "reportable": True,
                "annotations": {"VEP_IMPACT": "HIGH", "ClinVar": "Pathogenic"},
            }],
        }

    def test_requires_bridge_token(self):
        response = self.client.post("/api/bridge/register/", {"node_id": "node9"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_register_import_and_idempotence(self):
        response = self.client.post(
            "/api/bridge/register/",
            {"node_id": "node9-wes", "display_name": "node9"},
            format="json", **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        body = {
            "upload_id": "upload-001",
            "node_id": "node9-wes",
            "patient_username": self.patient.username,
            "report": self.report,
        }
        first = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        second = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["idempotent"])
        imported = Report.objects.get(report_number="BRIDGE-SMOKE-001:T01_vs_N01")
        self.assertEqual(imported.status, "review")
        self.assertEqual(imported.items.count(), 1)
        self.assertEqual(imported.items.get().annotations["VEP_IMPACT"], "HIGH")
        self.assertEqual(BridgeNode.objects.count(), 1)
        self.assertEqual(BridgeUpload.objects.count(), 1)
        self.assertEqual(BridgeUploadRevision.objects.count(), 1)

    def test_same_upload_id_accepts_a_new_payload_revision(self):
        self.client.post(
            "/api/bridge/register/",
            {"node_id": "node9-wes", "display_name": "node9"},
            format="json", **self.headers,
        )
        body = {
            "upload_id": "upload-revision-001",
            "node_id": "node9-wes",
            "patient_username": self.patient.username,
            "report": self.report,
        }
        first = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        changed = {**self.report, "summary": {"reportable_variant_count": 2}}
        body["report"] = changed
        second = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["updated"])
        self.assertEqual(second.data["revision"], 2)
        self.assertEqual(first.data["report_id"], second.data["report_id"])
        upload = BridgeUpload.objects.get(upload_id="upload-revision-001")
        self.assertEqual(upload.revisions.count(), 2)

    def test_customer_only_sees_released_report(self):
        report = Report.objects.create(
            user=self.patient, title="Review", report_type="mutation",
            sample_id="T01", report_date=date.today(), report_number="R-1", status="review",
        )
        self.client.force_authenticate(self.patient)
        self.assertEqual(self.client.get("/api/reports/").data, [])
        report.status = "released"
        report.save(update_fields=["status"])
        self.assertEqual(len(self.client.get("/api/reports/").data), 1)

    def test_bridge_uploads_real_pdf_and_owner_downloads_after_release(self):
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            self.client.post(
                "/api/bridge/register/", {"node_id": "node9-wes", "display_name": "node9"},
                format="json", **self.headers,
            )
            body = {
                "upload_id": "upload-pdf-001", "node_id": "node9-wes",
                "patient_username": self.patient.username, "report": self.report,
            }
            imported = self.client.post(
                "/api/bridge/reports/import/", body, format="json", **self.headers,
            )
            pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.4\n%%EOF\n", content_type="application/pdf")
            uploaded = self.client.post(
                "/api/bridge/reports/upload-pdf-001/pdf/", {"file": pdf},
                format="multipart", **self.headers,
            )
            self.assertEqual(uploaded.status_code, 200)
            report = Report.objects.get(id=imported.data["report_id"])
            self.assertTrue(report.report_pdf_file)
            report.status = "released"
            report.save(update_fields=["status"])
            self.client.force_authenticate(self.patient)
            downloaded = self.client.get(f"/api/reports/{report.id}/pdf/")
            self.assertEqual(downloaded.status_code, 200)
            self.assertEqual(downloaded["Content-Type"], "application/pdf")

    def test_cloud_job_claim_logs_and_complete(self):
        admin = User.objects.create_user("bridge-admin", password="admin-pass", is_staff=True)
        self.client.post(
            "/api/bridge/register/", {"node_id": "node9-wes", "display_name": "node9"},
            format="json", **self.headers,
        )
        self.client.force_authenticate(admin)
        created = self.client.post(
            "/api/bridge/jobs/",
            {"job_type": "smoke", "node_id": "node9-wes", "payload": {"duration_seconds": 2}},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        job_id = created.data["id"]

        self.client.force_authenticate(None)
        claimed = self.client.post(
            "/api/bridge/node/jobs/claim/", {"node_id": "node9-wes"},
            format="json", **self.headers,
        )
        self.assertEqual(claimed.status_code, 200)
        lease = claimed.data["lease_token"]
        node_headers = {
            **self.headers,
            "HTTP_X_GAOMEI_NODE_ID": "node9-wes",
            "HTTP_X_GAOMEI_JOB_LEASE": lease,
        }
        denied = self.client.post(
            f"/api/bridge/node/jobs/{job_id}/status/",
            {"status": "running"}, format="json",
            **{**node_headers, "HTTP_X_GAOMEI_JOB_LEASE": "wrong"},
        )
        self.assertEqual(denied.status_code, 403)
        running = self.client.post(
            f"/api/bridge/node/jobs/{job_id}/status/",
            {"status": "running", "progress_percent": 50, "progress_step": "validate"},
            format="json", **node_headers,
        )
        self.assertEqual(running.status_code, 200)
        logged = self.client.post(
            f"/api/bridge/node/jobs/{job_id}/logs/",
            {"chunks": [{"sequence": 1, "stream": "stdout", "message": "validated"}]},
            format="json", **node_headers,
        )
        self.assertEqual(logged.status_code, 200)
        completed = self.client.post(
            f"/api/bridge/node/jobs/{job_id}/status/",
            {"status": "succeeded", "progress_percent": 100, "result": {"ok": True}},
            format="json", **node_headers,
        )
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(BridgeJob.objects.get(id=job_id).status, "succeeded")

        self.client.force_authenticate(admin)
        logs = self.client.get(f"/api/bridge/jobs/{job_id}/logs/")
        self.assertEqual(logs.status_code, 200)
        self.assertEqual(logs.data["chunks"][0]["message"], "validated")

    def test_stale_running_job_can_be_reclaimed_by_same_node(self):
        admin = User.objects.create_user("resume-admin", password="admin-pass", is_staff=True)
        self.client.post(
            "/api/bridge/register/", {"node_id": "node9-resume", "display_name": "node9"},
            format="json", **self.headers,
        )
        self.client.force_authenticate(admin)
        created = self.client.post(
            "/api/bridge/jobs/",
            {"job_type": "smoke", "node_id": "node9-resume", "payload": {}},
            format="json",
        )
        job = BridgeJob.objects.get(id=created.data["id"])
        job.status = BridgeJob.Status.RUNNING
        job.save(update_fields=["status", "updated_at"])
        BridgeJob.objects.filter(id=job.id).update(
            updated_at=timezone.now() - timedelta(minutes=5)
        )
        BridgeJobLog.objects.create(job=job, sequence=7, message="before restart")

        self.client.force_authenticate(None)
        claimed = self.client.post(
            "/api/bridge/node/jobs/claim/", {"node_id": "node9-resume"},
            format="json", **self.headers,
        )
        self.assertEqual(claimed.status_code, 200)
        self.assertEqual(claimed.data["job"]["id"], str(job.id))
        self.assertEqual(claimed.data["job"]["last_log_sequence"], 7)
        self.assertEqual(claimed.data["job"]["message"], "node resumed stale job")

    def test_customer_cannot_create_cloud_job(self):
        self.client.force_authenticate(self.patient)
        response = self.client.post(
            "/api/bridge/jobs/",
            {"job_type": "smoke", "node_id": "node9-wes", "payload": {}},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_cloud_project_create_csv_and_authoritative_node_sync(self):
        analyst = User.objects.create_user("project-analyst", password="pw")
        analyst.profile.role = "analyst"
        analyst.profile.save(update_fields=["role"])
        node = BridgeNode.objects.create(
            node_id="node9-wes-executor", display_name="node9",
            last_seen_at=date.today(), status="online",
        )
        self.client.force_authenticate(analyst)
        payload = {
            "project_code": "GM-CLOUD-001", "project_name": "云端创建测试",
            "patient_no": "p-cloud-001", "patient_name": "测试患者",
            "normal_sample_id": "N01", "normal_fastq_dir": "/PUBLIC/data/N01",
            "tumor_sample_id": "T01", "tumor_fastq_dir": "/PUBLIC/data/T01",
        }
        created = self.client.post("/api/bridge/projects/", payload, format="json")
        self.assertEqual(created.status_code, 201)
        project = BridgeProject.objects.get(project_code="GM-CLOUD-001")
        self.assertEqual(project.patient_no, "P-CLOUD-001")
        self.assertEqual(project.sync_status, BridgeProject.SyncStatus.PENDING_CREATE)
        self.assertEqual(project.jobs.get().job_type, BridgeJob.JobType.PROJECT_CREATE)

        template = self.client.get("/api/bridge/projects/template.csv")
        self.assertEqual(template.status_code, 200)
        self.assertIn("project_code", template.content.decode("utf-8-sig"))
        csv_buffer = io.StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=[
            "project_code", "project_name", "patient_no", "patient_name",
            "tumor_sample_id", "tumor_fastq_dir", "normal_sample_id", "normal_fastq_dir",
        ])
        writer.writeheader()
        writer.writerow({
            "project_code": "GM-CLOUD-CSV-001", "project_name": "CSV测试",
            "patient_no": "P-CSV-001", "patient_name": "CSV患者",
            "tumor_sample_id": "T02", "tumor_fastq_dir": "/PUBLIC/data/T02",
            "normal_sample_id": "N02", "normal_fastq_dir": "/PUBLIC/data/N02",
        })
        upload = SimpleUploadedFile("projects.csv", csv_buffer.getvalue().encode("utf-8"), content_type="text/csv")
        validated = self.client.post(
            "/api/bridge/projects/import/", {"file": upload, "validate_only": "true"},
            format="multipart",
        )
        self.assertEqual(validated.status_code, 200)
        self.assertEqual(validated.data["success"], 1)
        self.assertFalse(BridgeProject.objects.filter(project_code="GM-CLOUD-CSV-001").exists())

        self.client.force_authenticate(None)
        project.sync_status = BridgeProject.SyncStatus.SYNCED
        project.node = node
        project.save(update_fields=["sync_status", "node"])
        preserved_parameters = project.parameters.copy()
        retained = self.client.post(
            "/api/bridge/node/projects/sync/",
            {"node_id": node.node_id, "projects": [{
                "project_uuid": str(project.project_uuid), "project_code": project.project_code,
                "project_name": project.project_name, "patient_no": project.patient_no,
                "patient_name": project.patient_name, "samples": project.samples, "parameters": {},
            }]}, format="json", **self.headers,
        )
        self.assertEqual(retained.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.parameters, preserved_parameters)
        snapshot = self.client.post(
            "/api/bridge/node/projects/sync/",
            {"node_id": node.node_id, "projects": []}, format="json", **self.headers,
        )
        self.assertEqual(snapshot.status_code, 200)
        self.assertEqual(snapshot.data["archived"], [str(project.project_uuid)])
        project.refresh_from_db()
        self.assertEqual(project.sync_status, BridgeProject.SyncStatus.ARCHIVED)

    def test_report_patient_number_creates_and_reuses_placeholder_account(self):
        self.client.post(
            "/api/bridge/register/", {"node_id": "node9-patient", "display_name": "node9"},
            format="json", **self.headers,
        )
        body = {
            "upload_id": "patient-number-upload-1", "node_id": "node9-patient",
            "patient_no": "p-unique-001", "report": self.report,
        }
        first = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        self.assertEqual(first.status_code, 201)
        patient = User.objects.get(profile__patient_no="P-UNIQUE-001")
        self.assertFalse(patient.is_active)
        self.assertFalse(patient.has_usable_password())
        body["upload_id"] = "patient-number-upload-2"
        second = self.client.post("/api/bridge/reports/import/", body, format="json", **self.headers)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(Report.objects.get(id=second.data["report_id"]).user_id, patient.id)
