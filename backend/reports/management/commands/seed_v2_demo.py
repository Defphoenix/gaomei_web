"""Seed V2 demo users/patients/reports on the TEST database.

Usage (from backend/, with gaomei-web.env loaded):
  python manage.py seed_v2_demo
  python manage.py seed_v2_demo --migrate-wes

- Passwords for all seeded users: admin123
- Migrates WES package SH05677 → GM01 when --migrate-wes (default on)
"""
from __future__ import annotations

import json
import shutil
from datetime import date
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import UserProfile
from reports.models import Patient, Report, ReportAsset, ReportStatus, ReportVariant, SexChoices

PASSWORD = "admin123"
OLD_WES = "SH05677"
NEW_WES = "GM01"


class Command(BaseCommand):
    help = "Seed V2 demo accounts/patients/reports; optionally migrate SH05677→GM01"

    def add_arguments(self, parser):
        parser.add_argument(
            "--migrate-wes",
            action="store_true",
            default=True,
            help="Copy/rename WES JSON+PDF from SH05677 to GM01 (default: on)",
        )
        parser.add_argument(
            "--no-migrate-wes",
            action="store_true",
            help="Skip WES filesystem migration",
        )
        parser.add_argument(
            "--allow-prod-db",
            action="store_true",
            help="Allow running against a DB path that looks like production",
        )

    def handle(self, *args, **options):
        db_name = str(settings.DATABASES["default"]["NAME"])
        if "db.sqlite3" in db_name and "test" not in db_name and not options["allow_prod_db"]:
            # Symlink may resolve to db.test.sqlite3 — check resolved path
            resolved = str(Path(db_name).resolve())
            if "db.test" not in resolved and "test" not in resolved:
                raise CommandError(
                    f"Refusing to seed non-test DB: {resolved}. "
                    "Use test DB or pass --allow-prod-db."
                )

        migrate = options["migrate_wes"] and not options["no_migrate_wes"]
        if migrate:
            self._migrate_wes_files()

        with transaction.atomic():
            self._reset_passwords_all_users()
            users = self._ensure_users()
            patients = self._ensure_patients(users)
            self._ensure_reports(patients)

        self._print_summary()

    def _migrate_wes_files(self):
        data_root = Path(settings.WES_REPORT_DATA_DIR)
        out_root = Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf"
        src_dir = data_root / OLD_WES
        dst_dir = data_root / NEW_WES
        src_pdf = out_root / f"{OLD_WES}.pdf"
        dst_pdf = out_root / f"{NEW_WES}.pdf"

        if not src_dir.is_dir() and not dst_dir.is_dir():
            self.stdout.write(self.style.WARNING(f"No WES dir for {OLD_WES} or {NEW_WES}; skip file migrate"))
            return

        if src_dir.is_dir():
            if dst_dir.exists():
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)
            self.stdout.write(f"Copied {src_dir} → {dst_dir}")

        json_path = dst_dir / "current.json"
        if json_path.is_file():
            payload = json.loads(json_path.read_text(encoding="utf-8"))
            self._rewrite_json_ids(payload, OLD_WES, NEW_WES)
            json_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            self.stdout.write(f"Rewrote IDs inside {json_path}")

        if src_pdf.is_file():
            out_root.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_pdf, dst_pdf)
            self.stdout.write(f"Copied PDF → {dst_pdf}")
        elif not dst_pdf.is_file():
            self.stdout.write(self.style.WARNING(f"No PDF at {src_pdf}; generate later via editor"))

        # Keep old SH05677 as backup (do not delete) so rollback is easy
        self.stdout.write(self.style.SUCCESS(f"WES migrate ready: {NEW_WES} (old {OLD_WES} kept as backup)"))

    def _rewrite_json_ids(self, obj, old: str, new: str):
        if isinstance(obj, dict):
            for k, v in list(obj.items()):
                if isinstance(v, (dict, list)):
                    self._rewrite_json_ids(v, old, new)
                elif isinstance(v, str) and old in v:
                    obj[k] = v.replace(old, new)
        elif isinstance(obj, list):
            for item in obj:
                self._rewrite_json_ids(item, old, new)

    def _ensure_user(self, username: str, *, role: str, is_staff: bool = False, is_superuser: bool = False) -> User:
        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@example.com"},
        )
        user.set_password(PASSWORD)
        user.is_staff = is_staff or role == "admin"
        user.is_superuser = is_superuser
        user.is_active = True
        user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.is_bioinfo = role in {"admin", "analyst", "reviewer"}
        profile.save(update_fields=["role", "is_bioinfo"])
        return user

    def _reset_passwords_all_users(self):
        for user in User.objects.all():
            user.set_password(PASSWORD)
            user.save(update_fields=["password"])
        self.stdout.write(f"Set password={PASSWORD!r} for {User.objects.count()} existing users")

    def _ensure_users(self) -> dict[str, User]:
        users = {}
        # Keep legacy superuser, reset password already done
        if User.objects.filter(username="gaomei_admin").exists():
            users["gaomei_admin"] = self._ensure_user(
                "gaomei_admin", role="admin", is_staff=True, is_superuser=True,
            )
        for name in ("admin1", "admin2", "admin3"):
            users[name] = self._ensure_user(name, role="admin", is_staff=True, is_superuser=(name == "admin1"))
        for name in ("analyst1", "analyst2", "analyst3"):
            users[name] = self._ensure_user(name, role="analyst")
        for name in ("reviewer1", "reviewer2", "reviewer3"):
            users[name] = self._ensure_user(name, role="reviewer")
        for name in ("zhangsan", "lisi", "wangwu", "zhaoliu"):
            users[name] = self._ensure_user(name, role="customer")
        # Disable old demo_customer login confusion (keep row or rename)
        if User.objects.filter(username="demo_customer").exists():
            u = User.objects.get(username="demo_customer")
            u.set_password(PASSWORD)
            u.is_active = False
            u.save()
        return users

    def _ensure_patients(self, users: dict[str, User]) -> dict[str, Patient]:
        specs = [
            ("GM-P-001", "张三", users["zhangsan"], SexChoices.MALE),
            ("GM-P-002", "李四", users["lisi"], SexChoices.FEMALE),
            ("GM-P-003", "王五", users["wangwu"], SexChoices.MALE),
            ("GM-P-004", "赵六", users["zhaoliu"], SexChoices.FEMALE),
        ]
        out = {}
        for patient_no, name, user, sex in specs:
            patient, _ = Patient.objects.update_or_create(
                patient_no=patient_no,
                defaults={
                    "name": name,
                    "sex": sex,
                    "email": f"{user.username}@example.com",
                    "user": user,
                    "is_active": True,
                    "metadata": {"demo": True, "login": user.username},
                },
            )
            out[patient_no] = patient
        # Unbind old demo patients from conflicting users if any leftover numbers
        return out

    def _variant_rows(self, report: Report, sample_id: str):
        ReportVariant.objects.filter(report=report).delete()
        rows = [
            ("EGFR", "chr7", 55249071, "c.2573T>G", "p.L858R", 0.18, "Pathogenic"),
            ("TP53", "chr17", 7675088, "c.524G>A", "p.R175H", 0.22, "Pathogenic"),
            ("KRAS", "chr12", 25245350, "c.35G>A", "p.G12D", 0.15, "Pathogenic"),
        ]
        for gene, chrom, pos, hgvs_c, hgvs_p, af, clinsig in rows:
            ReportVariant.objects.create(
                report=report,
                gene=gene,
                chromosome=chrom,
                position=pos,
                ref="N",
                alt="N",
                variant_type="SNV",
                consequence="missense_variant",
                allele_frequency=af,
                data={
                    "demo": True,
                    "sample_id": sample_id,
                    "hgvs_c": hgvs_c,
                    "hgvs_p": hgvs_p,
                    "clinical_significance": clinsig,
                },
            )

    def _link_pdf_asset(self, report: Report, sample_id: str):
        pdf = Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{sample_id}.pdf"
        if not pdf.is_file():
            return
        media_root = Path(settings.MEDIA_ROOT)
        rel = str(pdf.relative_to(media_root)) if str(pdf).startswith(str(media_root)) else str(pdf)
        ReportAsset.objects.update_or_create(
            report=report,
            asset_type="pdf",
            name=f"{sample_id}.pdf",
            defaults={
                "storage_backend": "local",
                "file_path": rel,
                "mime_type": "application/pdf",
                "file_size": pdf.stat().st_size,
            },
        )

    def _ensure_reports(self, patients: dict[str, Patient]):
        today = date.today()
        now = timezone.now()

        # Clean prior demo report numbers we manage
        managed = ["GM-R-001", "GM-R-002", "GM-R-003", "GM-R-004", "GM-R-005"]
        # Also retire old demo numbers if present
        Report.objects.filter(report_number__in=["GM-RPT-DEMO-001", "GM-RPT-DEMO-002", "GM-RPT-INGEST-002"]).delete()

        specs = [
            {
                "report_number": "GM-R-001",
                "patient": "GM-P-001",
                "sample_id": NEW_WES,
                "tumor_sample_id": f"{NEW_WES}-T",
                "normal_sample_id": f"{NEW_WES}-N",
                "product_code": "WES_TN",
                "report_type": "combined",
                "title": "全外显子组测序临床报告（张三·演示）",
                "status": ReportStatus.RELEASED,
                "wes": True,
                "variants": True,
            },
            {
                "report_number": "GM-R-002",
                "patient": "GM-P-001",
                "sample_id": "GM02",
                "tumor_sample_id": "GM02-T",
                "normal_sample_id": "GM02-N",
                "product_code": "WES_TN",
                "report_type": "combined",
                "title": "WES 报告（张三·分析中）",
                "status": ReportStatus.DRAFT,
                "wes": False,
                "variants": False,
            },
            {
                "report_number": "GM-R-003",
                "patient": "GM-P-002",
                "sample_id": "GM03",
                "tumor_sample_id": "GM03-T",
                "normal_sample_id": "GM03-N",
                "product_code": "WES_TN",
                "report_type": "combined",
                "title": "WES 报告（李四·已发布）",
                "status": ReportStatus.RELEASED,
                "wes": False,
                "variants": True,
            },
            {
                "report_number": "GM-R-004",
                "patient": "GM-P-003",
                "sample_id": "GM04",
                "tumor_sample_id": "GM04-T",
                "normal_sample_id": "GM04-N",
                "product_code": "WES_TN",
                "report_type": "combined",
                "title": "WES 报告（王五·待审核）",
                "status": ReportStatus.REVIEW,
                "wes": False,
                "variants": True,
            },
            {
                "report_number": "GM-R-005",
                "patient": "GM-P-004",
                "sample_id": "GM05",
                "tumor_sample_id": "GM05-T",
                "normal_sample_id": "",
                "product_code": "LUNG_PANEL",
                "report_type": "mutation",
                "title": "肺癌 Panel 简报（赵六·demo）",
                "status": ReportStatus.RELEASED,
                "wes": False,
                "variants": True,
            },
        ]

        for spec in specs:
            patient = patients[spec["patient"]]
            sample_id = spec["sample_id"]
            analysis = {
                "wes_report_id": sample_id if spec["wes"] or sample_id == NEW_WES else sample_id,
                "demo": True,
                "product_code": spec["product_code"],
            }
            if spec["wes"]:
                analysis["wes_report_id"] = NEW_WES
            defaults = {
                "patient": patient,
                "title": spec["title"],
                "product_code": spec["product_code"],
                "report_type": spec["report_type"],
                "sample_id": sample_id,
                "tumor_sample_id": spec["tumor_sample_id"],
                "normal_sample_id": spec["normal_sample_id"],
                "report_date": today,
                "genome_build": "GRCh38",
                "status": spec["status"],
                "summary": "V2 演示数据",
                "patient_snapshot": {
                    "patient_no": patient.patient_no,
                    "name": patient.name,
                    "sex": patient.sex,
                    "email": patient.email,
                },
                "analysis_data": analysis,
                "data_schema_version": "2.0",
                "released_at": now if spec["status"] == ReportStatus.RELEASED else None,
            }
            report, _ = Report.objects.update_or_create(
                report_number=spec["report_number"],
                defaults=defaults,
            )
            if spec["variants"]:
                self._variant_rows(report, sample_id)
            else:
                ReportVariant.objects.filter(report=report).delete()
            if sample_id == NEW_WES:
                self._link_pdf_asset(report, NEW_WES)

        # Remove leftover unmanaged demo patients without our GM-P- prefix if only demo leftovers
        for p in Patient.objects.exclude(patient_no__startswith="GM-P-"):
            if p.reports.exists():
                continue
            # only delete clearly old demo codes
            if p.patient_no in {"GM-DEMO-001", "GM-INGEST-002"}:
                if p.user_id:
                    # unbind first
                    p.user = None
                    p.save(update_fields=["user"])
                p.delete()

        self.stdout.write(f"Reports upserted: {', '.join(managed)}")

    def _print_summary(self):
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== V2 demo seed ready (password=admin123) ==="))
        self.stdout.write("Internal:")
        for u in User.objects.filter(profile__role__in=["admin", "analyst", "reviewer"]).order_by("username"):
            role = u.profile.role
            self.stdout.write(f"  {u.username:12}  role={role:8}  staff={u.is_staff} super={u.is_superuser}")
        self.stdout.write("Customers:")
        for p in Patient.objects.filter(patient_no__startswith="GM-P-").order_by("patient_no"):
            uname = p.user.username if p.user_id else "-"
            reps = list(p.reports.order_by("report_number").values_list("report_number", "sample_id", "status"))
            self.stdout.write(f"  {uname:12}  {p.patient_no}  {p.name}  reports={reps}")
