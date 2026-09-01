import { getTechArticle } from "./techArticles";
import { PRODUCTS, type ProductItem } from "./productsCatalog";

export type ManualSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type ProductReportModule = {
  id: string;
  title: string;
  desc: string;
  count: number;
  countLabel?: string;
  icon: string;
  color: string;
};

export type ProductReportSample = {
  title: string;
  summary: string;
  sections: string[];
  note: string;
  modules: ProductReportModule[];
};

/** WeGene-style “选择理由” journey step; accent spans render in brand blue. */
export type JourneyPart = { text: string; accent?: boolean };

export type ProductJourneyStep = {
  id: string;
  label: string;
  icon: string;
  parts: JourneyPart[];
};

export type ProductJourney = {
  title: string;
  subtitle: string;
  steps: ProductJourneyStep[];
};

export type CompareCell = string | { kind: "yes" | "no" | "text"; text?: string };

export type ProductCompareRow = {
  key: string;
  label: string;
  cells: Record<string, CompareCell>;
};

export type ProductCompareTable = {
  title: string;
  subtitle: string;
  columns: { slug: string; short: string; accent: string }[];
  rows: ProductCompareRow[];
  footnote: string;
};

export type ProductManual = {
  slug: string;
  disclaimer: string;
  sections: ManualSection[];
  reportSample: ProductReportSample;
  journey: ProductJourney;
};

const GATE_KEY = "gomics_product_guide_ok";

export function openProductGuideAccess(slug: string) {
  try {
    sessionStorage.setItem(GATE_KEY, slug);
  } catch {
    /* ignore */
  }
}

export function hasProductGuideAccess(slug: string): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === slug;
  } catch {
    return false;
  }
}

function baseSections(product: ProductItem): ManualSection[] {
  return [
    {
      heading: "产品概述",
      paragraphs: [product.intro],
      bullets: product.highlights,
    },
    {
      heading: "适用场景",
      paragraphs: [`推荐用于：${product.scene}。`],
    },
    {
      heading: "样本要求",
      paragraphs: [`标准采样：${product.sample}。具体以采样说明书与项目 SOP 为准。`],
    },
    {
      heading: "检测交付",
      paragraphs: [`交付内容：${product.output}。报告仅供专业人员结合临床信息解读。`],
    },
    {
      heading: "合规说明",
      paragraphs: [
        "对外宣传统一使用「风险评估 / 辅助筛查」表述，不能替代影像学、病理学或其他临床确诊手段。",
        "具体性能指标、适应证与使用边界以正式说明书、临床验证资料及注册/备案范围为准。",
      ],
    },
  ];
}

const MODULE_COLORS = [
  "#4A90D9", "#3CB8B0", "#E57373", "#D4A017",
  "#9B7EBD", "#5BA3E0", "#C17A5A", "#5C9E4C",
  "#D16BA5", "#8BC34A", "#7E8CC8", "#F0A020",
  "#E06B5C", "#E8A87C", "#6B9BD2", "#5A6F8C",
];

function m(
  id: string,
  title: string,
  desc: string,
  count: number,
  icon: string,
  colorIndex: number,
  countLabel = "项检测",
): ProductReportModule {
  return {
    id,
    title,
    desc,
    count,
    countLabel,
    icon,
    color: MODULE_COLORS[colorIndex % MODULE_COLORS.length],
  };
}

