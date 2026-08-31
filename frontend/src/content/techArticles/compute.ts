import type { TechArticle } from "./types";

export const computeArticles: TechArticle[] = [
  {
    slug: "bioinformatics-pipeline",
    title: "自主生信算法体系",
    subtitle: "Bioinformatics Pipeline",
    categoryId: "compute",
    categoryTitle: "计算与 AI",
    intro:
      "“湿实验”生产数据，“干实验”提炼价值。高美基因自主研发覆盖甲基化组与基因组变异双维度的全流程算法体系，针对重亚硫酸盐测序数据特性深度优化，支撑大规模样本的稳定分析。",
    sections: [
      {
        heading: "工具矩阵",
        paragraphs: [
          "BseQC：对重亚硫酸盐测序数据进行系统性质量评估与过滤，从源头保障分析可靠性。",
          "RRBSMAP：针对 RRBS 数据特征优化的高效比对算法，精准区分甲基化与未甲基化胞嘧啶。",
          "MOABS：模型驱动的甲基化定量与差异甲基化区域（DMR）检测算法，发表于 Nucleic Acids Research。",
          "Libis、OUMR、MMINT 等自研工具分别面向大规模甲基化定量、DMR 挖掘与多组学整合。",
        ],
        bullets: ["质控 → 比对 → 定量 → 特征挖掘", "甲基化图谱 + 突变谱双输出", "发表于 NAR 等期刊"],
      },
      {
        heading: "流程设计",
        paragraphs: [
          "标准化 Snakemake / Nextflow 流程，软件版本与参数全程记录。",
          "支持组织、血液、FFPE、单细胞等多类型数据接入。",
          "变异检测模块与 GATK / Mutect2 等行业工具衔接，输出统一注释格式。",
        ],
      },
      {
        heading: "质控与审计",
        paragraphs: [
          "每一批次生成汇总质控报告，异常样本自动标记。",
          "分析员审核界面保留过滤步骤与证据链接，满足临床转化项目的可追溯要求。",
        ],
      },
      {
        heading: "扩展能力",
        paragraphs: [
          "支持私有化部署至客户本地 Linux 集群，与云端任务管理联动。",
          "可根据合作方需求定制分析模块与报告模板。",
        ],
      },
      {
        heading: "交付",
        paragraphs: ["标准化分析包、特征矩阵、可视化结果及技术文档。"],
      },
    ],
    relatedSlugs: ["ai-screening", "wgbs", "wes"],
  },
  {
    slug: "ai-screening",
    title: "AI 早筛模型体系",
    subtitle: "AI-powered Screening Models",
    categoryId: "compute",
    categoryTitle: "计算与 AI",
    intro:
      "以血液 cfDNA 的甲基化与突变信号为输入，融合多种机器学习方法构建肿瘤风险评估模型。当前聚焦肝癌与肺癌，并依托 PanCancer 研究项目向泛癌种拓展。",
    sections: [
      {
        heading: "模型产品",
        paragraphs: [
          "美甘鑫：肝癌 cfDNA 甲基化风险评估模型。",
          "美甘飞：肺癌 cfDNA 甲基化风险评估模型。",
          "泛癌种扩展：基于多癌种甲基化特征库的模型研发与验证。",
        ],
      },
      {
        heading: "方法学",
        paragraphs: [
          "特征选择：从全基因组或靶向甲基化数据筛选稳健标志物。",
          "模型训练：随机森林、XGBoost、逻辑回归等多模型对比与融合。",
          "验证策略：独立队列、交叉验证、前瞻性研究（按项目设计）。",
        ],
        bullets: ["多模型融合", "交叉验证", "独立队列验证", "持续迭代"],
      },
      {
        heading: "数据基础",
        paragraphs: [
          "国人专属 cfDNA 甲基化数据库为模型提供训练与校准基础。",
          "累计 7000+ 样本实践经验支撑流程稳定性（具体性能指标以临床验证为准）。",
        ],
      },
      {
        heading: "合规与解读",
        paragraphs: [
          "对外统一使用“风险评估 / 辅助筛查”表述。",
          "模型输出需由专业人员结合临床信息解读，不作为单独确诊依据。",
        ],
      },
      {
        heading: "合作",
        paragraphs: [
          "支持科研合作、队列研究、模型共建与多中心验证项目。",
          "联系技术团队获取白皮书与方案评估。",
        ],
      },
    ],
    relatedSlugs: ["meiganxin", "meiganfei", "bioinformatics-pipeline"],
  },
];
