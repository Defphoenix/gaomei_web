# Gomics Web — 项目总结与上传交接（给 node / 上传端 AI）

> 受众：另一台服务器上的 AI / 工程师，负责 **WES 报告包上传与流水线对接**。  
> 云端生产站：`https://gomics.icu`  
> 文档日期：2026-09-03  
> 相关代码仓：`gaomei_web`（本仓库）

---

## 1. 一句话现状

云端门户已切到 **Data V2**：`Patient 1↔N Report` + `ReportAsset` / `ReportVariant` / `IngestEvent`。  
**上传只走 Ingest API Key**（`X-API-Key`）。旧 Bridge Token / SampleBundle / `/api/bridge/` **已删除，不要再写**。

云端负责：落盘 JSON/BAM、写库、渲染 HTML/PDF、门户 ACL。  
上传端负责：组 `clinical_v2` 包、带 API Key 调 package 接口、保证 `upload_id` 幂等。

---

## 2. 你（上传端）要对接的唯一主路径

```http
POST https://gomics.icu/api/v1/ingest/reports/package/
Header: X-API-Key: gm_<...>
Content-Type: multipart/form-data
```

### 2.1 鉴权

| 项 | 说明 |
|----|------|
| Header | `X-API-Key: gm_...` |
| 创建位置 | 云端门户「数据台 → 导入 API Key」或 Django Admin |
| Scope | 推荐 `wes_package` |
| 明文 | **创建时只返回一次**，请安全存到 node 环境变量 `GAOMEI_INGEST_API_KEY` |
| 已废弃 | `X-Gaomei-Bridge-Token` / `GAOMEI_BRIDGE_TOKEN*` |

### 2.2 表单字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `upload_id` | 是 | 幂等键（建议内容哈希或流水号）；相同内容重复提交 → idempotent |
| `patient_no` | 是 | 受检者编号，如 `GM-P-010`；不存在则自动创建 Patient |
| `sample_id` | 是 | 样本 / WES 盘符，如 `GM10` |
| `patient_name` | 否 | 写入/更新 `Patient.name` |
| `report_number` | 否 | 缺省自动分配 `GM-R-NNN`；同 sample 可复用 |
| `node_id` | 否 | 来源节点标记（审计用） |
| `manifest` | 是 | JSON **字符串**，列出每个文件名与 role |
| `force` | 否 | `true` 时允许覆盖已 `released`（默认 409 拒绝） |
| `files` | 是 | 至少含 `report.json`；可附 BAM/BAI 等 |

### 2.3 包目录约定

```text
<package_dir>/
  report.json          # 必填，clinical_v2 schema
  *.bam / *.bai        # 推荐，进入 ReportAsset，支持 Range 下载
  其它附件              # 可选
  # 不要上传 PDF —— 云端生成
  # 忽略 current.json
```

`manifest` 示例：

```json
{
  "patient_no": "GM-P-010",
  "patient_name": "测试患者",
  "sample_id": "GM10",
  "files": [
    {"name": "report.json", "role": "report_json"},
    {"name": "tumor.bam", "role": "attachment"},
    {"name": "tumor.bam.bai", "role": "attachment"}
  ]
}
```

### 2.4 云端收到后做什么（按序）

1. 校验 API Key + clinical_v2 schema  
2. 落盘 `MEDIA/wes_bundles/<sample_id>/<upload_id>/`  
3. 写 `MEDIA/wes_reports/<sample_id>/current.json`（旧版进 `history/`）  
4. Upsert `Patient` + `Report`（默认 `status=review`）  
5. 写 `ReportAsset`（json/bam/bai…）  
6. 同步门户 `analysis_data` + `ReportVariant`；生成 HTML/PDF  
7. 写 `IngestEvent` 审计  

**不会**自动把 Patient 绑到登录 User。客户可见还需：后台绑定 `Patient.user` + 报告 **release**。

### 2.5 响应与错误（上传端要处理）

| HTTP | 含义 | 上传端建议 |
|------|------|------------|
| 200/201 | 成功（含 idempotent 重放） | 记录 `report.id` / `report_number` |
| 400 | 字段/schema/文件非法 | 修包后换新或同 `upload_id` 重试（视错误） |
| 401/403 | Key 无效/停用 | 检查 Key |
| 409 | 已 released 且未 `force` | 勿覆盖；或人工确认后 `force=true` |
| 413/其它 | 单文件过大等（上限约 100MB/文件） | 拆包或联系云端 |

历史查询：

```http
GET /api/v1/ingest/reports/{report_id}/package-history/
Header: X-API-Key: gm_...
```

（以云端实际实现为准；无 Key 权限时用内部 JWT。）

---

## 3. 现成上传脚本（优先复用）

仓库内：

- `scripts/wes_package_upload.py` — 跨平台 Python 上传器  
- `scripts/wes_package_upload.sh` — shell 包装  
- 示例包：`backend/wes_report_examples/clinical_v2_demo/`  
- 说明：`NODE9_REPORT_PACKAGE_zh.md`

最小调用：

```bash
export GAOMEI_INGEST_API_KEY='gm_...'
python3 scripts/wes_package_upload.py \
  --api https://gomics.icu/api/v1/ingest/reports/package/ \
  --dir /path/to/package \
  --patient-no GM-P-010 \
  --patient-name '测试患者' \
  --sample-id GM10 \
  --node-id node9
```

**上传端 AI 任务建议：**

