from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Report, ReportItem


class ReportApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("report-owner", password="owner-pass-123")
        self.other = User.objects.create_user("other-user", password="other-pass-123")
        self.report = Report.objects.create(
            user=self.owner,
            title="WES rich report",
            report_type="mutation",
            sample_id="T001",
            report_date=date(2026, 7, 29),
            report_number="GM-WES-TEST-001",
            status="released",
            tumor_sample_id="T001",
            normal_sample_id="N001",
            patient_info={"name": "Test subject"},
            analysis_data={"biomarkers": {"tmb": 3.2, "msi_status": "MSS"}},
            annotation_sources=[{"name": "VEP", "version": "115"}],
        )
        ReportItem.objects.create(
            report=self.report,
            gene="TP53",
            chromosome="17",
            position=7674220,
            ref_allele="C",
            alt_allele="T",
            variant_type="SNP",
            af=0.25,
            transcript="NM_000546.6",
            hgvs_c="c.743G>A",
            hgvs_p="p.Arg248Gln",
            consequence="missense_variant",
            tumor_depth=100,
            tumor_alt_reads=25,
            normal_depth=80,
            normal_alt_reads=0,
            tlod=30.1,
            annotations={"ClinVar": "Pathogenic"},
            neoantigens=[{"peptide": "SSCMGGMNR", "hla": "HLA-A*33:03"}],
        )
        self.client = APIClient()

    def test_detail_includes_rich_wes_payload(self):
        self.client.force_authenticate(self.owner)
        response = self.client.get(f"/api/reports/{self.report.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analysis_data"]["biomarkers"]["msi_status"], "MSS")
        self.assertEqual(response.data["annotation_sources"][0]["version"], "115")
        self.assertEqual(response.data["items"][0]["hgvs_p"], "p.Arg248Gln")
        self.assertEqual(response.data["items"][0]["annotations"]["ClinVar"], "Pathogenic")

    def test_customer_cannot_open_another_users_report(self):
        self.client.force_authenticate(self.other)
        response = self.client.get(f"/api/reports/{self.report.id}/")

        self.assertEqual(response.status_code, 404)
