import type { ComponentProps } from "react";
import { MotionIcon } from "../components/PublicMotion";

export type ProductIcon = ComponentProps<typeof MotionIcon>["variant"];

export type ProductItem = {
  slug: string;
  short: string;
  title: string;
  subtitle: string;
  icon: ProductIcon;
  accent: string;
  image: string;
  qr: string;
  qrLabel: string;
  tags: string[];
  intro: string;
  highlights: string[];
  scene: string;
  sample: string;
  output: string;
  price: number;
  priceOriginal?: number;
  priceNote?: string;
};

export const PRODUCTS: ProductItem[] = [
  {
    slug: "public-welfare",
    short: "公益基因",
    title: "公益基因产品",
    subtitle: "公益筛查 · 惠民检测",
    icon: "shield",
    accent: "#2f9e6b",
    image: "/assets/images/products/kit-welfare.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码报名公益检测",
    tags: ["公益", "惠民", "0 元"],
    intro: "面向符合条件的人群提供公益基因检测名额，降低早筛门槛，让更多家庭获得可及的健康风险评估服务。",
    highlights: [
      "符合条件可申请 0 元检测",
      "标准化采样与报告流程",
      "专业顾问解读与转诊建议",
      "名额有限，扫码或咨询报名",
    ],
    scene: "公益筛查、社区健康行动、符合条件的个人申请",
    sample: "按公益项目说明采集",
    output: "公益检测报告与健康管理建议",
    price: 0,
    priceNote: "公益免费 · 限量名额",
  },
  {
    slug: "susceptibility",
    short: "易感诊断",
    title: "易感基因诊断",
    subtitle: "遗传易感 · 风险评估",
    icon: "dna",
    accent: "#6b6fd6",
    image: "/assets/images/products/kit-susceptibility.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码咨询易感诊断",
    tags: ["易感基因", "遗传", "诊断"],
    intro: "针对肿瘤及相关疾病遗传易感位点进行检测与解读，帮助理解家族风险背景，为健康管理与随访策略提供参考。",
    highlights: [
      "覆盖常见遗传易感相关位点",
      "结构化风险解读报告",
      "可结合家族史综合评估",
      "支持后续随访方案设计",
    ],
    scene: "家族史关注、遗传咨询辅助、健康管理",
    sample: "口腔拭子或外周血（按方案）",
    output: "易感位点报告与管理建议",
    price: 1999,
    priceOriginal: 3999,
  },
  {
    slug: "meiganxin",
    short: "美甘鑫",
    title: "美甘鑫 · 肝癌风险评估",
    subtitle: "cfDNA 甲基化 · 肝癌早筛",
    icon: "target",
    accent: "#5b8def",
    image: "/assets/images/products/kit-meiganxin.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码购买美甘鑫",
    tags: ["cfDNA", "甲基化", "肝癌"],
    intro: "基于外周血 cfDNA 甲基化信号的肝癌风险评估模型，面向高危人群提供辅助筛查信息，助力早期发现与健康管理。",
    highlights: [
      "一管外周血完成检测流程",
      "国人专属甲基化特征库支撑",
      "风险评估报告与随访建议",
      "适合体检与肝病管理场景",
    ],
    scene: "肝癌高危人群、健康管理、队列研究",
    sample: "10 mL 外周血",
    output: "风险评估报告、特征解读与随访建议",
    price: 2999,
    priceOriginal: 6999,
  },
  {
    slug: "meiganfei",
    short: "美甘飞",
    title: "美甘飞 · 肺癌风险评估",
    subtitle: "cfDNA 甲基化 · 肺癌早筛",
    icon: "scan",
    accent: "#4ea37a",
    image: "/assets/images/products/kit-meiganfei.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码购买美甘飞",
    tags: ["cfDNA", "甲基化", "肺癌"],
    intro: "面向肺癌的 cfDNA 甲基化风险评估模型，与低剂量 CT 等影像学手段互补，辅助早期风险识别与肺结节随访管理。",
    highlights: [
      "与影像学手段形成互补",
      "适合高危吸烟人群筛查",
      "支持年度重复检测管理",
      "结构化风险分层报告",
    ],
    scene: "肺癌高危筛查、体检联合、科研验证",
    sample: "10 mL 外周血",
    output: "风险评估报告、模型分层与研究报告",
    price: 2999,
    priceOriginal: 6999,
  },
  {
    slug: "early-screening",
    short: "早筛早检",
    title: "肿瘤早筛早检",
    subtitle: "表观遗传 · 多癌种研究",
    icon: "microscope",
    accent: "#c48a5a",
    image: "/assets/images/products/kit-screening.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码咨询早筛方案",
    tags: ["甲基化", "多组学", "早筛"],
    intro: "通过表观遗传与多组学信号识别早期风险，覆盖多癌种研究队列与健康管理场景，可按项目定制标志物组合。",
    highlights: [
      "多癌种风险信号探索",
      "队列研究友好的交付结构",
      "可衔接影像与临床路径",
      "支持标志物验证设计",
    ],
    scene: "高风险队列、健康管理研究、早期标志物验证",
    sample: "血液及研究方案规定样本",
    output: "风险信号、模型分层、关键特征和研究报告",
    price: 1999,
    priceOriginal: 4999,
  },
  {
    slug: "precision-testing",
    short: "精准检测",
    title: "肿瘤精准检测",
    subtitle: "WES · Panel · TAPS",
    icon: "network",
    accent: "#7a5cff",
    image: "/assets/images/products/kit-precision.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码咨询精准检测",
    tags: ["WES", "Panel", "TAPS"],
    intro: "通过 WES、靶向 Panel 与 TAPS 技术，系统整理治疗相关分子信息与拷贝数变异，支持分子分型与用药讨论。",
    highlights: [
      "全外显子到靶向深度覆盖",
      "TAPS 突变与甲基化双维度",
      "证据分级的中文解读报告",
      "适合治疗方案讨论场景",
    ],
    scene: "治疗方案讨论、靶点检测、分子分型",
    sample: "肿瘤组织、配对正常样本或血液 cfDNA",
    output: "变异总表、证据分级、中文报告",
    price: 4999,
    priceOriginal: 9999,
  },
  {
    slug: "therapy-followup",
    short: "疗效随访",
    title: "疗效监测与随访",
    subtitle: "动态追踪 · 重点位点",
    icon: "report",
    accent: "#3d8ebd",
    image: "/assets/images/products/kit-followup.png",
    qr: "/assets/images/wechat_qrcode.jpg",
    qrLabel: "扫码咨询随访方案",
    tags: ["Panel", "随访", "监测"],
    intro: "基于基线检测结果进行连续时间点观察，对重点位点与甲基化信号进行动态追踪，辅助疗效与复发风险评估。",
    highlights: [
      "基线—随访一体化设计",
      "重点位点动态对比",
      "可对接临床随访节奏",
      "结构化趋势解读",
    ],
    scene: "治疗后随访、复发监控、纵向队列",
    sample: "外周血或既定随访样本",
    output: "动态对比报告、趋势解读与建议",
    price: 1999,
    priceOriginal: 3999,
  },
];

export const DEFAULT_PRODUCT_SLUG = PRODUCTS[0].slug;

export function getProduct(slug?: string) {
  return PRODUCTS.find((p) => p.slug === slug) ?? PRODUCTS[0];
}

export function getProductIndex(slug?: string) {
  const idx = PRODUCTS.findIndex((p) => p.slug === slug);
  return idx >= 0 ? idx : 0;
}

export function formatPrice(value: number) {
  if (value <= 0) return "¥0";
  return `¥${value.toLocaleString("zh-CN")}`;
}
