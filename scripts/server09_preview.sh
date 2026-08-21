#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_PREFIX="${GAOMEI_WEB_ENV_PREFIX:-/PUBLIC/gomics/guofenghua/envs/web/gaomei_web_env}"
SERVER_IP="${GAOMEI_WEB_SERVER_IP:-192.168.3.109}"

if [[ ! -x "$ENV_PREFIX/bin/python" || ! -x "$ENV_PREFIX/bin/node" ]]; then
    echo "Web environment is incomplete: $ENV_PREFIX" >&2
    echo "Install it first according to SERVER09_PREVIEW_DEPLOY_zh.md." >&2
    exit 1
fi

export GAOMEI_WEB_PYTHON="$ENV_PREFIX/bin/python"
export GAOMEI_WEB_NODE="$ENV_PREFIX/bin/node"
export GAOMEI_WEB_BACKEND_HOST=0.0.0.0
export GAOMEI_WEB_BACKEND_CONNECT_HOST=127.0.0.1
export GAOMEI_WEB_BACKEND_PORT=18081
export GAOMEI_WEB_FRONTEND_HOST=0.0.0.0
export GAOMEI_WEB_FRONTEND_PORT=18080
export GAOMEI_WEB_PUBLIC_ORIGIN="http://${SERVER_IP}:18080"

exec bash "$ROOT/scripts/local_web.sh" "${1:-start}"
