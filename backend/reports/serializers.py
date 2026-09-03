from rest_framework import serializers
from .models import Patient, Report, ReportAsset, ReportVariant


REPORT_TYPE_LABELS = {
    "mutation": "突变",
    "methylation": "甲基化",
    "msi": "MSI",
    "cnv": "CNV",
    "combined": "综合",
    "other": "其他",
}


def _as_annotation_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        if not value:
            return []
        # normalize dict → list of {name, ...}
        rows = []
        for name, meta in value.items():
            if isinstance(meta, dict):
                rows.append({"name": name, **meta})
            else:
                rows.append({"name": name, "version": str(meta), "assembly": "", "purpose": "", "status": ""})
        return rows
    return []


def variant_as_report_item(v: ReportVariant) -> dict:
    """Map ReportVariant → legacy ReportItem shape for ReportDetail / IGV."""
    data = v.data if isinstance(v.data, dict) else {}
    end_pos = data.get("end_position") or v.position
    chrom = str(v.chromosome).replace("chr", "")
    return {
        "id": v.id,
        "gene": v.gene,
        "chromosome": chrom,
        "position": v.position,
        "end_position": end_pos,
        "ref_allele": v.ref or data.get("ref_allele") or "",
        "alt_allele": v.alt or data.get("alt_allele") or "",
        "variant_type": v.variant_type or data.get("variant_type") or "SNP",
        "variant_type_display": v.variant_type or "SNP",
        "significance": data.get("significance") or "vus",
        "significance_display": data.get("significance_display") or "意义未明",
        "af": v.allele_frequency if v.allele_frequency is not None else data.get("af"),
        "methylation_level": data.get("methylation_level"),
        "cnv_ratio": data.get("cnv_ratio"),
        "annotation": data.get("annotation") or v.consequence or "",
        "transcript": data.get("transcript") or "",
        "hgvs_c": data.get("hgvs_c") or "",
        "hgvs_p": data.get("hgvs_p") or "",
        "consequence": v.consequence or data.get("consequence") or "",
        "tumor_depth": data.get("tumor_depth"),
        "tumor_alt_reads": data.get("tumor_alt_reads"),
        "normal_depth": data.get("normal_depth"),
        "normal_alt_reads": data.get("normal_alt_reads"),
        "tlod": data.get("tlod"),
        "filter_status": data.get("filter_status") or "",
        "review_status": data.get("review_status") or "pending",
        "annotations": data.get("annotations") if isinstance(data.get("annotations"), dict) else {},
        "therapies": data.get("therapies") if isinstance(data.get("therapies"), list) else [],
        "neoantigens": data.get("neoantigens") if isinstance(data.get("neoantigens"), list) else [],
        "locus": f"chr{chrom}:{v.position}-{end_pos}",
        "ucsc_url": f"https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr{chrom}:{v.position}-{end_pos}",
        "bam_track_url": data.get("bam_track_url") or "",
        "bam_index_url": data.get("bam_index_url") or "",
        "vcf_track_url": data.get("vcf_track_url") or "",
        "vcf_index_url": data.get("vcf_index_url") or "",
    }


class PatientSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True, default="")

    class Meta:
        model = Patient
        fields = [
            "id", "patient_no", "name", "sex", "birth_date", "phone", "email",
            "metadata", "is_active", "username", "user_id", "created_at", "updated_at",
        ]


class ReportAssetSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ReportAsset
        fields = [
            "id", "asset_type", "name", "storage_backend", "sha256",
            "file_size", "mime_type", "metadata", "download_url", "created_at",
        ]

    def get_download_url(self, obj):
        return f"/api/v1/reports/{obj.report_id}/assets/{obj.id}/download/"


