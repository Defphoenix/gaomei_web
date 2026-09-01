"""Tests for WES clinical_v2 → portal sync."""
from pathlib import Path

from django.test import SimpleTestCase

from reports.wes_portal_sync import build_portal_analysis_data

DEMO_JSON = Path(__file__).resolve().parent.parent / "wes_report_examples" / "clinical_v2_demo" / "current.json"


class WesPortalSyncTests(SimpleTestCase):
    def test_build_portal_analysis_from_clinical_v2_demo(self):
        import json

        payload = json.loads(DEMO_JSON.read_text(encoding="utf-8"))
        bundle_root = DEMO_JSON.parent
        analysis = build_portal_analysis_data(payload, bundle_root_path=bundle_root, wes_report_id="SH05677")

        self.assertEqual(analysis["document_type"], "clinical_v2")
        self.assertEqual(analysis["counts"]["reportable"], 3)
        self.assertGreaterEqual(len(analysis["organ_risks"]), 1)
        self.assertAlmostEqual(analysis["biomarkers"]["tmb"], 3.214, places=2)
        self.assertEqual(analysis["qc"]["status"], "PASS")
        self.assertTrue(analysis["igv_tracks"]["tumor_bam"].endswith("tumor.report.bam"))
        self.assertIn("chr17:", analysis["igv_tracks"]["default_locus"])
