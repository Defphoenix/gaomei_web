#!/usr/bin/env bash
# GAOMEI Web — Tencent Cloud release deploy / rollback
#
# Usage:
#   bash deploy/tencent/deploy.sh deploy [--yes] [--skip-pull] [--allow-dirty]
#   bash deploy/tencent/deploy.sh rollback [<release_id>] [--restore-db] [--yes]
#   bash deploy/tencent/deploy.sh status
#   bash deploy/tencent/deploy.sh health
#
# Designed for /home/ubuntu/src/gaomei_web on the Tencent Cloud host.
# Never edits apps/.../current in place; always creates a new timestamped release.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

APP_ROOT="${GAOMEI_WEB_APP_ROOT:-/home/ubuntu/apps/gaomei_web}"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
ENV_FILE="$SHARED_DIR/gaomei-web.env"
DB_PATH="$SHARED_DIR/db.sqlite3"
VENV_BIN="${GAOMEI_WEB_VENV:-/home/ubuntu/envs/gaomei_web/bin}"
PYTHON="$VENV_BIN/python"
PIP="$VENV_BIN/pip"
SERVICE_NAME="${GAOMEI_WEB_SERVICE:-gaomei-web}"
PUBLIC_WWW="${GAOMEI_WEB_PUBLIC_WWW:-/var/www/gaomei_web}"
STATIC_ROOT_LIVE="${GAOMEI_WEB_STATIC_ROOT:-/var/lib/gaomei_web/static}"
HEALTH_ORIGIN="${GAOMEI_WEB_HEALTH_ORIGIN:-https://gomics.icu}"
KEEP_RELEASES="${GAOMEI_WEB_KEEP_RELEASES:-8}"

YES=0
SKIP_PULL=0
ALLOW_DIRTY=0
RESTORE_DB=0
COMMAND=""
ROLLBACK_TARGET=""

log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
die()  { printf '[%s] ERROR: %s\n' "$(date '+%F %T')" "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

confirm() {
  local prompt=$1
  if [[ "$YES" -eq 1 ]]; then
    return 0
  fi
  read -r -p "$prompt [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" ]]
}

run_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

