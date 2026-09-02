# Gomics / Gaomei Web 数据层 V2 重构实施规格书

> 适用项目：高美基因 Gomics 客户门户  
> 技术栈：Django 4.2 + Django REST Framework + React(Vite)  
> 当前阶段：测试环境开发，生产环境尚未正式承载真实业务数据  
> 核心原则：**业务数据库允许推翻重建，不做旧业务脏数据兼容；保留指定官网/外链业务表；彻底移除 Bridge 双服务器体系。**

---

# 0. 本文用途

本文不是概念设计稿，而是给本地 AI 开发工具直接执行的 **数据库 V2 重构规格 + 实施计划 + 验收标准**。

本地 AI 在开始编码前必须：

1. 阅读现有 Django 项目结构；
2. 确认现有 app、models、urls、serializers、permissions、admin；
3. 识别本文要求“保留不动”的两类表；
4. 输出一次“拟删除 / 拟保留 / 拟新增”的清单；
5. 然后再开始修改代码。

**不要为了兼容现有演示数据而增加兼容字段、临时 M:N 表、Bridge 中间表或旧字段 fallback。**

当前生产尚未正式上线，业务数据可删除，因此本次以 **greenfield / clean reset** 方式重建业务域。

---

# 1. 最终目标

将现有患者和报告相关数据库彻底重构为：

```text
User
 │
 │ optional 1:1
 ▼
Patient
 │
 │ 1:N
 ▼
Report
 ├── ReportAsset
 ├── ReportVariant
 └── ReportAccessLog

外部分析流水线
 │
 │ HTTPS + API Key
 ▼
Ingest API
 │
 ├── upsert Patient
 ├── create/update Report
 ├── sync Assets
 ├── optional sync Variants
 └── IngestEvent
```

客户数据访问规则：

```text
request.user
   ↓
Patient.user
   ↓
Patient
   ↓
Report.patient
   ↓
status == released
   ↓
客户可见
```

任何客户不得通过猜测 Report ID、Asset ID、文件 URL 等方式访问其他患者数据。

---

# 2. 本次必须保留、不允许破坏的数据

用户明确说明有两类现有表，本次重构不应修改：

1. **链接其他公司的公司咨询相关表**
2. **生信 Wiki 相关表**

由于当前规格中没有给出准确 Django Model 名或 SQL table 名，本地 AI 必须首先在项目中识别它们。

可能通过以下方式寻找：

- Django `models.py`
- `INSTALLED_APPS`
- Admin 注册
- URL / serializer 引用
- SQLite schema
- migrations

识别完成后建立保护清单，例如：

```text
PRESERVE_TABLES = [
    "<actual_company_consult_table>",
    "<actual_bioinfo_wiki_table>",
]
```

## 强制规则

对保护表：

- 不删除 Model
- 不删除 migration
- 不清空数据
- 不重命名表
- 不修改字段
- 不改外键，除非现有代码因删除业务模型导致无法启动；这种情况先汇报再做最小修改
- 不把这两个表纳入业务 DB reset

此外，官网内容 app 如果与核心患者报告域无关，原则上也保留：

```text
company
blog
bioblog
```

但“公司咨询外链表”和“生信 Wiki 表”优先级最高，必须明确保护。

---

# 3. 本次必须删除的旧业务设计

目标是删除旧患者报告体系中的冗余关系，而不是继续兼容。

## 3.1 Bridge 整体移除

删除整个 Bridge 业务依赖：

```text
BridgeNode
BridgeProject
BridgeUpload
BridgeUploadRevision
BridgeJob
BridgeJobLog
```

删除：

- `bridge` app（如果不存在其他必须保留逻辑）
- Bridge API urls
- register
- heartbeat
- claim job
- node/project sync
- upload revision
- bridge package
- bridge import
- bridge PDF upload
- Bridge 管理前端
- Bridge deployment/service 依赖

最终不再存在：

```text
node registration
heartbeat
claim
job polling
BridgeProject
BridgeUpload
Bundle revision
```

替换为：

```text
POST /api/v1/ingest/reports/
X-API-Key: ...
```

---

## 3.2 删除患者报告旧中间模型

删除以下旧概念：

```text
ReportPatientLink
PatientReportSlot
SampleBundle
BundleFile
```

原因：

```text
Patient 1:N Report
```

只需要：

```python
Report.patient = ForeignKey(Patient)
```

不需要 M:N 或 Slot。

---

## 3.3 删除重复身份字段

删除：

```text
UserProfile.patient_no
Report.user
```

以后：

```text
Patient.patient_no
```

是唯一患者编号。

User 与 Patient 的关系通过：

```python
Patient.user = OneToOneField(User, ...)
```

建立。

---

# 4. 新核心 ER 模型

```text
Django User
   │
   │ 0..1 : 0..1
   ▼
Patient
   │
   │ 1 : N
   ▼
Report
   ├── 1:N ReportAsset
   ├── 1:N ReportVariant
   └── 1:N ReportAccessLog

IngestApiKey
   │
   └── 1:N IngestEvent
                  │
                  └── Report
```

---

# 5. Patient 模型

建议放置：

```text
reports/models/patient.py
```

或如果现有项目没有拆 models package，则暂时放 `reports/models.py`，但最终结构建议拆开。

