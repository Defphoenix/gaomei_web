# node9 → 云端正式报告包对接说明

云端生成 HTML/PDF。**node9 只上传 JSON 与附属文件，不要上传 PDF。**

主接口：

```http
POST https://gomics.icu/api/bridge/reports/package/
Header: X-Gaomei-Bridge-Token: <明文 Bridge Token>
Content-Type: multipart/form-data
```

## 表单字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `upload_id` | 是 | 本次上传唯一 ID（幂等键） |
| `node_id` | 是 | 例如 `node9-wes-executor` |
| `patient_no` | 是 | 患者编号（管理员台账一行） |
| `sample_id` | 是 | 样本编号（版本目录维度） |
| `patient_name` | 否 | 患者姓名 |
| `manifest` | 是 | JSON 字符串，文件清单 |
| `files` 或同名文件字段 | 是 | 至少一个文件；必须含 `report.json` |

## manifest 示例

```json
{
  "schema_version": "wes_package_v1",
  "patient_no": "P20260001",
  "patient_name": "张某某",
  "sample_id": "SH05677",
  "generated_at": "2026-08-22T01:00:00+08:00",
  "files": [
    {"name": "report.json", "role": "report_json", "sha256": "<可选>"},
    {"name": "coverage.svg", "role": "qc_plot", "sha256": "<可选>"}
  ]
}
```

`report.json` 必须符合 `wes_report` 的 `ReportData` schema（可用仓库内 `backend/wes_report_examples/sample_report.json` 作模板）。

## curl 示例

```bash
TOKEN='你的Bridge明文Token'
curl -X POST 'https://gomics.icu/api/bridge/reports/package/' \
  -H "X-Gaomei-Bridge-Token: ${TOKEN}" \
  -F 'upload_id=upload-SH05677-20260822-01' \
  -F 'node_id=node9-wes-executor' \
  -F 'patient_no=P20260001' \
  -F 'patient_name=张某某' \
  -F 'sample_id=SH05677' \
  -F 'manifest={"schema_version":"wes_package_v1","files":[{"name":"report.json","role":"report_json"}]}' \
  -F 'files=@/path/to/report.json;filename=report.json' \
  -F 'files=@/path/to/coverage.svg;filename=coverage.svg'
```

## 云端行为

1. 落盘：`wes_bundles/<sample_id>/<upload_id>/`，每个文件写入 `BundleFile` 路径映射。
2. 同一样本若已有 `active` 包 → 标记 `superseded`，指针切到新包。
3. 将 `report.json` 写入编辑工作区 `wes_reports/<wes_report_id>/current.json`。
4. 自动 HTML → PDF；PDF 挂到患者可下载的 `Report.report_pdf_file`（状态仍为 `review`，需发布后患者可见）。
5. 同一 `upload_id` 重复提交 → 幂等返回，不新建目录。

## 成功响应（节选）

```json
{
  "upload_id": "upload-SH05677-20260822-01",
  "patient_no": "P20260001",
  "sample_id": "SH05677",
  "wes_report_id": "SH05677",
  "pdf_ready": true,
  "preview_url": "/wes/reports/SH05677/",
  "edit_url": "/wes/reports/SH05677/edit/",
  "download_url": "/api/reports/12/pdf/",
  "files": [
    {"role": "report_json", "rel_path": "report.json", "sha256": "...", "abs_path": "..."}
  ]
}
```

## 管理员入口

登录内部账号后打开：`https://gomics.icu/patient-reports`

- **查看** → `/wes/reports/<id>/`（HTML）
- **编辑** → `/wes/reports/<id>/edit/`
- 患者端：仅已发布报告可下载 PDF；看不到编辑页

## 将废弃的接口

- `POST /api/bridge/reports/<upload_id>/pdf/`：不再作为正式路径（PDF 由云端生成）。
- 后续可停用 job claim / project sync；**本上传接口独立保留**。

## 旧互动报告 import

`POST /api/bridge/reports/import/` 仍可用于门户互动 JSON；正式排版请改用本 `package/` 接口。
