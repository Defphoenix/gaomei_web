import type { TechArticle } from "./types";

export const liquidArticles: TechArticle[] = [
  {
    slug: "cfdna-methylation",
    title: "cfDNA 甲基化检测平台",
    subtitle: "Cell-free DNA Methylation Platform",
    categoryId: "liquid",
    categoryTitle: "液体活检",
    intro:
      "面向无创早筛的核心平台。从一管外周血（通常 10 mL）出发，完成血浆分离、cfDNA 提取、甲基化文库构建与高通量测序，全流程质控保障低起始量样本的检测稳定性。与 TAPS 技术协同，可实现突变与甲基化信号的联合捕获。",
    sections: [
      {
        heading: "平台能力",
        paragraphs: [
          "低起始量甲基化测序：针对 ng 级 cfDNA 优化的 WGBS 与靶向甲基化 Panel 流程。",
          "全流程质控：采血、血浆分离、提取、文库、测序各环节设置关键指标与追溯记录。",
          "一管血检测：降低受检者负担，适合大规模筛查与随访场景。",
        ],
        bullets: ["10 mL 外周血采样", "ng 级 cfDNA 建库", "靶向/全基因组甲基化", "联合突变检测可选"],
      },
      {
        heading: "甲基化数据库",
        paragraphs: [
          "建设国人专属 cfDNA 甲基化数据库，收录健康人与多种肿瘤相关甲基化特征，为模型训练与标志物验证提供基础。",
          "数据库持续扩充，支持泛癌种与癌种特异性模型迭代。",
        ],
      },
      {
        heading: "应用场景",
        paragraphs: [
          "高危人群健康管理与体检联合筛查。",
          "科研队列生物标志物发现与验证。",
          "治疗后随访与复发风险监测（需结合临床设计）。",
        ],
      },
      {
        heading: "合规表述",
        paragraphs: [
          "对外宣传统一使用“风险评估 / 辅助筛查”表述，避免诊断性或确诊性措辞。",
          "具体产品性能指标以临床验证数据及注册范围为准。",
        ],
      },
      {
        heading: "交付",
        paragraphs: ["质控报告、甲基化特征矩阵、模型评分及研究报告。"],
      },
    ],
    relatedSlugs: ["meiganxin", "meiganfei", "wgbs"],
  },
  {
    slug: "meiganxin",
    title: "美甘鑫 · 肝癌风险评估",
    subtitle: "HCC Risk Assessment Model",
    categoryId: "liquid",
    categoryTitle: "液体活检",
    intro:
      "美甘鑫是基于 cfDNA 甲基化信号的肝癌风险评估模型，面向肝癌高危人群（如乙肝/丙肝携带者、肝硬化患者等）提供辅助筛查信息，助力早期发现与健康管理。模型融合多种机器学习算法，在独立验证队列中持续优化。",
    sections: [
      {
        heading: "模型原理",
        paragraphs: [
          "筛选与肝癌发生相关的差异甲基化位点，构建分类模型区分高风险信号与背景噪声。",
          "采用随机森林、XGBoost 等集成学习方法，通过交叉验证提升稳健性。",
        ],
      },
      {
        heading: "适用人群",
        paragraphs: [
          "慢性肝病、肝硬化、肝癌家族史等高危人群。",
          "体检中心健康管理与科研队列分层。",
        ],
      },
      {
        heading: "检测流程",
        paragraphs: [
          "标准化采血 → cfDNA 提取 → 甲基化文库 → 测序 → 算法判读 → 风险评估报告。",
          "全程质控与样本追溯，确保结果可重复。",
        ],
      },
      {
        heading: "结果解读",
        paragraphs: [
          "报告提供风险分层与随访建议，需由临床医生结合影像学、AFP 等指标综合判断。",
          "本产品为风险评估工具，不能替代病理确诊。",
        ],
      },
      {
        heading: "持续研发",
        paragraphs: ["依托 PanCancer 研究项目，模型持续纳入新数据迭代，并向泛癌种拓展。"],
      },
    ],
    relatedSlugs: ["meiganfei", "cfdna-methylation", "ai-screening"],
  },
  {
    slug: "meiganfei",
    title: "美甘飞 · 肺癌风险评估",
    subtitle: "Lung Cancer Risk Assessment Model",
    categoryId: "liquid",
    categoryTitle: "液体活检",
    intro:
      "美甘飞是面向肺癌的 cfDNA 甲基化风险评估模型，与低剂量 CT 等影像学手段互补，旨在提升早期肺癌风险识别能力，尤其适用于高危吸烟人群及肺部结节随访管理。",
    sections: [
      {
        heading: "模型特点",
        paragraphs: [
          "基于肺癌相关甲基化标志物组合，对血液样本进行风险评分。",
          "多模型融合框架降低单一批次或单一样本的波动影响。",
        ],
      },
      {
        heading: "适用场景",
        paragraphs: [
          "肺癌高危人群年度筛查。",
          "肺结节患者的辅助风险评估与随访决策参考。",
          "体检与健康管理项目。",
        ],
      },
      {
        heading: "与影像联合",
        paragraphs: [
          "甲基化风险信号可提示进一步影像学检查的必要性，但不能替代 CT 诊断。",
          "联合使用可提高整体筛查策略的灵敏度与特异性（以临床验证数据为准）。",
        ],
      },
      {
        heading: "合规",
        paragraphs: ["统一使用“风险评估 / 辅助筛查”表述，具体适应症与性能指标以注册文件为准。"],
      },
      {
        heading: "交付",
        paragraphs: ["风险评估报告、特征说明及可选的科研数据交付。"],
      },
    ],
    relatedSlugs: ["meiganxin", "cfdna-methylation", "ai-screening"],
  },
];
