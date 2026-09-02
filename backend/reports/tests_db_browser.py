"""Portal db-browser writable API tests."""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from reports.models import Patient, Report, ReportStatus, SexChoices


class DbBrowserApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("db-admin", password="admin-pass-123", is_staff=True)
        self.admin.profile.role = "admin"
        self.admin.profile.save(update_fields=["role"])
        self.customer = User.objects.create_user("db-customer", password="customer-pass")
        self.customer.profile.role = "customer"
        self.customer.profile.save(update_fields=["role"])
        self.client = APIClient()

    def test_admin_can_crud_patient_and_bind_user(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post("/api/v1/db-browser/patients/", {
            "patient_no": "GM-P-800",
            "name": "数据台患者",
            "sex": "male",
        }, format="json")
        self.assertEqual(created.status_code, 201, created.content)
        pk = created.data["id"]

        bind = self.client.patch(f"/api/v1/db-browser/patients/{pk}/", {
            "username": "db-customer",
        }, format="json")
        self.assertEqual(bind.status_code, 200, bind.content)
        self.assertEqual(bind.data["username"], "db-customer")
        patient = Patient.objects.get(pk=pk)
        self.assertEqual(patient.user_id, self.customer.id)

        report = self.client.post("/api/v1/db-browser/reports/", {
            "patient_no": "GM-P-800",
            "report_number": "GM-R-800",
            "title": "台账报告",
            "sample_id": "GM80",
            "wes_report_id": "GM80",
            "status": "review",
        }, format="json")
        self.assertEqual(report.status_code, 201, report.content)
        rid = report.data["id"]
        released = self.client.patch(f"/api/v1/db-browser/reports/{rid}/", {"status": "released"}, format="json")
        self.assertEqual(released.status_code, 200)
        self.assertEqual(Report.objects.get(pk=rid).status, ReportStatus.RELEASED)

    def test_customer_forbidden(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/v1/db-browser/patients/")
        self.assertEqual(response.status_code, 403)

    def test_catalog_lists_editable_tables(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/v1/db-browser/")
        self.assertEqual(response.status_code, 200)
        keys = {t["key"] for t in response.data["tables"]}
        self.assertTrue({"users", "patients", "reports", "assets", "api_keys", "access_logs"} <= keys)
        patients = next(t for t in response.data["tables"] if t["key"] == "patients")
        self.assertTrue(patients["editable"])
