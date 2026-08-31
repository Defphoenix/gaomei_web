import type { TechArticle } from "./types";

export const singlecellArticles: TechArticle[] = [
  {
    slug: "scrna-seq",
    title: "单细胞转录组测序（scRNA-seq）",
    subtitle: "Single-cell RNA Sequencing",
    categoryId: "singlecell",
    categoryTitle: "单细胞多组学",
    intro:
      "scRNA-seq 在单细胞分辨率绘制基因表达图谱，精准识别细胞类型与功能状态，挖掘肿瘤微环境中的稀有细胞亚群，是解析肿瘤异质性的前沿技术。",
    sections: [
      {
        heading: "技术价值",
        paragraphs: [
          "传统 bulk RNA-seq 反映的是组织平均信号，scRNA-seq 可分辨同一肿瘤内不同克隆与微环境细胞。",
          "识别 T 细胞、巨噬细胞、成纤维细胞等浸润细胞亚型及其状态转换。",
        ],
        bullets: ["细胞类型注释", "稀有亚群发现", "拟时序分析", "细胞通讯推断"],
      },
      {
        heading: "平台与流程",
        paragraphs: [
          "支持 10x Genomics 等主流单细胞平台，从组织解离、细胞捕获到文库构建全程质控。",
          "评估细胞活性、双细胞率及测序饱和度。",
        ],
      },
      {
        heading: "分析",
        paragraphs: [
          "降维聚类、细胞注释、差异表达、轨迹分析及配体—受体分析构成标准流程。",
          "可与 scATAC-seq 进行多组学整合（如使用相同 barcode 策略）。",
        ],
      },
      {
        heading: "应用",
        paragraphs: ["肿瘤微环境、免疫治疗响应、发育谱系及药物筛选研究。"],
      },
    ],
    relatedSlugs: ["scatac-seq", "scwgbs", "rna-seq"],
  },
  {
    slug: "scwgbs",
    title: "单细胞全基因组甲基化（scWGBS）",
    subtitle: "Single-cell WGBS",
    categoryId: "singlecell",
    categoryTitle: "单细胞多组学",
    intro:
      "scWGBS 在单细胞分辨率检测全基因组 DNA 甲基化，解析细胞谱系间表观遗传差异，追踪疾病进程中的甲基化异质性。",
    sections: [
      {
        heading: "技术挑战",
        paragraphs: [
          "单细胞 DNA 量极少，亚硫酸盐转化损失大，需要高度优化的全流程。",
          "数据稀疏性强，分析需采用专门算法处理覆盖不均。",
        ],
      },
      {
        heading: "应用",
        paragraphs: [
          "胚胎发育与细胞分化过程中的甲基化重编程。",
          "肿瘤克隆演化与耐药相关的表观异质性。",
        ],
      },
      {
        heading: "联合",
        paragraphs: ["与 scRNA-seq 联合揭示同一细胞群的转录与表观状态。"],
      },
      {
        heading: "交付",
        paragraphs: ["单细胞甲基化矩阵、聚类结果及差异甲基化区域注释。"],
      },
    ],
    relatedSlugs: ["scrna-seq", "wgbs", "scatac-seq"],
  },
  {
    slug: "scatac-seq",
    title: "单细胞 ATAC-seq（scATAC-seq）",
    subtitle: "Single-cell Chromatin Accessibility",
    categoryId: "singlecell",
    categoryTitle: "单细胞多组学",
    intro:
      "scATAC-seq 刻画单个细胞的染色质开放区域，揭示基因调控元件的细胞类型特异性激活状态，与 scRNA-seq 互补构建单细胞多组学图谱。",
    sections: [
      {
        heading: "特点",
        paragraphs: [
          "细胞核提取与 Tn5 转座酶标记开放染色质，测序后识别峰值。",
          "可推断关键转录因子活性及细胞状态。",
        ],
      },
      {
        heading: "肿瘤研究",
        paragraphs: [
          "解析肿瘤内不同亚克隆的调控程序差异。",
          "鉴定免疫浸润细胞与肿瘤细胞之间的调控差异。",
        ],
      },
      {
        heading: "多组学",
        paragraphs: ["10x Multiome 等平台可实现同一细胞 scRNA + scATAC 联合检测。"],
      },
      {
        heading: "交付",
        paragraphs: ["细胞聚类、开放区域图谱、差异可及性分析及 TF motif 富集。"],
      },
    ],
    relatedSlugs: ["scrna-seq", "atac-seq", "scwgbs"],
  },
];
