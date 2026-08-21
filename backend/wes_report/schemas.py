from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReportMeta(StrictModel):
    report_id: str
    title: str = "全外显子组测序检测报告"
    subtitle: str = "Whole Exome Sequencing Report"
    template_version: str = "1.0"
    generated_at: str
    laboratory: str = "高美基因医学检验实验室"
    reviewer: str = ""


class SampleInfo(StrictModel):
    sample_id: str
    name: str
    sex: str
    age: str
    specimen_type: str
    clinical_diagnosis: str = ""
    received_at: str = ""
    tested_at: str = ""


class QualityMetric(StrictModel):
    label: str
    value: str
    reference: str = ""
    status: str = "合格"


class ChartPoint(StrictModel):
    label: str
    value: float = Field(ge=0, le=100)


class Variant(StrictModel):
    gene: str
    transcript: str = ""
    exon: str = ""
    nucleotide_change: str
    amino_acid_change: str = ""
    zygosity: str = ""
    allele_frequency: str = ""
    classification: str
    disease: str = ""


class Interpretation(StrictModel):
    gene: str
    title: str
    classification: str
    evidence: list[str] = Field(default_factory=list)
    clinical_significance: str
    recommendation: str = ""


class ReferenceItem(StrictModel):
    index: int
    citation: str


class FlexibleMetric(StrictModel):
    label: str
    value: str
    detail: str = ""
    status: str = ""


class FlexibleTable(StrictModel):
    title: str = ""
    columns: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)
    note: str = ""
    compact: bool = False
    css_class: str = ""


class ReportSection(StrictModel):
    section_id: str
    number: str
    title: str
    subtitle: str = ""
    paragraphs: list[str] = Field(default_factory=list)
    metrics: list[FlexibleMetric] = Field(default_factory=list)
    tables: list[FlexibleTable] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    page_break_before: bool = False
    page_group: str = "1"
    show_heading: bool = True


class ReportChapter(StrictModel):
    chapter_id: str
    number: str
    title: str
    subtitle: str = ""
    sections: list[ReportSection] = Field(default_factory=list)


class HeatmapChart(StrictModel):
    title: str = "风险热图"
    x_labels: list[str] = Field(default_factory=list)
    y_labels: list[str] = Field(default_factory=list)
    values: list[list[float]] = Field(default_factory=list)
    min_value: float = 0
    max_value: float = 100
    low_color: str = "#1a9850"
    mid_color: str = "#fee08b"
    high_color: str = "#d73027"


class ForestPoint(StrictModel):
    label: str
    effect: float
    lower: float
    upper: float
    group: str = ""


class ForestChart(StrictModel):
    title: str = "效应量森林图"
    x_label: str = "效应量（95% CI）"
    reference: float = 1
    items: list[ForestPoint] = Field(default_factory=list)


class SunburstNode(StrictModel):
    name: str
    value: float | None = None
    children: list["SunburstNode"] = Field(default_factory=list)


class SunburstChart(StrictModel):
    title: str = "变异分类旭日图"
    root: SunburstNode


class InteractiveCharts(StrictModel):
    enabled: bool = True
    heatmap: HeatmapChart
    forest: ForestChart
    sunburst: SunburstChart


class ReportLayout(StrictModel):
    document_type: str = "legacy"
    show_toc: bool = True
    font_scale: float = Field(default=1.0, ge=0.9, le=1.3)


class ExecutiveMessage(StrictModel):
    enabled: bool = True
    page_title: str = "致受检者的一封信"
    salutation: str = "尊敬的受检者及家属："
    paragraphs: list[str] = Field(default_factory=list)
    closing: str = "让基因科技服务每一个生命。"
    signer_name: str = "待讨论"
    signer_title: str = "高美基因负责人"
    date: str = ""


class SpecimenRecord(StrictModel):
    sample_id: str
    role: str
    specimen_type: str = ""


class ReportModule(StrictModel):
    number: str
    title: str
    subtitle: str = ""
    sections: list[ReportSection] = Field(default_factory=list)


class QcSample(StrictModel):
    sample_id: str
    role: str
    mean_target_coverage: float
    pct_target_bases_20x: float
    pct_target_bases_100x: float
    pct_unique_reads_aligned: float
    duplication_rate: float


class QcCoverageSeries(StrictModel):
    sample_id: str
    role: str
    values: list[float] = Field(default_factory=list)


class QualityControlModule(ReportModule):
    samples: list[QcSample] = Field(default_factory=list)
    coverage_thresholds: list[int] = Field(default_factory=list)
    coverage_series: list[QcCoverageSeries] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    table: FlexibleTable | None = None
    guidance_table: FlexibleTable | None = None


class ProvenanceInfo(StrictModel):
    coordinate_system: str = "GRCh38"
    source_schema: str = ""
    source_generated_at: str = ""
    source_sha256: str = ""
    warnings: list[str] = Field(default_factory=list)


class ReportData(StrictModel):
    # 顶层报告数据会随生信流程版本演进。未知字段暂时保留在原始
    # JSON 中而不阻断报告生成；嵌套业务对象仍保持严格字段校验。
    model_config = ConfigDict(extra="ignore")

    report: ReportMeta
    sample: SampleInfo
    project_description: str = ""
    result_summary: str = ""
    quality_metrics: list[QualityMetric] = Field(default_factory=list)
    coverage_chart: list[ChartPoint] = Field(default_factory=list)
    variants: list[Variant] = Field(default_factory=list)
    interpretations: list[Interpretation] = Field(default_factory=list)
    methods: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    references: list[ReferenceItem] = Field(default_factory=list)
    notices: list[str] = Field(default_factory=list)
    chapters: list[ReportChapter] = Field(default_factory=list)
    charts: InteractiveCharts | None = None
    layout: ReportLayout = Field(default_factory=ReportLayout)
    executive_message: ExecutiveMessage | None = None
    samples: list[SpecimenRecord] = Field(default_factory=list)
    overview: ReportModule | None = None
    targeted_therapy: ReportModule | None = None
    quality_control: QualityControlModule | None = None
    somatic_variants: ReportModule | None = None
    immunotherapy: ReportModule | None = None
    neoantigens: ReportModule | None = None
    pharmacogenomics: ReportModule | None = None
    hereditary_risk: ReportModule | None = None
    appendices: ReportModule | None = None
    provenance: ProvenanceInfo | None = None

    @model_validator(mode="after")
    def require_supported_document_data(self):
        if self.layout.document_type == "clinical_v2":
            required = [
                self.overview,
                self.targeted_therapy,
                self.quality_control,
                self.somatic_variants,
                self.immunotherapy,
                self.neoantigens,
                self.pharmacogenomics,
                self.hereditary_risk,
                self.appendices,
            ]
            if any(item is None for item in required):
                raise ValueError("clinical_v2 报告缺少必要模块")
        elif not self.quality_metrics:
            raise ValueError("legacy 报告的 quality_metrics 至少需要一项")
        return self
