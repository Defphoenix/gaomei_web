#!/usr/bin/env python3
"""Seed internal Bioinformatics Wiki (生信 Wiki) categories, tags and articles.

Run:
  cd backend && python3 scripts/seed_biowiki.py

Idempotent: safe to re-run; updates content on existing slugs.
"""
from __future__ import annotations

import os
import sys
from datetime import timedelta
from pathlib import Path

import django

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.utils import timezone  # noqa: E402

from bioblog.models import BioCategory, BioComment, BioPost, BioTag  # noqa: E402

CATEGORIES = [
    {
        "slug": "pipeline",
        "name": "分析流程",
        "description": "WES / Panel / 甲基化等标准流程与质控节点",
        "icon": "fas fa-project-diagram",
        "color": "#667eea",
        "order": 1,
    },
    {
        "slug": "methylation",
        "name": "甲基化分析",
        "description": "WGBS / RRBS / cfDNA 甲基化与 MOABS 等工具",
        "icon": "fas fa-dna",
        "color": "#10b981",
        "order": 2,
    },
    {
        "slug": "somatic",
        "name": "肿瘤基因组",
        "description": "体细胞变异、CNV、融合与注释分级",
        "icon": "fas fa-microscope",
        "color": "#f59e0b",
        "order": 3,
    },
    {
        "slug": "liquid-biopsy",
        "name": "液体活检",
        "description": "cfDNA 早筛模型、甲基化特征与随访",
        "icon": "fas fa-tint",
        "color": "#3b82f6",
        "order": 4,
    },
    {
        "slug": "portal",
        "name": "门户与交付",
        "description": "报告同步、IGV 证据、审核发布",
        "icon": "fas fa-cloud",
        "color": "#8b5cf6",
        "order": 5,
    },
    {
        "slug": "ops",
        "name": "环境与规范",
        "description": "Linux 环境、数据安全、协作约定",
        "icon": "fas fa-server",
        "color": "#64748b",
        "order": 6,
    },
]

TAGS = [
    ("qc", "质控"),
    ("wes", "WES"),
    ("panel", "Panel"),
    ("taps", "TAPS"),
    ("moabs", "MOABS"),
    ("igv", "IGV"),
    ("clinvar", "ClinVar"),
    ("oncokb", "OncoKB"),
    ("cfdna", "cfDNA"),
    ("msi", "MSI"),
    ("tmb", "TMB"),
    ("node9", "node9"),
    ("sop", "SOP"),
    ("review", "审核"),
]

