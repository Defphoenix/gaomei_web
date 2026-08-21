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