## 字段

```python
class Patient(models.Model):
    patient_no = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patient_profile",
    )

    name = models.CharField(
        max_length=128,
        db_index=True,
    )

    sex = models.CharField(
        max_length=16,
        choices=SexChoices.choices,
        blank=True,
        default="",
    )

    birth_date = models.DateField(
        null=True,
        blank=True,
    )

    phone = models.CharField(
        max_length=32,
        blank=True,
        default="",
    )

    email = models.EmailField(
        blank=True,
        default="",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

## 关键决策

### 一个 User 是否只能对应一个 Patient？

**是。**

但是：

```text
Patient.user 可以为空
```

因为实际流程可能是：

```text
分析结果先进入系统
→ 创建 Patient
→ 创建 Report
→ 客户之后注册账号
→ Admin 再绑定 User
```

禁止要求“先注册用户才能上传报告”。

### Patient 删除策略

如果 Patient 已有关联 Report：

**不允许物理删除。**

推荐：

```text
is_active = False
```

Report.patient 应使用：

```python
on_delete=models.PROTECT
```

---

# 6. Report 模型

建议：

```text
reports/models/report.py
```

## 状态

```python
class ReportStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    REVIEW = "review", "Under Review"
    RELEASED = "released", "Released"
    VOID = "void", "Void"
