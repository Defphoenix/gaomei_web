# node9 / 本机 → 云端正式报告包（Data V2）

云端生成 HTML/PDF。**只上传 JSON 与附属 BAM/BAI，不要上传 PDF。**

## 鉴权（V2）

使用 **Ingest API Key**（不是 Bridge Token）：

```http
POST /api/v1/ingest/reports/package/
Header: X-API-Key: gm_...
Content-Type: multipart/form-data
```

在 Django Admin →「导入 API Key」创建；明文只显示一次。  
推荐 scope：`wes_package` / `test-pipeline`。

> 旧 `/api/bridge/reports/package/` + `X-Gaomei-Bridge-Token` 路径已废弃（SampleBundle 已删除）。

## 表单字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `upload_id` | 是 | 幂等键；相同内容重复提交返回 idempotent |
| `patient_no` | 是 | 受检者编号（如 `GM-P-010`）；无则创建 Patient |
| `sample_id` | 是 | 样本 / WES 盘符（如 `GM10`） |
| `patient_name` | 否 | 写入 Patient.name |
| `report_number` | 否 | 缺省自动分配 `GM-R-NNN`；同 sample 复用 |
| `node_id` | 否 | 来源节点标记 |
| `manifest` | 是 | JSON 字符串清单 |
| `force` | 否 | `true` 时允许覆盖已 released（慎用） |
| `files` | 是 | 至少含 `report.json`；BAM/BAI 一并上传 |

## 行为

1. 校验 clinical_v2 schema → 落盘 `wes_bundles/<sample_id>/<upload_id>/`
2. 写 `wes_reports/<sample_id>/current.json`（覆盖前备份到 `history/`）
3. Upsert `Patient` + `Report`（`status=review`）；**不自动绑 User**
4. 写入 `ReportAsset`（bam/bai/json/pdf）
5. 同步门户 `analysis_data` + `ReportVariant`；生成 HTML/PDF
6. `IngestEvent` 审计；历史查询：`GET /api/v1/ingest/reports/{id}/package-history/`
7. **released 报告默认拒绝覆盖**（409）
8. 客户可见：Admin 将 `Patient.user` 绑到登录账号，再 **release**

## 上传脚本

```bash
export GAOMEI_INGEST_API_KEY='gm_...'
python3 scripts/wes_package_upload.py \
  --dir backend/wes_report_examples/clinical_v2_demo \
  --patient-no GM-P-010 \
  --patient-name '测试患者' \
  --sample-id GM10
```

Asset 下载（需 JWT + ACL，BAM 支持 Range）：

```text
GET /api/v1/reports/{report_id}/assets/{asset_id}/download/
```
