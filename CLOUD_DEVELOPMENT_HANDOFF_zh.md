# GAOMEI Web 腾讯云开发与部署交接文档

> 最后核对时间：2026-08-21（Asia/Shanghai）  
> 适用仓库：`Defphoenix/gaomei_web`  
> 当前开发分支：`main`

## 1. 交接目标

本项目允许两台电脑协同开发，并允许新电脑通过 Remote SSH 连接腾讯云，在腾讯云
Git 工作区内修改代码。GitHub 的 `main` 分支是唯一代码来源。

需要严格区分：

- Git 负责同步源代码、迁移文件、部署模板和文档；
- 腾讯云保存生产/测试数据库、媒体文件、私有环境变量和证书；
- 代码同步不等于数据库同步；
- 修改 Git 工作区不会自动更新官网，必须执行部署流程。

## 2. 服务器和访问入口

| 项目 | 当前值 |
|---|---|
| 腾讯云公网 IP | `118.25.149.190` |
| SSH 用户 | `ubuntu` |
| 正式域名 | `https://gomics.icu` |
| `www` 域名 | `https://www.gomics.icu` |
| Django/Gunicorn | `127.0.0.1:18081`，不直接暴露公网 |
| Web 服务器 | Apache 2.4 |
| systemd 服务 | `gaomei-web.service` |
| Python 环境 | `/home/ubuntu/envs/gaomei_web` |

不要在文档、Git 提交、聊天记录或命令历史中保存服务器密码、Django Secret Key、
Bridge Token、OncoKB Token、患者信息或 SSH 私钥。

## 3. 代码和运行目录

### 3.1 Git 开发工作区

```text
/home/ubuntu/src/gaomei_web
```

用途：

- 新电脑通过 Remote SSH 打开的主要目录；
- 执行 `git pull`、修改代码、测试、提交和推送；
- 当前分支为 `main`；
- GitHub remote 为 `git@github.com:Defphoenix/gaomei_web.git`。

### 3.2 发布目录

```text
/home/ubuntu/apps/gaomei_web/releases/<timestamp>
/home/ubuntu/apps/gaomei_web/current
```

`current` 是指向当前 release 的软链接。Gunicorn 从
`/home/ubuntu/apps/gaomei_web/current/backend` 启动。

禁止直接修改 `current` 中的代码。直接修改会造成：

- 改动不在 Git 中；
- 下一次部署被覆盖；
- 无法准确回滚；
- 两台电脑看到的代码不一致。

### 3.3 持久数据目录

```text
/home/ubuntu/apps/gaomei_web/shared/db.sqlite3
/home/ubuntu/apps/gaomei_web/shared/media/
/home/ubuntu/apps/gaomei_web/shared/gaomei-web.env
```

这些文件不进入 Git，部署时必须保留。release 中的
`backend/db.sqlite3` 是指向 shared 数据库的软链接。

### 3.4 公共静态目录

```text
/var/www/gaomei_web
/var/lib/gaomei_web/static
/var/lib/gaomei_web/media
```

- React 构建产物发布到 `/var/www/gaomei_web`；
- Django static 发布到 `/var/lib/gaomei_web/static`；
- 上传媒体由 `/var/lib/gaomei_web/media` 提供。

## 4. 当前版本状态

本次同步前后的基准提交：

```text
ac65893e1e42d19322182eadee568eaddf5d8581
Initial GAOMEI public web portal release
```

2026-08-21 创建并部署的 release：

```text
/home/ubuntu/apps/gaomei_web/releases/20260821_171505
```

已完成：

- 腾讯云 Git 工作区创建；
- 本地与腾讯云 `main` 分支对齐；
- React 前端重新构建；
- Django `check`、`migrate`、`collectstatic`；
- 发布前 SQLite 备份；
- `current` 切换；
- Gunicorn 重启；
- 外部 HTTPS 和 API 健康检查；
- node9 Bridge 请求恢复正常。

数据库部署后仍保留：15 个用户、8 份报告、3 个桥接项目。数字只用于确认部署没有
覆盖数据，后续会随测试变化。

## 5. GitHub SSH 权限待办

腾讯云已生成仓库专用 SSH 密钥：

```text
/home/ubuntu/.ssh/gaomei_web_github_ed25519
/home/ubuntu/.ssh/gaomei_web_github_ed25519.pub
```

