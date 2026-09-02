#!/usr/bin/env bash
# Upload WES package via V2 Ingest API Key.
#   export GAOMEI_INGEST_API_KEY='gm_...'
#   bash scripts/wes_package_upload.sh --dir backend/wes_report_examples/clinical_v2_demo \
#     --patient-no GM-P-010 --patient-name 测试 --sample-id GM10

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/wes_package_upload.py" "$@"
