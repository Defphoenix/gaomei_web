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

`report.json` 必须符合 `wes_report` 的 **clinical_v2** schema（含 `executive_message` /
「致受检者的一封信」）。仓库示例：

`backend/wes_report_examples/clinical_v2_demo/report.json`

同目录还附带演示用 `tumor.report.bam` / `normal.report.bam`（及 `.bai`），用于 IGV 查看突变证据。
旧版 `sample_report.json` 为 legacy 模板，**不要**再用于正式报告包。


## 本机（Windows）/ node9 共用上传（推荐）

**同一套 Token + 同一接口**：Windows 本机和 node9 都可以上传；云端只认 `X-Gaomei-Bridge-Token` 明文对应的 SHA256。

仓库已带演示包与跨平台脚本（clinical_v2 + 位点小 BAM）：

- 示例目录：`backend/wes_report_examples/clinical_v2_demo/`
  - 必填：`report.json`
  - IGV：`tumor.report.bam` / `.bai`，`normal.report.bam` / `.bai`（只含报告位点附近的小切片即可）
- 生成 Token：`python scripts/gen_bridge_token.py`（也可用 `.sh`）
- 上传：`python scripts/wes_package_upload.py`（也可用 `.sh`；**Windows 请用 Python 版**）

### A. 一次性：生成 Token 并写入云端

在任意一台有 Python3 的机器上：

```bash
python scripts/gen_bridge_token.py
```

把打印的 `GAOMEI_BRIDGE_TOKEN_SHA256=...` 写入云端  
`/home/ubuntu/apps/gaomei_web/shared/gaomei-web.env`，然后：

```bash
sudo systemctl restart gaomei-web
```

明文 `GAOMEI_BRIDGE_TOKEN` **同时**保存在 Windows 本机和 node9（可用环境变量或本地私密文件，不要提交 git）。

### B. Windows 本机上传（PowerShell）

前置：安装 [Python 3](https://www.python.org/downloads/)（勾选 Add to PATH），并拿到本仓库（git clone 或复制整个目录）。

```powershell
cd D:\path\to\gaomei_web

# 明文 Token（与云端 SHA256 对应）
$env:GAOMEI_BRIDGE_TOKEN = "粘贴明文token"

python scripts\wes_package_upload.py `
  --dir backend\wes_report_examples\clinical_v2_demo `
  --patient-no P20260001 `
  --patient-name "测试患者" `
  --sample-id SH05677 `
  --upload-id ("upload-win-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
```

或 CMD：

```bat
cd /d D:\path\to\gaomei_web
set GAOMEI_BRIDGE_TOKEN=粘贴明文token
python scripts\wes_package_upload.py --dir backend\wes_report_examples\clinical_v2_demo --patient-no P20260001 --patient-name 测试患者 --sample-id SH05677
```

### C. node9（Linux）上传

```bash
cd /path/to/gaomei_web
export GAOMEI_BRIDGE_TOKEN='粘贴明文token'
python3 scripts/wes_package_upload.py \
  --dir backend/wes_report_examples/clinical_v2_demo \
  --patient-no P20260001 \
  --patient-name '测试患者' \
  --sample-id SH05677 \
  --upload-id "upload-node9-$(date +%Y%m%d-%H%M%S)"
```

成功时响应里 `pdf_ready: true`，管理员打开 `preview_url`。  
患者端要能下载 PDF，还需在「患者报告」里把该报告 **发布 (released)**。

> 每次上传请换新的 `upload_id`（脚本默认已带时间戳）。同一样本新上传会 **覆盖** 旧 active 包。

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
  -F 'manifest={"schema_version":"wes_package_v1","files":[{"name":"report.json","role":"report_json"},{"name":"tumor.report.bam","role":"attachment"},{"name":"tumor.report.bam.bai","role":"attachment"},{"name":"normal.report.bam","role":"attachment"},{"name":"normal.report.bam.bai","role":"attachment"}]}' \
  -F 'files=@/path/to/report.json;filename=report.json' \
  -F 'files=@/path/to/tumor.report.bam;filename=tumor.report.bam' \
  -F 'files=@/path/to/tumor.report.bam.bai;filename=tumor.report.bam.bai' \
  -F 'files=@/path/to/normal.report.bam;filename=normal.report.bam' \
  -F 'files=@/path/to/normal.report.bam.bai;filename=normal.report.bam.bai'
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
