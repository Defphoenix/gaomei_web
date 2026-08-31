#!/usr/bin/env python3
"""Sync official company website content into Django models.

Run on cloud after deploy:
  cd backend && python3 scripts/sync_company_website.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import django

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from company.models import CompanyInfo, Service, TeamMember  # noqa: E402

COMPANY = {
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
    "email": "contact@gomicsgene.com",
    "phone": "",
    "address": "浙江省杭州市余杭区仓前街道留泽街110号4幢-201-2",
    "wechat": "高美基因",
    "founded_year": 2018,
}

TEAM = [
    {
        "name": "孙德强",
        "position": "董事长 / 创始人",
        "bio": "高美基因创始人，长期深耕肿瘤基因组学与精准医学方向，推动公司实验平台、算法体系与临床转化能力建设。",
        "expertise": "肿瘤基因组学，精准医学，临床转化",
        "order": 1,
    },
    {
        "name": "熊晶",
        "position": "总经理",
        "bio": "负责公司整体运营管理，统筹科研服务、临床检测与产品化落地，推动技术平台持续升级。",
        "expertise": "运营管理，产品开发，检测服务",
        "order": 2,
    },
    {
        "name": "张旭丹",
        "position": "董事会秘书",
        "bio": "负责公司治理、对外沟通与战略协同，连接科研、产业与资本资源。",
        "expertise": "公司治理，战略协同，对外合作",
        "order": 3,
    },
    {
        "name": "陈润生",
        "position": "生物信息学专家顾问",
        "bio": "中国科学院院士，著名生物信息学家，在基因组学与生物信息交叉领域具有深厚积累，为公司算法与数据战略提供指导。",
        "expertise": "生物信息学，基因组学，科学顾问",
        "order": 4,
    },
    {
        "name": "Margaret A. Goodell",
        "position": "表观遗传学专家顾问",
        "bio": "贝勒医学院教授，国际表观遗传与干细胞研究领域专家，为公司表观组学研究方向提供学术支持。",
        "expertise": "表观遗传学，干细胞，科学顾问",
        "order": 5,
    },
]

SERVICES = [
    {
        "title": "肿瘤突变分析",
        "description": "WES、靶向 Panel 与 TAPS 技术，解析 SNV、InDel、CNV 等变异，支持突变与甲基化双维度联合分析。",
        "icon": "fas fa-dna",
        "order": 1,
    },
    {
        "title": "cfDNA 甲基化早筛",
        "description": "基于外周血 cfDNA 甲基化信号的风险评估模型，聚焦肝癌、肺癌等癌种，辅助高危人群筛查。",
        "icon": "fas fa-vial",
        "order": 2,
    },
    {
        "title": "表观基因组检测",
        "description": "WGBS、RRBS、ATAC-seq、ChIP-seq 等平台，覆盖 DNA 甲基化与染色质修饰研究。",
        "icon": "fas fa-microscope",
        "order": 3,
    },
    {
        "title": "单细胞多组学",
        "description": "scRNA-seq、scWGBS、scATAC-seq 在单细胞分辨率解析肿瘤异质性与表观调控。",
        "icon": "fas fa-project-diagram",
        "order": 4,
    },
]


def main() -> int:
    company, created = CompanyInfo.objects.get_or_create(id=1, defaults=COMPANY)
    if not created:
        for key, value in COMPANY.items():
            setattr(company, key, value)
        company.save()
    print(f"Company: {company.name} ({'created' if created else 'updated'})")

    active_names = {row["name"] for row in TEAM}
    TeamMember.objects.exclude(name__in=active_names).update(is_active=False)

    for row in TEAM:
        member, was_created = TeamMember.objects.get_or_create(
            name=row["name"],
            defaults={**row, "is_active": True},
        )
        if not was_created:
            for key, value in row.items():
                setattr(member, key, value)
            member.is_active = True
            member.save()
        print(f"  Team: {member.name} ({member.position})")

    active_titles = {row["title"] for row in SERVICES}
    Service.objects.exclude(title__in=active_titles).update(is_active=False)
    for row in SERVICES:
        service, was_created = Service.objects.get_or_create(
            title=row["title"],
            defaults={**row, "is_active": True},
        )
        if not was_created:
            for key, value in row.items():
                setattr(service, key, value)
            service.is_active = True
            service.save()
        print(f"  Service: {service.title}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