load_env() {
  [[ -f "$ENV_FILE" ]] || die "missing env file: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

require_host_layout() {
  [[ -d "$APP_ROOT" ]] || die "APP_ROOT not found: $APP_ROOT"
  [[ -d "$RELEASES_DIR" ]] || die "releases dir missing: $RELEASES_DIR"
  [[ -d "$SHARED_DIR" ]] || die "shared dir missing: $SHARED_DIR"
  [[ -x "$PYTHON" ]] || die "python venv missing: $PYTHON"
  [[ -f "$DB_PATH" ]] || die "shared database missing: $DB_PATH"
  [[ -f "$ENV_FILE" ]] || die "shared env missing: $ENV_FILE"
  need git
  need rsync
  need npm
  need curl
  need systemctl
}

current_release_path() {
  if [[ -L "$CURRENT_LINK" || -d "$CURRENT_LINK" ]]; then
    readlink -f "$CURRENT_LINK"
  else
    echo ""
  fi
}

release_id_from_path() {
  basename "$1"
}

write_meta() {
  local release_dir=$1
  cat >"$release_dir/DEPLOY_META" <<EOF
COMMIT=${DEPLOY_COMMIT}
COMMIT_SHORT=${DEPLOY_COMMIT_SHORT}
BRANCH=${DEPLOY_BRANCH}
DEPLOYED_AT=$(date -Iseconds)
PREVIOUS_RELEASE=${PREVIOUS_RELEASE_ID:-}
DB_BACKUP=${DB_BACKUP_PATH:-}
REPO=${REPO_ROOT}
HEALTH_ORIGIN=${HEALTH_ORIGIN}
EOF
}

db_counts() {
  GAOMEI_WEB_DB_PATH="$DB_PATH" "$PYTHON" - <<'PY'
import os
import sqlite3
from pathlib import Path

db = Path(os.environ["GAOMEI_WEB_DB_PATH"])
conn = sqlite3.connect(str(db))
tables = {
    "users": "auth_user",
    "patients": "reports_patient",
    "reports": "reports_report",
}
for label, table in tables.items():
    try:
        n = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    except Exception as exc:  # noqa: BLE001
        print(f"{label}=ERROR:{exc}")
    else:
        print(f"{label}={n}")
PY
}

backup_database() {
  local stamp=$1
  DB_BACKUP_PATH="$SHARED_DIR/db.sqlite3.before_${stamp}"
  cp -a "$DB_PATH" "$DB_BACKUP_PATH"
  log "Database backup: $DB_BACKUP_PATH"
}

atomic_switch_current() {
  local target=$1
  local tmp="$APP_ROOT/current.new"
  ln -sfn "$target" "$tmp"
  mv -Tf "$tmp" "$CURRENT_LINK"
  log "current -> $(readlink -f "$CURRENT_LINK")"
}

restart_service() {
  run_sudo systemctl restart "$SERVICE_NAME"
  sleep 2
  run_sudo systemctl is-active --quiet "$SERVICE_NAME" \
    || die "service $SERVICE_NAME failed to become active"
  log "Service $SERVICE_NAME is active"
}

publish_frontend() {
  local release_dir=$1
  local dist="$release_dir/frontend/dist"
  [[ -f "$dist/index.html" ]] || die "frontend dist missing: $dist/index.html"
  log "Sync frontend dist -> $PUBLIC_WWW"
  run_sudo rsync -a --delete "$dist"/ "$PUBLIC_WWW"/
}

publish_static() {
  local release_dir=$1
  local snapshot="$release_dir/static_published"
  [[ -d "$snapshot" ]] || die "static snapshot missing: $snapshot"
  log "Sync Django static -> $STATIC_ROOT_LIVE"
  run_sudo rsync -a --delete "$snapshot"/ "$STATIC_ROOT_LIVE"/
}

# Returns 0 on success, 1 on failure (does not exit the process).
health_check() {
  local origin=${1:-$HEALTH_ORIGIN}
  local code
  local body
  local ok=1

  log "Health: HEAD $origin/"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -I --max-time 20 "$origin/" || true)
  if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" && "$code" != "308" ]]; then
    log "Health FAIL: site HTTP $code for $origin/"
    ok=0
  fi

  log "Health: GET $origin/api/auth/me/ (expect 401 JSON)"
  body=$(curl -sS --max-time 20 -w '\n%{http_code}' "$origin/api/auth/me/" || true)
  code=$(printf '%s\n' "$body" | tail -n1)
  body=$(printf '%s\n' "$body" | sed '$d')
  if [[ "$code" != "401" ]]; then
    log "Health FAIL: API expected 401, got $code"
    ok=0
  elif [[ -z "$body" ]]; then
    log "Health FAIL: API returned empty body"
    ok=0
  fi

  if run_sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Health: systemd $SERVICE_NAME active"
  else
    log "Health FAIL: systemd $SERVICE_NAME not active"
    ok=0
  fi

  log "Health: database counts"
  db_counts | while IFS= read -r line; do log "  $line"; done

  if [[ "$ok" -eq 1 ]]; then
    log "Health checks passed"
    return 0
  fi
  return 1
}

prune_old_releases() {
  local keep=$KEEP_RELEASES
  local current_id
  current_id=$(release_id_from_path "$(current_release_path)")
  mapfile -t all_releases < <(ls -1 "$RELEASES_DIR" | sort -r)

  declare -A keep_set=()
  local count=0
  local rel
  for rel in "${all_releases[@]}"; do
    if (( count < keep )); then
      keep_set[$rel]=1
      count=$((count + 1))
    fi
  done
  keep_set[$current_id]=1

  for rel in "${all_releases[@]}"; do
    if [[ -n "${keep_set[$rel]:-}" ]]; then
      continue
    fi
    log "Pruning old release: $rel"
    rm -rf "$RELEASES_DIR/$rel"
  done
}

prepare_git() {
  cd "$REPO_ROOT"
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  [[ "$branch" == "main" ]] || die "must deploy from main (current: $branch)"

  if [[ "$ALLOW_DIRTY" -ne 1 ]]; then
    if [[ -n "$(git status --porcelain)" ]]; then
      die "working tree is dirty; commit/stash first or pass --allow-dirty"
    fi
  fi

  if [[ "$SKIP_PULL" -ne 1 ]]; then
    log "Pulling origin/main"
    git fetch origin
    git pull --rebase origin main
  else
    log "Skipping git pull (--skip-pull)"
  fi

  DEPLOY_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  DEPLOY_COMMIT=$(git rev-parse HEAD)
  DEPLOY_COMMIT_SHORT=$(git rev-parse --short HEAD)
  log "Deploy commit: $DEPLOY_COMMIT ($DEPLOY_COMMIT_SHORT)"
}

export_release_tree() {
  local release_dir=$1
  mkdir -p "$release_dir"
  git -C "$REPO_ROOT" archive --format=tar "$DEPLOY_COMMIT" | tar -x -C "$release_dir"
  write_meta "$release_dir"
}

