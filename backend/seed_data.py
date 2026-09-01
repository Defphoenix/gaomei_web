"""
综合数据填充脚本
运行: cd backend && python3 seed_data.py
"""
import os
import django
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from company.models import CompanyInfo, TeamMember, Service
from blog.models import Category, Tag, Post
from reports.models import Report, ReportItem
from django.utils import timezone

print("=" * 50)
print("开始填充数据...")
print("=" * 50)

# ============ 公司信息 ============
company, _ = CompanyInfo.objects.get_or_create(
    id=1,
    defaults={
        "name": "浙江高美基因科技有限公司",
        "slogan": "让天下无癌",
        "description": (
            "浙江高美基因科技有限公司以表观遗传学为核心、肿瘤基因组学为支柱，"
            "构建了从全基因组突变到单细胞多组学、从组织样本到一管外周血的完整技术矩阵。"
            "公司自主建设肿瘤突变分析（WES / 靶向 Panel / TAPS）、表观多组学、"
            "cfDNA 甲基化检测实验平台与全流程生信算法体系，"
            "以多模型融合 AI 将技术转化为可落地的肿瘤早筛与精准医学方案。"
        ),
        "mission": "让天下无癌",
        "vision": "世界一流的泛癌早筛、早诊",
        "email": "",
        "phone": "0571-88776688",
        "address": "浙江省杭州市余杭区仓前街道留泽街110号4幢-201-2",
        "wechat": "高美基因",
        "founded_year": 2018,
    },
)
print(f"公司信息: {company.name}")

# ============ 团队成员 ============
team_data = [
    {"name": "孙德强", "position": "董事长 / 创始人", "bio": "高美基因创始人，长期深耕肿瘤基因组学与精准医学方向。", "expertise": "肿瘤基因组学，精准医学，临床转化", "order": 1},
    {"name": "熊晶", "position": "总经理", "bio": "负责公司整体运营管理，统筹科研服务、临床检测与产品化落地。", "expertise": "运营管理，产品开发，检测服务", "order": 2},
    {"name": "张旭丹", "position": "董事会秘书", "bio": "负责公司治理、对外沟通与战略协同。", "expertise": "公司治理，战略协同，对外合作", "order": 3},
    {"name": "陈润生", "position": "生物信息学专家顾问", "bio": "中国科学院院士，著名生物信息学家。", "expertise": "生物信息学，基因组学，科学顾问", "order": 4},
    {"name": "Margaret A. Goodell", "position": "表观遗传学专家顾问", "bio": "贝勒医学院教授，国际表观遗传与干细胞研究领域专家。", "expertise": "表观遗传学，干细胞，科学顾问", "order": 5},
]
for td in team_data:
    TeamMember.objects.get_or_create(name=td["name"], defaults=td)
print(f"团队成员: {len(team_data)} 人")

# ============ 服务项目 ============
services_data = [
    {"title": "肿瘤突变分析", "description": "WES、靶向 Panel 与 TAPS，解析 SNV、InDel、CNV 等变异。", "icon": "fas fa-dna", "order": 1},
    {"title": "cfDNA 甲基化早筛", "description": "基于外周血 cfDNA 甲基化信号的风险评估，聚焦肝癌、肺癌等癌种。", "icon": "fas fa-vial", "order": 2},
    {"title": "表观基因组检测", "description": "WGBS、RRBS、ATAC-seq、ChIP-seq 等平台服务。", "icon": "fas fa-microscope", "order": 3},
    {"title": "单细胞多组学", "description": "scRNA-seq、scWGBS、scATAC-seq 单细胞分辨率分析。", "icon": "fas fa-project-diagram", "order": 4},
]
for sd in services_data:
    Service.objects.get_or_create(title=sd["title"], defaults=sd)
print(f"服务项目: {len(services_data)} 项")

