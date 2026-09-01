#!/usr/bin/env python3
"""Build a compact clinical_v2 demo package: current.json + tiny tumor/normal BAMs."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "wes_report_examples" / "clinical_v2_demo"
sys.path.insert(0, str(ROOT))

from wes_report.schemas import ReportData  # noqa: E402


def table(title, columns, rows, note="", compact=False, css_class=""):
    return {
        "title": title,
        "columns": columns,
        "rows": [["" if v is None else str(v) for v in row] for row in rows],
        "note": note or "表注：结果应结合本节判读口径、检测限制及签发时最新指南和数据库版本综合解释。",
        "compact": compact,
        "css_class": css_class,
    }


def section(number, title, *, paragraphs=None, tables=None, notes=None, page_group="01", show_heading=True):
    return {
        "section_id": number.replace(".", "-"),
        "number": number,
        "title": title,
        "subtitle": "",
        "paragraphs": paragraphs or [],
        "metrics": [],
        "tables": tables or [],
        "bullets": [],
        "notes": notes or [
            "结果需结合临床资料与实验室SOP综合解释。",
            "数据库与指南版本会持续更新，签发前应复核。",
            "本演示数据为虚构，不可作为医学结论。",
        ],
        "page_break_before": True,
        "page_group": page_group,
        "show_heading": show_heading,
    }


def module(number, title, subtitle, sections):
    return {"number": number, "title": title, "subtitle": subtitle, "sections": sections}


def build_report() -> dict:
    tumor_id, normal_id = "SH05677", "SH05678"
    report_date = "2026-08-19"
    patient_name = "冒烟测试患者"
    diagnosis = "胃腺癌"

    qc_tumor = {
        "sample_id": tumor_id,
        "role": "肿瘤样本",
        "mean_target_coverage": 210.87,
        "pct_target_bases_20x": 0.982,
        "pct_target_bases_100x": 0.741,
        "pct_unique_reads_aligned": 0.961,
        "duplication_rate": 0.187,
    }
    qc_normal = {
        "sample_id": normal_id,
        "role": "正常对照",
        "mean_target_coverage": 128.4,
        "pct_target_bases_20x": 0.975,
        "pct_target_bases_100x": 0.612,
        "pct_unique_reads_aligned": 0.972,
        "duplication_rate": 0.152,
    }
    thresholds = [1, 10, 20, 30, 50, 100]
    series_tumor = [0.998, 0.991, 0.982, 0.965, 0.891, 0.741]
    series_normal = [0.997, 0.988, 0.975, 0.942, 0.812, 0.612]

    somatic_rows = [
        ["Ⅲ类变异", "TP53", "exon 7", "c.743G>A", "p.R248Q", "35.2%", "错义突变"],
        ["Ⅲ类变异", "KRAS", "exon 2", "c.35G>A", "p.G12D", "28.6%", "错义突变"],
        ["Ⅲ类变异", "PIK3CA", "exon 10", "c.1633G>A", "p.E545K", "18.1%", "错义突变"],
        ["Ⅲ类变异", "APC", "exon 16", "c.3927_3931del", "p.E1309Dfs*4", "22.4%", "移码突变"],
        ["Ⅲ类变异", "ERBB2", "exon 20", "c.2324_2325ins12", "p.A775_G776insYVMA", "12.8%", "插入突变"],
    ]

    treatment_rows = [
        ["胃癌", "FLOT或含氟嘧啶/铂类围手术期方案", "围手术期", "化疗", "结合分期和体能状态", "--"],
        ["胃癌", "曲妥珠单抗联合含氟嘧啶和铂类", "一线", "HER2靶向+化疗", "HER2阳性晚期胃癌", "--"],
        ["胃癌", "纳武利尤单抗联合化疗", "一线", "免疫+化疗", "HER2阴性；结合PD-L1 CPS", "--"],
        ["胃癌", "PD-1/PD-L1相关治疗", "系统治疗", "免疫", "dMMR/MSI-H", "--"],
    ]

    pgx_class_rows = [
        ["铂类", "顺铂、卡铂、奥沙利铂", "常规使用：顺铂、卡铂、奥沙利铂"],
        ["嘧啶类似物", "卡培他滨、氟尿嘧啶、替吉奥", "谨慎使用：氟尿嘧啶；常规使用：卡培他滨、替吉奥"],
        ["紫杉烷类", "多西他赛、紫杉醇", "常规使用：多西他赛、紫杉醇"],
        ["伊立替康类", "伊立替康", "推荐使用：伊立替康"],
    ]

    matrix_rows = [
        ["遗传性乳腺癌卵巢癌综合征", "BRCA1, BRCA2", "显性", "未见明确升高证据"],
        ["Lynch综合征", "MLH1, MSH2, MSH6, PMS2", "显性", "未见明确升高证据"],
        ["家族性腺瘤性息肉病", "APC", "显性", "潜在匹配(VUS)"],
        ["Li-Fraumeni综合征", "TP53", "显性", "未见明确升高证据"],
        ["遗传性弥漫性胃癌", "CDH1", "显性", "未见明确升高证据"],
    ]

    report = {
        "report": {
            "report_id": f"GAOMEI-WES-{tumor_id}-20260819",
            "title": "全外显子组测序临床报告",
            "subtitle": "Tumor-Normal Paired Whole Exome Sequencing Report",
            "template_version": "2.0",
            "generated_at": report_date,
            "laboratory": "高美基因医学检验实验室",
            "reviewer": "待审核",
        },
        "sample": {
            "sample_id": tumor_id,
            "name": patient_name,
            "sex": "男",
            "age": "53岁",
            "specimen_type": "组织+血液",
            "clinical_diagnosis": diagnosis,
            "received_at": "2026-08-10",
            "tested_at": report_date,
        },
        "layout": {"document_type": "clinical_v2", "show_toc": True, "font_scale": 1.30},
        "executive_message": {
            "enabled": True,
            "page_title": "致受检者的一封信",
            "salutation": "尊敬的受检者及家属：",
            "paragraphs": [
                "感谢您选择高美基因提供的全外显子组测序服务。每一份样本背后，都是一份对生命健康的认真托付。",
                "我们坚持以规范的实验流程、严谨的数据分析和审慎的医学解释，为临床诊疗提供可追溯的分子信息。本报告中的结果仍需由临床医生结合病理诊断、疾病分期、既往治疗及其他检查综合判断。",
                "这是一份用于内部讨论的致辞草案。后续可根据公司负责人意见继续调整文字、署名与表达方式。",
            ],
            "closing": "让基因科技服务每一个生命。",
            "signer_name": "待讨论",
            "signer_title": "高美基因负责人",
            "date": report_date,
        },
        "samples": [
            {"sample_id": tumor_id, "role": "肿瘤样本", "specimen_type": "组织"},
            {"sample_id": normal_id, "role": "正常对照", "specimen_type": "血液"},
        ],
        "overview": module("01", "检测概览", "REPORT OVERVIEW", [
            section("1.1", "基本信息与检测项目", page_group="01", paragraphs=[
                "本次检测采用肿瘤-正常配对全外显子组测序，对体细胞SNV/Indel、肿瘤突变负荷、免疫相关变异、HLA分型、新抗原候选、化疗药物基因组学及遗传性肿瘤候选进行综合分析。参考基因组为GRCh38。"
            ], tables=[table("基本信息", ["姓名", "临床诊断", "性别", "样本类型", "年龄", "样本编号"],
                             [[patient_name, diagnosis, "男", "组织+血液", "53", tumor_id]], compact=True)]),
            section("1.2", "本次检测小结", page_group="02", tables=[
                table("靶向药物相关标志物评估汇总", ["检测内容", "变异等级", "本次结果", "说明"], [
                    ["体细胞变异", "Ⅰ类", "--", "未发现A/B级患者级临床证据"],
                    ["体细胞变异", "Ⅱ类", "--", "未发现C/D级患者级临床证据"],
                    ["体细胞变异", "Ⅲ类", f"{len(somatic_rows)}个", "当前临床复核候选"],
                    ["其他药物治疗方案", "指南方案", "有", "详见2.4"],
                ], compact=True),
                table("免疫治疗相关标志物评估汇总", ["评估内容", "评估结果", "结论"], [
                    ["肿瘤突变负荷（TMB）", "3.214 mutations/Mb", "TMB-L；当前为研发阈值"],
                    ["MSI", "--", "未完成正式判定"],
                    ["免疫治疗新抗原评估", "3个双工具强结合组合", "计算候选，需进一步验证"],
                ], compact=True),
            ]),
            section("1.3", "其他标志物与综合说明", page_group="03", tables=[
                table("其他相关标志物评估汇总", ["评估内容", "分类", "评估结果"], [
                    ["化疗药物评估", "推荐使用药物", "伊立替康"],
                    ["化疗药物评估", "谨慎使用药物", "氟尿嘧啶"],
                    ["家族性遗传肿瘤综合征", "致病/可能致病变异", "--"],
                ], compact=True),
            ]),
        ]),
        "targeted_therapy": module("02", "重要变异及靶向用药检测结果", "TARGETED THERAPY FINDINGS", [
            section("2.1", "肿瘤热点基因变异检测结果", page_group="01", tables=[
                table("", ["基因", "外显子/内含子", "核苷酸变异", "氨基酸变异", "丰度/拷贝数", "变异类型"],
                      [[g, "--", "--", "--", "--", "--"] for g in ["BRAF", "ERBB2", "NTRK1", "RET"]],
                      note="当前WES结果未发现符合Ⅰ/Ⅱ类报告条件的上述基因SNV/Indel。", compact=True)
            ]),
            section("2.2", "具有明确临床意义的变异解读（Ⅰ类变异）", page_group="02", tables=[
                table("本次检测结果", ["结果"], [["--"]], compact=True)
            ]),
            section("2.3", "具有潜在临床意义的变异解读（Ⅱ类变异）", page_group="02", tables=[
                table("本次检测结果", ["结果"], [["--"]], compact=True)
            ]),
            section("2.4", "其他药物治疗方案", page_group="03", paragraphs=[
                "下表为依据胃癌诊疗指南整理的通用治疗路径，不代表本病例已经满足适用条件。"
            ], tables=[table("", ["癌种", "指南治疗方案", "治疗阶段", "机制", "适用条件", "本病例匹配"],
                             treatment_rows, compact=True, css_class="treatment-table")]),
        ]),
        "quality_control": {
            **module("03", "检测质控", "QUALITY CONTROL", []),
            "samples": [qc_tumor, qc_normal],
            "coverage_thresholds": thresholds,
            "coverage_series": [
                {"sample_id": tumor_id, "role": "肿瘤样本", "values": series_tumor},
                {"sample_id": normal_id, "role": "正常对照", "values": series_normal},
            ],
            "notes": [
                "平均深度和覆盖率用于评估目标区域数据充足性。",
                "重复率、比对率应结合建库方法与实验室验证阈值综合判定。",
                "本页为演示质控数据。",
            ],
            "table": table("", ["主要评估内容", "质控参数", "肿瘤样本", "正常样本", "参考/状态"], [
                ["测序质量评估", "平均目标深度", "210.9×", "128.4×", "Picard HsMetrics"],
                ["测序质量评估", "目标区≥20×覆盖率", "98.2%", "97.5%", "Picard HsMetrics"],
                ["测序质量评估", "目标区≥100×覆盖率", "74.1%", "61.2%", "Picard HsMetrics"],
                ["测序质量评估", "唯一reads比对率", "96.1%", "97.2%", "Picard HsMetrics"],
                ["测序质量评估", "重复排除比例", "18.7%", "15.2%", "Picard HsMetrics"],
            ], compact=True, css_class="qc-data-table"),
            "guidance_table": table("质控指标说明", ["指标", "主要含义", "解释口径"], [
                ["平均目标深度", "目标区域平均有效覆盖", "总体统计量，不代表每个位点深度相同"],
                ["目标区覆盖率", "达到指定深度阈值的目标区域比例", "结合实验室验证阈值解释"],
                ["唯一reads比对率", "去重后有效序列比对比例", "受样本质量与文库复杂度影响"],
                ["重复排除比例", "PCR/光学重复被排除的比例", "较高时需结合总深度判断"],
                ["肿瘤-正常配对", "辅助区分体细胞与胚系变异", "正常对照质量不足会影响过滤"],
                ["综合质控结论", "样本/建库/测序/生信整体复核", "按SOP由授权人员签发"],
                ["肿瘤细胞含量", "病理评估的肿瘤比例", "影响低丰度变异检出"],
                ["DNA完整性", "核酸降解程度", "未提供时不能反推原始样本质量"],
            ], compact=True, css_class="qc-guidance-table"),
        },
        "somatic_variants": module("04", "靶向药物相关标志物检测结果", "SOMATIC VARIANT FINDINGS", [
            section("4.1", "基因变异结果汇总", page_group="01", paragraphs=[
                f"本表列出当前经过体细胞过滤并纳入编码后果集合的{len(somatic_rows)}条候选，暂按Ⅲ类展示。"
            ], tables=[table("", ["变异分类", "基因", "外显子/内含子", "核苷酸变异", "氨基酸变异", "丰度/拷贝数", "变异类型"],
                             somatic_rows, compact=True, css_class="somatic-table")]),
        ]),
        "immunotherapy": module("05", "免疫治疗相关标志物评估结果", "IMMUNOTHERAPY BIOMARKERS", [
            section("5.1", "肿瘤突变负荷评估详细解读", page_group="01", tables=[
                table("", ["评估指标", "本次结果", "说明"], [
                    ["TMB", "3.214 mutations/Mb", "当前研发阈值下为TMB-L"],
                    ["纳入编码变异", "66个", "missense、stop、frameshift等"],
                    ["有效编码区域", "20.534 Mb", "当前BED推算分母"],
                    ["免疫治疗结论", "--", "不能仅根据当前TMB形成用药结论"],
                ], compact=True)
            ]),
            section("5.2", "MSI检测详细解读", page_group="02", tables=[
                table("", ["评估内容", "检测结果", "临床提示"],
                      [["MSI状态", "--", "未判定"], ["微卫星稳定性", "--", "--"]], compact=True)
            ]),
            section("5.3", "免疫治疗正相关评估结果", page_group="03", tables=[
                table("", ["基因", "核苷酸变异", "氨基酸变异", "丰度/拷贝数", "疗效提示"],
                      [["--", "--", "--", "--", "--"]], compact=True)
            ]),
            section("5.4", "免疫治疗超进展评估结果", page_group="03", tables=[
                table("", ["基因", "核苷酸变异", "氨基酸变异", "丰度/拷贝数", "疗效提示"],
                      [["--", "--", "--", "--", "--"]], compact=True)
            ]),
            section("5.5", "免疫治疗耐药评估结果", page_group="04", tables=[
                table("", ["基因", "核苷酸变异", "氨基酸变异", "丰度/拷贝数", "疗效提示"],
                      [["--", "--", "--", "--", "--"]], compact=True)
            ]),
        ]),
        "neoantigens": module("06", "免疫治疗新抗原预测结果", "HLA AND NEOANTIGEN", [
            section("6.1", "HLA-I高分辨率分型", tables=[
                table("HLA分型", ["位点", "拷贝", "HLA*LA分型", "结合预测等位基因", "平均覆盖度"], [
                    ["A", "1", "A*31:01:02G", "HLA-A*31:01", "86.2"],
                    ["A", "2", "A*33:03:01G", "HLA-A*33:03", "91.4"],
                    ["B", "1", "B*15:01:01G", "HLA-B*15:01", "78.9"],
                    ["B", "2", "B*58:01:01G", "HLA-B*58:01", "82.1"],
                    ["C", "1", "C*03:02:01G", "HLA-C*03:02", "74.5"],
                    ["C", "2", "C*15:02:01G", "HLA-C*15:02", "79.0"],
                ], compact=True)
            ]),
            section("6.2", "优先新抗原候选", page_group="02", tables=[
                table("Top候选", ["基因", "突变", "肽段", "HLA分型", "NetMHCpan EL rank", "MHCflurry亲和力"], [
                    ["TP53", "p.R248Q", "NYMCNSSCM", "HLA-A*33:03", "0.082", "48.2 nM"],
                    ["KRAS", "p.G12D", "KLVVVGAGGV", "HLA-A*31:01", "0.150", "62.1 nM"],
                    ["PIK3CA", "p.E545K", "STRDPLSEI", "HLA-B*15:01", "0.210", "95.4 nM"],
                ], note="共有3个双工具强结合组合；新抗原为计算预测。", compact=True)
            ]),
        ]),
        "pharmacogenomics": module("07", "化疗药物检测结果", "PHARMACOGENOMICS", [
            section("7.1", "常见肿瘤化疗药物分类与综合评估", page_group="01", tables=[
                table("", ["药物分类", "药物列表", "患者药物基因组综合结果"], pgx_class_rows,
                      compact=True, css_class="pgx-class-table")
            ]),
            section("7.2", "获得患者基因型证据的药物详情", page_group="02", tables=[
                table("", ["药物", "药物类别", "常见肿瘤用途", "药效方向", "毒性方向", "综合建议", "证据"], [
                    ["伊立替康", "拓扑异构酶I抑制剂", "结直肠癌/胃癌", "可能获益", "未见额外警示", "推荐使用", "ClinPGx 1A"],
                    ["氟尿嘧啶", "嘧啶类似物", "消化道肿瘤", "常规", "毒性风险升高", "谨慎使用", "ClinPGx 1A"],
                    ["奥沙利铂", "铂类", "消化道肿瘤", "常规", "未见额外警示", "常规使用", "ClinPGx 2A"],
                ], compact=True, css_class="pgx-detail-table")
            ]),
        ]),
        "hereditary_risk": module("08", "遗传性肿瘤综合征风险评估结果", "HEREDITARY CANCER RISK", [
            section("8.1", "遗传性肿瘤结果摘要", page_group="01", paragraphs=[
                "本部分依据ClinGen高可信基因-疾病关系，对遗传性肿瘤相关疾病进行患者级胚系变异匹配。"
            ], tables=[
                table("致病/可能致病胚系变异", ["基因", "变异位点", "临床意义", "合子类型", "相关遗传性肿瘤综合征", "相关易感肿瘤"],
                      [["--", "--", "--", "--", "--", "--"]], compact=True),
                table("相关肿瘤发生风险评估结果", ["评估内容", "评估结果", "说明"], [
                    ["高可信疾病/综合征", "5种（演示子集）", "ClinGen高等级关系"],
                    ["P/LP疾病匹配", "0种", "当前未发现"],
                    ["潜在遗传疾病匹配", "1种", "VUS潜在匹配"],
                ], compact=True),
            ]),
            section("8.2", "潜在遗传疾病匹配", page_group="02", tables=[
                table("潜在遗传疾病匹配", ["基因", "变异", "相关疾病/综合征", "证据说明"], [
                    ["APC", "c.3920T>A p.I1307K", "家族性腺瘤性息肉病相关", "VUS：临床意义未明"],
                ], compact=True)
            ]),
            section("8.3", "高置信遗传性肿瘤疾病矩阵（演示子集）", page_group="03", tables=[
                table("ClinGen疾病矩阵", ["疾病/综合征", "相关基因", "遗传方式", "患者状态"],
                      matrix_rows, compact=True)
            ]),
        ]),
        "appendices": module("09", "附录", "APPENDICES", [
            section("9.1", "注释数据来源", page_group="01", tables=[
                table("", ["名称", "版本", "组装", "用途", "状态"], [
                    ["VEP", "115", "GRCh38", "变异后果注释", "available"],
                    ["ClinVar", "2026-07", "GRCh38", "临床意义参考", "available"],
                    ["OncoKB", "2026-06", "GRCh38", "肿瘤学证据", "available"],
                    ["ClinPGx", "2026-05", "GRCh38", "药物基因组", "available"],
                ], compact=True)
            ]),
            section("9.2", "检测限制与声明", page_group="02", paragraphs=[
                "本报告是实验室检测结果与知识库证据的综合说明，不构成处方或诊断证明的替代品。",
                "演示数据均为虚构，仅用于模板与系统联调。",
            ], tables=[table("声明摘要", ["项目", "说明"], [
                ["参考基因组", "GRCh38"],
                ["适用边界", "不覆盖融合/蛋白表达类独立伴随诊断"],
            ], compact=True)]),
            section("9.3", "指南与注释资源说明", page_group="03", paragraphs=[
                "NCCN和CSCO指南需以签发时可获得的正式版本为准；本报告仅保留判读框架。"
            ], tables=[table("", ["资源", "用途"], [
                ["NCCN / CSCO", "治疗路径框架参考"],
                ["ClinGen / ClinVar", "遗传性肿瘤证据参考"],
            ], compact=True)]),
        ]),
        "provenance": {
            "coordinate_system": "GRCh38",
            "source_schema": "wes_package_v1_clinical_v2_demo",
            "source_generated_at": report_date,
            "source_sha256": "",
            "warnings": ["演示数据：不可用于临床决策"],
        },
        "igv_tracks": {
            "tumor_bam": "tumor.report.bam",
            "tumor_bai": "tumor.report.bam.bai",
            "normal_bam": "normal.report.bam",
            "normal_bai": "normal.report.bam.bai",
            "default_locus": "chr17:7,674,100-7,674,400",
        },
        "portal_variants": [
            {
                "gene": "TP53", "chrom": "17", "pos": 7674220, "ref": "C", "alt": "T",
                "hgvsc": "c.743G>A", "hgvsp": "p.R248Q", "consequence": "missense_variant",
                "tumor_af": 0.352, "tumor_dp": 120, "tumor_alt_reads": 42,
                "normal_dp": 90, "normal_alt_reads": 0, "tlod": 48.2, "significance": "pathogenic",
            },
            {
                "gene": "KRAS", "chrom": "12", "pos": 25245350, "ref": "C", "alt": "T",
                "hgvsc": "c.35G>A", "hgvsp": "p.G12D", "consequence": "missense_variant",
                "tumor_af": 0.286, "tumor_dp": 98, "tumor_alt_reads": 28,
                "normal_dp": 85, "normal_alt_reads": 0, "tlod": 36.1, "significance": "pathogenic",
            },
            {
                "gene": "PIK3CA", "chrom": "3", "pos": 179218294, "ref": "G", "alt": "A",
                "hgvsc": "c.1633G>A", "hgvsp": "p.E545K", "consequence": "missense_variant",
                "tumor_af": 0.181, "tumor_dp": 110, "tumor_alt_reads": 20,
                "normal_dp": 88, "normal_alt_reads": 1, "tlod": 22.4, "significance": "likely_pathogenic",
            },
        ],
        "portal_organ_risks": [
            {
                "key": "colon", "name": "结直肠", "score": 8.2,
                "genes": ["TP53", "KRAS", "PIK3CA"],
                "evidence": "胃腺癌背景 + Ⅲ类体细胞变异",
                "recommendation": "结合内镜/影像与肿瘤标志物随访，需专业审核。",
            },
            {
                "key": "pancreas", "name": "胰腺", "score": 7.1,
                "genes": ["KRAS"],
                "evidence": "KRAS 驱动相关信号",
                "recommendation": "不等同于胰腺病变诊断，需临床综合判断。",
            },
            {
                "key": "liver", "name": "肝脏", "score": 6.4,
                "genes": ["TP53"],
                "evidence": "TP53 体细胞变异",
                "recommendation": "建议结合腹部影像与肝功能检查。",
            },
            {
                "key": "trachea", "name": "气管", "score": 3.2,
                "genes": [],
                "evidence": "当前报告无直接相关变异",
                "recommendation": "低关注度，常规随访。",
            },
        ],
    }
    return report


def write_tiny_bams(out_dir: Path) -> None:
    """Create small tumor/normal BAMs around TP53 chr17:7674220 for IGV."""
    out_dir.mkdir(parents=True, exist_ok=True)
    # Minimal paired reads covering TP53 hotspot (hg38).
    sam_header = (
        "@HD\tVN:1.6\tSO:coordinate\n"
        "@SQ\tSN:chr17\tLN:83257441\n"
        "@RG\tID:demo\tSM:DEMO\tPL:ILLUMINA\n"
    )
    # 80bp reads spanning 7674180-7674300
    tumor_reads = []
    normal_reads = []
    start = 7674180
    seq = "N" * 80
    qual = "I" * 80
    for i, pos in enumerate(range(start, start + 120, 10)):
        # Tumor: half the reads carry alt-like soft flag via different seq mid-base
        tseq = list(seq)
        if i % 2 == 0:
            tseq[40] = "T"  # alt-ish
        else:
            tseq[40] = "C"  # ref-ish
        tumor_reads.append(
            f"TREAD{i}\t99\tchr17\t{pos}\t60\t80M\t=\t{pos}\t80\t{''.join(tseq)}\t{qual}\tRG:Z:demo"
        )
        nseq = list(seq)
        nseq[40] = "C"
        normal_reads.append(
            f"NREAD{i}\t99\tchr17\t{pos}\t60\t80M\t=\t{pos}\t80\t{''.join(nseq)}\t{qual}\tRG:Z:demo"
        )

    def sam_to_bam(reads: list[str], bam_path: Path) -> None:
        sam_path = bam_path.with_suffix(".sam")
        sam_path.write_text(sam_header + "\n".join(reads) + "\n", encoding="utf-8")
        subprocess.run(
            ["samtools", "view", "-b", "-o", str(bam_path), str(sam_path)],
            check=True,
        )
        subprocess.run(["samtools", "sort", "-o", str(bam_path), str(bam_path)], check=True)
        subprocess.run(["samtools", "index", str(bam_path)], check=True)
        sam_path.unlink(missing_ok=True)

    write_tumor = out_dir / "tumor.report.bam"
    write_normal = out_dir / "normal.report.bam"
    sam_to_bam(tumor_reads, write_tumor)
    sam_to_bam(normal_reads, write_normal)
    print("wrote", write_tumor, write_tumor.with_suffix(".bam.bai"))
    print("wrote", write_normal)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = build_report()
    # Validate core report fields (igv_tracks/portal_variants are extra=ignore on ReportData)
    core = {
        k: v for k, v in payload.items()
        if k not in {"igv_tracks", "portal_variants", "portal_organ_risks"}
    }
    ReportData.model_validate(core)
    json_path = OUT_DIR / "report.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Also publish as example current.json name used by docs
    (OUT_DIR / "current.json").write_text(json_path.read_text(encoding="utf-8"), encoding="utf-8")
    write_tiny_bams(OUT_DIR)
    print("validated clinical_v2 ->", json_path)


if __name__ == "__main__":
    main()
