"""V2 WES package ingest tests (API Key + Patient/Report/ReportAsset)."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from ingest.models import IngestApiKey, IngestEvent, generate_api_key
from reports.models import Patient, Report, ReportAsset, ReportStatus


DEMO_DIR = Path(__file__).resolve().parents[1] / "wes_report_examples" / "clinical_v2_demo"


@override_settings(
    MEDIA_ROOT="/tmp/gaomei_package_test_media",
    DATA_ROOT=Path("/tmp/gaomei_package_test_media/data"),
    WES_BUNDLE_ROOT=Path("/tmp/gaomei_package_test_media/wes_bundles"),
    WES_REPORT_DATA_DIR=Path("/tmp/gaomei_package_test_media/wes_reports"),
    WES_REPORT_OUTPUT_DIR=Path("/tmp/gaomei_package_test_media/wes_output"),
)
class ReportPackageIngestTests(TestCase):
    def setUp(self):
        shutil.rmtree("/tmp/gaomei_package_test_media", ignore_errors=True)
        Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
        self.client = APIClient()
        raw, prefix, key_hash = generate_api_key()
        self.raw_key = raw
        IngestApiKey.objects.create(
            name="test-pipeline",
            key_prefix=prefix,
            key_hash=key_hash,
            scope="wes_package",
            is_active=True,
        )
        self.headers = {"HTTP_X_API_KEY": self.raw_key}

    def tearDown(self):
        shutil.rmtree("/tmp/gaomei_package_test_media", ignore_errors=True)

    def _post_package(self, upload_id: str, sample_id: str = "GM99", patient_no: str = "GM-P-099"):
        from django.core.files.uploadedfile import SimpleUploadedFile

        payload = {
            "upload_id": upload_id,
            "patient_no": patient_no,
            "patient_name": "内测患者",
            "sample_id": sample_id,
            "node_id": "test-node",
            "manifest": json.dumps({
                "schema_version": "wes_package_v1",
                "patient_no": patient_no,
                "sample_id": sample_id,
                "files": [],
            }),
        }
        file_list = []
        for name in [
            "report.json",
            "tumor.report.bam",
            "tumor.report.bam.bai",
            "normal.report.bam",
            "normal.report.bam.bai",
        ]:
            path = DEMO_DIR / name
            if not path.is_file():
                self.skipTest(f"missing demo file {path}")
            file_list.append(SimpleUploadedFile(name, path.read_bytes()))
        payload["files"] = file_list
        return self.client.post(
            "/api/v1/ingest/reports/package/",
            data=payload,
            format="multipart",
            **self.headers,
        )

    def test_requires_api_key(self):
        response = self.client.post("/api/v1/ingest/reports/package/", {})
        self.assertIn(response.status_code, {401, 403})

    def test_package_creates_patient_report_assets(self):
        response = self._post_package("pkg-upload-v2-001")
        self.assertIn(response.status_code, {200, 201}, response.content)
        body = response.json()
        self.assertEqual(body["sample_id"], "GM99")
        self.assertEqual(body["patient_no"], "GM-P-099")
        self.assertTrue(body["pdf_ready"] or body.get("pdf_error") == "" or "pdf" in body)
        self.assertTrue(Patient.objects.filter(patient_no="GM-P-099").exists())
        report = Report.objects.get(id=body["report_id"])
        self.assertEqual(report.status, ReportStatus.REVIEW)
        self.assertEqual(report.patient.patient_no, "GM-P-099")
        self.assertFalse(report.patient.user_id)  # unbound until admin binds
        bam_count = report.assets.filter(asset_type=ReportAsset.AssetType.BAM).count()
        self.assertGreaterEqual(bam_count, 2)
        self.assertTrue((Path(settings.WES_REPORT_DATA_DIR) / "GM99" / "current.json").exists())
        data_dir = Path(settings.DATA_ROOT) / str(report.id)
        self.assertTrue((data_dir / "report.json").exists())
        self.assertTrue((data_dir / "tumor.report.bam").exists())
        self.assertTrue(IngestEvent.objects.filter(report=report).exists())

    def test_idempotent_same_upload_id(self):
        first = self._post_package("pkg-upload-v2-idem")
        self.assertIn(first.status_code, {200, 201}, first.content)
        second = self._post_package("pkg-upload-v2-idem")
        self.assertEqual(second.status_code, 200, second.content)
        self.assertTrue(second.json().get("idempotent"))
        self.assertEqual(Report.objects.filter(sample_id="GM99").count(), 1)

    def test_overwrite_review_creates_history(self):
        first = self._post_package("pkg-upload-v2-a", sample_id="GM98", patient_no="GM-P-098")
        self.assertIn(first.status_code, {200, 201}, first.content)
        report_id = first.json()["report_id"]
        # seed a prior current.json so second write creates history
        second = self._post_package("pkg-upload-v2-b", sample_id="GM98", patient_no="GM-P-098")
        self.assertIn(second.status_code, {200, 201}, second.content)
        self.assertEqual(second.json()["report_id"], report_id)
        self.assertEqual(second.json()["status"], "updated")
        history = Path(settings.WES_REPORT_DATA_DIR) / "GM98" / "history"
        self.assertTrue(history.is_dir())
        self.assertGreaterEqual(len(list(history.glob("*.json"))), 1)

    def test_released_immutable(self):
        first = self._post_package("pkg-upload-v2-rel", sample_id="GM97", patient_no="GM-P-097")
        self.assertIn(first.status_code, {200, 201}, first.content)
        report = Report.objects.get(id=first.json()["report_id"])
        report.status = ReportStatus.RELEASED
        report.save(update_fields=["status"])
        second = self._post_package("pkg-upload-v2-rel2", sample_id="GM97", patient_no="GM-P-097")
        self.assertEqual(second.status_code, 409, second.content)
        self.assertEqual(second.json()["error"]["code"], "released_report_immutable")

    def test_bind_user_then_history_acl(self):
        first = self._post_package("pkg-upload-v2-bind", sample_id="GM96", patient_no="GM-P-096")
        self.assertIn(first.status_code, {200, 201}, first.content)
        report = Report.objects.get(id=first.json()["report_id"])
        user = User.objects.create_user(username="pkg_customer", password="admin123")
        report.patient.user = user
        report.patient.save(update_fields=["user"])
        report.status = ReportStatus.RELEASED
        report.save(update_fields=["status"])

        self.client.force_authenticate(user)
        hist = self.client.get(f"/api/v1/ingest/reports/{report.id}/package-history/")
        self.assertEqual(hist.status_code, 200, hist.content)
        payload = hist.json()
        self.assertGreaterEqual(len(payload["assets"]), 1)
        assets = self.client.get(f"/api/v1/reports/{report.id}/assets/")
        self.assertEqual(assets.status_code, 200)
        bam = next(a for a in assets.json() if a["asset_type"] == "bam")
        dl = self.client.get(bam["download_url"])
        self.assertEqual(dl.status_code, 200)