1. 读 `scripts/wes_package_upload.py`，按本机路径/流水号封装  
2. 保证每次成功分析产出含 `report.json`（clinical_v2）  
3. 环境变量只放 `GAOMEI_INGEST_API_KEY`，不要提交到 Git  
4. 删除任何 Bridge Token / `/api/bridge/` 调用  
5. 上传成功后把 `report_number` / `sample_id` 写回本地流水账  

---

## 4. ID 规范（与云端一致）

| 实体 | 格式 | 例 |
|------|------|-----|
| Patient | `GM-P-NNN` | `GM-P-010` |
| Report | `GM-R-NNN` | `GM-R-006` |
| Sample / WES 盘符 | `GM##` | `GM10` |

缺省时云端 `allocate_ids` 自动分配。上传端若自带编号，请保持大写与唯一。

---

## 5. 云端数据模型（上传后你在库里会看到什么）

```text
User 0..1 ←→ 0..1 Patient 1──N Report
                              ├── ReportAsset   (pdf/bam/bai/json…)
                              ├── ReportVariant
                              └── ReportAccessLog
IngestApiKey ── IngestEvent ──(optional) Report
```

报告状态：`draft` → `review`（上传默认）→ `released` / `void`。  
客户门户只看 **已绑定 Patient.user** 且 **released** 的报告。

附件下载（门户 JWT + ACL，BAM 支持 HTTP Range）：

```text
GET /api/v1/reports/{report_id}/assets/{asset_id}/download/
```

---

## 6. 云端门户能力（背景，上传端一般不改）

| 入口 | 谁用 | 作用 |
|------|------|------|
| `/patient-reports` | 内部 | 送审 / 发布 / 作废、开 HTML/PDF/3D/IGV |
| `/db-browser` | admin | 后台「数据台」：患者/报告/文件/用户/API Key CRUD |
| `/dashboard` | 内部 | 工作台 |
| `/reports/:id` | 登录用户 | 3D 报告 |
| `/browser` | 登录用户 | IGV |

编辑方式：列表 → 文字链「编辑」→ **独立表单页** → 保存。

---

## 7. 云端关键代码（只读参考）

| 路径 | 职责 |
|------|------|
| `backend/ingest/views.py` | `ReportPackageIngestView` |
| `backend/ingest/services/package_ingest.py` | 包落盘 + Patient/Report/Asset |
| `backend/ingest/authentication.py` | `X-API-Key` |
| `backend/reports/wes_portal_sync.py` | JSON → 门户字段/变异 |
| `backend/reports/id_format.py` | ID 分配 |
| `backend/wes_report/` | HTML/PDF 渲染 |
| `scripts/wes_package_upload.py` | 官方上传客户端 |

规格长文（设计意图）：`GOMICS_DATA_V2_IMPLEMENTATION_SPEC.md`。  
**明确非目标：** 裸 `/media/` 公共 Alias 加锁（当前不做）。

---

## 8. 环境变量（上传端 vs 云端）

**上传端（node9）最少：**

```bash
GAOMEI_INGEST_API_KEY=gm_...
# 可选覆盖：
# GAOMEI_PACKAGE_API=https://gomics.icu/api/v1/ingest/reports/package/
```

**云端 shared（勿改生产 DB 路径）：**

```text
/home/ubuntu/apps/gaomei_web/shared/gaomei-web.env
/home/ubuntu/apps/gaomei_web/shared/db.sqlite3          # 生产库
/home/ubuntu/apps/gaomei_web/shared/db.test.sqlite3     # 仅开发测试
```

开发机 `backend/db.sqlite3` 可软链到 `db.test.sqlite3`；**部署永远链生产 `db.sqlite3`**。

---

## 9. 验收清单（上传端做完应满足）

- [ ] 用有效 API Key 上传含 `report.json` 的包 → 200/201  
- [ ] 重复相同 `upload_id` → idempotent，不双写坏数据  
- [ ] BAM/BAI 出现在报告附件；IGV 能读（经 asset download）  
- [ ] 云端生成 PDF（上传目录无自带 PDF 也可）  
- [ ] 报告默认 `review`；release 后客户账号（已绑 Patient）可见  
- [ ] 代码中无 Bridge Token / SampleBundle / `/api/bridge/`  

---

## 10. 给上传端 AI 的直接指令（可复制）

```text
你在 node / 分析服务器上工作。请对接 Gomics 云端 Data V2 报告包上传：

1. 阅读云端仓库 scripts/wes_package_upload.py 与 NODE9_REPORT_PACKAGE_zh.md、
   以及本文件 UPLOAD_PIPELINE_HANDOFF_zh.md。
2. 删除本机任何 Bridge Token / /api/bridge/ 上传逻辑。
3. 使用环境变量 GAOMEI_INGEST_API_KEY，对
   POST https://gomics.icu/api/v1/ingest/reports/package/
   上传 multipart：upload_id, patient_no, sample_id, manifest, files[]。
4. 包内必须有 clinical_v2 的 report.json；可附 BAM/BAI；不要上传 PDF。
5. 做好幂等（稳定 upload_id）与 409 released 冲突处理。
6. 上传成功后记录返回的 report_number / sample_id / report id。
```

---

## 11. 变更摘要（本轮云端已落地）

- V2 模型 + package ingest 全链路  
- 门户可写「数据台」（设计稿式列表 + 独立编辑页）  
- 患者报告工作流：送审 / 发布 / 作废  
- Bridge / SampleBundle / CloudJobs / 旧 seed / Bridge Token 脚本已清理  
- 生产部署走 `deploy/tencent/deploy.sh`（`git archive` 当前 commit）
