# 腾讯云调试部署

正式域名为 `https://gomics.icu`，同时支持 `https://www.gomics.icu`。
IP 调试入口为 `http://118.25.149.190`，备用入口为
`http://118.25.149.190:18080`。React 静态文件由 Apache
提供，`/api` 转发到仅监听本机 `127.0.0.1:18081` 的 Gunicorn。

## 目录

- 版本：`/home/ubuntu/apps/gaomei_web/releases/<timestamp>`
- 当前版本：`/home/ubuntu/apps/gaomei_web/current`
- 数据：`/home/ubuntu/apps/gaomei_web/shared`
- 公共前端：`/var/www/gaomei_web`
- 公共媒体和静态文件：`/var/lib/gaomei_web`
- Python 环境：`/home/ubuntu/envs/gaomei_web`
- systemd：`gaomei-web.service`

数据库、媒体、环境变量位于 `shared/`，更新 release 时不会覆盖。

## 一键部署

仓库脚本：`deploy/tencent/deploy.sh`。在腾讯云 Git 工作区、干净的 `main` 分支上执行。

```bash
cd /home/ubuntu/src/gaomei_web

# 查看当前 release / 服务 / 数据计数
bash deploy/tencent/deploy.sh status

# 健康检查（官网、/api/auth/me/ 401、systemd、数据库计数）
bash deploy/tencent/deploy.sh health

# 正式发布（会 pull、备份 SQLite、构建、迁移、切换 current、重启并检查）
bash deploy/tencent/deploy.sh deploy

# 非交互发布（CI/脚本场景）
bash deploy/tencent/deploy.sh deploy --yes

# 回滚到上一个 release；若迁移有问题可同时恢复数据库备份
bash deploy/tencent/deploy.sh rollback --yes
bash deploy/tencent/deploy.sh rollback 20260821_171505 --restore-db --yes
```

发布前工作区应干净。不要直接修改 `apps/gaomei_web/current`。
失败时脚本会尝试切回上一 release，并在已执行迁移时恢复对应 SQLite 备份。

## 管理命令

```bash
sudo systemctl status gaomei-web --no-pager
sudo systemctl restart gaomei-web
sudo journalctl -u gaomei-web -f
sudo tail -f /var/log/apache2/gaomei-web-error.log
```

## 正式上线前

调试端口通过后，再配置域名、HTTPS、`GAOMEI_WEB_SECURE_COOKIES=true`、
正式数据库、备份和上传文件访问控制。不要把 `shared/gaomei-web.env` 纳入 Git。