class ReportListSerializer(serializers.ModelSerializer):
    patient_id = serializers.IntegerField(source="patient.id", read_only=True)
    patient_no = serializers.CharField(source="patient.patient_no", read_only=True)
    patient_name = serializers.CharField(source="patient.name", read_only=True)
    patient_email = serializers.CharField(source="patient.email", read_only=True)
    patient_username = serializers.SerializerMethodField()
    pdf_available = serializers.SerializerMethodField()
    report_type_display = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    report_pdf_url = serializers.SerializerMethodField()
    report_pdf_download_url = serializers.SerializerMethodField()
    wes_report_id = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    edit_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    pdf_ready = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "report_number", "title", "product_code", "report_type", "report_type_display",
            "sample_id", "status", "report_date", "released_at", "summary",
            "patient_id", "patient_no", "patient_name", "patient_email", "patient_username",
            "pdf_available", "pdf_ready", "report_pdf_url", "report_pdf_download_url",
            "wes_report_id", "preview_url", "edit_url", "download_url",
            "genome_build", "item_count", "created_at",
        ]

    def get_patient_username(self, obj):
        if obj.patient_id and obj.patient.user_id:
            return obj.patient.user.username
        return ""

    def get_report_type_display(self, obj):
        return REPORT_TYPE_LABELS.get(obj.report_type, obj.report_type)

    def get_wes_report_id(self, obj):
        data = obj.analysis_data if isinstance(obj.analysis_data, dict) else {}
        rid = str(data.get("wes_report_id") or "").strip()
        if rid:
            return rid
        if obj.sample_id:
            return obj.sample_id
        return obj.report_number or ""

    def get_preview_url(self, obj):
        rid = self.get_wes_report_id(obj)
        return f"/wes/reports/{rid}/" if rid else ""

    def get_edit_url(self, obj):
        rid = self.get_wes_report_id(obj)
        return f"/wes/reports/{rid}/edit/" if rid else ""

    def _wes_pdf_path(self, report_id: str):
        from pathlib import Path
        from django.conf import settings
        if not report_id:
            return None
        return Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{report_id}.pdf"

    def _wes_json_exists(self, report_id: str) -> bool:
        from pathlib import Path
        from django.conf import settings
        if not report_id:
            return False
        return (Path(settings.WES_REPORT_DATA_DIR) / report_id / "current.json").is_file()

    def get_pdf_ready(self, obj):
        if obj.assets.filter(asset_type="pdf").exists():
            return True
        path = self._wes_pdf_path(self.get_wes_report_id(obj))
        return bool(path and path.is_file())

    def get_pdf_available(self, obj):
        return self.get_pdf_ready(obj)

    def get_item_count(self, obj):
        return obj.variants.count()

    def _pdf_url(self, obj):
        """Formal PDF must go through /wes/.../pdf/ (HTML→PDF + wes_auth).

        Do NOT prefer ReportAsset static download here: that bypasses write_pdf and
        the WES auth gate, so the portal can serve a stale/wrong file instead of
        regenerating from the same Jinja2 HTML the preview uses.
        """
        rid = self.get_wes_report_id(obj)
        if rid and self._wes_json_exists(rid):
            return f"/wes/reports/{rid}/pdf/"
        asset = obj.assets.filter(asset_type="pdf").order_by("-created_at").first()
        if asset:
            return f"/api/v1/reports/{obj.id}/assets/{asset.id}/download/"
        path = self._wes_pdf_path(rid) if rid else None
        if path and path.is_file():
            return f"/wes/reports/{rid}/pdf/"
        return ""

    def get_download_url(self, obj):
        return self._pdf_url(obj)

    def get_report_pdf_url(self, obj):
        return self._pdf_url(obj)

    def get_report_pdf_download_url(self, obj):
        return self._pdf_url(obj)