```

## 字段

```python
class Report(models.Model):
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name="reports",
    )

    report_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
    )

    external_source = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    external_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
    )

    product_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    report_type = models.CharField(
        max_length=32,
        db_index=True,
    )

    title = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    sample_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
    )

    tumor_sample_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
    )

    normal_sample_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
    )

    report_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
    )

    genome_build = models.CharField(
        max_length=32,
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=16,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
        db_index=True,
    )

    summary = models.TextField(
        blank=True,
        default="",
    )

    conclusion = models.TextField(
        blank=True,
        default="",
    )

    patient_snapshot = models.JSONField(
        default=dict,
        blank=True,
    )

    analysis_data = models.JSONField(
        default=dict,
        blank=True,
    )

    annotation_sources = models.JSONField(
        default=dict,
        blank=True,
    )

    data_schema_version = models.CharField(
        max_length=32,
        default="2.0",
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_reports",
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    released_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

## 唯一约束

保留：

```text
report_number UNIQUE
```

并增加：

```python
models.UniqueConstraint(
    fields=["external_source", "external_id"],
    condition=~models.Q(external_id=""),
    name="uniq_report_external_source_external_id",
)
```

如果 SQLite / Django 条件唯一约束实现有兼容性问题，可退化为 application validation，但优先使用数据库约束。

---

# 7. report_type 与 product_code

不得再把产品线和分析方法混成同一个字段。

例如：

```text
product_code = MEIGANXIN
report_type  = mutation
```

`report_type` 当前建议允许：

```text
mutation
methylation
msi
cnv
combined
other
```

`product_code` 用于：

```text
MEIGANXIN
LUNG_PANEL
PAN_CANCER
...
```

第一版不需要创建 `Product` 表。

未来确有复杂产品管理需求再独立。

---

# 8. patient_snapshot 的作用

`Patient`：

```text
当前患者资料
```

`Report.patient_snapshot`：

```text
报告发布当时的患者信息
```

发布时自动生成：

```json
{
  "patient_no": "GM000001",
  "name": "张三",
  "sex": "male",
  "birth_date": "1980-01-01"
}
```

这样 Patient 后续资料发生修改，也不会影响历史正式报告。

注意：

这不是旧系统 `patient_info` 那种无控制双写。

它是**正式发布时刻意生成的历史快照**。

---

# 9. analysis_data 策略

第一阶段：

**继续保留 JSONField。**

不要这次顺便把所有 mutation / CNV / MSI / methylation 全部分成几十张关系表。

目标：

```text
Report.analysis_data
```

仍然是报告完整分析结果的 canonical payload。

例如：

```json
{
  "qc": {},
  "variants": [],
  "cnv": [],
  "msi": {},
  "methylation": {},
  "clinical": {},
  "plots": {},
  "igv": {}
}
```

必须增加：

```text
data_schema_version
```

例如：

```text
2.0
```

以后 JSON 结构升级：

```text
2.1
3.0
```

避免前端通过“有没有某个 key”猜数据版本。

---

# 10. ReportVariant 模型

V2 建议保留，但允许第一阶段部分报告不写入。

其作用是：

```text
DB Browser
Gene 查询
Variant 查询
统计
筛选
```

不是替代 analysis_data。

关系：

```text
analysis_data = 完整分析结果
ReportVariant = 可检索索引
```

推荐模型：

```python
class ReportVariant(models.Model):
    report = models.ForeignKey(
        Report,
        on_delete=models.CASCADE,
        related_name="variants",
    )

    chromosome = models.CharField(max_length=32, db_index=True)

    position = models.BigIntegerField(db_index=True)

    ref = models.CharField(max_length=512, blank=True, default="")
    alt = models.CharField(max_length=512, blank=True, default="")

    gene = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    variant_type = models.CharField(
        max_length=32,
        blank=True,
        default="",
        db_index=True,
    )

    consequence = models.CharField(
        max_length=128,
        blank=True,
        default="",
    )

    allele_frequency = models.FloatField(
        null=True,
        blank=True,
    )

    data = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
```

建议复合索引：

```text
(report_id)
(gene)
(chromosome, position)
```

不要第一阶段继续创建：

```text
MutationTable
CNVTable
MSITable
FusionTable
MethylationTable
```

除非以后真实查询需求证明有必要。

---

# 11. ReportAsset

所有报告文件统一通过：

```text
ReportAsset
```

管理。

替代：

```text
report_pdf_file
report_pdf_url
SampleBundle
BundleFile
部分 GenomicTrack
```

推荐模型：

```python
class ReportAsset(models.Model):
    report = models.ForeignKey(
        Report,
        on_delete=models.CASCADE,
        related_name="assets",
    )

    asset_type = models.CharField(
        max_length=32,
        db_index=True,
    )

    name = models.CharField(
        max_length=255,
    )

    storage_backend = models.CharField(
        max_length=32,
        default="local",
    )

    file_path = models.CharField(
        max_length=1024,
        blank=True,
        default="",
    )

    external_url = models.URLField(
        max_length=2048,
        blank=True,
        default="",
    )

    sha256 = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    file_size = models.BigIntegerField(
        null=True,
        blank=True,
    )

    mime_type = models.CharField(
        max_length=128,
        blank=True,
        default="",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
```

`asset_type` 第一版允许：

```text
pdf
bam
bai
vcf
bed
image
json
other
```

---

# 12. 文件存储策略

当前允许继续使用：

```text
local media/shared directory
```

但数据库只保存：

```text
relative path / storage key / metadata
```

不要把 BAM/PDF 二进制放进 SQLite。

未来迁移 COS/S3 时，只修改 storage backend 层。

建议：

```text
storage_backend = local
storage_backend = cos
storage_backend = s3
storage_backend = external
```

---

# 13. 文件安全

**绝对禁止直接将受保护患者文件通过公开 `/media/...` URL 暴露。**

错误示例：

```text
https://gomics.icu/media/reports/123/report.pdf
```

因为知道路径的人可能绕过权限。

必须通过受保护 API：

```text
GET /api/v1/reports/{report_id}/assets/{asset_id}/download/
```

执行：

```text
JWT
→ request.user
→ Report ACL
→ Asset belongs to Report
→ access allowed
→ return file
```

大文件生产环境建议：

```text
Django 做认证
→ X-Accel-Redirect
→ Nginx 实际发送文件
```

IGV Range Request 也必须经过同样 ACL。

---

# 14. ReportAccessLog

保留审计。

```python
class ReportAccessLog(models.Model):
    report = models.ForeignKey(
        Report,
        on_delete=models.PROTECT,
        related_name="access_logs",
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    action = models.CharField(
        max_length=32,
        db_index=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    user_agent = models.TextField(
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
```

action：

```text
view
download_pdf
download_asset
igv_access
```

Admin：

```text
只读
```

不允许人工修改审计日志。

---

# 15. 用户角色

继续使用现有：

```text
accounts.UserProfile.role
```

角色：

```text
customer
analyst
reviewer
admin
```

如果当前系统已依赖这些角色，不需要此次迁移改用 Django Group。

---

# 16. 权限矩阵

| 资源 / 动作 | customer | analyst | reviewer | admin |
|---|---:|---:|---:|---:|
| 自己 Patient | Read | All | Read/All | All |
| 其他 Patient | No | Read/Write | Read | All |
| draft Report | No | Read/Write | Read/Write | All |
| review Report | No | Read/Write | Read/Write | All |
| released 自己报告 | Read | Read/Write | Read/Write | All |
| released 他人报告 | No | Read/Write | Read/Write | All |
| ReportAsset | 自己 released | All | All | All |
| 发布 Report | No | 默认 No | Yes | Yes |
| Void Report | No | No/可选 | Yes | Yes |
| API Key | No | No | No | Admin |
| IngestEvent | No | 可选 Read | Read | All |
| AccessLog | No | 可选 Read | Read | All |

---

# 17. ACL 必须在 queryset 层实现

禁止只靠：

```text
React 隐藏按钮
Serializer 权限
前端不显示
```

必须在 DRF queryset 层过滤。

建议创建统一 service：

```python
def visible_reports_for_user(user):
    qs = Report.objects.select_related("patient")

    if user.is_superuser:
        return qs

    role = getattr(user.profile, "role", None)

    if role in {"admin", "analyst", "reviewer"}:
        return qs

    return qs.filter(
        patient__user=user,
        status=ReportStatus.RELEASED,
    )
```

所有报告 API 应复用，不得各写一套。

客户请求无权限 Report：

```text
404
```

而不是：

```text
403
```

以避免泄露其他报告是否存在。

---

# 18. 当前患者 API

增加：

```text
GET /api/v1/me/patient/
```

customer：

返回自己的 Patient。

没有绑定 Patient：

返回合理空状态：

```json
{
  "patient": null
}
```

或者：

```text
404 patient_profile_not_linked
```

项目内统一即可。

---

# 19. 客户历史报告 API

增加：

```text
GET /api/v1/me/reports/
```

只返回：

```text
patient.user == request.user
AND
status == released
```

排序：

```text
-report_date
-released_at
-created_at
```

用途：

```text
/patient-reports
```

这是未来客户首页历史检测报告列表的唯一主要来源。

---

# 20. 报告详情 API

```text
GET /api/v1/reports/{id}/
```

customer：

仅能获取：

```text
自己的 Patient
+
released
```

internal：

按角色读取全量。

推荐 detail serializer 返回：

```text
Report metadata
patient snapshot
analysis_data
annotation_sources
assets metadata
optional variants summary
```

不要在一个 detail API 中直接返回 BAM 文件。

---

# 21. API Key

新建独立 app：

```text
ingest
```

推荐模型：

```python
class IngestApiKey(models.Model):
    name = models.CharField(max_length=128, unique=True)

    key_prefix = models.CharField(
        max_length=32,
        db_index=True,
    )

    key_hash = models.CharField(
        max_length=128,
        unique=True,
    )

    scope = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    expires_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    created_at = models.DateTimeField(auto_now_add=True)
```

完整 API Key 只在创建时显示一次。

数据库不得保存明文 Key。

例如：

```text
gmk_live_XYZ...
```

数据库保存：

```text
key_prefix
secure hash
```

可使用 Django password hasher：

```python
make_password(raw_key)
check_password(raw_key, key_hash)
```

优先于简单裸 SHA256。

---

# 22. API Key 划分

不要整个平台只有一个 Key。

建议：

```text
mutation-production
methylation-production
test-pipeline
manual-import
```

每个来源一个 Key。

泄露时可以独立 revoke。

---

# 23. Ingest API

新增：

```text
POST /api/v1/ingest/reports/
```

认证：

```text
X-API-Key: <key>
```

不使用：

```text
Authorization: Bearer
```

因为该 header 保留给 JWT customer/internal user。

---

# 24. Ingest 请求 Schema

第一版：

```json
{
  "schema_version": "2.0",

  "external_source": "mutation-production",
  "external_id": "PIPELINE-JOB-000001",

  "patient": {
    "patient_no": "GM000123",
    "name": "张三",
    "sex": "male",
    "birth_date": "1980-01-01",
    "phone": "",
    "email": ""
  },

  "report": {
    "report_number": "R202609020001",
    "title": "肿瘤基因检测报告",
    "product_code": "MEIGANXIN",
    "report_type": "mutation",
    "report_date": "2026-09-02",
    "sample_id": "S202609020001",
    "tumor_sample_id": "T001",
    "normal_sample_id": "N001",
    "genome_build": "hg38",
    "summary": "",
    "conclusion": ""
  },

  "analysis_data": {
    "qc": {},
    "variants": [],
    "cnv": [],
    "msi": {},
    "methylation": {},
    "clinical": {}
  },

  "annotation_sources": {
    "clinvar": "",
    "cosmic": ""
  },

  "assets": [
    {
      "type": "bam",
      "name": "tumor.bam",
      "external_url": "",
      "file_path": "",
      "sha256": "",
      "file_size": null,
      "mime_type": "application/octet-stream",
      "metadata": {
        "genome": "hg38"
      }
    }
  ]
}
```

---

# 25. Ingest 默认行为

事务执行：

```text
validate API key
↓
validate schema_version
↓
validate payload
↓
transaction.atomic
↓
upsert Patient by patient_no
↓
resolve Report identity
↓
create/update Report
↓
sync ReportAsset metadata
↓
optional sync ReportVariant
↓
write IngestEvent
↓
commit
```

---

# 26. Patient upsert

唯一匹配依据：

```text
patient_no
```

禁止根据：

```text
姓名
手机号
生日
```

自动猜测同一个人。

逻辑：

```text
patient_no 不存在
→ create

patient_no 存在
→ update allowed demographic fields
```

如果出现明显身份冲突：

```text
同 patient_no
但关键身份信息严重冲突
```

推荐：

```text
409 patient_identity_conflict
```

不要自动创建第二个患者，也不要偷偷覆盖。

---

# 27. 报告幂等

必须实现。

目标：

同一个 pipeline request 重复发送，不创建重复报告。

第一次：

```text
201 created
```

完全相同 retry：

```text
200 unchanged
```

内容有更新且 Report 未 released：

```text
200 updated
```

released 后内容不同：

```text
409 released_report_immutable
```

---

# 28. Report identity

两层 identity：

业务唯一：

```text
report_number
```

pipeline 唯一：

```text
external_source + external_id
```

如果两者指向不同 Report：

```text
409 report_identity_conflict
```

禁止猜测合并。

---

# 29. Released Report 不允许 pipeline 修改

这是强制规则。

状态：

```text
draft
review
released
void
```

pipeline 可以：

```text
create draft
update draft
```

是否允许 update review：

建议第一版：

```text
允许，但记录 IngestEvent
```

或者更严格：

```text
review 后禁止 pipeline 修改
```

如果没有明确需求，默认：

```text
released 才硬锁
```

released 报告：

完全相同 payload：

```text
200 unchanged
```

内容发生变化：

```text
409 released_report_immutable
```

---

# 30. IngestEvent

用于排查导入。

```python
class IngestEvent(models.Model):
    api_key = models.ForeignKey(
        IngestApiKey,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
    )

    report = models.ForeignKey(
        Report,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ingest_events",
    )

    external_source = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    external_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
    )

    request_hash = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
    )

    status = models.CharField(
        max_length=32,
        db_index=True,
    )

    error_detail = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
```

status：

```text
created
updated
unchanged
rejected
failed
```

---

# 31. Ingest Service

禁止把所有逻辑写在 DRF View。

推荐：

```text
ingest/services/report_ingest.py
```

例如：

```python
class ReportIngestService:
    def ingest(self, payload, api_key):
        ...
```

内部：

```text
upsert_patient()
resolve_report()
upsert_report()
sync_assets()
sync_variants()
write_ingest_event()
```

必须使用：

```python
transaction.atomic()
```

未来以下入口都可复用：

```text
HTTP API
management command
old JSON import
manual internal import
```

---

# 32. Ingest 错误码

统一结构：

```json
{
  "code": "invalid_schema",
  "detail": "..."
}
```

建议：

```text
400 invalid_schema
400 invalid_patient
400 invalid_report

401 invalid_api_key
401 expired_api_key

403 api_key_scope_denied

409 patient_identity_conflict
409 report_number_conflict
409 external_id_conflict
409 report_identity_conflict
409 released_report_immutable

413 payload_too_large

422 unsupported_schema_version

500 ingest_failed
```

---

# 33. 报告审核和发布

推荐工作流：

```text
Pipeline
   ↓
DRAFT
   ↓
Analyst
   ↓
REVIEW
   ↓
Reviewer/Admin
   ↓
RELEASED
   ↓
Customer
```

customer 永远看不到：

```text
draft
review
void
```

发布动作必须：

```text
reviewer
or
admin
```

执行。

发布时：

```text
patient_snapshot = current patient snapshot
reviewed_by = current user
reviewed_at = now
released_at = now
status = released
```

建议实现 service：

```text
ReportReleaseService
```

不要在多个 view/admin action 中重复写发布逻辑。

---

# 34. Django Admin

必须重点优化。

## PatientAdmin

list_display：

```text
patient_no
name
user
sex
is_active
updated_at
```

search_fields：

```text
patient_no
name
phone
email
user__username
```

filter：

```text
is_active
sex
```

Reports 可以 Inline 或链接查看。

---

## ReportAdmin

list_display：

```text
report_number
patient
product_code
report_type
sample_id
status
report_date
released_at
updated_at
```

search：

```text
report_number
patient__patient_no
patient__name
sample_id
external_id
```

filter：

```text
status
report_type
product_code
genome_build
```

Admin actions：

```text
Send to review
Release selected reports
Void selected reports
```

released 后核心结果字段建议 readonly。

---

## ReportAssetAdmin

可单独管理，同时在 Report 页面 Inline。

---

## ReportVariantAdmin

适合搜索：

```text
gene
chromosome
position
report
```

不要一次 Admin 列表加载完整 JSON。

---

## AccessLogAdmin

只读：

```text
has_add_permission = False
has_change_permission = False
has_delete_permission = False
```

---

## IngestApiKeyAdmin

支持：

```text
create
disable
expire
```

不要显示 key_hash。

完整 raw key 只在创建时显示一次。

---

## IngestEventAdmin

只读。

支持：

```text
external_id
report_number
status
api_key
created_at
```

筛选。

---

# 35. 前端/API 对照

现有 React 路由尽可能保持：

```text
/patient-reports
/reports/:id
/browser
/db-browser
/admin
```

后端 V2：

| Frontend | Backend |
|---|---|
| `/patient-reports` | `GET /api/v1/me/reports/` |
| `/reports/:id` | `GET /api/v1/reports/:id/` |
| 当前患者 | `GET /api/v1/me/patient/` |
| 报告附件 | `GET /api/v1/reports/:id/assets/` |
| 下载 PDF | `GET /api/v1/reports/:id/assets/:asset_id/download/` |
| IGV asset | protected asset content endpoint |
| `/db-browser` | internal-only variant/report search |
| Pipeline | `POST /api/v1/ingest/reports/` |

---

# 36. DB Browser

不要第一阶段优先重构 DB Browser。

顺序：

```text
Schema
→ Ingest
→ ACL
→ Patient reports
→ Report detail
→ Asset/IGV
→ DB Browser
```

DB Browser 后续主要基于：

```text
ReportVariant
Report
Patient
```

查询。

customer 不应访问全局 DB Browser，除非它只是当前患者报告内的特定浏览功能。

内部 `/db-browser` 必须 internal role ACL。

---

# 37. GenomicTrack 迁移策略

检查当前：

```text
accounts.GenomicTrack
```

如果是：

```text
某个报告/样本的 BAM
BAI
VCF
BED
```

逐渐迁入：

```text
ReportAsset
```

如果是公共参考 track，例如：

```text
hg38 reference
cytoband
public annotation
```

可以保留独立 Track 模型。

不要盲目删除。

---

# 38. SQLite / PostgreSQL

当前阶段继续：

```text
SQLite
```

允许。

不要因为本次 schema reset 强制同时迁 PostgreSQL。

但新代码必须：

```text
ORM first
避免 SQLite-only SQL
避免难迁移 trigger
避免二进制大文件进 DB
```

未来出现：

```text
高并发写入
大量 variant
复杂统计
多人同时编辑
```

再迁 PostgreSQL。

---

# 39. 数据库重建策略

用户明确：

```text
当前所有业务数据可删除
生产尚未正式上线
测试环境开发中
```

因此本次优先：

**新建 clean DB，而不是在旧 DB 上做复杂 migration。**

## 测试环境

先备份：

```bash
cp /path/to/db.test.sqlite3 /path/to/db.test.pre_v2.sqlite3
```

然后创建新的：

```text
db.test.sqlite3
```

迁移：

```bash
python manage.py migrate
python manage.py createsuperuser
```

注意：

必须保护前面所述的：

```text
公司咨询外链表
生信 Wiki 表
```

如果这两个表与其他业务表存在于同一个 SQLite 文件，并且其中已有需要保留的数据，则不能简单 `rm db.sqlite3`。

这时本地 AI 必须采用以下其中一种方式：

### 推荐方案 A

先：

```text
dump / export 两个保护表
```

然后：

```text
创建全新 DB
migrate
restore 两个保护表
```

前提是 table schema 不变。

### 推荐方案 B

如果保护表数据实际也可以从源系统重新同步，则明确确认后再 clean reset。

### 禁止

直接删除 DB 导致这两个保护表数据丢失。

---

# 40. Migration 策略

业务 app 当前数据不需要兼容，因此：

```text
reports
ingest
bridge
accounts patient duplicate fields
```

可以按 clean V2 migration 处理。

如果项目尚未正式上线且 migration 不被其他部署依赖：

允许重新整理：

```text
reports/migrations/0001_initial.py
ingest/migrations/0001_initial.py
```

但不要随意删除 Django 标准 app migration：

```text
auth
admin
contenttypes
sessions
```

官网/保护 app migration 原则上不动。

---

# 41. 推荐代码结构

```text
backend/
├── accounts/
│   ├── models.py
│   └── permissions.py
│
├── reports/
│   ├── models/
│   │   ├── patient.py
│   │   ├── report.py
│   │   ├── asset.py
│   │   ├── variant.py
│   │   └── audit.py
│   │
│   ├── api/
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── permissions.py
│   │   └── urls.py
│   │
│   ├── services/
│   │   ├── visibility.py
│   │   └── release.py
│   │
│   └── admin.py
│
├── ingest/
│   ├── models.py
│   ├── authentication.py
│   ├── serializers.py
│   ├── services/
│   │   └── report_ingest.py
│   ├── views.py
│   ├── urls.py
│   └── admin.py
│
├── company/
├── blog/
├── bioblog/
└── ...
```

如果现有 layout 不适合一次拆这么细，可以保留现状，但逻辑边界必须一致。

---

# 42. 删除 Bridge 后检查

必须全局搜索：

```text
BridgeNode
BridgeProject
BridgeUpload
BridgeUploadRevision
BridgeJob
BridgeJobLog
PatientReportSlot
SampleBundle
BundleFile
ReportPatientLink
patient_no
Report.user
bridge/
```

删除所有：

```text
imports
serializer references
admin registrations
urls
frontend requests
deployment services
tests
management commands
settings config
```

确保 Django：

```bash
python manage.py check
```

通过。

---

# 43. Seed 数据

创建 management command：

```text
python manage.py seed_gomics_demo
```

只允许测试环境。

至少：

## User

```text
customer_a
customer_b
analyst_demo
reviewer_demo
admin
```

## Patient

```text
GM-DEMO-001 → customer_a
GM-DEMO-002 → customer_b
```

## Report

A：

```text
R-DEMO-A-RELEASED
released
```

A：

```text
R-DEMO-A-DRAFT
draft
```

B：

```text
R-DEMO-B-RELEASED
released
```

## Assets

给 A released：

```text
demo.pdf
demo.bam metadata optional
```

## API Key

创建：

```text
test-pipeline
```

注意测试 key 不得进入生产。

---

# 44. 必须完成的 ACL 自动化测试

必须覆盖：

```text
anonymous
GET report
→ 401
```

```text
customer A
GET A released
→ 200
```

```text
customer A
GET A draft
→ 404
```

```text
customer A
GET B released
→ 404
```

```text
customer A
GET B asset
→ 404
```

```text
customer B
GET A released
→ 404
```

```text
analyst
GET all report
→ 200
```

```text
reviewer
release review report
→ success
```

```text
customer
attempt release
→ forbidden
```

---

# 45. Ingest 自动化测试

必须：

```text
invalid key
→ 401
```

```text
expired key
→ 401
```

```text
new patient + report
→ 201
```

```text
existing patient + new report
→ 201
```

```text
same payload retry
→ 200 unchanged
```

```text
same draft report with changed payload
→ 200 updated
```

```text
released report same payload
→ 200 unchanged
```

```text
released report changed payload
→ 409
```

```text
same external_id points to different report_number
→ 409
```

```text
same patient_no with identity conflict
→ 409
```

---

# 46. Asset 安全测试

必须：

```text
public /media URL
不能直接访问 protected report file
```

```text
customer A
download own released PDF
→ 200
```

```text
customer A
download B PDF
→ 404
```

```text
customer A
access own draft asset
→ 404
```

```text
internal
access asset
→ according role
```

IGV：

验证 HTTP Range：

```text
206 Partial Content
```

且 ACL 在 Range 前执行。

---

# 47. Admin 验收

Django Admin 必须能：

```text
创建 Patient
编辑 Patient
绑定 User
查看历史 Reports
创建 Report
修改 draft Report
send to review
release
查看 Asset
查看 Variant
创建/禁用 API Key
查看 IngestEvent
查看 AccessLog
```

superuser 必须可以完成所有操作。

---

# 48. 前端第一阶段修改

## `/patient-reports`

改为：

```text
GET /api/v1/me/reports/
```

展示：

```text
report_number
title
product_code
report_type
report_date
released_at
```

按时间倒序。

---

## `/reports/:id`

改用：

```text
GET /api/v1/reports/:id/
```

尽可能继续兼容：

```text
analysis_data
```

避免第一阶段完全重写报告 UI。

---

## `/browser`

所有 BAM/BAI/VCF URL：

必须改为受保护 Asset Endpoint。

不能继续依赖公开 media path。

---

## `/db-browser`

最后重构。

只允许：

```text
analyst
reviewer
admin
```

客户无权全局查询。

---

# 49. 公司咨询表 / 生信 Wiki 表验收

在 DB 重建完成后必须确认：

```text
记录数量未减少
schema 未变化
对应页面/API 正常
```

如果它们是外部数据链接表而非核心数据，也必须确保：

```text
foreign key
URL
sync information
```

没有因删除业务 app 破坏。

---

# 50. ContactMessage

当前默认：

```text
不关联 Patient
```

不要因为有客户留言就自动建立 Patient。

CRM/官网留言和医疗检测 Patient 是两个不同领域。

未来业务明确需要再设计关系。

---

# 51. 不做事项

本次明确不要做：

```text
Bridge compatibility layer
Report.user fallback
ReportPatientLink fallback
UserProfile.patient_no fallback
M:N Patient Report
SampleBundle version system
复杂 Product 表
几十种分析结果关系表
BAM 二进制入数据库
公开 media patient files
自动通过姓名合并患者
pipeline 自动 released
```

---

# 52. 开发阶段顺序

## Phase 0 — Repository Audit

先输出：

```text
current apps
current models
current routes
current report-related frontend APIs
tables to preserve
tables to delete
```

停止条件：

明确识别：

```text
公司咨询外链表
生信 Wiki 表
```

---

## Phase 1 — Core Schema

完成：

```text
Patient
Report
ReportAsset
ReportVariant
ReportAccessLog
```

完成 Admin。

验收：

```bash
python manage.py check
python manage.py makemigrations --check
```

新 DB migrate 正常。

---

## Phase 2 — Ingest

完成：

```text
IngestApiKey
IngestEvent
API Key Authentication
POST /api/v1/ingest/reports/
ReportIngestService
```

完成 ingest test。

---

## Phase 3 — ACL

完成：

```text
visibility service
me/patient
me/reports
reports detail
asset ACL
```

完成越权测试。

**未完成 ACL 禁止进入生产。**

---

## Phase 4 — Report Workflow

完成：

```text
draft
review
released
void
release service
admin action
reviewer API
patient_snapshot
```

---

## Phase 5 — Bridge Removal

彻底删除：

```text
Bridge Models
Bridge URLs
Bridge serializers
Bridge frontend
Bridge deployment dependencies
```

执行：

```bash
grep -R "Bridge" .
grep -R "bridge/" .
```

人工确认无遗留。

---

## Phase 6 — Frontend Patient Reports

改：

```text
/patient-reports
/reports/:id
```

客户只能看到历史 released report。

---

## Phase 7 — Asset / IGV

实现：

```text
protected PDF
protected BAM
Range
BAI
VCF
```

---

## Phase 8 — DB Browser

基于：

```text
ReportVariant
```

重构 internal-only browser。

---

# 53. 每阶段 Git 提交建议

不要一次 giant commit。

建议：

```text
feat(data-v2): add patient and report schema

feat(data-v2): add report assets and audit

feat(ingest): add api key authentication

feat(ingest): implement report ingest service

feat(auth): enforce patient report ACL

feat(reports): add release workflow

refactor(bridge): remove legacy bridge subsystem

refactor(frontend): migrate patient report APIs

feat(assets): protect report file access

refactor(db-browser): use report variant model
```

---

# 54. 数据库 reset 操作安全要求

任何 delete/reset 前：

必须：

```text
打印当前 DB path
确认是测试 DB
备份 SQLite
确认保护表
```

本地 AI 不应只凭变量名猜环境。

需要从 Django settings 获取实际数据库：

```python
settings.DATABASES["default"]["NAME"]
```

如果路径指向：

```text
production db.sqlite3
```

停止自动 destructive action。

当前开发阶段应操作：

```text
db.test.sqlite3
```

或明确的 dev/test DB。

---

# 55. 生产切换策略

虽然生产当前无正式业务数据，也不要直接覆盖。

上线时：

```text
1. maintenance
2. backup current DB
3. verify preserved tables
4. create V2 DB / migrate
5. restore preserved tables if required
6. create superuser
7. create production API Keys
8. smoke test
9. start web
10. start pipeline ingest
```

保留：

```text
db.pre_v2.sqlite3
```

至少到 V2 稳定。

---

# 56. 推荐 smoke test

上线前：

```text
1. Admin login
2. Create Patient
3. Bind customer
4. Create draft report
5. Customer cannot view
6. reviewer release
7. customer can view
8. PDF works
9. another customer cannot view
10. API key creates report
11. retry does not duplicate
12. Bridge URLs return 404 / no longer exist
13. protected company consult table still works
14. protected bioinfo wiki table still works
```

---

# 57. 最终核心数据库目标

最终业务域应该尽量控制在：

```text
Patient
Report
ReportAsset
ReportVariant
ReportAccessLog

IngestApiKey
IngestEvent
```

账号：

```text
User
UserProfile
```

官网/保护数据：

```text
company / blog / bioblog
公司咨询外链表
生信 Wiki 表
```

旧：

```text
ReportPatientLink
PatientReportSlot
SampleBundle
BundleFile
Bridge*
Report.user
UserProfile.patient_no
```

应彻底退出。

---

# 58. 最终架构图

```text
                        ┌─────────────┐
                        │ Django User │
                        └──────┬──────┘
                               │
                           optional 1:1
                               │
                               ▼
                        ┌─────────────┐
                        │   Patient   │
                        └──────┬──────┘
                               │
                              1:N
                               │
                               ▼
                        ┌─────────────┐
                        │   Report    │
                        └──────┬──────┘
                   ┌───────────┼───────────┐
                   │           │           │
                   ▼           ▼           ▼
             ReportAsset  ReportVariant  AccessLog
             PDF/BAM/VCF     query        audit


External Pipeline
       │
       │ X-API-Key
       ▼
 /api/v1/ingest/reports/
       │
       ▼
 ReportIngestService
       │
       ├── Patient upsert
       ├── Report upsert
       ├── Asset sync
       ├── Variant sync
       └── IngestEvent


customer login
       │
       ▼
JWT request.user
       │
       ▼
Patient.user
       │
       ▼
Report.patient
       │
       ▼
status=released
       │
       ▼
history reports
```

---

# 59. 本地 AI 执行时必须遵循的工作方式

开始修改前：

1. Audit repository；
2. 给出当前 Model → V2 Model 映射；
3. 给出保护表真实名称；
4. 给出将删除的文件；
5. 给出将新增/修改的文件；
6. 确认当前运行的是测试数据库；
7. 再开始代码修改。

实施过程中：

- 一阶段一阶段改；
- 每阶段执行测试；
- 不跳过 ACL；
- 不留旧 fallback；
- 不自动破坏保护表；
- 不对生产 DB 直接执行 destructive command；
- 如果旧代码和本文冲突，以本文 V2 业务规则为准。

---

# 60. Definition of Done

只有同时满足以下条件，本次 V2 数据层重构才算完成：

- [ ] Patient 1:N Report 成为唯一报告归属关系
- [ ] User 最多绑定一个 Patient
- [ ] Patient 可以暂时无 User
- [ ] customer 只可见自己 released reports
- [ ] 猜测其他 Report ID 返回 404
- [ ] ReportAsset 也执行同一 ACL
- [ ] PDF/BAM 不公开裸 media URL
- [ ] API Key 可以上传 JSON
- [ ] Patient 按 patient_no upsert
- [ ] Report ingest 幂等
- [ ] released report 不可被 pipeline 覆盖
- [ ] API Key 不明文存储
- [ ] IngestEvent 可审计
- [ ] AccessLog 可审计
- [ ] Bridge app / route / model 已移除
- [ ] ReportPatientLink 已移除
- [ ] PatientReportSlot 已移除
- [ ] SampleBundle / BundleFile 已移除
- [ ] Report.user 已移除
- [ ] UserProfile.patient_no 已移除
- [ ] Django Admin 可以维护 Patient / Report / API Key
- [ ] `/patient-reports` 使用新 API
- [ ] `/reports/:id` 使用新 ACL
- [ ] 公司咨询保护表完整
- [ ] 生信 Wiki 保护表完整
- [ ] 全部核心自动测试通过
- [ ] Django `check` 通过
- [ ] migration 可在全新 SQLite 中从 0 执行
- [ ] 测试 DB 已使用 V2 schema
- [ ] 生产切换前已有备份和 smoke test 清单

---

# 61. 给本地 AI 的最后指令

请不要只输出建议。

请基于当前仓库实际代码逐阶段实施这份 V2 设计。

第一步先执行 **Repository Audit**，不要立刻删除数据库。

Audit 必须告诉我：

1. 当前所有 Django app；
2. 当前所有 reports / bridge / accounts 相关 Model；
3. 公司咨询外链表的真实 Model/table；
4. 生信 Wiki 表的真实 Model/table；
5. 哪些表将保留；
6. 哪些表将删除；
7. 哪些字段将删除；
8. 当前测试 DB 的实际路径；
9. 当前生产 DB 的实际路径；
10. 预计修改的后端文件；
11. 预计修改的前端文件；
12. 是否存在会阻碍 clean reset 的 FK / migration 依赖。

完成 Audit 后，再按：

```text
Core Schema
→ Ingest
→ ACL
→ Workflow
→ Remove Bridge
→ Frontend
→ Asset/IGV
→ DB Browser
```

的顺序执行。

任何涉及生产数据库删除、覆盖、重建的命令，不要自动执行；只生成明确步骤，由人工确认。