/** Clinical-style colorful report modules (WeGene-like density, product-appropriate topics). */
function reportModulesFor(product: ProductItem): ProductReportModule[] {
  const bySlug: Record<string, ProductReportModule[]> = {
    meiganxin: [
      m("risk", "风险分层结论", "肝癌相关 cfDNA 甲基化风险评分与分层结果", 1, "fa-chart-pie", 0, "项结论"),
      m("markers", "关键甲基化位点", "模型纳入的核心差异甲基化位点摘要", 48, "fa-dna", 1),
      m("qc", "样本与实验质控", "采血、提取、文库与测序全流程质控通过情况", 12, "fa-vial", 2, "项指标"),
      m("clinical", "临床建议摘要", "结合超声 / AFP 等综合随访提示（需医生判断）", 6, "fa-user-md", 3, "条建议"),
      m("pipeline", "检测流程追溯", "从采样到算法判读的关键节点记录", 8, "fa-project-diagram", 4, "个节点"),
      m("model", "模型说明", "算法框架、验证队列与适用边界说明", 4, "fa-brain", 5, "项说明"),
      m("followup", "随访管理", "低 / 中 / 高风险对应的复查节奏建议", 3, "fa-calendar-check", 6, "档方案"),
      m("limit", "方法学局限", "不能替代病理确诊等合规声明", 5, "fa-exclamation-circle", 7, "条声明"),
      m("compare", "历史对比", "如有既往检测，展示评分趋势占位", 2, "fa-chart-line", 8, "次对比"),
      m("ref", "参考文献", "关键指南与文献引用列表", 15, "fa-book", 9, "篇文献"),
      m("lab", "实验室信息", "检测平台、试剂批次与签发信息", 7, "fa-flask", 10, "项信息"),
      m("faq", "报告解读 FAQ", "常见疑问与就医路径提示", 10, "fa-comments", 11, "个问答"),
      m("partner", "联合筛查建议", "与乙肝管理、腹部影像的协同建议", 4, "fa-link", 12, "条协同"),
      m("safety", "隐私与安全", "数据存储与授权使用说明", 3, "fa-shield-alt", 13, "项说明"),
      m("action", "行动清单", "受检者下一步可执行事项摘要", 5, "fa-tasks", 14, "项行动"),
      m("appendix", "附录与术语", "缩略语、位点命名与术语表", 20, "fa-list", 15, "条术语"),
    ],
    meiganfei: [
      m("risk", "风险分层结论", "肺癌相关 cfDNA 甲基化风险评分与分层", 1, "fa-chart-pie", 2, "项结论"),
      m("markers", "关键甲基化位点", "模型核心位点与信号强度摘要", 52, "fa-dna", 0),
      m("ct", "影像协同提示", "与低剂量 CT / 结节随访的互补说明", 6, "fa-x-ray", 1, "条提示"),
      m("qc", "样本与实验质控", "全流程质控指标与通过状态", 12, "fa-vial", 3, "项指标"),
      m("smoke", "危险因素备注", "吸烟史等背景信息占位（如提供）", 4, "fa-smoking", 4, "项备注"),
      m("followup", "随访管理", "不同风险档的复查建议", 3, "fa-calendar-check", 5, "档方案"),
      m("model", "模型说明", "算法、验证与适用人群说明", 4, "fa-brain", 6, "项说明"),
      m("limit", "方法学局限", "炎症等因素可能影响评分的声明", 5, "fa-exclamation-circle", 7, "条声明"),
      m("pipeline", "检测流程追溯", "采样到报告签发的关键节点", 8, "fa-project-diagram", 8, "个节点"),
      m("lab", "实验室信息", "平台、批次与签发信息", 7, "fa-flask", 9, "项信息"),
      m("ref", "参考文献", "肺癌筛查相关指南与文献", 14, "fa-book", 10, "篇文献"),
      m("faq", "报告解读 FAQ", "常见疑问与专科就诊提示", 10, "fa-comments", 11, "个问答"),
      m("action", "行动清单", "戒烟咨询与复查提醒摘要", 5, "fa-tasks", 12, "项行动"),
      m("compare", "历史对比", "重复检测评分趋势占位", 2, "fa-chart-line", 13, "次对比"),
      m("safety", "隐私与安全", "数据授权与存储说明", 3, "fa-shield-alt", 14, "项说明"),
      m("appendix", "附录与术语", "术语表与缩略语", 18, "fa-list", 15, "条术语"),
    ],
    "precision-testing": [
      m("somatic", "体细胞突变", "最终报告纳入的体细胞变异列表", 36, "fa-dna", 0),
      m("therapy", "靶向治疗证据", "药物与指南证据等级摘要", 18, "fa-pills", 1, "条证据"),
      m("immuno", "免疫治疗相关", "TMB / MSI 等生物标志物", 4, "fa-shield-virus", 2, "项指标"),
      m("cnv", "拷贝数变异", "关键基因扩增 / 缺失摘要", 8, "fa-copy", 3),
      m("fusion", "融合与重排", "结构变异检测结果占位", 3, "fa-exchange-alt", 4),
      m("qc", "测序质控", "覆盖度、比对率、污染等", 15, "fa-vial", 5, "项指标"),
      m("igv", "IGV 证据入口", "关键位点 Tumor/Normal 小 BAM", 12, "fa-microscope", 6, "个位点"),
      m("hla", "HLA 与新抗原", "分型与候选肽段摘要", 10, "fa-project-diagram", 7),
      m("germline", "胚系提示区", "接口预留，正式胚系结论按流程接入", 2, "fa-user-injured", 8, "项预留"),
      m("pgx", "药物基因组", "PGx 相关提示（如启用）", 6, "fa-prescription", 9),
      m("pipeline", "分析流程", "从比对到注释的流程版本", 9, "fa-sitemap", 10, "个步骤"),
      m("review", "审核记录", "审核人、版本与签发信息", 5, "fa-stamp", 11, "项记录"),
      m("limit", "局限性声明", "方法学与检测范围边界", 6, "fa-exclamation-circle", 12, "条声明"),
      m("ref", "数据库来源", "注释数据库版本快照", 11, "fa-database", 13, "个库"),
      m("action", "临床行动建议", "分子肿瘤会讨论要点摘要", 7, "fa-notes-medical", 14, "条要点"),
      m("appendix", "附录与术语", "HGVS、转录本与术语表", 24, "fa-list", 15, "条术语"),
    ],
  };

  if (bySlug[product.slug]) return bySlug[product.slug];

  // Generic rich modules for other products
  return [
    m("summary", "检测结论摘要", "本产品核心结论与一句话解读", 1, "fa-file-medical", 0, "项结论"),
    m("findings", "关键发现", "进入报告的主要阳性 / 关注项", 24, "fa-search", 1),
    m("markers", "检测位点 / 指标", "本方案覆盖的检测内容概览", 64, "fa-dna", 2),
    m("qc", "质量与质控", "样本与实验过程关键质控", 12, "fa-vial", 3, "项指标"),
    m("scene", "适用场景说明", "推荐使用场景与不适用边界", 5, "fa-map-marker-alt", 4, "条说明"),
    m("sample", "采样与送检", "采样类型、运输与接收要求", 8, "fa-tint", 5, "项要求"),
    m("method", "方法学概述", "技术路线与分析流程简述", 6, "fa-cogs", 6, "项说明"),
    m("report", "报告阅读指南", "如何阅读结论与附录", 4, "fa-book-open", 7, "节指南"),
    m("followup", "随访建议", "复查节奏与专科就诊提示", 5, "fa-calendar-check", 8, "条建议"),
    m("risk", "风险管理提示", "结果解读注意事项", 6, "fa-exclamation-triangle", 9, "条提示"),
    m("lab", "实验室信息", "平台、批次与签发信息", 7, "fa-flask", 10, "项信息"),
    m("faq", "常见问题", "受检与合作机构常见问答", 12, "fa-comments", 11, "个问答"),
    m("ref", "参考文献", "指南与文献引用", 10, "fa-book", 12, "篇文献"),
    m("privacy", "隐私与合规", "数据使用与表述规范", 4, "fa-shield-alt", 13, "项说明"),
    m("action", "下一步行动", "下单后采样与报告获取路径", 5, "fa-tasks", 14, "项行动"),
    m("appendix", "附录与术语", "术语表与缩略语", 16, "fa-list", 15, "条术语"),
  ];
}

