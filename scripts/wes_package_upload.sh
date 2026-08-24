#!/usr/bin/env bash
# Upload a clinical_v2 WES package to cloud (node9 / local laptop).
# Cloud generates HTML+PDF. Do NOT upload a PDF.
#
# Usage:
#   export GAOMEI_BRIDGE_TOKEN='your-plaintext-token'
#   ./scripts/wes_package_upload.sh \
#     --dir backend/wes_report_examples/clinical_v2_demo \
#     --patient-no P20260001 \
#     --patient-name '测试患者' \
#     --sample-id SH05677 \
#     --upload-id "upload-SH05677-$(date +%Y%m%d-%H%M%S)"
#
# Optional:
#   --api https://gomics.icu/api/bridge/reports/package/
#   --node-id node9-wes-executor

set -euo pipefail

API="${GAOMEI_PACKAGE_API:-https://gomics.icu/api/bridge/reports/package/}"
NODE_ID="node9-wes-executor"
DIR=""
PATIENT_NO=""
PATIENT_NAME=""
SAMPLE_ID=""
UPLOAD_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --patient-no) PATIENT_NO="$2"; shift 2 ;;
    --patient-name) PATIENT_NAME="$2"; shift 2 ;;
    --sample-id) SAMPLE_ID="$2"; shift 2 ;;
    --upload-id) UPLOAD_ID="$2"; shift 2 ;;
    --api) API="$2"; shift 2 ;;
    --node-id) NODE_ID="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

: "${GAOMEI_BRIDGE_TOKEN:?Set GAOMEI_BRIDGE_TOKEN to the plaintext Bridge token}"
: "${DIR:?--dir is required}"
: "${PATIENT_NO:?--patient-no is required}"
: "${SAMPLE_ID:?--sample-id is required}"

DIR="$(cd "$DIR" && pwd)"
UPLOAD_ID="${UPLOAD_ID:-upload-${SAMPLE_ID}-$(date +%Y%m%d-%H%M%S)}"

REPORT_JSON="${DIR}/report.json"
if [[ ! -f "$REPORT_JSON" ]]; then
  echo "Missing report.json in $DIR" >&2
  exit 1
fi

# Collect optional BAM/BAI + any other attachments (skip current.json duplicate)
CURL_FILES=(-F "files=@${REPORT_JSON};filename=report.json")
MANIFEST_FILES='{"name":"report.json","role":"report_json"}'

add_file() {
  local path="$1" name role
  name="$(basename "$path")"
  case "$name" in
    report.json|current.json) return 0 ;;
    *.bam) role=attachment ;;
    *.bai) role=attachment ;;
    *) role=attachment ;;
  esac
  CURL_FILES+=(-F "files=@${path};filename=${name}")
  MANIFEST_FILES+=",{\"name\":\"${name}\",\"role\":\"${role}\"}"
}

shopt -s nullglob
for f in "$DIR"/*; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  [[ "$base" == "report.json" || "$base" == "current.json" ]] && continue
  add_file "$f"
done
shopt -u nullglob

MANIFEST=$(cat <<EOF
{"schema_version":"wes_package_v1","patient_no":"${PATIENT_NO}","patient_name":"${PATIENT_NAME}","sample_id":"${SAMPLE_ID}","files":[${MANIFEST_FILES}]}
EOF
)

echo "POST ${API}"
echo "upload_id=${UPLOAD_ID} sample_id=${SAMPLE_ID} patient_no=${PATIENT_NO}"
echo "files from: ${DIR}"

RESP=$(curl -sS -X POST "$API" \
  -H "X-Gaomei-Bridge-Token: ${GAOMEI_BRIDGE_TOKEN}" \
  -F "upload_id=${UPLOAD_ID}" \
  -F "node_id=${NODE_ID}" \
  -F "patient_no=${PATIENT_NO}" \
  -F "patient_name=${PATIENT_NAME}" \
  -F "sample_id=${SAMPLE_ID}" \
  -F "manifest=${MANIFEST}" \
  "${CURL_FILES[@]}")

echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

if echo "$RESP" | grep -q '"pdf_ready"[[:space:]]*:[[:space:]]*true'; then
  echo
  echo "OK: PDF generated."
  echo "Preview (admin login): https://gomics.icu$(echo "$RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("preview_url",""))' 2>/dev/null)"
else
  echo
  echo "Upload returned but pdf_ready is not true — check pdf_error in response." >&2
  exit 2
fi
