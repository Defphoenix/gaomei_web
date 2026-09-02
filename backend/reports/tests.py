"""V2 report ACL / detail API tests."""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Patient, Report, ReportStatus, ReportVariant, SexChoices


class ReportApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("report-owner", password="owner-pass-123")
        self.other = User.objects.create_user("other-user", password="other-pass-123")
        self.patient = Patient.objects.create(
            patient_no="GM-P-900",
            user=self.owner,
            name="Test subject",
            sex=SexChoices.UNKNOWN,
        )
        self.report = Report.objects.create(
            patient=self.patient,
            title="WES rich report",
            report_type="mutation",
            sample_id="GM90",
            report_date=date(2026, 7, 29),
            report_number="GM-R-900",
            status=ReportStatus.RELEASED,
            tumor_sample_id="GM90",
            normal_sample_id="GM90N",
            patient_snapshot={"name": "Test subject", "patient_no": "GM-P-900"},
            analysis_data={"biomarkers": {"tmb": 3.2, "msi_status": "MSS"}, "wes_report_id": "GM90"},
            annotation_sources={"VEP": {"version": "115"}},
        )
        ReportVariant.objects.create(
            report=self.report,
            gene="TP53",
            chromosome="17",
            position=7674220,
            ref="C",
            alt="T",
            variant_type="SNP",
            allele_frequency=0.25,
            consequence="missense_variant",
            data={
                "hgvs_c": "c.743G>A",
                "hgvs_p": "p.Arg248Gln",
                "transcript": "NM_000546.6",
                "tumor_depth": 100,
                "tumor_alt_reads": 25,
                "normal_depth": 80,
                "normal_alt_reads": 0,
                "tlod": 30.1,
                "annotations": {"ClinVar": "Pathogenic"},
                "neoantigens": [{"peptide": "SSCMGGMNR", "hla": "HLA-A*33:03"}],
            },
        )
        self.client = APIClient()

    def test_detail_includes_rich_wes_payload(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/v1/reports/{self.report.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analysis_data"]["biomarkers"]["msi_status"], "MSS")
        self.assertEqual(response.data["items"][0]["hgvs_p"], "p.Arg248Gln")
        self.assertEqual(response.data["items"][0]["annotations"]["ClinVar"], "Pathogenic")

    def test_customer_cannot_open_another_users_report(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/v1/reports/{self.report.id}/")
        self.assertEqual(response.status_code, 404)

    def test_me_reports_only_released_for_customer(self):
        draft = Report.objects.create(
            patient=self.patient,
            report_number="GM-R-901",
            report_type="mutation",
            sample_id="GM91",
            status=ReportStatus.DRAFT,
            title="draft",
        )
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/v1/me/reports/")
        self.assertEqual(response.status_code, 200)
        ids = {row["id"] for row in response.data}
        self.assertIn(self.report.id, ids)
        self.assertNotIn(draft.id, ids)

    def test_submit_review_and_void(self):
        analyst = User.objects.create_user("analyst-wf", password="x")
        analyst.profile.role = "analyst"
        analyst.profile.save(update_fields=["role"])
        report = Report.objects.create(
            patient=self.patient,
            report_number="GM-R-902",
            report_type="mutation",
            sample_id="GM92",
            status=ReportStatus.DRAFT,
            title="wf",
        )
        self.client.force_authenticate(analyst)
        r1 = self.client.post(f"/api/v1/reports/{report.id}/submit-review/")
        self.assertEqual(r1.status_code, 200, r1.content)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.REVIEW)

        reviewer = User.objects.create_user("reviewer-wf", password="x", is_staff=True)
        reviewer.profile.role = "reviewer"
        reviewer.profile.save(update_fields=["role"])
        self.client.force_authenticate(reviewer)
        r2 = self.client.post(f"/api/v1/reports/{report.id}/void/")
        self.assertEqual(r2.status_code, 200, r2.content)
        report.refresh_from_db()
        self.assertEqual(report.status, ReportStatus.VOID)