function reportSampleFor(product: ProductItem): ProductReportSample {
  return {
    title: `${product.short} · 报告示例结构`,
    summary: `以下为「${product.title}」正式报告的信息结构示意，便于了解交付内容与阅读顺序。`,
    sections: [
      "封面与受检信息",
      "检测结论 / 风险分层摘要",
      "关键发现与证据说明",
      "样本与实验质控",
      "随访与健康管理建议",
      "方法学与局限性声明",
    ],
    note: "示例仅展示结构，不包含真实受检者数据。正式报告以实验室签发版本为准。具体项目数量以实际检测为准。",
    modules: reportModulesFor(product),
  };
}

function step(
  id: string,
  label: string,
  icon: string,
  parts: JourneyPart[],
): ProductJourneyStep {
  return { id, label, icon, parts };
}

function t(text: string, accent = false): JourneyPart {
  return accent ? { text, accent: true } : { text };
}

/** Per-product service journey (WeGene-style “选择理由”), sourced from catalog + tech copy. */
function journeyFor(product: ProductItem): ProductJourney {
  const bySlug: Record<string, ProductJourneyStep[]> = {
    meiganxin: [
      step("sample", "采样阶段", "fa-tint", [
        t("一管 "), t("10 mL", true), t(" 外周血完成采样，无需穿刺组织，适合体检与肝病管理场景。"),
      ]),
      step("lab", "检测阶段", "fa-vial", [
        t("血浆分离、cfDNA 提取与甲基化文库全流程质控，关键环节设有 "), t("可追溯", true), t(" 指标。"),
      ]),
      step("analysis", "分析阶段", "fa-project-diagram", [
        t("自研生信 + 多模型融合（随机森林 / XGBoost 等）判读肝癌相关 "), t("甲基化特征", true), t("。"),
      ]),
      step("report", "解读阶段", "fa-file-medical", [
        t("交付风险分层报告、特征说明与随访建议，需结合 "), t("超声 / AFP", true), t(" 等综合判断。"),
      ]),
      step("follow", "健康管理", "fa-heartbeat", [
        t("按低 / 中 / 高风险给出复查节奏提示，可与乙肝管理、腹部影像形成 "), t("联合筛查", true), t(" 路径。"),
      ]),
      step("rd", "持续迭代", "fa-sync-alt", [
        t("依托 PanCancer 研究持续纳入队列数据，模型向 "), t("泛癌种", true), t(" 拓展验证。"),
      ]),
    ],
    meiganfei: [
      step("sample", "采样阶段", "fa-tint", [
        t("标准化 "), t("10 mL", true), t(" 外周血采样，流程轻量，适合年度重复筛查。"),
      ]),
      step("lab", "检测阶段", "fa-lungs", [
        t("面向肺癌的 cfDNA 甲基化检测与文库测序，全流程 "), t("质控闭环", true), t("。"),
      ]),
      step("analysis", "分析阶段", "fa-brain", [
        t("多模型融合评分，降低批次波动；与 "), t("低剂量 CT", true), t(" 策略互补设计。"),
      ]),
      step("report", "解读阶段", "fa-file-medical", [
        t("结构化风险分层报告，提示结节随访与专科就诊路径（需医生判断）。"),
      ]),
      step("follow", "影像协同", "fa-x-ray", [
        t("甲基化信号可辅助判断是否加强影像随访，"), t("不能替代 CT 诊断", true), t("。"),
      ]),
      step("action", "行为干预", "fa-smoking-ban", [
        t("报告附带戒烟咨询与职业防护提示，纳入整体 "), t("肺癌防控", true), t(" 而非孤立产品。"),
      ]),
    ],
    "precision-testing": [
      step("sample", "采样阶段", "fa-procedures", [
        t("支持肿瘤组织、配对正常样本或 "), t("血液 cfDNA", true), t("，按方案选择。"),
      ]),
      step("lab", "检测阶段", "fa-microscope", [
        t("覆盖 "), t("WES / 靶向 Panel / TAPS", true), t("，兼顾突变与甲基化双维度。"),
      ]),
      step("analysis", "分析阶段", "fa-dna", [
        t("SNV、InDel、CNV 及可选融合分析；注释整合 ClinVar / COSMIC / OncoKB 等知识库。"),
      ]),
      step("report", "解读阶段", "fa-notes-medical", [
        t("证据分级的中文报告 + 变异总表，支持 "), t("分子肿瘤会", true), t(" 讨论。"),
      ]),
      step("igv", "证据复核", "fa-search-plus", [
        t("关键位点可衔接门户 "), t("IGV 小 BAM", true), t(" 证据查看，提升复核效率。"),
      ]),
      step("therapy", "用药讨论", "fa-pills", [
        t("输出靶向 / 免疫相关生物标志物摘要，供临床方案讨论参考（非处方依据）。"),
      ]),
    ],
    "therapy-followup": [
      step("baseline", "基线建立", "fa-flag", [
        t("基于既往或同步基线检测，锁定 "), t("重点位点 / 甲基化信号", true), t("。"),
      ]),
      step("sample", "随访采样", "fa-tint", [
        t("按临床随访节奏采集外周血或既定样本，减少多余侵入操作。"),
      ]),
      step("lab", "检测阶段", "fa-vial", [
        t("针对随访 Panel / 信号位点的深度检测，保持与基线可比的质控标准。"),
      ]),
      step("trend", "趋势分析", "fa-chart-line", [
        t("多时间点动态对比，辅助观察疗效响应与 "), t("复发风险", true), t(" 信号变化。"),
      ]),
      step("report", "解读阶段", "fa-file-alt", [
        t("交付动态对比报告与结构化趋势解读，对接临床随访节奏。"),
      ]),
      step("plan", "方案调整", "fa-user-md", [
        t("为专科医生提供会诊讨论要点，"), t("不替代", true), t(" 影像与病理结论。"),
      ]),
    ],
    "early-screening": [
      step("design", "方案设计", "fa-drafting-compass", [
        t("按队列目标定制标志物组合，覆盖 "), t("多癌种", true), t(" 风险信号探索。"),
      ]),
      step("sample", "采样阶段", "fa-flask", [
        t("血液及研究方案规定样本，统一 SOP 降低批次效应。"),
      ]),
      step("lab", "检测阶段", "fa-dna", [
        t("表观遗传 + 多组学信号采集，可衔接 "), t("WGBS / Panel / TAPS", true), t(" 路线。"),
      ]),
      step("analysis", "分析阶段", "fa-chart-bar", [
        t("模型分层、关键特征挖掘与可交付研究矩阵。"),
      ]),
      step("report", "研究交付", "fa-book", [
        t("风险信号、分层结果与研究报告，便于对接影像与临床路径。"),
      ]),
      step("scale", "落地扩展", "fa-expand", [
        t("适合标志物验证与健康管理研究，支持向产品化模型迁移。"),
      ]),
    ],
    susceptibility: [
      step("consult", "遗传咨询入口", "fa-comments", [
        t("结合家族史收集，明确检测目标与 "), t("解读边界", true), t("。"),
      ]),
      step("sample", "采样阶段", "fa-hand-holding-medical", [
        t("口腔拭子或外周血（按方案），流程标准化。"),
      ]),
      step("lab", "检测阶段", "fa-dna", [
        t("覆盖常见肿瘤及相关疾病 "), t("遗传易感位点", true), t("。"),
      ]),
      step("analysis", "分析阶段", "fa-balance-scale", [
        t("位点分级与背景频率参考，避免对 VUS 过度解读。"),
      ]),
      step("report", "解读阶段", "fa-file-medical", [
        t("结构化风险解读报告，可衔接健康管理与随访方案设计。"),
      ]),
      step("plan", "管理建议", "fa-clipboard-list", [
        t("为遗传咨询与专科随访提供参考，"), t("不构成确诊", true), t("。"),
      ]),
    ],
    "public-welfare": [
      step("apply", "公益申请", "fa-hand-holding-heart", [
        t("符合条件可申请 "), t("0 元", true), t(" 检测名额，降低早筛门槛。"),
      ]),
      step("sample", "采样阶段", "fa-tint", [
        t("按公益项目说明标准化采样与送检。"),
      ]),
      step("lab", "检测阶段", "fa-vial", [
        t("与常规产品同一质控体系，保障结果可比与可追溯。"),
      ]),
      step("report", "解读阶段", "fa-file-medical", [
        t("交付公益检测报告与健康管理建议。"),
      ]),
      step("advisor", "顾问服务", "fa-headset", [
        t("专业顾问解读与 "), t("转诊建议", true), t("，帮助后续就医路径清晰。"),
      ]),
      step("community", "惠民覆盖", "fa-users", [
        t("服务社区健康行动与公益筛查，名额有限，扫码或咨询报名。"),
      ]),
    ],
  };

  const steps = bySlug[product.slug] ?? [
    step("sample", "采样阶段", "fa-tint", [
      t(`按方案采集：${product.sample}。`),
    ]),
    step("lab", "检测阶段", "fa-vial", [
      t("标准化实验流程与全环节质控，保障结果可追溯。"),
    ]),
    step("analysis", "分析阶段", "fa-project-diagram", [
      t("自研算法与知识库注释，输出结构化检测结果。"),
    ]),
    step("report", "解读阶段", "fa-file-medical", [
      t(`交付：${product.output}。`),
    ]),
    step("scene", "适用场景", "fa-map-marker-alt", [
      t(`推荐用于：${product.scene}。`),
    ]),
    step("service", "服务支持", "fa-headset", [
      t("顾问协助下单、采样安排与报告阅读引导。"),
    ]),
  ];

  return {
    title: `选择「${product.short}」的理由`,
    subtitle: "从采样到报告与随访，六步看清服务密度与交付价值。",
    steps,
  };
}