POSTS = [
    {
        "slug": "wes-qc-checklist",
        "title": "WES 质控与交付检查清单",
        "category": "pipeline",
        "tags": ["qc", "wes", "sop"],
        "is_pinned": True,
        "summary": "从 FASTQ 到变异总表的全流程质控阈值与常见异常处理。",
        "content": """## 适用范围
肿瘤—正常配对 WES 项目，参考基因组 **GRCh38**。

## 必查指标
- **原始数据**：Q30 比例 ≥ 85%，接头二聚体比例可接受
- **比对**：Mapping rate ≥ 95%，去重后中位深度 ≥ 100×（组织）
- **覆盖度**：外显子区域 ≥ 98% 碱基 ≥ 20×
- **污染**：Contamination estimate < 5%（配对设计时重点看肿瘤样本）
- **Tumor fraction**：组织样本需结合病理评估纯度

## 交付前核对
- 变异总表字段完整：基因、转录本、HGVS、VAF、深度、COSMIC/ClinVar 注释
- 重点基因列表与 Panel 一致（如项目约定）
- 质控 PDF / 图表与 JSON 数据版本号一致

## 常见异常
- **深度不足**：考虑补测或下调 CNV 判读置信度
- **高污染**：优先复核样本标签与提取批次
- **批次效应**：多样本项目记录 flowcell / lane，必要时做批次校正说明

> 正式报告签发前，分析员与审核员各签一轮 checklist。""",
    },
    {
        "slug": "somatic-variant-filter",
        "title": "体细胞变异过滤与分级规范",
        "category": "somatic",
        "tags": ["wes", "panel", "clinvar", "oncokb", "review"],
        "is_pinned": True,
        "summary": "SNV / InDel / CNV 的过滤逻辑与 I/II 类变异证据口径。",
        "content": """## 过滤层级
1. **原始 calling**：Mutect2 / VarScan2 等 caller 输出
2. **胚系剔除**：配对 normal 或 gnomAD / 内部队列频率过滤
3. **功能注释**：VEP / ANNOVAR + OncoKB / CIViC 证据
4. **人工复核**：IGV 查 reads 支持、链偏向、区域复杂度

## VAF 参考（组织）
- **SNV**：VAF ≥ 5% 进入报告讨论区（热点基因可酌情下调并标注）
- **InDel**：注意 indel 区域比对质量，低深度位点标为 **待复核**
- **CNV**：需结合 log2 ratio 与片段长度，全基因缺失/扩增单独分级

## 证据分级（简表）
- **Ⅰ类**：明确临床意义（用药 / 诊断）
- **Ⅱ类**：潜在临床意义，需 MDT 讨论
- **Ⅲ类 / VUS**：写入附录或科研列表，**不**默认进入治疗建议正文

## 中国人队列注意
内部队列与 COSMIC 亚洲亚群数据冲突时，以 **配对 normal + 局部噪声模型** 为准，并在报告中注明。""",
    },
    {
        "slug": "panel-vaf-thresholds",
        "title": "靶向 Panel VAF 与深度判读阈值",
        "category": "somatic",
        "tags": ["panel", "qc", "review"],
        "summary": "不同 Panel 深度下的 SNV / 融合检出与报告纳入标准。",
        "content": """## 深度分层
| 平均深度 | SNV 最低 VAF | 备注 |
| ≥ 500× | 1% | 热点基因可报告 |
| 300–500× | 3% | 需 IGV 确认 |
| < 300× | 5% | 仅作科研参考 |

## 融合 / 重排
- 需 span reads 与 discordant pairs 双支持
- 低丰度融合标注 **低置信** 并建议重复检测

## 报告纳入
- 进入正文表格：通过质控 + 证据 ≥ Ⅱ类 或 项目约定必报基因
- 仅写入总表：VUS 或低于阈值但有临床追问需求""",
    },
    {
        "slug": "cfdna-methylation-qc",
        "title": "cfDNA 甲基化文库质控要点",
        "category": "liquid-biopsy",
        "tags": ["cfdna", "qc", "sop"],
        "summary": "血浆分离、提取、亚硫酸盐转化/酶法建库各环节关键指标。",
        "content": """## 样本环节
- 采血后 **6 h 内** 分离血浆（项目 SOP 为准）
- 血浆溶血、脂血样本单独标记，可影响甲基化背景

## 提取与文库
- cfDNA 总量（ng）与片段分布（主峰 ~167 bp）
- 转化效率 / 酶法反应完整性（按试剂盒 QC 片）
- 文库浓度、片段大小、无接头二聚体峰

## 测序
- 有效 reads 数达到模型最低要求（按产品说明书）
- 批次内阴性/阳性对照通过

## 分析输出
- 位点覆盖均一性、甲基化 β 值分布
- 模型输入特征矩阵版本与训练集快照 ID 需可追溯""",
    },
    {
        "slug": "moabs-dmr-basics",
        "title": "MOABS 差异甲基化分析备忘",
        "category": "methylation",
        "tags": ["moabs", "qc"],
        "summary": "MOABS 定量、DMR calling 参数与结果解读注意事项。",
        "content": """## 工具定位
**MOABS** 用于重亚硫酸盐测序数据的甲基化定量与 DMR 检测，适用于 WGBS / RRBS / 靶向甲基化。

## 推荐流程
1. **BseQC** 原始数据质控
2. **RRBSMAP**（RRBS）或标准比对流程（WGBS）
3. **MOABS** 甲基化 calling + DMR
4. 功能注释：启动子 / 增强子 / 基因体

## 参数备忘
- 最小覆盖深度按实验类型调整（RRBS 常 ≥ 5×）
- DMR 最小 CpG 数、最小长度避免碎片化假阳性
- 多样本比较注意批次，必要时 ComBat 或协变量回归

## 解读提示
- 高甲基化 ≠ 沉默，需结合表达数据
- cfDNA 组织来源分解（如有）可辅助解释 DMR 模式""",
    },
    {
        "slug": "taps-dual-signal",
        "title": "TAPS 突变 + 甲基化双维度解读",
        "category": "methylation",
        "tags": ["taps", "panel", "review"],
        "summary": "TAPS 同时产出 SNV 与甲基化信号时的联合判读思路。",
        "content": """## 技术特点
TAPS 免亚硫酸盐转化，适合 **FFPE / cfDNA** 等低质量 DNA，一次测序获取突变与甲基化。

## 联合分析
- 突变谱：按 Panel / WES 规范过滤
- 甲基化：位点覆盖与 β 值需单独质控（与 WGBS 阈值不可直接等同）
- **一致性**：同一区域突变与甲基化变化需区分技术噪声与生物学信号

## 报告策略
- 正文分块：体细胞变异表 + 甲基化特征摘要
- 低输入样本在局限性声明中说明检测边界""",
    },
    {
        "slug": "igv-evidence-review",
        "title": "IGV 证据复核 SOP（门户）",
        "category": "portal",
        "tags": ["igv", "review", "sop"],
        "is_pinned": True,
        "summary": "在门户 IGV 页面复核 Tumor/Normal BAM 的操作步骤与记录要求。",
        "content": """## 入口
患者报告 → 变异详情 → **IGV 证据**（或 `/browser?report=ID&locus=chr:pos`）

## 复核清单
- **位点**：染色体、坐标、参考/变异碱基与 HGVS 一致
- **Reads**：支持变异的 reads 数、方向、链偏向
- **Normal**：配对样本无相同支持（排除胚系）
- **区域**：重复序列、indel 区标注低置信

## 记录
- 截图或 IGV session 链接写入审核备注
- 争议位点升级至第二审核人

## 本地调试
开发环境 Vite 代理 `/media` 至 Django `:18082`，Range 请求必须可用。""",
    },
    {
        "slug": "portal-sync-node9",
        "title": "node9 报告同步与排错",
        "category": "portal",
        "tags": ["node9", "portal", "sop"],
        "summary": "临床 JSON / PDF / BAM 从 node9 同步到云门户的常见问题。",
        "content": """## 同步路径
node9 → Bridge API (`/api/bridge/reports/import/`) → 患者报告包 → 门户发布

## 必带文件
- `report.json` / `clinical_v2` 结构
- PDF（可选，审核后上传）
- 小 BAM / 索引（IGV 证据，按位点）

## 常见失败
| 现象 | 排查 |
| 401/403 | node token / 节点注册 |
| JSON 校验失败 | schema 版本、必填字段 sample_id |
| IGV 无法加载 | media Range、CORS、BAM 路径 |
| 重复导入 | 使用相同 report_number 会更新而非重复建单 |

## 发布后
- 客户在「个人报告」查看；管理员在「患者报告」编辑排版""",
    },
    {
        "slug": "clinvar-oncokb-annotate",
        "title": "ClinVar / OncoKB 注释与证据分级速查",
        "category": "somatic",
        "tags": ["clinvar", "oncokb", "review"],
        "summary": "致病性、肿瘤驱动性与用药证据的快速对照表。",
        "content": """## ClinVar 致病性
- **P / LP**：胚系报告重点；体细胞需区分 somatic 证据
- **VUS**：默认不写入治疗建议正文
- **冲突**：ClinVar 星级与 submitter 数量参考

## OncoKB
- **Level 1–2**：标准治疗 / 临床证据
- **Level 3A–4**：临床试验 / 病例报告
- **R1–R2**：耐药证据单独列出

## 中文报告写法
- 统一使用「证据等级」「可能获益」等表述
- 避免「确诊」「保证疗效」等医疗宣称
- 未注册适应证标注 **超说明书用药讨论**""",
    },
    {
        "slug": "msi-tmb-immuno",
        "title": "MSI / TMB 免疫治疗相关标志物",
        "category": "somatic",
        "tags": ["msi", "tmb", "panel", "wes"],
        "summary": "MSI 判定标准、TMB 计算口径与报告呈现规范。",
        "content": """## MSI
- **MSI-H**：≥ 30% 不稳定位点（或项目约定阈值）
- **MSS / MSI-L**：合并说明检测局限性
- Panel 需覆盖足够微卫星位点

## TMB
- 单位：**mut/Mb**（编码区非同义突变数 / 可评估 Mb）
- WES 与 Panel 不可直接数值对比，需标注 **检测范围**
- TMB-H 阈值参考产品注册范围（如 ≥ 10 mut/Mb）

## 报告呈现
- 与 PD-L1、免疫药物证据分级同表或相邻模块
- 注明 **辅助决策，非单独用药依据**""",
    },
    {
        "slug": "report-review-checklist",
        "title": "临床报告审核检查表",
        "category": "portal",
        "tags": ["review", "sop"],
        "summary": "报告发布前三步审核：数据、医学、合规表述。",
        "content": """## 第一步：数据一致
- 样本编号、姓名脱敏、采样/报告日期
- 结论与变异表、质控节无矛盾
- 版本号、数据库日期、流程版本

## 第二步：医学逻辑
- Ⅰ/Ⅱ类变异与摘要结论一致
- 随访建议与风险分层匹配
- 胚系/VUS 表述克制

## 第三步：合规
- 「辅助筛查 / 风险评估」口径
- 免责声明、方法学局限、复检建议
- PDF 水印与在线查看权限

## 签发
审核员账号操作「发布」→ 客户可见；操作记入日志。""",
    },
    {
        "slug": "linux-env-setup",
        "title": "生信分析环境初始化（Linux）",
        "category": "ops",
        "tags": ["sop"],
        "summary": "新同事 / 新节点上的 Conda、参考基因组与常用工具安装备忘。",
        "content": """## 基础环境
```bash
# Conda 环境示例
conda create -n gaomei-ngs python=3.11
conda activate gaomei-ngs
```

## 参考数据
- GRCh38 FASTA + GTF（版本号写入 wiki 记录）
- gnomAD / ClinVar / COSMIC 定期同步脚本
- 甲基化：内参对照、阳性对照路径

## 常用工具
- samtools / bcftools / bedtools
- GATK / Mutect2（按 license 约定）
- IGV 桌面版与门户嵌入版 locus 格式一致

## 数据安全
- 受检者数据不出内网；外发需脱敏审批
- 分析目录权限 750，日志保留 180 天""",
    },
    {
        "slug": "ai-screening-model-notes",
        "title": "美甘鑫 / 美甘飞 模型特征与边界",
        "category": "liquid-biopsy",
        "tags": ["cfdna", "review"],
        "summary": "cfDNA 甲基化早筛模型的输入特征、适用人群与禁止表述。",
        "content": """## 模型输入
- cfDNA 甲基化特征矩阵（位点集版本号固定）
- 可选：年龄、性别、肝病/吸烟等协变量（按产品）

## 输出
- 风险评分 + 分层（低 / 中 / 高）
- **非确诊**：统一「风险评估 / 辅助筛查」

## 适用边界
- 美甘鑫：肝癌高危人群，需结合超声 / AFP
- 美甘飞：肺癌高危，与 LDCT 互补
- 炎症、妊娠等可能影响评分，报告中提示

## 版本管理
模型权重、特征列表、训练队列快照需与报告 PDF 脚注版本一致。""",
    },
    {
        "slug": "rrbs-vs-wgbs",
        "title": "RRBS 与 WGBS 选型对照",
        "category": "methylation",
        "tags": ["moabs", "qc"],
        "summary": "两种甲基化测序技术的覆盖、成本与适用场景。",
        "content": """## WGBS
- 全基因组 CpG，金标准
- 数据量大，适合发现式研究

## RRBS
- 富集 CpG 岛 / 启动子，约 1% 数据量
- 适合大队列、成本敏感项目

## 选型建议
| 场景 | 推荐 |
| 大队列筛查 | RRBS |
| 全基因组 DMR 发现 | WGBS |
| 靶向验证 | 甲基化 Panel |
| cfDNA 早筛产品 | 靶向甲基化 + 模型 |

## 分析注意
- RRBS 使用 **RRBSMAP** 比对
- 两种技术 β 值分布不同，不可混批直接比较""",
    },
]