# ============ 博客分类和标签 ============
categories_data = [
    {"name": "技术分享", "slug": "tech", "description": "生信技术文章和教程", "order": 1},
    {"name": "行业资讯", "slug": "news", "description": "行业最新动态和新闻", "order": 2},
    {"name": "产品更新", "slug": "product", "description": "产品和服务更新公告", "order": 3},
    {"name": "研究进展", "slug": "research", "description": "科研前沿和研究成果", "order": 4},
]
categories = {}
for cd in categories_data:
    cat, _ = Category.objects.get_or_create(slug=cd["slug"], defaults=cd)
    categories[cd["slug"]] = cat
print(f"博客分类: {len(categories_data)} 个")

tags_data = [
    {"name": "甲基化", "slug": "methylation"},
    {"name": "突变检测", "slug": "mutation"},
    {"name": "NGS", "slug": "ngs"},
    {"name": "精准医学", "slug": "precision-medicine"},
    {"name": "生信分析", "slug": "bioinformatics"},
]
tags = {}
for td in tags_data:
    tag, _ = Tag.objects.get_or_create(slug=td["slug"], defaults=td)
    tags[td["slug"]] = tag
print(f"博客标签: {len(tags_data)} 个")

# ============ 博客文章 ============
admin_user = User.objects.filter(is_superuser=True).first()
if not admin_user:
    admin_user = User.objects.create_superuser("admin", "admin@gaomeibio.com", "admin123")
    print("创建管理员账号: admin / admin123")

posts_data = [
    {
        "title": "DNA甲基化在肿瘤早筛中的应用进展",
        "slug": "dna-methylation-cancer-screening",
        "category": categories["research"],
        "content": """## 引言

DNA甲基化是最早被发现和研究的表观遗传修饰之一，在基因表达调控、基因组稳定性维持等方面发挥着重要作用。近年来，随着检测技术的不断进步，DNA甲基化在肿瘤早期诊断中的应用越来越受到关注。

## DNA甲基化与肿瘤

在正常细胞中，DNA甲基化模式维持着基因组的稳定性。然而在肿瘤发生发展过程中，全基因组低甲基化和特定基因启动子区域的高甲基化是两大特征性改变。

### 关键甲基化标志物

- **SEPT9**: 结直肠癌早期筛查的重要标志物
- **SHOX2**: 肺癌检测中的高特异性标志物
- **RASSF1A**: 多种肿瘤中常见的甲基化基因

## 技术平台

我们公司的甲基化检测平台基于全基因组亚硫酸氢盐测序(WGBS)，能够精确检测每个CpG位点的甲基化状态，为肿瘤早筛提供全面的数据支持。

## 总结

DNA甲基化检测作为肿瘤早筛的重要工具，正在从科研走向临床。高美基因将持续投入技术研发，为精准医学贡献力量。""",
        "summary": "DNA甲基化作为重要的表观遗传标记，在肿瘤早期诊断中展现出巨大潜力。本文介绍了甲基化检测技术的最新进展及其在癌症早筛中的应用。",
        "status": "published",
        "published_at": timezone.now() - timedelta(days=2),
    },
    {
        "title": "NGS时代的基因突变检测技术全解析",
        "slug": "ngs-mutation-detection",
        "category": categories["tech"],
        "content": """## 二代测序(NGS)技术概述

新一代测序技术(Next-Generation Sequencing, NGS)彻底改变了基因组学研究的格局。通过高通量并行测序，我们可以在一次实验中获取海量的基因组数据。

## 突变检测流程

### 1. 样本准备
- 组织样本或血液样本采集
- DNA提取和质量控制
- 文库构建和质控

### 2. 测序策略
- **全外显子组测序(WES)**: 覆盖约1.5%的基因组，但包含约85%的致病突变
- **靶向Panel测序**: 针对特定基因集进行深度测序，适合临床检测

### 3. 生信分析
- 数据质控(FastQC)
- 序列比对(BWA/MEM)
- 变异检测(GATK/Mutect2)
- 变异注释(ANNOVAR/VEP)

## 质量把控

高美基因采用多重质控体系，确保每一个检出的变异位点都经过严格验证。我们的突变检测灵敏度和特异性均达到行业领先水平。""",
        "summary": "全面介绍NGS技术在基因突变检测中的应用，从样本准备到生信分析的完整流程解析。",
        "status": "published",
        "published_at": timezone.now() - timedelta(days=5),
    },
    {
        "title": "MSI检测：肿瘤免疫治疗的重要伴随诊断",
        "slug": "msi-immunotherapy",
        "category": categories["news"],
        "content": """## 什么是MSI

微卫星不稳定性(Microsatellite Instability, MSI)是指由于DNA错配修复(MMR)功能缺陷，导致微卫星序列长度发生改变的遗传现象。

## MSI与免疫治疗

2017年，FDA批准了首个不限癌种的泛肿瘤药物——帕博利珠单抗(Keytruda)，用于MSI-H/dMMR实体瘤的治疗。这一里程碑式的批准使MSI检测成为免疫治疗的重要伴随诊断。

### MSI分类
- **MSI-H**(高度不稳定): 约15%的结直肠癌
- **MSS**(稳定): 约85%的结直肠癌
- **MSI-L**(低度不稳定): 临床意义尚有争议

## 我们的MSI检测平台

高美基因采用多重荧光PCR结合毛细管电泳的方法，检测Panel包含国际推荐的5个NCI位点，同时评估MMR蛋白表达状态，为临床提供全面的MSI评估报告。""",
        "summary": "MSI检测已成为肿瘤免疫治疗的重要伴随诊断工具，了解MSI检测的原理和临床意义。",
        "status": "published",
        "published_at": timezone.now() - timedelta(days=10),
    },
]