class ReportDetailSerializer(serializers.ModelSerializer):
    """Detail payload compatible with existing ReportDetail / GenomeBrowser UI."""

    patient_no = serializers.CharField(source="patient.patient_no", read_only=True)
    patient_name = serializers.CharField(source="patient.name", read_only=True)
    patient_email = serializers.CharField(source="patient.email", read_only=True)
    patient_info = serializers.SerializerMethodField()
    annotation_sources = serializers.SerializerMethodField()
    assets = ReportAssetSerializer(many=True, read_only=True)
    items = serializers.SerializerMethodField()
    pdf_available = serializers.SerializerMethodField()
    report_pdf_download_url = serializers.SerializerMethodField()
    report_pdf_url = serializers.SerializerMethodField()
    report_pdf_sha256 = serializers.SerializerMethodField()
    reviewed_by = serializers.SerializerMethodField()
    report_type_display = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    wes_report = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "report_number", "title", "product_code", "report_type", "report_type_display",
            "sample_id", "tumor_sample_id", "normal_sample_id",
            "status", "report_date", "genome_build", "summary", "conclusion",
            "patient_snapshot", "patient_info", "analysis_data", "annotation_sources",
            "data_schema_version", "patient_no", "patient_name", "patient_email",
            "assets", "items", "item_count", "wes_report",
            "pdf_available", "report_pdf_download_url", "report_pdf_url", "report_pdf_sha256",
            "reviewed_by", "reviewed_at", "released_at",
            "created_at", "updated_at",
        ]

    def get_patient_info(self, obj):
        snap = obj.patient_snapshot if isinstance(obj.patient_snapshot, dict) else {}
        if snap:
            return snap
        return {
            "patient_no": obj.patient.patient_no,
            "name": obj.patient.name,
            "sex": obj.patient.sex,
            "phone": obj.patient.phone,
            "email": obj.patient.email,
        }

    def get_annotation_sources(self, obj):
        return _as_annotation_list(obj.annotation_sources)

    def get_items(self, obj):
        return [variant_as_report_item(v) for v in obj.variants.all()]

    def get_item_count(self, obj):
        return obj.variants.count()

    def get_report_type_display(self, obj):
        return REPORT_TYPE_LABELS.get(obj.report_type, obj.report_type)

    def get_wes_report_id(self, obj):
        data = obj.analysis_data if isinstance(obj.analysis_data, dict) else {}
        rid = str(data.get("wes_report_id") or "").strip()
        if rid:
            return rid
        return obj.sample_id or obj.report_number or ""

    def get_pdf_available(self, obj):
        if obj.assets.filter(asset_type="pdf").exists():
            return True
        from pathlib import Path
        from django.conf import settings
        rid = self.get_wes_report_id(obj)
        if not rid:
            return False
        return (Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{rid}.pdf").is_file()

    def _pdf_asset(self, obj):
        return obj.assets.filter(asset_type="pdf").order_by("-created_at").first()

    def get_report_pdf_download_url(self, obj):
        # Prefer WES HTML→PDF endpoint (auth + write_pdf). Asset download is fallback only.
        rid = self.get_wes_report_id(obj)
        if rid:
            from pathlib import Path
            from django.conf import settings
            json_path = Path(settings.WES_REPORT_DATA_DIR) / rid / "current.json"
            if json_path.is_file():
                return f"/wes/reports/{rid}/pdf/"
        asset = self._pdf_asset(obj)
        if asset:
            return f"/api/v1/reports/{obj.id}/assets/{asset.id}/download/"
        if rid:
            from pathlib import Path
            from django.conf import settings
            pdf_path = Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{rid}.pdf"
            if pdf_path.is_file():
                return f"/wes/reports/{rid}/pdf/"
        return ""

    def get_report_pdf_url(self, obj):
        return self.get_report_pdf_download_url(obj)

    def get_report_pdf_sha256(self, obj):
        asset = self._pdf_asset(obj)
        return asset.sha256 if asset else ""

    def get_reviewed_by(self, obj):
        if obj.reviewed_by_id:
            return obj.reviewed_by.username
        return ""

    def get_wes_report(self, obj):
        data = obj.analysis_data if isinstance(obj.analysis_data, dict) else {}
        return data.get("wes_report") or data.get("document") or None


class ReportVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportVariant
        fields = [
            "id", "chromosome", "position", "ref", "alt", "gene",
            "variant_type", "consequence", "allele_frequency", "data",
        ]