function cellText(text: string): CompareCell {
  return { kind: "text", text };
}
function yes(): CompareCell {
  return { kind: "yes" };
}
function no(): CompareCell {
  return { kind: "no" };
}

/** Cross-product comparison table (WeGene-style), from catalog + 技术平台文案. */
export function getProductCompareTable(activeSlug?: string): ProductCompareTable {
  const columns = PRODUCTS.map((p) => ({
    slug: p.slug,
    short: p.short,
    accent: p.accent,
  }));

  const row = (key: string, label: string, cells: Record<string, CompareCell>): ProductCompareRow => ({
    key, label, cells,
  });

  const rows: ProductCompareRow[] = [
    row("scope", "检测范围", {
      "public-welfare": cellText("公益筛查项目规定范围"),
      susceptibility: cellText("常见遗传易感相关位点"),
      meiganxin: cellText("肝癌相关 cfDNA 甲基化特征"),
      meiganfei: cellText("肺癌相关 cfDNA 甲基化特征"),
      "early-screening": cellText("多癌种表观 / 多组学风险信号"),
      "precision-testing": cellText("WES · Panel · TAPS（突变±甲基化）"),
      "therapy-followup": cellText("基线锁定的重点位点 / 信号"),
    }),
    row("sample", "样本类型", {
      "public-welfare": cellText("按公益项目说明"),
      susceptibility: cellText("口腔拭子或外周血"),
      meiganxin: cellText("10 mL 外周血"),
      meiganfei: cellText("10 mL 外周血"),
      "early-screening": cellText("血液及方案规定样本"),
      "precision-testing": cellText("组织 / 配对正常 / cfDNA"),
      "therapy-followup": cellText("外周血或随访样本"),
    }),
    row("tech", "技术路线", {
      "public-welfare": cellText("标准化基因检测流程"),
      susceptibility: cellText("易感位点检测与分级"),
      meiganxin: cellText("cfDNA 甲基化 + AI 模型"),
      meiganfei: cellText("cfDNA 甲基化 + AI 模型"),
      "early-screening": cellText("表观遗传 × 多组学"),
      "precision-testing": cellText("高通量测序（WES/Panel/TAPS）"),
      "therapy-followup": cellText("随访 Panel / 动态信号"),
    }),
    row("output", "核心交付", {
      "public-welfare": cellText("公益报告 + 健康建议"),
      susceptibility: cellText("易感位点报告 + 管理建议"),
      meiganxin: cellText("风险分层 + 随访建议"),
      meiganfei: cellText("风险分层 + 影像协同提示"),
      "early-screening": cellText("风险信号 + 研究报告"),
      "precision-testing": cellText("变异总表 + 证据分级中文报告"),
      "therapy-followup": cellText("动态对比 + 趋势解读"),
    }),
    row("risk", "风险分层 / 证据分级", {
      "public-welfare": yes(),
      susceptibility: yes(),
      meiganxin: yes(),
      meiganfei: yes(),
      "early-screening": yes(),
      "precision-testing": yes(),
      "therapy-followup": yes(),
    }),
    row("imaging", "影像 / 临床协同说明", {
      "public-welfare": cellText("转诊建议"),
      susceptibility: cellText("家族史综合评估"),
      meiganxin: cellText("超声 / AFP 协同"),
      meiganfei: cellText("低剂量 CT 互补"),
      "early-screening": cellText("可衔接影像路径"),
      "precision-testing": cellText("分子肿瘤会讨论"),
      "therapy-followup": cellText("对接临床随访节奏"),
    }),
    row("igv", "门户 IGV 证据入口", {
      "public-welfare": no(),
      susceptibility: no(),
      meiganxin: no(),
      meiganfei: no(),
      "early-screening": no(),
      "precision-testing": yes(),
      "therapy-followup": cellText("可选 / 按项目"),
    }),
    row("follow", "随访 / 动态追踪", {
      "public-welfare": cellText("基础建议"),
      susceptibility: cellText("随访方案设计"),
      meiganxin: yes(),
      meiganfei: yes(),
      "early-screening": cellText("队列友好"),
      "precision-testing": cellText("可衔接随访产品"),
      "therapy-followup": yes(),
    }),
    row("view", "报告查看方式", {
      "public-welfare": cellText("Web / PDF"),
      susceptibility: cellText("Web / PDF"),
      meiganxin: cellText("Web / PDF"),
      meiganfei: cellText("Web / PDF"),
      "early-screening": cellText("Web / 研究数据包"),
      "precision-testing": cellText("Web / PDF / IGV"),
      "therapy-followup": cellText("Web / PDF"),
    }),
    row("feature", "产品特点", {
      "public-welfare": cellText("惠民可及 · 限量名额"),
      susceptibility: cellText("遗传背景 · 结构化解读"),
      meiganxin: cellText("肝癌早筛 · 一管血"),
      meiganfei: cellText("肺癌早筛 · 影像互补"),
      "early-screening": cellText("多癌种探索 · 可定制"),
      "precision-testing": cellText("治疗相关分子信息全景"),
      "therapy-followup": cellText("基线—随访一体化"),
    }),
    row("audience", "适合人群", {
      "public-welfare": cellText("符合公益条件者"),
      susceptibility: cellText("家族史关注 / 遗传咨询辅助"),
      meiganxin: cellText("肝癌高危 / 肝病管理"),
      meiganfei: cellText("肺癌高危 / 结节随访"),
      "early-screening": cellText("高风险队列 / 标志物研究"),
      "precision-testing": cellText("治疗方案讨论 / 分子分型"),
      "therapy-followup": cellText("治疗后随访 / 纵向队列"),
    }),
    row("price", "参考价格", Object.fromEntries(
      PRODUCTS.map((p) => [
        p.slug,
        cellText(
          p.price <= 0
            ? (p.priceNote || "公益免费")
            : `¥${p.price.toLocaleString("zh-CN")}${p.priceOriginal ? `（原价 ¥${p.priceOriginal.toLocaleString("zh-CN")}）` : ""}`,
        ),
      ]),
    )),
  ];

  void activeSlug; // highlight handled in UI

  return {
    title: "产品方案对比",
    subtitle: "一眼看清各方案的检测范围、样本、技术路线与交付差异（资料来自产品目录与技术平台文案）。",
    columns,
    rows,
    footnote: "* 性能指标、适应证与最终报价以正式说明书、临床验证资料及商务确认为准。对外统一「风险评估 / 辅助筛查」口径。",
  };
}

/** Merge catalog fields with tech-article copy when available (说明书第一版内容源). */
export function getProductManual(slug: string): ProductManual | null {
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) return null;

  const article = getTechArticle(slug);
  const fromArticle: ManualSection[] = article
    ? [
        { heading: "产品说明", paragraphs: [article.intro] },
        ...article.sections.map((s) => ({
          heading: s.heading,
          paragraphs: s.paragraphs,
          bullets: s.bullets,
        })),
      ]
    : [];

  const sections = fromArticle.length > 0
    ? [...fromArticle, ...baseSections(product).slice(1)]
    : baseSections(product);

  // De-duplicate similar headings roughly
  const seen = new Set<string>();
  const deduped = sections.filter((s) => {
    const key = s.heading.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    slug,
    disclaimer:
      "本页根据产品对外说明整理，供浏览参考；不等同于医疗器械注册证附带的法定说明书全文。",
    sections: deduped,
    reportSample: reportSampleFor(product),
    journey: journeyFor(product),
  };
}