for pd_item in posts_data:
    tags_list = [tags["methylation"], tags["ngs"], tags["bioinformatics"]]
    post, created = Post.objects.get_or_create(
        slug=pd_item["slug"],
        defaults={**pd_item, "author": admin_user},
    )
    if created:
        post.tags.set(tags_list[:2])
print(f"博客文章: {len(posts_data)} 篇")

# ============ 模拟报告数据 ============
# 确保有测试用户
test_users = []
for uname, email in [("zhangsan", "zhangsan@example.com"), ("lisi", "lisi@example.com")]:
    u, created = User.objects.get_or_create(username=uname, defaults={"email": email})
    if created:
        u.set_password("test123456")
        u.save()
    test_users.append(u)

# 用户1: 甲基化+突变报告
local_bam = "/data/tracks/demo.bam"
local_bai = "/data/tracks/demo.bam.bai"
local_vcf = "/data/tracks/demo.vcf.gz"
local_tbi = "/data/tracks/demo.vcf.gz.tbi"

report1, _ = Report.objects.get_or_create(
    user=test_users[0],
    sample_id="GM2024001",
    report_type="methylation",
    defaults={
        "title": "样本GM2024001 - 综合基因组分析报告",
        "report_type": "methylation",
        "report_date": date(2024, 12, 15),
        "summary": "本样本进行了全面的基因组分析，包括DNA甲基化检测和基因突变筛查。检测结果显示多个基因存在异常甲基化和致病性突变。",
        "conclusion": "建议结合临床信息进行综合评估，关注MYC、TP53等关键基因的异常改变。",
    },
)

