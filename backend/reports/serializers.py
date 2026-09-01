from rest_framework import serializers

from .models import Report, ReportItem
from .wes_portal_sync import load_wes_report_json


class ReportItemSerializer(serializers.ModelSerializer):
    locus = serializers.ReadOnlyField()
    ucsc_url = serializers.ReadOnlyField()
    significance_display = serializers.CharField(source="get_significance_display", read_only=True)
    variant_type_display = serializers.CharField(source="get_variant_type_display", read_only=True)

    class Meta:
        model = ReportItem
        fields = [
            "id", "gene", "chromosome", "position", "end_position",
            "ref_allele", "alt_allele", "variant_type", "variant_type_display",
            "significance", "significance_display", "af",
            "methylation_level", "cnv_ratio", "annotation",
            "transcript", "hgvs_c", "hgvs_p", "consequence",
            "tumor_depth", "tumor_alt_reads", "normal_depth", "normal_alt_reads",
            "tlod", "filter_status", "review_status",
            "annotations", "therapies", "neoantigens",
            "locus", "ucsc_url",
            "bam_track_url", "bam_index_url", "vcf_track_url", "vcf_index_url",
        ]


class ReportSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source="get_report_type_display", read_only=True)
    item_count = serializers.SerializerMethodField()
    patient_name = serializers.CharField(source="user.username", read_only=True)
    patient_email = serializers.CharField(source="user.email", read_only=True)
    pdf_available = serializers.SerializerMethodField()
    report_pdf_download_url = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "title", "report_type", "report_type_display",
            "sample_id", "report_date", "summary", "conclusion",
            "report_number", "status", "genome_build",
            "tumor_sample_id", "normal_sample_id", "patient_info",
            "analysis_data", "annotation_sources", "report_pdf_url",
            "pdf_available", "report_pdf_download_url", "report_pdf_sha256",
            "reviewed_by", "released_at",
            "created_at", "item_count", "patient_name", "patient_email",
        ]

    def get_item_count(self, obj):
        return obj.items.count()

    def get_pdf_available(self, obj):
        return bool(obj.report_pdf_file)

    def get_report_pdf_download_url(self, obj):
        return f"/api/reports/{obj.pk}/pdf/" if obj.report_pdf_file else ""


class ReportDetailSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source="get_report_type_display", read_only=True)
    items = ReportItemSerializer(many=True, read_only=True)
    patient_name = serializers.CharField(source="user.username", read_only=True)
    patient_email = serializers.CharField(source="user.email", read_only=True)
    pdf_available = serializers.SerializerMethodField()
    report_pdf_download_url = serializers.SerializerMethodField()
    wes_report = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = [
            "id", "title", "report_type", "report_type_display",
            "sample_id", "report_date", "summary", "conclusion",
            "report_number", "status", "genome_build",
            "tumor_sample_id", "normal_sample_id", "patient_info",
            "analysis_data", "annotation_sources", "report_pdf_url",
            "pdf_available", "report_pdf_download_url", "report_pdf_sha256",
            "reviewed_by", "released_at",
            "created_at", "items", "patient_name", "patient_email",
            "wes_report",
        ]

    def get_pdf_available(self, obj):
        return bool(obj.report_pdf_file)

    def get_report_pdf_download_url(self, obj):
        return f"/api/reports/{obj.pk}/pdf/" if obj.report_pdf_file else ""

    def get_wes_report(self, obj):
        wes_report_id = (obj.analysis_data or {}).get("wes_report_id")
        if not wes_report_id:
            return None
        return load_wes_report_json(str(wes_report_id))