私钥只能留在腾讯云，不得复制、提交或展示。公钥可以添加到 GitHub Deploy keys：

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAckYfLHkrTiq19TQ+LO0fejzp5lhRO0vkqCylNZWHfb gaomei-web-tencent-cloud
```

GitHub 操作位置：

```text
Defphoenix/gaomei_web
Settings
Deploy keys
Add deploy key
```

标题建议：`gaomei-web-tencent-cloud`。需要勾选 `Allow write access`，否则腾讯云只能
拉取，不能推送。

仓库已经配置只使用该密钥：

```bash
cd /home/ubuntu/src/gaomei_web
git config --get core.sshCommand
```

添加 Deploy key 后验证：

```bash
cd /home/ubuntu/src/gaomei_web
git fetch origin
git status --short --branch
git ls-remote origin HEAD refs/heads/main
```

不要通过创建无意义提交来测试写权限。完成真实修改后再执行正常 `git push`。

## 6. 双电脑开发规则

每次开始修改前：

```bash
cd /home/ubuntu/src/gaomei_web
git switch main
git pull --rebase origin main
git status
```

完成修改后：

```bash
git status
git add <本次明确修改的文件>
git commit -m "描述本次修改"
git push origin main
```

另一台电脑继续工作前必须再次执行：

```bash
git pull --rebase origin main
```

约束：

1. 不允许两台电脑长期保留未推送的大批修改；
2. 不使用 `git reset --hard` 或强制推送覆盖另一台电脑的提交；
3. 出现冲突时先确认双方改动，再解决冲突；
4. 不提交数据库、媒体、日志、环境变量、Token、证书和私钥；
5. 发布前保持 Git 工作区干净，并记录部署的 commit SHA。

## 7. 开发和测试命令

### 7.1 Django

```bash
cd /home/ubuntu/src/gaomei_web/backend
source /home/ubuntu/envs/gaomei_web/bin/activate

set -a
source /home/ubuntu/apps/gaomei_web/shared/gaomei-web.env
set +a

python manage.py check
python manage.py test
```

涉及数据结构修改时：

```bash
python manage.py makemigrations
python manage.py migrate --plan
```

`makemigrations` 生成的迁移文件必须进入 Git。不要在未备份生产 SQLite 的情况下直接
执行正式迁移。

### 7.2 React

```bash
cd /home/ubuntu/src/gaomei_web/frontend
npm ci
npm run build
```

部署时发现 `npm audit` 报告 4 个 moderate 和 3 个 high 风险依赖。不要直接执行
`npm audit fix --force`，应先确认依赖升级是否造成 React/Vite/IGV 功能回归。

## 8. 标准部署顺序

一键脚本（推荐）：

```bash
cd /home/ubuntu/src/gaomei_web
bash deploy/tencent/deploy.sh status
bash deploy/tencent/deploy.sh health
bash deploy/tencent/deploy.sh deploy
# 失败回滚示例：
# bash deploy/tencent/deploy.sh rollback --restore-db --yes
```

脚本已封装下列步骤；若需人工部署，仍必须遵循同一顺序：

1. 确认工作区干净且位于 `main`；
2. `git pull --rebase origin main`；
3. 记录 `git rev-parse HEAD`；
4. 创建新的时间戳 release，不覆盖旧 release；
5. 备份 `shared/db.sqlite3`；
6. 从 Git commit 导出代码到 release；
7. 链接 shared 数据库；
8. 安装/核对 Python 依赖；
9. 执行 Django `check`、迁移和 `collectstatic`；
10. 执行 React `npm ci && npm run build`；
11. 原子切换 `current` 并重启 `gaomei-web`；
12. 同步前端 `dist/` 与 Django static；
13. 检查 API、官网和数据库记录数；
14. 失败时切回前一个 release，并恢复对应数据库备份。

服务检查：

```bash
bash deploy/tencent/deploy.sh health
# 或手动：
sudo systemctl status gaomei-web --no-pager
sudo journalctl -u gaomei-web -n 100 --no-pager
curl -I https://gomics.icu/
curl https://gomics.icu/api/auth/me/
```

未登录访问 `/api/auth/me/` 返回 401 JSON 属于正常健康响应。

## 9. 当前架构

```text
浏览器
  |
  | HTTPS 443
  v
腾讯云 Apache
  |-- React 静态文件: /var/www/gaomei_web
  |-- /static/: /var/lib/gaomei_web/static
  |-- /media/: /var/lib/gaomei_web/media
  `-- /api/ 和 /admin/
          |
          v
      Gunicorn 127.0.0.1:18081
          |
          v
      Django + shared/db.sqlite3

node9 WES Agent/Worker
  |
  | 主动访问腾讯云 Bridge API
  v
项目同步、任务领取、状态、日志、报告和PDF上传
```

腾讯云不能主动 SSH 进入 node9，也不能直接读取 node9 的 FASTQ、完整 BAM、参考基因组
或注释数据库。Bridge Token 只以 SHA256 形式保存在腾讯云环境文件中。