items1 = [
    {"gene": "MYC", "chromosome": "8", "position": 127736588, "end_position": 127739371, "ref_allele": "C", "alt_allele": "T", "variant_type": "Methylation", "significance": "pathogenic", "methylation_level": 0.85, "annotation": "MYC基因启动子区域异常高甲基化", "bam_track_url": local_bam, "bam_index_url": local_bai, "vcf_track_url": local_vcf, "vcf_index_url": local_tbi},
    {"gene": "TP53", "chromosome": "17", "position": 7668421, "end_position": 7687490, "ref_allele": "G", "alt_allele": "A", "variant_type": "SNP", "significance": "pathogenic", "af": 0.35, "annotation": "TP53 R248Q 热点突变", "bam_track_url": local_bam, "bam_index_url": local_bai, "vcf_track_url": local_vcf, "vcf_index_url": local_tbi},
    {"gene": "BRCA1", "chromosome": "17", "position": 43044295, "end_position": 43125364, "ref_allele": "AT", "alt_allele": "A", "variant_type": "InDel", "significance": "likely_pathogenic", "af": 0.48, "annotation": "BRCA1 移码突变", "bam_track_url": local_bam, "bam_index_url": local_bai, "vcf_track_url": local_vcf, "vcf_index_url": local_tbi},
    {"gene": "EGFR", "chromosome": "7", "position": 55019017, "end_position": 55211628, "ref_allele": "T", "alt_allele": "G", "variant_type": "SNP", "significance": "vus", "af": 0.22, "annotation": "EGFR L858R 区域变异", "bam_track_url": local_bam, "bam_index_url": local_bai, "vcf_track_url": local_vcf, "vcf_index_url": local_tbi},
    {"gene": "MLH1", "chromosome": "3", "position": 37034853, "end_position": 37092333, "ref_allele": "", "alt_allele": "", "variant_type": "Methylation", "significance": "likely_pathogenic", "methylation_level": 0.92, "annotation": "MLH1启动子甲基化，提示MSI-H可能", "bam_track_url": local_bam, "bam_index_url": local_bai, "vcf_track_url": local_vcf, "vcf_index_url": local_tbi},
]
for item_data in items1:
    ReportItem.objects.get_or_create(report=report1, gene=item_data["gene"], chromosome=item_data["chromosome"], position=item_data["position"], defaults=item_data)

# 用户1: MSI报告
report_msi, _ = Report.objects.get_or_create(
    user=test_users[0],
    sample_id="GM2024001",
    report_type="msi",
    defaults={
        "title": "样本GM2024001 - MSI检测报告",
        "report_date": date(2024, 12, 18),
        "summary": "采用多重荧光PCR方法检测5个NCI推荐位点，结果显示MSI-H。",
        "conclusion": "MSI-H状态提示患者可能受益于免疫检查点抑制剂治疗。",
    },
)

# 用户2: CNV报告
report2, _ = Report.objects.get_or_create(
    user=test_users[1],
    sample_id="GM2024002",
    report_type="cnv",
    defaults={
        "title": "样本GM2024002 - CNV分析报告",
        "report_type": "cnv",
        "report_date": date(2024, 12, 20),
        "summary": "基于全外显子组测序数据的CNV分析，检测到HER2基因扩增。",
        "conclusion": "HER2扩增阳性，建议评估靶向治疗适应症。",
    },
)

items2 = [
    {"gene": "HER2", "chromosome": "17", "position": 37844331, "end_position": 37884644, "variant_type": "Amplification", "significance": "pathogenic", "cnv_ratio": 5.2, "annotation": "HER2基因扩增，CNV比值5.2"},
    {"gene": "CDKN2A", "chromosome": "9", "position": 21967752, "end_position": 21995286, "variant_type": "Deletion", "significance": "likely_pathogenic", "cnv_ratio": 0.3, "annotation": "CDKN2A纯合缺失"},
]
for item_data in items2:
    ReportItem.objects.get_or_create(report=report2, gene=item_data["gene"], chromosome=item_data["chromosome"], position=item_data["position"], defaults=item_data)

print(f"报告数据: 用户1({test_users[0].username})={Report.objects.filter(user=test_users[0]).count()}份, 用户2({test_users[1].username})={Report.objects.filter(user=test_users[1]).count()}份")
print(f"变异位点: {ReportItem.objects.count()} 个")

print("\n" + "=" * 50)
print("数据填充完成!")
print("=" * 50)
print(f"\n测试账号:")
print(f"  管理员: admin / admin123")
print(f"  用户1:  zhangsan / test123456")
print(f"  用户2:  lisi / test123456")

# ============ 生信 Wiki（内部知识库）============
import subprocess
import sys
from pathlib import Path

_biowiki = Path(__file__).resolve().parent / "scripts" / "seed_biowiki.py"
if _biowiki.exists():
    print("\n填充生信 Wiki…")
    subprocess.run([sys.executable, str(_biowiki)], check=False)
