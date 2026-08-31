import type { TechArticle } from "./types";

export const epigenomeArticles: TechArticle[] = [
  {
    slug: "wgbs",
    title: "全基因组重亚硫酸盐测序（WGBS）",
    subtitle: "Whole Genome Bisulfite Sequencing",
    categoryId: "epigenome",
    categoryTitle: "表观基因组",
    intro:
      "WGBS 是 DNA 甲基化检测的行业金标准，以单碱基分辨率覆盖全基因组 CpG 位点（及部分非 CpG 甲基化），为发现级表观遗传研究提供最全面的数据基础。甲基化在基因表达调控、基因组印记、X 染色体失活及肿瘤发生中扮演核心角色。高美基因拥有成熟的 WGBS 实验与数据分析能力，并针对组织、细胞及 cfDNA 等不同样本类型建立差异化前处理方案。",
    sections: [
      {
        heading: "技术原理",
        paragraphs: [
          "亚硫酸盐将未甲基化胞嘧啶转化为尿嘧啶，而 5-甲基胞嘧啶保持不变，测序后即可区分甲基化状态。全基因组随机打断后建库，可获得几乎全基因组范围的甲基化图谱。",
          "WGBS 数据可用于 CpG 岛、启动子、增强子及基因体区域的甲基化分析，并支持差异甲基化区域（DMR）鉴定与功能注释。",
        ],
      },
      {
        heading: "应用场景",
        paragraphs: [
          "肿瘤早筛与标志物发现：筛选组织或血液中的差异甲基化标志物。",
          "发育与疾病机制：研究胚胎发育、衰老及环境暴露相关的表观变化。",
          "队列研究：大样本 WGBS 或 WGBS 与 RRBS 联合，构建甲基化图谱资源。",
        ],
        bullets: ["单碱基分辨率", "全基因组 CpG 覆盖", "DMR 与通路分析", "与 RNA-seq 多组学联合"],
      },
      {
        heading: "cfDNA 低输入 WGBS",
        paragraphs: [
          "针对液体活检场景，实验室优化微量 cfDNA 的回收、末端修复与亚硫酸盐转化条件，降低降解与损失。",
          "结合靶向甲基化 Panel 可在验证阶段对 WGBS 发现的关键区域进行高深度复核，形成“发现—验证”闭环。",
        ],
      },
      {
        heading: "数据分析",
        paragraphs: [
          "采用 RRBSMAP 等针对亚硫酸盐数据优化的比对工具，配合 MOABS 进行甲基化定量与 DMR 检测。",
          "输出甲基化水平矩阵、DMR 列表、基因组浏览器轨道文件及可视化热图，支持后续机器学习建模。",
        ],
      },
      {
        heading: "交付内容",
        paragraphs: [
          "标准交付包括质控报告、全基因组甲基化矩阵、DMR 注释表、Circos / 热图等可视化结果及原始数据。",
          "可根据课题需求提供与转录组、突变数据的整合分析报告。",
        ],
      },
    ],
    relatedSlugs: ["rrbs", "cfdna-methylation", "bioinformatics-pipeline"],
  },
  {
    slug: "rrbs",
    title: "简化代表性重亚硫酸盐测序（RRBS）",
    subtitle: "Reduced Representation Bisulfite Sequencing",
    categoryId: "epigenome",
    categoryTitle: "表观基因组",
    intro:
      "RRBS 通过限制性内切酶酶切与大小片段选择，富集 CpG 密集的启动子与增强子区域，以约全基因组 WGBS 1% 的数据量获得关键调控区域的高深度甲基化信息，性价比优异，适合大样本队列与临床研究。",
    sections: [
      {
        heading: "技术策略",
        paragraphs: [
          "常用 MspI 等酶切识别 CpG 位点，富集 CpG 岛及启动子附近片段。测序深度集中于功能相关区域，降低单个样本测序成本。",
          "RRBSMAP 算法针对 RRBS 数据的特殊比对需求进行优化，准确区分甲基化与未甲基化胞嘧啶。",
        ],
      },
      {
        heading: "适用场景",
        paragraphs: [
          "肿瘤与正常组织甲基化差异筛查。",
          "药物处理前后表观响应研究。",
          "人群队列表观流行病学调查。",
        ],
      },
      {
        heading: "与 WGBS 的选择",
        paragraphs: [
          "探索阶段、标志物发现优先 WGBS；验证与扩大样本量阶段常用 RRBS 降低成本。",
          "两者可联合设计：WGBS 发现 DMR，RRBS 在独立队列中验证。",
        ],
      },
      {
        heading: "质控与交付",
        paragraphs: [
          "评估酶切效率、文库复杂度、CpG 覆盖度及亚硫酸盐转化率。",
          "交付区域甲基化矩阵、DMR 结果及功能富集分析。",
        ],
      },
    ],
    relatedSlugs: ["wgbs", "atac-seq", "bioinformatics-pipeline"],
  },
  {
    slug: "atac-seq",
    title: "ATAC-seq 染色质可及性测序",
    subtitle: "Assay for Transposase-Accessible Chromatin",
    categoryId: "epigenome",
    categoryTitle: "表观基因组",
    intro:
      "ATAC-seq 利用 Tn5 转座酶切割开放染色质区域，无需抗体即可快速定位活跃调控元件，揭示转录调控活性与顺式作用元件分布，是表观遗传与功能基因组研究的重要工具。",
    sections: [
      {
        heading: "技术特点",
        paragraphs: [
          "实验周期短、细胞起始量要求相对较低，适合新鲜组织与部分冻存样本。",
          "可识别启动子、增强子、绝缘子等开放区域，与 RNA-seq 联合解析基因调控网络。",
        ],
      },
      {
        heading: "肿瘤研究应用",
        paragraphs: [
          "比较肿瘤与癌旁染色质开放状态差异，发现异常激活的增强子。",
          "鉴定转录因子足迹，推测驱动转录程序的关键因子。",
          "与 WGBS 联合分析甲基化与染色质开放性的耦合关系。",
        ],
      },
      {
        heading: "数据分析",
        paragraphs: [
          "峰值 calling、差异开放区域分析、motif 富集及足迹分析构成标准流程。",
          "支持与 ChIP-seq 数据交叉验证关键调控元件。",
        ],
      },
      {
        heading: "交付",
        paragraphs: ["开放区域列表、差异分析结果、基因组浏览器轨道及可视化报告。"],
      },
    ],
    relatedSlugs: ["chip-seq", "scrna-seq", "wgbs"],
  },
  {
    slug: "chip-seq",
    title: "ChIP-seq 染色质免疫共沉淀测序",
    subtitle: "Chromatin Immunoprecipitation Sequencing",
    categoryId: "epigenome",
    categoryTitle: "表观基因组",
    intro:
      "ChIP-seq 通过特异性抗体富集组蛋白修饰或转录因子结合的 DNA 片段，在全基因组范围绘制表观修饰与转录因子结合图谱，深入解析表观调控机制。",
    sections: [
      {
        heading: "检测内容",
        paragraphs: [
          "组蛋白修饰：H3K4me3（活跃启动子）、H3K27me3（抑制标记）、H3K36me3 等。",
          "转录因子结合：鉴定转录因子在全基因组的结合位点，构建调控网络。",
        ],
      },
      {
        heading: "实验要点",
        paragraphs: [
          "抗体特异性与交联条件是关键质控点，需进行 Input 对照与重复实验。",
          "新鲜样本效果最佳，冻存组织需评估降解程度。",
        ],
      },
      {
        heading: "联合分析",
        paragraphs: [
          "与 ATAC-seq 比较活跃与修饰标记的一致性。",
          "与 RNA-seq 关联修饰状态与基因表达变化。",
        ],
      },
      {
        heading: "交付",
        paragraphs: ["峰值注释、差异修饰区域、motif 分析及通路富集结果。"],
      },
    ],
    relatedSlugs: ["atac-seq", "wgbs", "rna-seq"],
  },
];
