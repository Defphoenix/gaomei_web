import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import api from "../api/client";
import type { ReportDetail as ReportDetailType, ReportItem } from "../types";
import {
  flattenModuleSections,
  igvLocusForItem,
  isClinicalV2Report,
  moduleTables,
  type WesReportModule,
  type WesReportPayload,
  type WesReportTable,
} from "../lib/clinicalV2Portal";
import OrganRiskViewer, { type OrganRisk } from "./report-v2/OrganRiskViewer";
import "./report-detail.css";

function renderTables(tables: WesReportTable[], keyPrefix: string) {
  if (!tables.length) return null;
  return (
    <div className="report-v2-table-wrap">
      {tables.map((table, index) => (
        <table key={`${keyPrefix}-${index}`}>
          {table.title ? <caption>{table.title}</caption> : null}
          <thead><tr>{(table.columns || []).map((col) => <th key={col}>{col}</th>)}</tr></thead>
          <tbody>
            {(table.rows || []).map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || "-"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

function moduleAsWes(module?: WesReportModule | null): WesReportModule | null {
  return module || null;
}

type Workspace = "overview" | "professional" | "qc" | "germline";

const statusLabels: Record<string, string> = {
  draft: "分析中",
  review: "待审核",
  released: "已发布",
};

const consequenceLabels: Record<string, string> = {
  missense_variant: "错义突变",
  frameshift_variant: "移码突变",
  stop_gained: "终止获得",
  start_lost: "起始密码子缺失",
  splice_acceptor_variant: "剪接受体变异",
  splice_donor_variant: "剪接供体变异",
};

const significanceLabels: Record<string, string> = {
  pathogenic: "致病",
  likely_pathogenic: "可能致病",
  vus: "意义未明",
  likely_benign: "可能良性",
  benign: "良性",
};

const workspaceConfig: Record<Workspace, {
  label: string;
  icon: string;
  note: string;
  sections: Array<[string, string, string]>;
}> = {
  overview: {
    label: "健康概览",
    icon: "◉",
    note: "患者友好模式：器官颜色表示证据关注度，不等同于患病概率或临床诊断。",
    sections: [
      ["overview-summary", "摘要", "⌂"],
      ["organ-risk", "器官证据地图", "3D"],
      ["somatic-findings", "重点体细胞发现", "DNA"],
      ["immune-summary", "免疫与新抗原", "H"],
      ["action-plan", "药物与行动建议", "Rx"],
      ["quality-summary", "报告质量摘要", "✓"],
      ["report-notes", "说明与声明", "i"],
    ],
  },
  professional: {
    label: "专业注释",
    icon: "⌬",
    note: "专业审核模式：保留来源字段、原始证据、数据库版本和审核状态。",
    sections: [
      ["pro-final-variants", "最终报告突变", "V"],
      ["pro-mutect2", "Mutect2证据", "M2"],
      ["pro-annotation", "注释证据矩阵", "DB"],
      ["pro-clinical", "临床与药物证据", "Rx"],
      ["pro-biomarkers", "分子标志物", "BM"],
      ["pro-neoantigen", "HLA与新抗原", "H"],
      ["pro-igv", "IGV证据", "IGV"],
      ["pro-review", "审核记录", "✓"],
    ],
  },
  qc: {
    label: "数据与质控",
    icon: "⌁",
    note: "质控追溯模式：展示FASTQ到报告发布的核心指标、流程状态和数据版本。",
    sections: [
      ["qc-samples", "样本与流程", "S"],
      ["qc-fastq", "FASTQ质控", "FQ"],
      ["qc-alignment", "比对与重复", "BAM"],
      ["qc-coverage", "深度与覆盖", "DP"],
      ["qc-bqsr", "BQSR质量", "BQ"],
      ["qc-contamination", "污染与配对", "C"],
      ["qc-variants", "变异质控", "VCF"],
      ["qc-workflow", "流程状态", "WF"],
      ["qc-versions", "软件与数据库", "SW"],
      ["qc-files", "结果文件", "⇩"],
    ],
  },
  germline: {
    label: "遗传与单基因病",
    icon: "◇",
    note: "胚系报告域尚未启用：不能用当前体细胞流程直接生成单基因病临床结论。",
    sections: [
      ["germline-summary", "模块状态", "G"],
      ["germline-pathogenic", "致病变异", "!"],
      ["germline-carrier", "携带者状态", "AR"],
      ["germline-vus", "意义未明变异", "?"],
      ["germline-phenotype", "表型与罕见病", "HPO"],
      ["germline-pharmaco", "药物基因组", "PGx"],
      ["germline-traits", "趣味遗传与PGS", "PGS"],
      ["germline-methods", "方法与限制", "i"],
    ],
  },
};

const fallbackOrganRisks: OrganRisk[] = [
  { key: "lung", name: "肺部", score: 6.4, genes: ["EGFR", "KRAS", "ALK"], evidence: "界面回退数据", recommendation: "正式报告需由肺部相关证据与人工审核结果替换当前回退分值。" },
  { key: "liver", name: "肝脏", score: 8.7, genes: ["TP53", "CTNNB1"], evidence: "界面回退数据", recommendation: "正式报告需由器官证据聚合规则和人工审核结果替换当前回退分值。" },
  { key: "prostate", name: "前列腺", score: 7.6, genes: ["AR", "PTEN"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，不代表患者存在前列腺疾病或风险。" },
  { key: "pancreas", name: "胰腺", score: 6.8, genes: ["KRAS", "SMAD4"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，正式分值需由报告JSON提供。" },
  { key: "colon", name: "结直肠", score: 5.4, genes: ["APC", "PIK3CA"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，不能替代临床检查和诊断。" },
  { key: "bladder", name: "膀胱", score: 4.3, genes: ["FGFR3", "TERT"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，正式结果需要数据库证据和人工复核。" },
  { key: "gallbladder", name: "胆囊", score: 3.4, genes: ["ERBB2"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，不能用于临床解释。" },
  { key: "kidney", name: "肾脏", score: 2.2, genes: ["VHL"], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，不能用于临床解释。" },
  { key: "trachea", name: "气管", score: 1.6, genes: [], evidence: "界面回退数据", recommendation: "当前仅展示交互结构，不能用于临床解释。" },
];

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
};

const formatNumber = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : value.toFixed(digits);

const percent = (value: number | null | undefined, digits = 1) =>
  value == null ? "-" : `${(value * 100).toFixed(digits)}%`;

const annotationValue = (item: ReportItem, keys: string[]) => {
  for (const key of keys) {
    const value = item.annotations?.[key];
    if (value !== null && value !== undefined && value !== "") return displayValue(value);
  }
  return "-";
};

const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedWorkspace = searchParams.get("workspace") as Workspace | null;
  const initialWorkspace = requestedWorkspace && workspaceConfig[requestedWorkspace] ? requestedWorkspace : "overview";
  const requestedSection = searchParams.get("section");
  const [report, setReport] = useState<ReportDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState<Workspace>(initialWorkspace);
  const [activeSection, setActiveSection] = useState(
    requestedSection && workspaceConfig[initialWorkspace].sections.some(([sectionId]) => sectionId === requestedSection)
      ? requestedSection
      : workspaceConfig[initialWorkspace].sections[0][0],
  );
  const [query, setQuery] = useState("");
  const [significance, setSignificance] = useState("all");
  const [selected, setSelected] = useState<ReportItem | null>(null);
  const [variantOpen, setVariantOpen] = useState(false);
  const [selectedOrganKey, setSelectedOrganKey] = useState<string | null>(searchParams.get("organ"));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/reports/${id}/`)
      .then((response) => {
        setReport(response.data);
        setSelected(response.data.items?.[0] || null);
      })
      .catch(() => setError("无法读取报告，请确认账号权限或报告状态。"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const nextWorkspace = searchParams.get("workspace") as Workspace | null;
    if (!nextWorkspace || !workspaceConfig[nextWorkspace]) return;
    const nextSection = searchParams.get("section");
    const safeSection = nextSection && workspaceConfig[nextWorkspace].sections.some(([sectionId]) => sectionId === nextSection)
      ? nextSection
      : workspaceConfig[nextWorkspace].sections[0][0];
    setWorkspace(nextWorkspace);
    setActiveSection(safeSection);
    setSelectedOrganKey(searchParams.get("organ"));
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>(".report-v2-workspace > .report-v2-anchor").forEach((section) => {
        section.hidden = section.id !== activeSection;
      });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, loading, workspace]);

  useEffect(() => {
    if (!report) return;
    const variantId = searchParams.get("variant");
    if (!variantId) return;
    const item = report.items.find((candidate) => String(candidate.id) === variantId);
    if (item) {
      setSelected(item);
      setVariantOpen(true);
    }
  }, [report, searchParams]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const keyword = query.trim().toLowerCase();
    return report.items.filter((item) => {
      const matchesLevel = significance === "all" || item.significance === significance;
      const haystack = [
        item.gene,
        item.hgvs_c,
        item.hgvs_p,
        item.transcript,
        item.locus,
        item.consequence,
        ...Object.values(item.annotations || {}),
      ].join(" ").toLowerCase();
      return matchesLevel && (!keyword || haystack.includes(keyword));
    });
  }, [query, report, significance]);

  const allNeoantigens = useMemo(() => report?.items.flatMap((item) =>
    (item.neoantigens || []).map((candidate) => ({ ...candidate, gene: item.gene, hgvs_p: item.hgvs_p, item }))
  ) || [], [report]);

  const allTherapies = useMemo(() => report?.items.flatMap((item) =>
    (item.therapies || []).map((therapy) => ({ ...therapy, gene: item.gene, hgvs_p: item.hgvs_p }))
  ) || [], [report]);

  if (loading) {
    return (
      <div className="report-v2-loader-screen">
        <div className="report-v2-loader-mark">G</div>
        <h1>正在装载WES综合报告</h1>
        <p>读取患者、样本、变异注释和报告元数据</p>
        <i><em /></i>
      </div>
    );
  }

  if (!report || error) {
    return (
      <div className="report-v2-state">
        <i className="fas fa-file-alt" />
        <h1>报告暂不可用</h1>
        <p>{error || "报告不存在。"}</p>
        <Link to="/my-reports">返回报告中心</Link>
      </div>
    );
  }

  const data = report.analysis_data || {};
  const wesReport = (report.wes_report || null) as WesReportPayload | null;
  const portalModules = data.portal_modules || {};
  const clinicalV2 = isClinicalV2Report(data, wesReport) || data.document_type === "clinical_v2";
  const sampleInfo = wesReport?.sample || data.sample;
  const overviewModule = moduleAsWes((wesReport?.overview as WesReportModule | undefined) || (portalModules.overview as WesReportModule | undefined));
  const therapyModule = moduleAsWes((wesReport?.targeted_therapy as WesReportModule | undefined) || (portalModules.targeted_therapy as WesReportModule | undefined));
  const immunoModule = moduleAsWes((wesReport?.immunotherapy as WesReportModule | undefined) || (portalModules.immunotherapy as WesReportModule | undefined));
  const somaticModule = moduleAsWes((wesReport?.somatic_variants as WesReportModule | undefined) || (portalModules.somatic_variants as WesReportModule | undefined));
  const qcModule = moduleAsWes((wesReport?.quality_control as WesReportModule | undefined) || (portalModules.quality_control as WesReportModule | undefined));
  const hereditaryModule = moduleAsWes((wesReport?.hereditary_risk as WesReportModule | undefined) || (portalModules.hereditary_risk as WesReportModule | undefined));
  const pgxModule = moduleAsWes((wesReport?.pharmacogenomics as WesReportModule | undefined) || (portalModules.pharmacogenomics as WesReportModule | undefined));
  const qc = data.qc || {};
  const biomarkers = data.biomarkers || {};
  const counts = data.counts || {};
  const patient = report.patient_info || {};
  const hasOrganRisks = Boolean(data.organ_risks?.length);
  const organRisks: OrganRisk[] = hasOrganRisks
    ? data.organ_risks!.map((risk) => ({
        key: risk.key,
        name: risk.name,
        score: risk.score,
        genes: risk.genes || [],
        evidence: risk.evidence || "报告证据",
        recommendation: risk.recommendation || "建议结合临床资料和专业审核结果进行解释。",
      }))
    : fallbackOrganRisks;
  const highestOrgan = [...organRisks].sort((a, b) => b.score - a.score)[0];
  const selectedOrgan = selectedOrganKey ? organRisks.find((risk) => risk.key === selectedOrganKey) || null : null;
  const organItems = selectedOrgan
    ? report.items.filter((item) => selectedOrgan.genes.includes(item.gene))
    : [];
  const strongNeoantigens = allNeoantigens.filter((item) => item.consensus.includes("strong"));

  const organComparisonOption = {
    grid: { left: 56, right: 28, top: 24, bottom: 34 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: organRisks.map((risk) => risk.name),
      axisLabel: { color: "#65758b", interval: 0 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 10,
      splitLine: { lineStyle: { color: "#e9eff7" } },
    },
    series: [{
      type: "bar",
      data: organRisks.map((risk) => ({
        value: risk.score,
        itemStyle: { color: risk.key === selectedOrgan?.key ? "#ef5b5b" : "#5a91e8", borderRadius: [8, 8, 2, 2] },
      })),
      barMaxWidth: 34,
    }],
  };

  const consequenceOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: "#68778d", fontSize: 10 } },
    color: ["#1769c2", "#16a6a1", "#e4a21c", "#c8324b", "#70b984"],
    series: [{
      type: "pie",
      radius: ["45%", "72%"],
      center: ["50%", "44%"],
      itemStyle: { borderColor: "#fff", borderWidth: 3 },
      label: { show: false },
      data: Object.entries(data.consequence_counts || {}).map(([name, value]) => ({ name, value })),
    }],
  };

  const vafItems = [...report.items].filter((item) => item.af != null).sort((a, b) => (b.af || 0) - (a.af || 0));
  const vafOption = {
    grid: { left: 46, right: 18, top: 24, bottom: 48 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: vafItems.map((item) => item.gene), axisLabel: { rotate: 28, color: "#60758a" } },
    yAxis: { type: "value", name: "VAF %", splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{ type: "bar", data: vafItems.map((item) => Number(((item.af || 0) * 100).toFixed(2))), itemStyle: { color: "#1769c2", borderRadius: [3, 3, 0, 0] } }],
  };

  const scatterOption = {
    grid: { left: 52, right: 24, top: 30, bottom: 42 },
    tooltip: { trigger: "item", formatter: (params: { data: [number, number, number, string] }) => `${params.data[3]}<br>TLOD ${params.data[0]}<br>VAF ${params.data[1]}%<br>DP ${params.data[2]}` },
    xAxis: { name: "TLOD", nameLocation: "middle", nameGap: 28, splitLine: { lineStyle: { color: "#edf2f7" } } },
    yAxis: { name: "Tumor VAF (%)", splitLine: { lineStyle: { color: "#edf2f7" } } },
    series: [{
      type: "scatter",
      data: report.items.map((item) => [item.tlod || 0, (item.af || 0) * 100, item.tumor_depth || 1, item.gene]),
      symbolSize: (value: [number, number, number]) => Math.max(12, Math.sqrt(value[2]) * 1.7),
      label: { show: true, formatter: (params: { data: [number, number, number, string] }) => params.data[3], position: "top", fontSize: 9 },
      itemStyle: { color: "#1769c2", opacity: .82 },
    }],
  };

  const funnelOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    series: [{
      type: "funnel",
      left: "10%",
      width: "80%",
      top: 18,
      bottom: 18,
      minSize: "18%",
      maxSize: "100%",
      gap: 3,
      label: { formatter: "{b}  {c}", fontSize: 10 },
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
      data: [
        { value: counts.raw_mutect2 || 0, name: "Mutect2 raw" },
        { value: counts.mutect2_pass || 0, name: "FilterMutectCalls PASS" },
        { value: counts.manual_filter_pass || 0, name: "VEP后人工过滤" },
        { value: counts.reportable ?? report.items.length, name: "最终报告候选" },
      ],
    }],
  };

  const coverageOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["平均深度", "20×覆盖率"], bottom: 0 },
    grid: { left: 52, right: 52, top: 32, bottom: 48 },
    xAxis: { type: "category", data: (data.coverage_by_chromosome || []).map((item) => item.chromosome) },
    yAxis: [
      { name: "深度", splitLine: { lineStyle: { color: "#edf2f7" } } },
      { name: "覆盖率", min: 80, max: 100, axisLabel: { formatter: "{value}%" } },
    ],
    series: [
      { name: "平均深度", type: "bar", data: (data.coverage_by_chromosome || []).map((item) => item.depth), itemStyle: { color: "#1769c2" } },
      { name: "20×覆盖率", type: "line", yAxisIndex: 1, data: (data.coverage_by_chromosome || []).map((item) => item.coverage20x), smooth: true, itemStyle: { color: "#16a6a1" } },
    ],
  };

  const neoOption = {
    grid: { left: 110, right: 28, top: 18, bottom: 28 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", name: "综合优先级", max: 100, splitLine: { lineStyle: { color: "#edf2f7" } } },
    yAxis: { type: "category", data: allNeoantigens.slice(0, 8).map((item) => `${item.gene} · ${item.length}mer`) },
    series: [{
      type: "bar",
      data: allNeoantigens.slice(0, 8).map((item) => {
        const affinity = Math.min(item.netmhcpan_affinity || 500, item.mhcflurry_affinity || 500);
        return Math.max(5, Math.round(100 - Math.min(95, affinity / 5)));
      }),
      itemStyle: { color: "#16a6a1", borderRadius: [0, 3, 3, 0] },
      label: { show: true, position: "right" },
    }],
  };

  const jumpToIgv = (item: ReportItem) =>
    navigate(`/browser?report=${report.id}&locus=${encodeURIComponent(igvLocusForItem(item))}`);

  const updateViewParams = (nextWorkspace: Workspace, nextSection: string, extras?: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    params.set("workspace", nextWorkspace);
    params.set("section", nextSection);
    Object.entries(extras || {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    setSearchParams(params);
  };

  const switchWorkspace = (next: Workspace) => {
    const first = workspaceConfig[next].sections[0][0];
    setWorkspace(next);
    setActiveSection(first);
    updateViewParams(next, first, { organ: null, variant: null });
  };

  const jumpToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    updateViewParams(workspace, sectionId, { organ: null, variant: null });
  };

  const openOrgan = (risk: OrganRisk) => {
    setSelectedOrganKey(risk.key);
    updateViewParams("overview", "organ-risk", { organ: risk.key, variant: null });
  };

  const closeOrgan = () => {
    setSelectedOrganKey(null);
    updateViewParams(workspace, activeSection, { organ: null });
  };

  const openVariant = (item: ReportItem) => {
    setSelected(item);
    setVariantOpen(true);
    updateViewParams(workspace, activeSection, { variant: String(item.id) });
  };

  const closeVariant = () => {
    setVariantOpen(false);
    updateViewParams(workspace, activeSection, { variant: null });
  };

  const downloadPdf = () => {
    const url = report.report_pdf_download_url || report.report_pdf_url;
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="wes-report-v2">
      <header className="report-v2-topbar">
        <Link to="/my-reports" className="report-v2-brand">
          <b className="report-v2-brand-mark" aria-hidden="true">G</b>
          <span><strong>高美精准医学</strong><small>WES CLINICAL INSIGHT</small></span>
        </Link>
        <nav className="report-v2-tabs" aria-label="报告工作区">
          {(Object.keys(workspaceConfig) as Workspace[]).map((key) => (
            <button type="button" key={key} className={workspace === key ? "active" : ""} onClick={() => switchWorkspace(key)}>
              <b>{workspaceConfig[key].icon}</b>{workspaceConfig[key].label}
            </button>
          ))}
        </nav>
        <div className="report-v2-topmeta">
          <span className={`status ${report.status}`}><i />{statusLabels[report.status] || report.status}</span>
          <span>{report.report_number || `REPORT-${report.id}`}</span>
          <Link to="/my-reports" title="返回报告列表"><i className="fas fa-times" /></Link>
        </div>
      </header>

      <aside className="report-v2-sidebar">
        <section className="report-v2-case">
          <small>患者全外显子组报告</small>
          <h2>{report.tumor_sample_id || sampleInfo?.sample_id || report.sample_id}</h2>
          <p>
            {displayValue(sampleInfo?.name || patient.name)}
            · {displayValue(sampleInfo?.sex || patient.sex)}
            · {displayValue(sampleInfo?.age || patient.age)}
            <br />
            {displayValue(sampleInfo?.clinical_diagnosis || patient.clinical_diagnosis)}
            · {displayValue(sampleInfo?.specimen_type || patient.specimen_type || "肿瘤/正常配对")}
            · {report.genome_build}
          </p>
        </section>
        <nav className="report-v2-side-nav">
          {workspaceConfig[workspace].sections.map(([sectionId, label, icon]) => (
            <button type="button" key={sectionId} className={activeSection === sectionId ? "active" : ""} onClick={() => jumpToSection(sectionId)}>
              <b>{icon}</b><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="report-v2-side-note">{workspaceConfig[workspace].note}</div>
        <button type="button" className="report-v2-download" disabled={!report.pdf_available && !report.report_pdf_url} onClick={downloadPdf}>
          <i className="fas fa-file-pdf" /> {report.pdf_available || report.report_pdf_url ? "下载正式报告 PDF" : "PDF 尚未生成"}
        </button>
      </aside>

      <main className="report-v2-main">
        {workspace === "overview" && (
          <div className="report-v2-workspace">
            <section id="overview-summary" className="report-v2-anchor">
              <header className="report-v2-page-head">
                <div>
                  <div className="eyebrow">{clinicalV2 ? "WES CLINICAL V2 · 来自 current.json" : "HEALTH OVERVIEW · 交互式器官证据地图"}</div>
                  <h1>{report.title}</h1>
                  <p>{report.summary || overviewModule?.sections?.[0]?.paragraphs?.[0]}</p>
                  {clinicalV2 && (
                    <div className="report-v2-source-chips" style={{ marginTop: 12 }}>
                      <span>{displayValue(sampleInfo?.clinical_diagnosis || patient.clinical_diagnosis || "临床诊断待补充")}</span>
                      <span>样本 {displayValue(sampleInfo?.sample_id || report.sample_id)}</span>
                      <span>{displayValue(data.assay || "WES")}</span>
                      <span>{hasOrganRisks ? "器官风险：正式数据" : "器官风险：演示回退"}</span>
                    </div>
                  )}
                </div>
                <div className="report-v2-source-chips">
                  {report.annotation_sources.slice(0, 6).map((source) => <span key={source.name}>{source.name} {source.version}</span>)}
                  {clinicalV2 && !report.annotation_sources.length && <span>clinical_v2 · {data.wes_report_id || report.sample_id}</span>}
                </div>
              </header>
              <section className="report-v2-kpis">
                <article style={{ "--accent": "#c8324b" } as React.CSSProperties}><span>最高器官关注度</span><strong>{highestOrgan.score.toFixed(1)} <small>/ 10</small></strong><small>{highestOrgan.name} · 需结合专业审核</small></article>
                <article style={{ "--accent": "#1769c2" } as React.CSSProperties}><span>最终报告变异</span><strong>{counts.reportable ?? report.items.length} <small>项</small></strong><small>portal_variants</small></article>
                <article style={{ "--accent": "#178865" } as React.CSSProperties}><span>TMB</span><strong>{formatNumber(biomarkers.tmb, 2)} <small>{biomarkers.tmb_unit || "mut/Mb"}</small></strong><small>{biomarkers.tmb_class || "未分级"}</small></article>
                <article style={{ "--accent": "#16a6b6" } as React.CSSProperties}><span>检测质量等级</span><strong>{qc.status || "-"}</strong><small>20×覆盖 {formatNumber(qc.target_20x)}%</small></article>
              </section>
              {clinicalV2 && renderTables(moduleTables(overviewModule), "overview")}
            </section>

            <section id="organ-risk" className="report-v2-anchor">
              <OrganRiskViewer
                risks={organRisks}
                simulated={Boolean(data.is_demo) || (!hasOrganRisks && !clinicalV2)}
                onOpenOrgan={openOrgan}
              />
            </section>

            <section id="somatic-findings" className="report-v2-section report-v2-anchor">
              <SectionHead title="重点体细胞发现" subtitle={clinicalV2 ? "来自 portal_variants / somatic_variants" : "报告变异构成、VAF和临床审核摘要"} color="#1769c2" />
              <div className="report-v2-chart-grid">
                <ChartCard title="报告变异类型" subtitle="按VEP consequence汇总"><ReactECharts option={consequenceOption} style={{ height: 250 }} /></ChartCard>
                <ChartCard title="肿瘤等位基因频率" subtitle="最终报告候选变异"><ReactECharts option={vafOption} style={{ height: 250 }} /></ChartCard>
              </div>
              <div className="report-v2-finding-grid">
                {report.items.slice(0, 6).map((item) => (
                  <article
                    key={item.id}
                    className="report-v2-clickable-finding"
                    style={{ "--finding": item.significance.includes("pathogenic") ? "#c8324b" : "#e4a21c" } as React.CSSProperties}
                    onClick={() => openVariant(item)}
                  >
                    <span>{significanceLabels[item.significance] || "待审核"}</span>
                    <h3>{item.gene} {item.hgvs_p || item.hgvs_c}</h3>
                    <p>{item.annotation || item.locus} · AF {percent(item.af)}</p>
                    <button type="button" className="button button-small button-outline" onClick={(event) => { event.stopPropagation(); jumpToIgv(item); }}>
                      <i className="fas fa-microscope" /> IGV
                    </button>
                  </article>
                ))}
                {!report.items.length && <EmptyState text="当前报告尚无 portal_variants。" />}
              </div>
              {clinicalV2 && renderTables(moduleTables(somaticModule), "somatic")}
            </section>

            <section id="immune-summary" className="report-v2-section report-v2-anchor">
              <SectionHead title="免疫与新抗原摘要" subtitle="TMB、MSI 与免疫相关解读" color="#178865" />
              <div className="report-v2-metrics">
                <Metric label="TMB" value={formatNumber(biomarkers.tmb)} note={biomarkers.tmb_unit || "mut/Mb"} />
                <Metric label="MSI状态" value={biomarkers.msi_status || "未检测"} note={`MSI score ${formatNumber(biomarkers.msi_score)}`} />
                <Metric label="HLA-I分型" value={String(biomarkers.hla_class_i?.length || 0)} note="A/B/C binding等位基因" />
                <Metric label="共识强结合肽" value={String(strongNeoantigens.length)} note="MHCflurry / NetMHCpan" />
              </div>
              {clinicalV2 && renderTables(moduleTables(immunoModule), "immuno")}
              {!clinicalV2 && (
                <div className="report-v2-chart-grid">
                  <ChartCard title="新抗原候选优先级" subtitle="结合强度的界面化摘要"><ReactECharts option={neoOption} style={{ height: 250 }} /></ChartCard>
                  <article className="report-v2-card">
                    <h3>HLA-I 等位基因</h3>
                    <div className="report-v2-tag-cloud">
                      {(biomarkers.hla_class_i || []).map((hla) => <span key={hla}>{hla}</span>)}
                      {!biomarkers.hla_class_i?.length && <p>尚未获得HLA分型结果。</p>}
                    </div>
                  </article>
                </div>
              )}
            </section>

            <section id="action-plan" className="report-v2-section report-v2-anchor">
              <SectionHead title="药物线索与行动建议" subtitle="患者视图仅展示已审核证据" color="#e4a21c" />
              {clinicalV2 && moduleTables(therapyModule).length > 0 ? (
                renderTables(moduleTables(therapyModule), "therapy")
              ) : (
                <div className="report-v2-finding-grid">
                  {allTherapies.slice(0, 3).map((therapy, index) => (
                    <article key={`${therapy.gene}-${therapy.drug}-${index}`} style={{ "--finding": "#e4a21c" } as React.CSSProperties}>
                      <span>{therapy.level || "证据线索"}</span><h3>{therapy.gene} · {therapy.drug}</h3><p>{therapy.response}；{therapy.status || "需专业审核"}。</p>
                    </article>
                  ))}
                  {!allTherapies.length && <EmptyState text="当前报告没有已审核的药物证据。" />}
                </div>
              )}
            </section>

            <section id="quality-summary" className="report-v2-section report-v2-anchor">
              <SectionHead title="报告质量摘要" subtitle="完整过程指标位于“数据与质控”工作区" color="#16a6b6" />
              <div className="report-v2-metrics">
                <Metric label="肿瘤平均深度" value={`${formatNumber(qc.tumor_mean_depth)}×`} note="目标BED范围" />
                <Metric label="正常平均深度" value={`${formatNumber(qc.normal_mean_depth)}×`} note="配对正常样本" />
                <Metric label="20×覆盖率" value={`${formatNumber(qc.target_20x)}%`} note="目标区域" />
                <Metric label="肿瘤重复率" value={`${formatNumber(qc.tumor_duplication_rate)}%`} note="MarkDuplicates" />
              </div>
              {clinicalV2 && renderTables(moduleTables(qcModule), "qc-overview")}
            </section>

            <section id="report-notes" className="report-v2-section report-v2-anchor">
              <SectionHead title="说明与声明" subtitle="报告用途、结果边界和复核要求" color="#6b7280" />
              <div className="report-v2-notice">器官分值表示证据关注度，不是患病概率，也不能替代临床诊断。药物、新抗原和遗传病结论必须结合患者资料并由专业人员审核。</div>
              <div className="report-v2-timeline">
                <div><span>{data.analysis_date || report.report_date}</span><b>生信分析完成</b><p>{data.pipeline_version || "WES pipeline"}</p></div>
                <div><span>{report.released_at ? report.released_at.slice(0, 10) : "待完成"}</span><b>分析员审核</b><p>{report.reviewed_by || "尚未指定"}</p></div>
                <div><span>{statusLabels[report.status]}</span><b>报告发布状态</b><p>{report.report_number}</p></div>
              </div>
            </section>
          </div>
        )}

        {workspace === "professional" && (
          <div className="report-v2-workspace">
            <WorkspaceIntro kicker="PROFESSIONAL ANNOTATION" title="专业注释与变异审核" text="集中展示最终报告突变、Mutect2原始证据、VEP/ANNOVAR来源字段、药物证据、新抗原和IGV审核入口。" badge={`当前报告：${statusLabels[report.status]}`} />

            <section id="pro-final-variants" className="report-v2-section report-v2-anchor">
              <SectionHead title="最终报告突变" subtitle="仅展示进入正式报告和小BAM的审核结果" color="#1769c2" />
              <div className="report-v2-filter-row">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索基因、HGVS、坐标或数据库字段" />
                <select value={significance} onChange={(event) => setSignificance(event.target.value)}>
                  <option value="all">全部证据等级</option>
                  <option value="pathogenic">致病</option>
                  <option value="likely_pathogenic">可能致病</option>
                  <option value="vus">意义未明</option>
                </select>
                <span>{filteredItems.length} / {report.items.length}</span>
              </div>
              <div className="report-v2-table-wrap">
                <table>
                  <thead><tr><th>基因</th><th>坐标</th><th>HGVS.c</th><th>HGVS.p</th><th>后果</th><th>Tumor AF</th><th>Normal ALT</th><th>TLOD</th><th>临床意义</th><th>IGV</th></tr></thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => openVariant(item)}>
                        <td><strong>{item.gene}</strong></td><td>{item.locus}</td><td>{item.hgvs_c || "-"}</td><td>{item.hgvs_p || "-"}</td>
                        <td>{consequenceLabels[item.consequence] || item.consequence}</td><td>{percent(item.af)}</td><td>{item.normal_alt_reads ?? "-"}</td><td>{formatNumber(item.tlod, 2)}</td>
                        <td><span className={`report-v2-badge ${item.significance}`}>{significanceLabels[item.significance] || item.significance}</span></td>
                        <td><button type="button" title="进入IGV" onClick={(event) => { event.stopPropagation(); jumpToIgv(item); }}><i className="fas fa-microscope" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected && (
                <article className="report-v2-variant-detail">
                  <div><span className={`report-v2-badge ${selected.significance}`}>{significanceLabels[selected.significance]}</span><h3>{selected.gene} {selected.hgvs_p || selected.hgvs_c}</h3><p>{selected.annotation}</p></div>
                  <button type="button" onClick={() => jumpToIgv(selected)}><i className="fas fa-microscope" /> 查看Tumor / Normal证据</button>
                  <dl>
                    <div><dt>肿瘤证据</dt><dd>DP {selected.tumor_depth ?? "-"} · ALT {selected.tumor_alt_reads ?? "-"} · AF {percent(selected.af)}</dd></div>
                    <div><dt>正常证据</dt><dd>DP {selected.normal_depth ?? "-"} · ALT {selected.normal_alt_reads ?? "-"}</dd></div>
                    <div><dt>过滤状态</dt><dd>{selected.filter_status || "-"}</dd></div>
                    <div><dt>转录本</dt><dd>{selected.transcript || "-"}</dd></div>
                  </dl>
                </article>
              )}
            </section>

            <section id="pro-mutect2" className="report-v2-section report-v2-anchor">
              <SectionHead title="Mutect2证据与过滤过程" subtitle="TLOD、VAF、深度、配对证据和逐层保留数量" color="#c8324b" />
              <div className="report-v2-chart-grid">
                <ChartCard title="TLOD与肿瘤VAF" subtitle="点大小表示肿瘤测序深度"><ReactECharts option={scatterOption} style={{ height: 310 }} /></ChartCard>
                <ChartCard title="变异筛选漏斗" subtitle="每一步保留数量可追溯"><ReactECharts option={funnelOption} style={{ height: 310 }} /></ChartCard>
              </div>
              <div className="report-v2-thresholds">
                {Object.entries(data.filter_thresholds || {}).map(([name, value]) => <div key={name}><span>{name}</span><strong>{displayValue(value)}</strong></div>)}
              </div>
            </section>

            <section id="pro-annotation" className="report-v2-section report-v2-anchor">
              <SectionHead title="VEP / ANNOVAR 多数据库证据矩阵" subtitle="字段保留来源前缀，避免不同数据库含义混淆" color="#16a6b6" />
              <div className="report-v2-table-wrap">
                <table>
                  <thead><tr><th>变异</th><th>VEP consequence</th><th>ANNOVAR</th><th>ClinVar</th><th>gnomAD AF</th><th>REVEL</th><th>SIFT / PolyPhen</th><th>dbSNP</th></tr></thead>
                  <tbody>{report.items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.gene}</strong><br />{item.hgvs_p || item.hgvs_c}</td><td>{item.consequence || "-"}</td>
                      <td>{annotationValue(item, ["ANNOVAR_Function", "ANNOVAR_ExonicFunc_refGene", "Func.refGeneWithVer", "Func.refGene"])}</td>
                      <td>{annotationValue(item, ["CLINVAR_CLNSIG", "ClinVar", "CLNSIG"])}</td><td>{annotationValue(item, ["GNOMAD_AF", "gnomAD_AF", "gnomAD_exome_AF", "AF"])}</td>
                      <td>{annotationValue(item, ["DBNSFP_REVEL_SCORE", "dbNSFP_REVEL", "REVEL_score"])}</td>
                      <td>{annotationValue(item, ["DBNSFP_SIFT_SCORE", "dbNSFP_SIFT", "SIFT_pred"])} / {annotationValue(item, ["DBNSFP_POLYPHEN2", "dbNSFP_PolyPhen2", "Polyphen2_HDIV_pred"])}</td>
                      <td>{annotationValue(item, ["CLINVAR_RSID", "dbSNP", "avsnp151"])}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {selected && (
                <article className="report-v2-raw-annotations">
                  <header>
                    <div><span>完整字段</span><h3>{selected.gene} {selected.hgvs_p || selected.hgvs_c}</h3></div>
                    <small>{Object.keys(selected.annotations || {}).length} 个来源字段</small>
                  </header>
                  <div>
                    {Object.entries(selected.annotations || {}).map(([key, value]) => (
                      <dl key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value, null, 2) : displayValue(value)}</dd></dl>
                    ))}
                  </div>
                </article>
              )}
            </section>

            <section id="pro-clinical" className="report-v2-section report-v2-anchor">
              <SectionHead title="临床与药物证据" subtitle="药物结论必须结合癌种、指南、证据等级和人工审核" color="#e4a21c" />
              <div className="report-v2-table-wrap">
                <table>
                  <thead><tr><th>基因 / 变异</th><th>药物或策略</th><th>预测反应</th><th>疾病</th><th>证据等级</th><th>来源</th><th>状态</th></tr></thead>
                  <tbody>
                    {allTherapies.map((therapy, index) => <tr key={`${therapy.gene}-${index}`}><td><strong>{therapy.gene}</strong><br />{therapy.hgvs_p}</td><td>{therapy.drug}</td><td>{therapy.response}</td><td>{therapy.disease}</td><td>{therapy.level}</td><td>{therapy.source}</td><td>{therapy.status || "需审核"}</td></tr>)}
                    {!allTherapies.length && <tr><td colSpan={7}>当前报告没有已审核药物证据。</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="pro-biomarkers" className="report-v2-section report-v2-anchor">
              <SectionHead title="分子标志物" subtitle="TMB、MSI、肿瘤纯度与CNV状态" color="#805ad5" />
              <div className="report-v2-metrics">
                <Metric label="TMB" value={formatNumber(biomarkers.tmb)} note={biomarkers.tmb_class || "未分级"} />
                <Metric label="MSI" value={biomarkers.msi_status || "未检测"} note={`score ${formatNumber(biomarkers.msi_score)}`} />
                <Metric label="肿瘤纯度" value={percent(biomarkers.tumor_purity)} note="污染估计/纯度模型" />
                <Metric label="CNV候选" value={String(data.cnv?.length || 0)} note="需参考体系支持" />
              </div>
              <div className="report-v2-table-wrap">
                <table><thead><tr><th>基因</th><th>类型</th><th>log2</th><th>拷贝数</th><th>状态</th></tr></thead>
                  <tbody>{(data.cnv || []).map((cnv) => <tr key={`${cnv.gene}-${cnv.type}`}><td><strong>{cnv.gene}</strong></td><td>{cnv.type}</td><td>{cnv.log2}</td><td>{cnv.copy_number ?? "-"}</td><td>{cnv.status}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section id="pro-neoantigen" className="report-v2-section report-v2-anchor">
              <SectionHead title="HLA与新抗原" subtitle="HLA*LA分型、MHCflurry与NetMHCpan预测结果" color="#178865" />
              <div className="report-v2-chart-grid">
                <ChartCard title="新抗原候选优先级" subtitle="结合强度的综合摘要"><ReactECharts option={neoOption} style={{ height: 290 }} /></ChartCard>
                <article className="report-v2-card"><h3>HLA分型</h3>
                  <div className="report-v2-table-wrap compact"><table><thead><tr><th>位点</th><th>等位基因1</th><th>等位基因2</th><th>分辨率</th></tr></thead><tbody>{(data.hla_typing || []).map((hla) => <tr key={hla.locus}><td>{hla.locus}</td><td>{hla.allele1}</td><td>{hla.allele2}</td><td>{hla.resolution}</td></tr>)}</tbody></table></div>
                </article>
              </div>
              <div className="report-v2-table-wrap">
                <table><thead><tr><th>基因</th><th>Peptide</th><th>长度</th><th>HLA</th><th>NetMHCpan rank</th><th>NetMHCpan affinity</th><th>MHCflurry affinity</th><th>共识</th></tr></thead>
                  <tbody>{allNeoantigens.map((neo, index) => <tr key={`${neo.gene}-${neo.peptide}-${index}`}><td><strong>{neo.gene}</strong></td><td><code>{neo.peptide}</code></td><td>{neo.length}</td><td>{neo.hla}</td><td>{formatNumber(neo.netmhcpan_rank, 2)}</td><td>{formatNumber(neo.netmhcpan_affinity, 1)}</td><td>{formatNumber(neo.mhcflurry_affinity, 1)}</td><td>{neo.consensus}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section id="pro-igv" className="report-v2-section report-v2-anchor">
              <SectionHead title="IGV证据入口" subtitle="最终报告变异对应Tumor与Normal小BAM" color="#1769c2" />
              <div className="report-v2-igv-grid">
                {report.items.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => jumpToIgv(item)}><i className="fas fa-microscope" /><span><strong>{item.gene} {item.hgvs_p || item.hgvs_c}</strong><small>{item.locus} · AF {percent(item.af)}</small></span><b>查看</b></button>)}
              </div>
            </section>

            <section id="pro-review" className="report-v2-section report-v2-anchor">
              <SectionHead title="审核记录与数据来源" subtitle="报告版本、审核人和数据库快照" color="#6b7280" />
              <div className="report-v2-source-grid">
                {report.annotation_sources.map((source) => <article key={source.name}><span>{source.status}</span><h3>{source.name}</h3><p>{source.version} · {source.assembly}</p><small>{source.purpose}</small></article>)}
              </div>
            </section>
          </div>
        )}

        {workspace === "qc" && (
          <div className="report-v2-workspace">
            <WorkspaceIntro kicker="SEQUENCING & PIPELINE QC" title="数据与质量控制" text="覆盖输入样本、FASTQ、比对、BQSR、覆盖度、污染估计、变异质控、软件版本和结果文件。" badge={`${qc.status || "未评估"} · ${data.pipeline_version || "WES pipeline"}`} />

            <section id="qc-samples" className="report-v2-section report-v2-anchor">
              <SectionHead title="样本与流程" subtitle="Tumor/Normal配对关系与参考体系" color="#1769c2" />
              <div className="report-v2-metrics"><Metric label="Tumor" value={report.tumor_sample_id || report.sample_id} note={displayValue(patient.specimen)} /><Metric label="Normal" value={report.normal_sample_id || "未提供"} note="配对正常样本" /><Metric label="参考基因组" value={report.genome_build} note="染色体命名需一致" /><Metric label="流程版本" value={data.pipeline_version || "-"} note={data.analysis_date || report.report_date} /></div>
            </section>

            <section id="qc-fastq" className="report-v2-section report-v2-anchor">
              <SectionHead title="FASTQ质控" subtitle="当前API只展示汇总状态，后续接入fastp JSON明细" color="#16a6b6" />
              <div className="report-v2-notice">fastp详细字段尚未进入报告JSON。正式接入后展示raw/clean reads、Q20、Q30、GC、接头和低质量过滤比例。</div>
            </section>

            <section id="qc-alignment" className="report-v2-section report-v2-anchor">
              <SectionHead title="比对与重复" subtitle="BWA-MEM、排序、重复标记和比对率" color="#178865" />
              <div className="report-v2-metrics"><Metric label="Tumor比对率" value={`${formatNumber(qc.tumor_mapping_rate, 2)}%`} note="最终BAM" /><Metric label="Normal比对率" value={`${formatNumber(qc.normal_mapping_rate, 2)}%`} note="最终BAM" /><Metric label="Tumor重复率" value={`${formatNumber(qc.tumor_duplication_rate)}%`} note="MarkDuplicates" /><Metric label="Normal重复率" value={`${formatNumber(qc.normal_duplication_rate)}%`} note="MarkDuplicates" /></div>
            </section>

            <section id="qc-coverage" className="report-v2-section report-v2-anchor">
              <SectionHead title="深度与覆盖" subtitle="目标BED范围内的平均深度和20×覆盖率" color="#1769c2" />
              <ChartCard title="染色体覆盖概览" subtitle="平均深度与20×覆盖率"><ReactECharts option={coverageOption} style={{ height: 330 }} /></ChartCard>
            </section>

            <section id="qc-bqsr" className="report-v2-section report-v2-anchor">
              <SectionHead title="BQSR质量" subtitle="重校准BAM、已知位点资源和报告状态" color="#805ad5" />
              <div className="report-v2-notice">当前API尚未上传AnalyzeCovariates明细图。流程需要记录dbSNP、Mills indels、1000G资源版本以及BQSR产物校验状态。</div>
            </section>

            <section id="qc-contamination" className="report-v2-section report-v2-anchor">
              <SectionHead title="污染估计与配对一致性" subtitle="GetPileupSummaries、CalculateContamination与方向偏倚模型" color="#e4a21c" />
              <div className="report-v2-metrics"><Metric label="污染比例" value={percent(data.contamination?.fraction)} note="CalculateContamination" /><Metric label="肿瘤纯度" value={percent(data.contamination?.tumor_purity ?? biomarkers.tumor_purity)} note="模型估计" /><Metric label="方向偏倚" value={data.contamination?.orientation_bias_status || "等待字段"} note="LearnReadOrientationModel" /><Metric label="样本配对" value={data.contamination?.pair_concordance || "等待字段"} note="Tumor/Normal一致性" /></div>
            </section>

            <section id="qc-variants" className="report-v2-section report-v2-anchor">
              <SectionHead title="变异质控" subtitle="Mutect2、过滤和人工审核数量" color="#c8324b" />
              <div className="report-v2-metrics"><Metric label="Mutect2 raw" value={String(counts.raw_mutect2 ?? 0)} note="原始候选" /><Metric label="Mutect2 PASS" value={String(counts.mutect2_pass ?? 0)} note="GATK过滤后" /><Metric label="人工硬过滤" value={String(counts.manual_filter_pass ?? 0)} note="VEP注释后" /><Metric label="最终报告" value={String(counts.reportable ?? report.items.length)} note="进入小BAM" /></div>
            </section>

            <section id="qc-workflow" className="report-v2-section report-v2-anchor">
              <SectionHead title="流程状态" subtitle="正式接入后由本地Agent上传逐步骤状态" color="#178865" />
              <div className="report-v2-workflow">
                {(data.workflow_steps?.length ? data.workflow_steps : [
                  { step: "01", label: "FASTQ QC", status: "completed" as const },
                  { step: "02", label: "Alignment", status: "completed" as const },
                  { step: "03", label: "BQSR", status: "completed" as const },
                  { step: "04", label: "Mutect2", status: "completed" as const },
                  { step: "05", label: "Annotation", status: "completed" as const },
                  { step: "06", label: "Report", status: report.status === "released" ? "completed" as const : "running" as const },
                ]).map((step) => <div key={step.step} className={step.status}><b>{step.step}</b><strong>{step.label}</strong><span>{step.status}</span></div>)}
              </div>
            </section>

            <section id="qc-versions" className="report-v2-section report-v2-anchor">
              <SectionHead title="软件与数据库" subtitle="所有结果必须绑定版本和参考组装" color="#16a6b6" />
              <div className="report-v2-source-grid">{report.annotation_sources.map((source) => <article key={source.name}><span>{source.status}</span><h3>{source.name}</h3><p>{source.version} · {source.assembly}</p><small>{source.purpose}</small></article>)}</div>
            </section>

            <section id="qc-files" className="report-v2-section report-v2-anchor">
              <SectionHead title="结果文件" subtitle="云端仅保存报告数据、PDF和最终位点小BAM" color="#6b7280" />
              <div className="report-v2-table-wrap"><table><thead><tr><th>文件</th><th>用途</th><th>云端策略</th></tr></thead><tbody><tr><td>report.json / final_variants.tsv</td><td>页面数据与最终突变</td><td>允许授权查看</td></tr><tr><td>report.pdf</td><td>正式报告</td><td>按发布权限下载</td></tr><tr><td>tumor.report.bam / bai</td><td>最终位点IGV证据</td><td>仅在线Range访问</td></tr><tr><td>normal.report.bam / bai</td><td>配对正常证据</td><td>仅在线Range访问</td></tr><tr><td>原始FASTQ / 完整BAM</td><td>本地分析数据</td><td>不上传、不展示内容</td></tr></tbody></table></div>
            </section>
          </div>
        )}

        {workspace === "germline" && (
          <div className="report-v2-workspace">
            <WorkspaceIntro
              kicker="GERMLINE & MONOGENIC"
              title="遗传与单基因病"
              text={clinicalV2
                ? "以下内容来自 WES 正式报告 JSON 中的遗传性肿瘤风险评估模块。"
                : "该工作区保留未来胚系分析、ACMG审核、罕见病表型匹配、携带者状态和药物基因组学的接口。"}
              badge={clinicalV2 ? "clinical_v2 · hereditary_risk" : "尚未启用正式胚系流程"}
              warning={!clinicalV2}
            />
            {!clinicalV2 && (
              <>
                <div className="report-v2-notice warning">当前Tumor/Normal体细胞流程不能直接生成正式单基因病结论。以下章节仅说明计划接入的数据，不展示模拟患者阳性结果。</div>
                {[
                  ["germline-summary", "模块状态", "需要独立胚系calling、变异质控、ACMG规则和人工遗传审核。"],
                  ["germline-pathogenic", "致病与可能致病变异", "接入ClinVar、ClinGen、OMIM授权数据及ACMG证据条目后展示。"],
                  ["germline-carrier", "携带者状态", "隐性遗传病需要覆盖评估、第二等位基因检查和生育咨询边界。"],
                  ["germline-vus", "意义未明变异", "VUS必须独立展示，不能直接用于临床决策。"],
                  ["germline-phenotype", "表型与罕见病匹配", "接入HPO、Orphanet与患者表型后进行候选疾病排序。"],
                  ["germline-pharmaco", "药物基因组学", "接入CPIC和PharmGKB后展示可行动等级与用药提示。"],
                  ["germline-traits", "趣味遗传与PGS", "PGS当前暂停接入，未来需人群适配、权重版本和非诊断用途声明。"],
                  ["germline-methods", "方法与限制", "WES不能可靠覆盖所有重复序列、动态重复扩增、甲基化改变及复杂结构变异。"],
                ].map(([sectionId, title, text]) => (
                  <section id={sectionId} key={sectionId} className="report-v2-section report-v2-anchor">
                    <SectionHead title={title} subtitle={text} color="#6b7280" />
                    <EmptyState text="当前报告无正式胚系结果。" />
                  </section>
                ))}
              </>
            )}
            {clinicalV2 && flattenModuleSections(hereditaryModule).map((section) => (
              <section id={`germline-${section.section_id || section.number}`} key={section.section_id || section.number} className="report-v2-section report-v2-anchor">
                <SectionHead title={section.title || "遗传性肿瘤风险评估"} subtitle={section.subtitle || section.paragraphs?.[0] || ""} color="#6b7280" />
                {(section.paragraphs || []).map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
                {renderTables(section.tables || [], `hereditary-${section.section_id}`)}
              </section>
            ))}
            {clinicalV2 && moduleTables(pgxModule).length > 0 && (
              <section id="germline-pharmaco" className="report-v2-section report-v2-anchor">
                <SectionHead title="药物基因组学" subtitle={pgxModule?.subtitle || "PHARMACOGENOMICS"} color="#805ad5" />
                {renderTables(moduleTables(pgxModule), "pgx")}
              </section>
            )}
          </div>
        )}
      </main>

      {selectedOrgan && (
        <div className="report-v2-overlay" role="presentation" onClick={closeOrgan}>
          <section className="report-v2-drilldown" role="dialog" aria-modal="true" aria-label={`${selectedOrgan.name}专题数据`} onClick={(event) => event.stopPropagation()}>
            <header className="report-v2-drilldown-head">
              <div>
                <span>ORGAN INTELLIGENCE · JSON DRIVEN</span>
                <h1>{selectedOrgan.name}专题数据</h1>
                <p>{selectedOrgan.recommendation}</p>
              </div>
              <button type="button" onClick={closeOrgan} aria-label="关闭器官专题">×</button>
            </header>
            <div className="report-v2-organ-hero">
              <article><span>证据关注度</span><strong>{selectedOrgan.score.toFixed(1)}</strong><small>/ 10</small></article>
              <article><span>关联基因</span><strong>{selectedOrgan.genes.length}</strong><small>{selectedOrgan.genes.join(" · ") || "暂无"}</small></article>
              <article><span>命中报告突变</span><strong>{organItems.length}</strong><small>来自 portal_variants</small></article>
              <article><span>证据状态</span><strong className="text">{selectedOrgan.evidence}</strong><small>需结合专业审核</small></article>
            </div>
            <div className="report-v2-drilldown-grid">
              <ChartCard title="全器官关注度对比" subtitle={`当前突出显示：${selectedOrgan.name}`}>
                <ReactECharts option={organComparisonOption} style={{ height: 320 }} />
              </ChartCard>
              <article className="report-v2-card report-v2-organ-story">
                <h3>{selectedOrgan.name}证据链</h3>
                <p>该页面完全由报告 JSON 中的 organ_risks、portal_variants 和人工审核字段生成。</p>
                <div>{selectedOrgan.genes.map((gene) => <span key={gene}>{gene}</span>)}</div>
                <ol>
                  <li>器官证据聚合与评分</li>
                  <li>关联基因及最终报告突变交叉匹配</li>
                  <li>临床数据库、药物与测序证据复核</li>
                </ol>
              </article>
            </div>
            <section className="report-v2-organ-variants">
              <div><h2>{selectedOrgan.name}相关突变</h2><p>点击任意突变打开完整资料卡。</p></div>
              {organItems.length ? (
                <div className="report-v2-table-wrap">
                  <table>
                    <thead><tr><th>基因</th><th>HGVS</th><th>坐标</th><th>VAF</th><th>临床意义</th><th>证据</th></tr></thead>
                    <tbody>{organItems.map((item) => (
                      <tr key={item.id} onClick={() => openVariant(item)}>
                        <td><strong>{item.gene}</strong></td><td>{item.hgvs_p || item.hgvs_c || "-"}</td><td>{item.locus}</td><td>{percent(item.af)}</td>
                        <td><span className={`report-v2-badge ${item.significance}`}>{significanceLabels[item.significance] || item.significance}</span></td>
                        <td>查看详情 →</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyState text={`当前最终报告突变中未命中${selectedOrgan.name}关联基因。`} />}
            </section>
          </section>
        </div>
      )}

      {variantOpen && selected && (
        <div className="report-v2-overlay report-v2-variant-overlay" role="presentation" onClick={closeVariant}>
          <section className="report-v2-variant-modal" role="dialog" aria-modal="true" aria-label={`${selected.gene}突变详情`} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className={`report-v2-badge ${selected.significance}`}>{significanceLabels[selected.significance] || selected.significance}</span>
                <h1>{selected.gene} <small>{selected.hgvs_p || selected.hgvs_c}</small></h1>
                <p>{selected.annotation || "该变异的解释信息来自后端报告 JSON。"}</p>
              </div>
              <button type="button" onClick={closeVariant} aria-label="关闭突变详情">×</button>
            </header>
            <div className="report-v2-variant-evidence">
              <article><span>基因组坐标</span><strong>{selected.locus}</strong></article>
              <article><span>肿瘤 VAF</span><strong>{percent(selected.af)}</strong></article>
              <article><span>肿瘤深度</span><strong>{selected.tumor_depth ?? "-"}×</strong></article>
              <article><span>TLOD</span><strong>{formatNumber(selected.tlod, 2)}</strong></article>
            </div>
            <div className="report-v2-variant-columns">
              <section>
                <h2>测序与注释证据</h2>
                <dl>
                  <div><dt>转录本</dt><dd>{selected.transcript || "-"}</dd></div>
                  <div><dt>HGVS.c</dt><dd>{selected.hgvs_c || "-"}</dd></div>
                  <div><dt>HGVS.p</dt><dd>{selected.hgvs_p || "-"}</dd></div>
                  <div><dt>功能后果</dt><dd>{consequenceLabels[selected.consequence] || selected.consequence}</dd></div>
                  <div><dt>正常样本</dt><dd>DP {selected.normal_depth ?? "-"} · ALT {selected.normal_alt_reads ?? "-"}</dd></div>
                  <div><dt>过滤状态</dt><dd>{selected.filter_status || "-"}</dd></div>
                </dl>
              </section>
              <section>
                <h2>数据库原始字段</h2>
                <div className="report-v2-annotation-list">
                  {Object.entries(selected.annotations || {}).slice(0, 12).map(([key, value]) => (
                    <div key={key}><span>{key}</span><strong>{displayValue(value)}</strong></div>
                  ))}
                  {!Object.keys(selected.annotations || {}).length && <p>当前 JSON 未提供扩展数据库字段。</p>}
                </div>
              </section>
            </div>
            <footer>
              <button type="button" className="button button-outline" onClick={closeVariant}>返回报告</button>
              <button type="button" className="button button-primary" onClick={() => jumpToIgv(selected)}><i className="fas fa-microscope" /> 打开 IGV 证据</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

const SectionHead: React.FC<{ title: string; subtitle: string; color: string }> = ({ title, subtitle, color }) => (
  <div className="report-v2-section-head">
    <i style={{ background: color }} /><div><h2>{title}</h2><p>{subtitle}</p></div>
  </div>
);

const Metric: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="report-v2-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
);

const ChartCard: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <article className="report-v2-card"><h3>{title}</h3><p>{subtitle}</p>{children}</article>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="report-v2-empty"><i className="fas fa-info-circle" /><span>{text}</span></div>
);

const WorkspaceIntro: React.FC<{ kicker: string; title: string; text: string; badge: string; warning?: boolean }> = ({ kicker, title, text, badge, warning }) => (
  <header className="report-v2-workspace-intro">
    <div><span>{kicker}</span><h1>{title}</h1><p>{text}</p></div>
    <b className={warning ? "warning" : ""}>{badge}</b>
  </header>
);

export default ReportDetail;
