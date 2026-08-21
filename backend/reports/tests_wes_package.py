import hashlib
import json
import shutil
from pathlib import Path

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from reports.models import BundleFile, PatientReportSlot, SampleBundle

TOKEN = "bridge-package-token"
TOKEN_HASH = hashlib.sha256(TOKEN.encode()).hexdigest()
SAMPLE_JSON = Path(__file__).resolve().parent.parent / "wes_report_examples" / "sample_report.json"


@override_settings(GAOMEI_BRIDGE_TOKEN_SHA256=TOKEN_HASH)
class ReportPackageTests(APITestCase):
    def setUp(self):
        self.headers = {"HTTP_X_GAOMEI_BRIDGE_TOKEN": TOKEN}
        self._temp_roots = []

    def tearDown(self):
        for path in self._temp_roots:
            shutil.rmtree(path, ignore_errors=True)

    def _temp_settings(self, tmp_path: Path):
        self._temp_roots.append(tmp_path)
        return override_settings(
            GAOMEI_BRIDGE_TOKEN_SHA256=TOKEN_HASH,
            WES_BUNDLE_ROOT=tmp_path / "bundles",
            WES_REPORT_DATA_DIR=tmp_path / "reports",
            WES_REPORT_OUTPUT_DIR=tmp_path / "output",
            MEDIA_ROOT=tmp_path / "media",
        )

    def test_package_upload_creates_slot_bundle_and_files(self):
        import tempfile

        tmp = Path(tempfile.mkdtemp(prefix="wes_pkg_"))
        payload = SAMPLE_JSON.read_bytes()
        with self._temp_settings(tmp):
            response = self.client.post(
                "/api/bridge/reports/package/",
                {
                    "upload_id": "pkg-upload-001",
                    "node_id": "node9-wes-executor",
                    "patient_no": "P20260001",
                    "patient_name": "测试患者",
                    "sample_id": "SH05677",
                    "manifest": json.dumps({
                        "schema_version": "wes_package_v1",
                        "files": [{"name": "report.json", "role": "report_json"}],
                    }),
                    "files": SimpleUploadedFile("report.json", payload, content_type="application/json"),
                },
                format="multipart",
                **self.headers,
            )
            self.assertIn(response.status_code, {200, 201}, response.content)
            body = response.json()
            self.assertEqual(body["patient_no"], "P20260001")
            self.assertEqual(body["sample_id"], "SH05677")
            self.assertTrue(PatientReportSlot.objects.filter(patient_no="P20260001").exists())
            bundle = SampleBundle.objects.get(upload_id="pkg-upload-001")
            self.assertEqual(bundle.status, SampleBundle.Status.ACTIVE)
            self.assertTrue(bundle.files.filter(role=BundleFile.Role.REPORT_JSON).exists())
            self.assertTrue((tmp / "bundles" / "SH05677" / "pkg-upload-001" / "report.json").exists())
            self.assertTrue((tmp / "reports" / "SH05677" / "current.json").exists())

            # re-upload same sample with new upload_id supersedes old
            response2 = self.client.post(
                "/api/bridge/reports/package/",
                {
                    "upload_id": "pkg-upload-002",
                    "node_id": "node9-wes-executor",
                    "patient_no": "P20260001",
                    "sample_id": "SH05677",
                    "manifest": json.dumps({"schema_version": "wes_package_v1", "files": [{"name": "report.json"}]}),
                    "files": SimpleUploadedFile("report.json", payload, content_type="application/json"),
                },
                format="multipart",
                **self.headers,
            )
            self.assertIn(response2.status_code, {200, 201}, response2.content)
            bundle.refresh_from_db()
            self.assertEqual(bundle.status, SampleBundle.Status.SUPERSEDED)
            active = SampleBundle.objects.get(upload_id="pkg-upload-002")
            self.assertEqual(active.status, SampleBundle.Status.ACTIVE)
            slot = PatientReportSlot.objects.get(patient_no="P20260001")
            self.assertEqual(slot.active_bundle_id, active.id)

            # idempotent same upload_id
            response3 = self.client.post(
                "/api/bridge/reports/package/",
                {
                    "upload_id": "pkg-upload-002",
                    "node_id": "node9-wes-executor",
                    "patient_no": "P20260001",
                    "sample_id": "SH05677",
                    "manifest": "{}",
                    "files": SimpleUploadedFile("report.json", payload, content_type="application/json"),
                },
                format="multipart",
                **self.headers,
            )
            self.assertEqual(response3.status_code, 200)
            self.assertTrue(response3.json()["idempotent"])
            self.assertEqual(SampleBundle.objects.filter(sample_id="SH05677").count(), 2)

    def test_patient_slots_api_requires_internal_role(self):
        user = User.objects.create_user("slot-admin", password="admin-pass-123")
        user.profile.role = "admin"
        user.profile.save(update_fields=["role"])
        self.client.force_authenticate(user=user)
        response = self.client.get("/api/reports/patient-slots/")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)
