# 09服务器预览部署

## 路径和端口

- 代码：`/PUBLIC/gomics/guofenghua/project/gaomei_web_preview`
- 环境：`/PUBLIC/gomics/guofenghua/envs/web/gaomei_web_env`
- 前端：`18080`
- Django后端：`18081`

该方案仅用于内网领导预览。腾讯云正式上线时应改用 Nginx、Gunicorn、HTTPS、
独立密钥和正式数据库，不直接暴露 Vite 与 Django 开发服务器。

## Mac上传

```bash
ssh guofenghua@192.168.3.109 \
  'mkdir -p /PUBLIC/gomics/guofenghua/project/gaomei_web_preview'

rsync -avP \
  --exclude '.git/' \
  --exclude '.runtime/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'frontend/dist/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.DS_Store' \
  /Users/mac/Documents/wes/gaomei_web/ \
  guofenghua@192.168.3.109:/PUBLIC/gomics/guofenghua/project/gaomei_web_preview/
```

## 首次安装

```bash
PROJECT=/PUBLIC/gomics/guofenghua/project/gaomei_web_preview
ENV=/PUBLIC/gomics/guofenghua/envs/web/gaomei_web_env

mkdir -p "$(dirname "$ENV")"
mamba create -y -p "$ENV" -c conda-forge python=3.11 nodejs=20 pip
mamba install -y -p "$ENV" -c conda-forge \
  "django>=4.2,<5" \
  djangorestframework \
  django-cors-headers \
  "pillow>=10" \
  django-filter \
  pyjwt

"$ENV/bin/python" -m pip install \
  --no-deps \
  --only-binary=:all: \
  "djangorestframework-simplejwt>=5.3"

export PATH="$ENV/bin:$PATH"
python "$PROJECT/backend/manage.py" check

cd "$PROJECT/frontend"
npm ci
```

## 启动

```bash
cd /PUBLIC/gomics/guofenghua/project/gaomei_web_preview
bash scripts/server09_preview.sh start
```

访问：`http://192.168.3.109:18080`

## 管理

```bash
bash scripts/server09_preview.sh status
bash scripts/server09_preview.sh restart
bash scripts/server09_preview.sh stop

tail -f .runtime/local_web/backend.log
tail -f .runtime/local_web/frontend.log
```