link_shared_db() {
  local release_dir=$1
  local db_link="$release_dir/backend/db.sqlite3"
  rm -f "$db_link"
  ln -s "$DB_PATH" "$db_link"
  [[ -e "$db_link" ]] || die "failed to link shared database"
}

install_python_deps() {
  local release_dir=$1
  log "Installing Python requirements"
  "$PIP" install -r "$release_dir/backend/requirements.txt"
}

django_prepare() {
  local release_dir=$1
  local staging="$release_dir/static_published"
  rm -rf "$staging"
  mkdir -p "$staging"

  load_env
  (
    cd "$release_dir/backend"
    export GAOMEI_WEB_STATIC_ROOT="$staging"
    log "Django check"
    "$PYTHON" manage.py check
    log "Django migrate"
    "$PYTHON" manage.py migrate --noinput
    log "Django collectstatic (release snapshot)"
    "$PYTHON" manage.py collectstatic --noinput --clear
  )
}

build_frontend() {
  local release_dir=$1
  local frontend="$release_dir/frontend"
  [[ -f "$frontend/package-lock.json" ]] || die "frontend/package-lock.json missing in release"

  log "npm ci"
  (
    cd "$frontend"
    npm ci --no-audit --no-fund
    log "npm run build"
    npm run build
  )
  [[ -f "$frontend/dist/index.html" ]] || die "frontend build missing dist/index.html"
}

auto_rollback_on_failure() {
  local previous=$1
  local backup=$2
  log "Deploy failed after switch; rolling back to $previous"
  if [[ -n "$previous" && -d "$previous" ]]; then
    if [[ -d "$previous/frontend/dist" ]]; then
      run_sudo rsync -a --delete "$previous/frontend/dist"/ "$PUBLIC_WWW"/ || true
    fi
    if [[ -d "$previous/static_published" ]]; then
      run_sudo rsync -a --delete "$previous/static_published"/ "$STATIC_ROOT_LIVE"/ || true
    fi
    atomic_switch_current "$previous"
    restart_service || true
  fi
  if [[ -n "$backup" && -f "$backup" ]]; then
    log "Restoring database from $backup"
    cp -a "$backup" "$DB_PATH"
    restart_service || true
  fi
}

cmd_status() {
  require_host_layout
  local cur
  cur=$(current_release_path)
  echo "APP_ROOT     : $APP_ROOT"
  echo "current      : ${cur:-"(unset)"}"
  if [[ -n "$cur" && -f "$cur/DEPLOY_META" ]]; then
    echo "----- DEPLOY_META -----"
    cat "$cur/DEPLOY_META"
  fi
  echo "----- systemd -----"
  run_sudo systemctl status "$SERVICE_NAME" --no-pager -l | sed -n '1,12p' || true
  echo "----- db counts -----"
  db_counts
  echo "----- releases (newest first) -----"
  ls -1 "$RELEASES_DIR" | sort -r | head -n 15
}

cmd_health() {
  require_host_layout
  health_check || die "health checks failed"
}

cmd_deploy() {
  require_host_layout
  prepare_git

  local stamp
  stamp=$(date '+%Y%m%d_%H%M%S')
  local release_dir="$RELEASES_DIR/$stamp"
  [[ ! -e "$release_dir" ]] || die "release already exists: $release_dir"

  PREVIOUS_RELEASE_PATH=$(current_release_path)
  PREVIOUS_RELEASE_ID=""
  if [[ -n "$PREVIOUS_RELEASE_PATH" ]]; then
    PREVIOUS_RELEASE_ID=$(release_id_from_path "$PREVIOUS_RELEASE_PATH")
  fi

  log "New release: $stamp"
  log "Previous  : ${PREVIOUS_RELEASE_ID:-none}"
  log "Commit    : $DEPLOY_COMMIT"

  if ! confirm "Proceed with production deploy of $DEPLOY_COMMIT_SHORT as $stamp?"; then
    die "aborted by user"
  fi

  local switched=0
  local migrated=0

  backup_database "$stamp"
  export_release_tree "$release_dir"
  link_shared_db "$release_dir"
  install_python_deps "$release_dir"

  # Build and migrate before publishing traffic so failures leave current intact.
  build_frontend "$release_dir"
  django_prepare "$release_dir"
  migrated=1

  atomic_switch_current "$release_dir"
  switched=1
  restart_service
  publish_static "$release_dir"
  publish_frontend "$release_dir"

  if ! health_check; then
    if [[ "$switched" -eq 1 ]]; then
      local restore_backup=""
      if [[ "$migrated" -eq 1 ]]; then
        restore_backup=$DB_BACKUP_PATH
      fi
      auto_rollback_on_failure "$PREVIOUS_RELEASE_PATH" "$restore_backup"
    fi
    die "deploy aborted after failed health check"
  fi

  prune_old_releases
  log "Deploy succeeded: $stamp ($DEPLOY_COMMIT_SHORT)"
  log "Previous release kept at: ${PREVIOUS_RELEASE_PATH:-none}"
  log "DB backup: $DB_BACKUP_PATH"
}

