"""Resync portal Report (3D / IGV) from wes current.json for one sample."""
from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from reports.models import Report, ReportStatus
from reports.wes_portal_sync import load_wes_report_json, sync_portal_from_wes_payload
from reports.wes_storage import to_wes_report_id, bundle_root


class Command(BaseCommand):
    help = "Sync /reports/:id portal data from current.json (QC, organ risks, variants, IGV)."

    def add_arguments(self, parser):
        parser.add_argument("--sample-id", required=True)
        parser.add_argument("--release", action="store_true", help="Set report status to released")

    def handle(self, *args, **options):
        sample_id = options["sample_id"]
        wes_id = to_wes_report_id(sample_id)
        report = (
            Report.objects.filter(sample_id=sample_id)
            .exclude(status=ReportStatus.VOID)
            .select_related("patient")
            .order_by("-updated_at")
            .first()
        )
        if not report:
            raise CommandError(f"No portal report for sample_id={sample_id}")

        payload = load_wes_report_json(wes_id)
        if not payload:
            raise CommandError(f"Missing current.json for wes_report_id={wes_id}")

        # Prefer latest upload bundle dir if present
        root = bundle_root() / sample_id
        bundle_path = root
        if root.is_dir():
            subdirs = sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.stat().st_mtime, reverse=True)
            if subdirs:
                bundle_path = subdirs[0]

        sync_portal_from_wes_payload(
            report,
            payload,
            Path(bundle_path),
            wes_report_id=wes_id,
        )
        if options["release"]:
            report.status = ReportStatus.RELEASED
            report.save(update_fields=["status"])

        report.refresh_from_db()
        risks = (report.analysis_data or {}).get("organ_risks") or []
        self.stdout.write(self.style.SUCCESS(
            f"Synced report_id={report.id} status={report.status} "
            f"variants={report.variants.count()} organ_risks={len(risks)} "
            f"portal=/reports/{report.id}/"
        ))