## 10. 网络和安全核对

已确认：

- `gomics.icu` 和 `www.gomics.icu` 解析到 `118.25.149.190`；
- 443 可访问；
- Let's Encrypt 证书覆盖两个域名；
- 证书当前有效期至 2026-11-07；
- `certbot.timer` active 且 enabled；
- Django `DEBUG=False`；
- Secure Cookie 已开启；
- MySQL 只监听 `127.0.0.1:3306`，当前 Django 实际使用 SQLite；
- 腾讯云系统 UFW 未启用，主要依赖腾讯云安全组。

已处理（HTTP → HTTPS，2026-08-21）：

1. `http://gomics.icu` / `http://www.gomics.icu` 现返回 **301** 到对应 HTTPS；
2. `http://118.25.149.190` 返回 **301** 到 `https://gomics.icu`（证书不含裸 IP）；
3. 80 端口改为独立重定向 VirtualHost；业务内容只在 443（及可选调试口 18080）；
4. 仓库模板已更新：`deploy/tencent/gaomei-web-apache.conf`。

待处理：

1. HSTS 尚未开启，应在 HTTPS 重定向稳定、确认无必要明文入口后再谨慎启用；
2. 公网 8080 当前开放，可能是 Genome Browser 镜像服务；不需要公网访问时应在腾讯云
   安全组中关闭或限制来源 IP；
3. 22 端口应限制为管理员固定 IP；
4. 应建立 SQLite、media 和环境配置的定时加密备份；
5. 应建立依赖漏洞审计和发布回滚演练。

## 11. 数据库说明

当前 Django 使用：

```text
django.db.backends.sqlite3
/home/ubuntu/apps/gaomei_web/shared/db.sqlite3
```

服务器虽然运行 MySQL，但 GAOMEI Web 目前未连接 MySQL。未来迁移 MySQL 时必须单独设计：

- 数据迁移和校验；
- 字符集与时区；
- 数据库用户最小权限；
- 连接凭据进入私有环境配置；
- 迁移前后用户、项目、任务、报告和审计日志数量比对；
- 可执行的回滚方案。

本地开发 SQLite 与腾讯云 SQLite 数据不同是正常情况。不得使用本地数据库覆盖云端。

## 12. 新 AI 接手时的首轮检查

```bash
cd /home/ubuntu/src/gaomei_web

git status --short --branch
git remote -v
git log -1 --oneline
git fetch origin

readlink -f /home/ubuntu/apps/gaomei_web/current
sudo systemctl status gaomei-web --no-pager

curl -I https://gomics.icu/
curl https://gomics.icu/api/auth/me/
```

然后阅读：

- `README.md`：项目总览；
- `TENCENT_CLOUD_DEPLOY_zh.md`：现有腾讯云部署说明；
- `SERVER09_PREVIEW_DEPLOY_zh.md`：node9 预览部署说明；
- 本文档：云端双电脑开发和运行状态。

## 13. 明确禁止事项

新 AI 未取得用户明确许可前，不得：

- 删除或覆盖 `shared/db.sqlite3`；
- 删除患者报告、media、Bridge 数据或审计日志；
- 将生产环境变量、Token、密码、证书或私钥提交 Git；
- 直接编辑 `/home/ubuntu/apps/gaomei_web/current`；
- 使用 `git reset --hard`、强制推送或批量删除 release；
- 开放 MySQL、Gunicorn、node9 管理端口到公网；
- 在未备份数据库时执行不可逆迁移；
- 使用 `npm audit fix --force` 直接改变生产依赖；
- 将完整 FASTQ、完整 BAM 或参考数据库上传腾讯云。

## 14. 下一步优先级

| 优先级 | 工作 | 验收标准 |
|---|---|---|
| P0 | 添加腾讯云 GitHub Deploy key | 已完成：`git fetch origin` 成功 |
| P0 | 验证云端真实修改可 push | 用真实文档/脚本提交验证（见 `deploy/tencent/deploy.sh`） |
| P0 | 编写一键部署脚本 | 已落地：`deploy/tencent/deploy.sh`（deploy/rollback/status/health） |
| P1 | 修复 HTTP 到 HTTPS 跳转 | 已完成：域名/IP 的 HTTP 返回 301 到 HTTPS |
| P1 | 收紧 8080、22 安全组 | 仅保留业务必需来源（需腾讯云安全组操作） |
| P1 | 建立生产数据备份 | SQLite、media、env 可恢复且有校验 |
| P1 | 审核 npm 漏洞 | 升级后前端、IGV和3D报告回归通过 |
| P2 | 评估 SQLite 到 MySQL 迁移 | 有迁移、校验、备份和回滚方案 |