cmd_rollback() {
  require_host_layout

  local target_id=$ROLLBACK_TARGET
  local target_path=""
  local cur
  cur=$(current_release_path)
  local cur_id=""
  if [[ -n "$cur" ]]; then
    cur_id=$(release_id_from_path "$cur")
  fi

  if [[ -z "$target_id" ]]; then
    mapfile -t candidates < <(ls -1 "$RELEASES_DIR" | sort -r)
    local rel
    for rel in "${candidates[@]}"; do
      if [[ "$rel" != "$cur_id" ]]; then
        target_id=$rel
        break
      fi
    done
  fi

  [[ -n "$target_id" ]] || die "no rollback target release found"
  target_path="$RELEASES_DIR/$target_id"
  [[ -d "$target_path" ]] || die "release not found: $target_path"
  [[ -d "$target_path/backend" ]] || die "release looks incomplete: $target_path"

  local backup=""
  if [[ "$RESTORE_DB" -eq 1 ]]; then
    # Prefer backup taken when the current (bad) release was deployed.
    if [[ -n "$cur_id" && -f "$SHARED_DIR/db.sqlite3.before_${cur_id}" ]]; then
      backup="$SHARED_DIR/db.sqlite3.before_${cur_id}"
    elif [[ -f "$SHARED_DIR/db.sqlite3.before_${target_id}" ]]; then
      backup="$SHARED_DIR/db.sqlite3.before_${target_id}"
    else
      die "DB backup not found for --restore-db"
    fi
    log "Will restore DB: $backup"
  fi

  log "Rollback target: $target_id"
  log "Current        : ${cur:-none}"

  if ! confirm "Switch current to $target_id$([[ "$RESTORE_DB" -eq 1 ]] && echo ' and restore DB')?"; then
    die "aborted by user"
  fi

  if [[ -d "$target_path/frontend/dist" ]]; then
    log "Restoring frontend from $target_path/frontend/dist"
    run_sudo rsync -a --delete "$target_path/frontend/dist"/ "$PUBLIC_WWW"/
  else
    log "WARNING: no frontend/dist in target release; public www left unchanged"
  fi

  if [[ -d "$target_path/static_published" ]]; then
    log "Restoring Django static from release snapshot"
    run_sudo rsync -a --delete "$target_path/static_published"/ "$STATIC_ROOT_LIVE"/
  else
    log "WARNING: no static_published in target release; live static left unchanged"
  fi

  atomic_switch_current "$target_path"

  if [[ "$RESTORE_DB" -eq 1 ]]; then
    cp -a "$backup" "$DB_PATH"
    log "Database restored from $backup"
  fi

  restart_service
  health_check || die "rollback completed but health checks failed"
  log "Rollback succeeded: $target_id"
}

parse_args() {
  [[ $# -gt 0 ]] || usage 1
  COMMAND=$1
  shift || true

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes|-y) YES=1 ;;
      --skip-pull) SKIP_PULL=1 ;;
      --allow-dirty) ALLOW_DIRTY=1 ;;
      --restore-db) RESTORE_DB=1 ;;
      --keep-releases)
        shift
        KEEP_RELEASES=${1:-}
        [[ -n "$KEEP_RELEASES" ]] || die "--keep-releases needs a number"
        ;;
      -h|--help) usage 0 ;;
      *)
        if [[ "$COMMAND" == "rollback" && -z "$ROLLBACK_TARGET" && "$1" != --* ]]; then
          ROLLBACK_TARGET=$1
        else
          die "unknown argument: $1"
        fi
        ;;
    esac
    shift || true
  done
}

main() {
  parse_args "$@"
  case "$COMMAND" in
    deploy)   cmd_deploy ;;
    rollback) cmd_rollback ;;
    status)   cmd_status ;;
    health)   cmd_health ;;
    -h|--help|help) usage 0 ;;
    *) die "unknown command: $COMMAND (use deploy|rollback|status|health)" ;;
  esac
}

main "$@"
