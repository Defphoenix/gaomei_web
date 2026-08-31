export type TechLink = {
  slug: string;
  title: string;
  brief: string;
};

export type TechCategory = {
  id: string;
  title: string;
  brief: string;
  links: TechLink[];
};

export const TECH_CATEGORIES: TechCategory[] = [
  {
    id: "somatic",
    title: "肿瘤突变分析",
    brief: "WES · Panel · TAPS 双维度检测",
    links: [
      { slug: "wes", title: "全外显子组测序 WES", brief: "约 2 万基因外显子全面变异检测" },
      { slug: "panel", title: "靶向基因 Panel", brief: "数百基因高深度靶向测序" },
      { slug: "taps", title: "TAPS 甲基化+突变", brief: "无亚硫酸盐转化双维度测序" },
    ],
  },
  {
    id: "epigenome",
    title: "表观基因组",
    brief: "甲基化与染色质修饰金标准技术",
    links: [
      { slug: "wgbs", title: "WGBS 全基因组甲基化", brief: "单碱基分辨率甲基化金标准" },
      { slug: "rrbs", title: "RRBS 简化甲基化", brief: "CpG 岛高深度性价比方案" },
      { slug: "atac-seq", title: "ATAC-seq", brief: "染色质开放性快速检测" },
      { slug: "chip-seq", title: "ChIP-seq", brief: "组蛋白修饰与转录因子结合" },
    ],
  },
  {
    id: "transcriptome",
    title: "转录组",
    brief: "表达谱与 RNA 修饰",
    links: [
      { slug: "rna-seq", title: "RNA-seq 转录组", brief: "全景基因表达与剪接分析" },
      { slug: "merip-seq", title: "MeRIP-seq", brief: "m6A 等 RNA 修饰定位" },
      { slug: "rip-seq", title: "RIP-seq", brief: "RNA 结合蛋白靶标鉴定" },
    ],
  },
  {
    id: "singlecell",
    title: "单细胞多组学",
    brief: "细胞分辨率组学图谱",
    links: [
      { slug: "scrna-seq", title: "scRNA-seq", brief: "单细胞转录组图谱" },
      { slug: "scwgbs", title: "scWGBS", brief: "单细胞全基因组甲基化" },
      { slug: "scatac-seq", title: "scATAC-seq", brief: "单细胞染色质开放性" },
    ],
  },
  {
    id: "liquid",
    title: "液体活检",
    brief: "一管血无创早筛",
    links: [
      { slug: "cfdna-methylation", title: "cfDNA 甲基化平台", brief: "外周血甲基化检测全流程" },
      { slug: "meiganxin", title: "美甘鑫 · 肝癌风险评估", brief: "肝癌 cfDNA 甲基化模型" },
      { slug: "meiganfei", title: "美甘飞 · 肺癌风险评估", brief: "肺癌 cfDNA 甲基化模型" },
    ],
  },
  {
    id: "compute",
    title: "计算与 AI",
    brief: "自研算法与早筛模型",
    links: [
      { slug: "bioinformatics-pipeline", title: "生信算法体系", brief: "BseQC · RRBSMAP · MOABS" },
      { slug: "ai-screening", title: "AI 早筛模型", brief: "多模型融合风险评估" },
    ],
  },
];

export const ALL_TECH_SLUGS = TECH_CATEGORIES.flatMap((c) => c.links.map((l) => l.slug));

export function findTechLink(slug: string): { category: TechCategory; link: TechLink } | null {
  for (const category of TECH_CATEGORIES) {
    const link = category.links.find((l) => l.slug === slug);
    if (link) return { category, link };
  }
  return null;
}
