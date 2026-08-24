#!/usr/bin/env bash
# Generate a new Bridge plaintext token + SHA256 for cloud env.
# Store the PLAINTEXT only on node9 / your laptop (never commit it).
# Put only the SHA256 into gaomei-web.env on the cloud server.
set -euo pipefail

TOKEN="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
HASH="$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')"

echo "=== Keep this PLAINTEXT on node9 / local only ==="
echo "GAOMEI_BRIDGE_TOKEN=${TOKEN}"
echo
echo "=== Put this HASH into cloud env (gaomei-web.env) ==="
echo "GAOMEI_BRIDGE_TOKEN_SHA256=${HASH}"
echo
echo "Then on cloud:"
echo "  1) edit /home/ubuntu/apps/gaomei_web/shared/gaomei-web.env"
echo "  2) sudo systemctl restart gaomei-web"
echo "  3) export GAOMEI_BRIDGE_TOKEN='...' on node9 and run wes_package_upload.sh"
