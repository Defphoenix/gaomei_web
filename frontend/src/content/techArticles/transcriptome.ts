import type { TechArticle } from "./types";

export const transcriptomeArticles: TechArticle[] = [
  {
    slug: "rna-seq",
    title: "RNA-seq 转录组测序",
    subtitle: "RNA Sequencing",
    categoryId: "transcriptome",
    categoryTitle: "转录组",
    intro:
      "RNA-seq 全景式量化基因表达水平，发现差异表达基因、可变剪接事件与新型转录本，是肿瘤分型、通路研究与生物标志物筛选的核心技术。高美基因提供链特异性建库、多样本批次校正及肿瘤—正常比较分析服务。",
    sections: [
      {
        heading: "技术能力",
        paragraphs: [
          "检测 mRNA 表达谱，支持 FPKM / TPM 定量及差异表达分析。",
          "识别可变剪接、融合基因及新转录本，补充 DNA 层面无法获得的表达与剪接信息。",
          "与 WES / Panel 联合，形成“DNA 变异 + RNA 表达”双组学证据链。",
        ],
        bullets: ["差异表达分析", "融合基因检测", "通路富集", "免疫微环境评估"],
      },
      {
        heading: "肿瘤应用",
        paragraphs: [
          "分子分型：基于表达谱区分肿瘤亚型。",
          "治疗响应：比较治疗前后表达变化，筛选响应相关基因集。",
          "免疫研究：评估免疫细胞浸润相关基因表达特征。",
        ],
      },
      {
        heading: "流程与质控",
        paragraphs: [
          "评估 RNA 完整性（RIN 值）、核糖体残留及基因组 DNA 污染。",
          "测序后评估比对率、基因覆盖度及样本间相关性。",
        ],
      },
      {
        heading: "交付",
        paragraphs: ["表达矩阵、差异基因列表、剪接/融合报告、通路分析与可视化图表。"],
      },
    ],
    relatedSlugs: ["merip-seq", "wes", "scrna-seq"],
  },
  {
    slug: "merip-seq",
    title: "MeRIP-seq m6A 修饰测序",
    subtitle: "Methylated RNA Immunoprecipitation Sequencing",
    categoryId: "transcriptome",
    categoryTitle: "转录组",
    intro:
      "MeRIP-seq 通过 m6A 抗体免疫沉淀富集甲基化修饰 RNA，全基因组定位 m6A 等表观转录组修饰位点，揭示转录后调控机制。",
    sections: [
      {
        heading: "生物学意义",
        paragraphs: [
          "m6A 是最丰富的 mRNA 内部修饰，影响 mRNA 稳定性、剪接、翻译与降解。",
          "肿瘤中 m6A 修饰异常与增殖、转移及治疗耐药相关。",
        ],
      },
      {
        heading: "实验设计",
        paragraphs: [
          "需设置 Input 对照与生物学重复，抗体特异性验证至关重要。",
          "可与 RNA-seq 联合，比较修饰水平与表达量关系。",
        ],
      },
      {
        heading: "分析内容",
        paragraphs: ["峰值 calling、差异 m6A 位点、修饰基因功能富集及 motif 分析。"],
      },
      {
        heading: "应用",
        paragraphs: ["肿瘤表观转录组机制研究、药物靶点发现、与 DNA 甲基化多组学整合。"],
      },
    ],
    relatedSlugs: ["rip-seq", "rna-seq", "wgbs"],
  },
  {
    slug: "rip-seq",
    title: "RIP-seq RNA 免疫沉淀测序",
    subtitle: "RNA Immunoprecipitation Sequencing",
    categoryId: "transcriptome",
    categoryTitle: "转录组",
    intro:
      "RIP-seq 鉴定 RNA 结合蛋白（RBP）的靶 RNA 分子，解析转录后调控网络，在肿瘤发生与应激响应研究中具有重要价值。",
    sections: [
      {
        heading: "原理",
        paragraphs: [
          "使用特异性抗体沉淀目标 RBP 及其结合的 RNA，测序后鉴定结合位点与靶基因。",
          "可研究 splicing 因子、miRNA 加工蛋白等调控因子。",
        ],
      },
      {
        heading: "设计要点",
        paragraphs: ["抗体质量、交联条件、RNase 处理需严格优化。", "设置 IgG 对照排除非特异性结合。"],
      },
      {
        heading: "分析",
        paragraphs: ["结合峰注释、靶基因列表、GO / KEGG 富集及与表达数据整合。"],
      },
      {
        heading: "联合",
        paragraphs: ["与 MeRIP-seq、RNA-seq 构建完整的转录后调控图谱。"],
      },
    ],
    relatedSlugs: ["merip-seq", "rna-seq", "chip-seq"],
  },
];
