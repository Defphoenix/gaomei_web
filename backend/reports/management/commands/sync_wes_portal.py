"""Resync portal Report (3D / IGV) from wes current.json for one sample."""
from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from reports.models import SampleBundle
from reports.wes_portal_sync import load_wes_report_json, sync_portal_from_wes_payload
from reports.wes_storage import to_wes_report_id


class Command(BaseCommand):
    help = "Sync /reports/:id portal data from current.json (QC, organ risks, variants, IGV)."

    def add_arguments(self, parser):
        parser.add_argument("--sample-id", required=True)
        parser.add_argument("--release", action="store_true", help="Set report status to released")

    def handle(self, *args, **options):
        sample_id = options["sample_id"]
        wes_id = to_wes_report_id(sample_id)
        bundle = (
            SampleBundle.objects.filter(sample_id=sample_id, status=SampleBundle.Status.ACTIVE)
            .select_related("slot", "slot__report")
            .order_by("-created_at")
            .first()
        )
        if not bundle or not bundle.slot.report_id:
            raise CommandError(f"No active portal report for sample_id={sample_id}")

        payload = load_wes_report_json(wes_id)
        if not payload:
            raise CommandError(f"Missing current.json for wes_report_id={wes_id}")

        report = bundle.slot.report
        sync_portal_from_wes_payload(
            report,
            payload,
            Path(bundle.root_dir),
            wes_report_id=wes_id,
        )
        if options["release"]:
            report.status = "released"
            report.save(update_fields=["status"])

        report.refresh_from_db()
        risks = (report.analysis_data or {}).get("organ_risks") or []
        self.stdout.write(self.style.SUCCESS(
            f"Synced report_id={report.id} status={report.status} "
            f"items={report.items.count()} organ_risks={len(risks)} "
            f"portal=/reports/{report.id}/ igv=/browser?report={report.id}"
        ))