def get_author() -> User:
    user = User.objects.filter(is_superuser=True).first()
    if user:
        return user
    user = User.objects.filter(username="admin").first()
    if user:
        return user
    return User.objects.create_superuser("admin", "admin@gaomeibio.com", "admin123")


def seed_categories() -> dict[str, BioCategory]:
    out: dict[str, BioCategory] = {}
    for item in CATEGORIES:
        obj, _ = BioCategory.objects.update_or_create(
            slug=item["slug"],
            defaults={
                "name": item["name"],
                "description": item["description"],
                "icon": item["icon"],
                "color": item["color"],
                "order": item["order"],
            },
        )
        out[item["slug"]] = obj
    return out


def seed_tags() -> dict[str, BioTag]:
    out: dict[str, BioTag] = {}
    for slug, name in TAGS:
        obj, _ = BioTag.objects.update_or_create(slug=slug, defaults={"name": name})
        out[slug] = obj
    return out


def seed_posts(categories: dict[str, BioCategory], tags: dict[str, BioTag], author: User) -> int:
    now = timezone.now()
    created = 0
    for index, item in enumerate(POSTS):
        published_at = now - timedelta(days=len(POSTS) - index)
        post, was_new = BioPost.objects.update_or_create(
            slug=item["slug"],
            defaults={
                "title": item["title"],
                "author": author,
                "category": categories.get(item["category"]),
                "content": item["content"].strip(),
                "summary": item["summary"],
                "status": "published",
                "is_pinned": item.get("is_pinned", False),
                "published_at": published_at,
            },
        )
        post.tags.set([tags[s] for s in item.get("tags", []) if s in tags])
        if was_new:
            created += 1
    return created


def seed_sample_comments(author: User) -> int:
    """One starter comment on IGV SOP for demo discussion thread."""
    post = BioPost.objects.filter(slug="igv-evidence-review", status="published").first()
    if not post or post.comments.exists():
        return 0
    BioComment.objects.create(
        post=post,
        author=author,
        content="复核时建议同时打开 Normal 轨道，胚系位点误判会少很多。",
    )
    return 1


def main() -> None:
    author = get_author()
    categories = seed_categories()
    tags = seed_tags()
    new_posts = seed_posts(categories, tags, author)
    comments = seed_sample_comments(author)
    total = BioPost.objects.filter(status="published").count()
    print(f"生信 Wiki：分类 {len(categories)}，标签 {len(tags)}，本次新增文章 {new_posts}，已发布共 {total} 篇，示例讨论 {comments} 条")
    print("访问：登录管理员/生信账号 → 导航栏「生信 Wiki」→ /bioblog")


if __name__ == "__main__":
    main()
