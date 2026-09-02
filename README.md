# GAOMEI Web

高美基因对外官网与患者报告门户。React + TypeScript 前端、Django REST Framework 后端，
含 3D 人体报告与腾讯云部署模板。

本仓库与 `gaomei_wes` 分开维护：

- `gaomei_web`：官网、登录、患者报告、V2 Ingest（报告包/API Key）
- `gaomei_wes`：node9 本地 WES 流程与分析 Agent

## 目录结构

```text
gaomei_web/
├── frontend/               # React 18 + TypeScript + Vite正式前端
├── backend/                # Django 4.2 REST API
│   ├── accounts/           # 登录与角色
│   ├── reports/            # Patient / Report / Asset / ACL
│   ├── ingest/             # API Key 导入与报告包
│   ├── wes_report/         # clinical_v2 HTML/PDF
│   ├── blog/ bioblog/ company/
│   └── config/
├── design/                 # 报告页面与3D人体交互原型
├── deploy/tencent/         # Apache、Gunicorn和systemd部署模板
├── scripts/                # 上传与启动脚本
└── NODE9_REPORT_PACKAGE_zh.md
```

## 主要技术

| 模块 | 技术 |
|------|------|
| 前端 | React 18、TypeScript、Vite、React Router |
| 数据可视化 | ECharts、GSAP、Three.js |
| 基因组浏览 | IGV.js |
| PDF前端能力 | html2pdf.js |
| 后端 | Django 4.2、Django REST Framework |
| 登录 | SimpleJWT |
| 开发数据库 | SQLite |
| 正式服务 | Apache/Nginx、Gunicorn、systemd |
| WES连接 | node9主动出站HTTPS轮询，不使用FRP或花生壳 |

## 本地启动

### 1. 后端环境

推荐 Python 3.10 或 3.11：

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
cd ..
```

创建本机管理员：

```bash
cd backend
source .venv/bin/activate
python manage.py createsuperuser
cd ..
```

### 2. 前端环境

推荐 Node.js 20 LTS：

```bash
cd frontend
npm ci
cd ..
```

### 3. 一键启动

为了与WES内部后台端口分离，建议本机使用 `18180/18181`：

```bash
GAOMEI_WEB_PYTHON="$PWD/backend/.venv/bin/python" \
GAOMEI_WEB_FRONTEND_PORT=18180 \
GAOMEI_WEB_BACKEND_PORT=18181 \
bash scripts/local_web.sh start
```

浏览器访问：

```text
http://127.0.0.1:18180
```

状态和停止：

```bash
bash scripts/local_web.sh status
bash scripts/local_web.sh stop
```

## UI和素材修改入口

公开官网已经完成UI设计。修改前应先确认影响范围，不要用内部WES后台页面覆盖官网视觉。

| 内容 | 位置 |
|------|------|
| 页面和路由 | `frontend/src/pages/`、`frontend/src/App.tsx` |
| 通用头部/底部 | `frontend/src/components/` |
| 全局样式 | `frontend/src/index.css` |
| 官网图片 | `frontend/public/assets/images/` |
| 官网视频 | `frontend/public/assets/media/` |
| 正式3D人体模型 | `frontend/public/assets/models/tumor_web_0.10.glb` |
| Draco资源 | `frontend/public/assets/draco/` |
| 3D交互原型 | `design/report_v2_3d_prototype.html`、`design/report_v2_3d.js` |
| 报告页面 | `frontend/src/pages/PersonalReports.tsx`及相关报告组件 |
| 报告API | `backend/reports/` + `backend/ingest/` |
| 报告包上传 | `POST /api/v1/ingest/reports/package/`（X-API-Key） |

替换图片或模型后运行：

```bash
cd frontend
npm run build
```

构建产物位于 `frontend/dist/`，不进入Git，由部署流程重新生成。

## node9 → 云端报告包（Data V2）

node9 / 本机通过 HTTPS 上传正式报告包：

```text
POST https://gomics.icu/api/v1/ingest/reports/package/
Header: X-API-Key: gm_...
```

详见 `NODE9_REPORT_PACKAGE_zh.md`。旧 `/api/bridge/` 已按 V2 规格移除。

## 腾讯云部署

部署结构：

```text
/home/ubuntu/apps/gaomei_web/releases/<timestamp>  版本目录
/home/ubuntu/apps/gaomei_web/current               当前版本链接
/home/ubuntu/apps/gaomei_web/shared                数据库、媒体和私有环境配置
/var/www/gaomei_web                                React静态文件
/var/lib/gaomei_web                                Django static/media
```

详细步骤见：

- `TENCENT_CLOUD_DEPLOY_zh.md`
- `deploy/tencent/gaomei-web.service`
- `deploy/tencent/gaomei-web-apache.conf`
- `deploy/tencent/gaomei-web.env.example`

生产环境必须设置：

```text
GAOMEI_WEB_DEBUG=false
GAOMEI_WEB_SECRET_KEY=<随机长密钥>
GAOMEI_WEB_SECURE_COOKIES=true
```

真实环境变量文件不得提交到Git。

## 不进入Git的内容

以下内容由 `.gitignore` 排除：

- `backend/db.sqlite3`；
- `backend/media/` 患者或运营上传文件；
- `.runtime/`、PID和日志；
- `frontend/node_modules/`、`design/node_modules/`；
- `frontend/dist/`；
- `.env`、Token、私钥和证书；
- 腾讯云真实环境配置。

Git保存源码和可公开设计素材，不是生产数据库备份。迁移到另一台电脑后需要重新安装
Python/Node依赖并执行Django迁移。

## 安全要求

1. 推荐使用私有GitHub仓库。
2. 不提交患者数据库、报告PDF、上传媒体、API Token或Django Secret Key。
3. 腾讯云22端口仅允许受信任IP，网站只开放80/443。
4. node9的29080/29180不得暴露公网。
5. 正式管理员账号使用强密码和多因素认证。
6. Bridge Token和Agent Token定期轮换。
7. 发布前执行敏感信息和大文件扫描。

## 代码迁移

新电脑获取代码后：

```bash
git clone git@github.com:Defphoenix/gaomei_web.git
cd gaomei_web

cd frontend && npm ci && cd ..
cd backend && python3 -m venv .venv && source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
```

本项目当前用于研发和展示。正式医疗数据服务仍需完成权限审计、备份、密钥管理、
日志脱敏、漏洞扫描和合规评估。
