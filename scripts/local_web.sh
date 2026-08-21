#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RUNTIME="$ROOT/.runtime/local_web"
BACKEND_PID="$RUNTIME/backend.pid"
FRONTEND_PID="$RUNTIME/frontend.pid"
BACKEND_LOG="$RUNTIME/backend.log"
FRONTEND_LOG="$RUNTIME/frontend.log"
BACKEND_HOST="${GAOMEI_WEB_BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${GAOMEI_WEB_BACKEND_PORT:-18081}"
BACKEND_CONNECT_HOST="${GAOMEI_WEB_BACKEND_CONNECT_HOST:-127.0.0.1}"
FRONTEND_HOST="${GAOMEI_WEB_FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${GAOMEI_WEB_FRONTEND_PORT:-18080}"
PUBLIC_ORIGIN="${GAOMEI_WEB_PUBLIC_ORIGIN:-http://${FRONTEND_HOST}:${FRONTEND_PORT}}"
PYTHON_BIN="${GAOMEI_WEB_PYTHON:-python3}"
NODE_BIN="${GAOMEI_WEB_NODE:-node}"

mkdir -p "$RUNTIME"

alive() {
    local pid_file=$1
    [[ -s "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

start() {
    "$PYTHON_BIN" "$ROOT/backend/manage.py" migrate
    if ! alive "$BACKEND_PID"; then
        (
            cd "$ROOT/backend"
            nohup env \
                GAOMEI_WEB_CORS_ORIGINS="$PUBLIC_ORIGIN" \
                GAOMEI_WEB_CSRF_TRUSTED_ORIGINS="$PUBLIC_ORIGIN" \
                "$PYTHON_BIN" manage.py runserver "${BACKEND_HOST}:${BACKEND_PORT}" --noreload \
                >"$BACKEND_LOG" 2>&1 &
            echo $! >"$BACKEND_PID"
        )
    fi
    if ! alive "$FRONTEND_PID"; then
        (
            cd "$ROOT/frontend"
            nohup env VITE_API_PROXY="http://${BACKEND_CONNECT_HOST}:${BACKEND_PORT}" \
                "$NODE_BIN" node_modules/vite/bin/vite.js \
                --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" --strictPort \
                >"$FRONTEND_LOG" 2>&1 &
            echo $! >"$FRONTEND_PID"
        )
    fi
    sleep 2
    status
}

stop_one() {
    local pid_file=$1
    if alive "$pid_file"; then
        kill "$(cat "$pid_file")"
    fi
    rm -f "$pid_file"
}

stop() {
    stop_one "$FRONTEND_PID"
    stop_one "$BACKEND_PID"
    echo "Gaomei public web stopped."
}

status() {
    if alive "$BACKEND_PID"; then
        echo "Backend : http://${BACKEND_HOST}:${BACKEND_PORT} (pid $(cat "$BACKEND_PID"))"
    else
        echo "Backend : stopped"
    fi
    if alive "$FRONTEND_PID"; then
        echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT} (pid $(cat "$FRONTEND_PID"))"
    else
        echo "Frontend: stopped"
    fi
    echo "Logs    : $RUNTIME"
}

case "${1:-start}" in
    start) start ;;
    stop) stop ;;
    restart) stop; start ;;
    status) status ;;
    *) echo "Usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
