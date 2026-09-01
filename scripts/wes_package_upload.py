#!/usr/bin/env python3
"""Upload a clinical_v2 WES package to cloud (Windows / macOS / Linux / node9).

Cloud generates HTML+PDF. Do NOT upload a PDF from the client.

Examples (PowerShell / cmd / bash):

  set GAOMEI_BRIDGE_TOKEN=your-plaintext-token
  python scripts/wes_package_upload.py ^
    --dir backend/wes_report_examples/clinical_v2_demo ^
    --patient-no P20260001 ^
    --patient-name 测试患者 ^
    --sample-id SH05677

  $env:GAOMEI_BRIDGE_TOKEN = "your-plaintext-token"
  python scripts/wes_package_upload.py `
    --dir backend/wes_report_examples/clinical_v2_demo `
    --patient-no P20260001 `
    --patient-name "测试患者" `
    --sample-id SH05677
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path


DEFAULT_API = "https://gomics.icu/api/bridge/reports/package/"
SKIP_NAMES = {"current.json"}


def _multipart_encode(fields: dict[str, str], files: list[tuple[str, Path]]) -> tuple[bytes, str]:
    boundary = f"----GaomeiBoundary{os.urandom(8).hex()}"
    lines: list[bytes] = []

    def add_field(name: str, value: str) -> None:
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        lines.append(value.encode("utf-8"))
        lines.append(b"\r\n")

    def add_file(field: str, path: Path, filename: str) -> None:
        data = path.read_bytes()
        lines.append(f"--{boundary}\r\n".encode())
        lines.append(
            (
                f'Content-Disposition: form-data; name="{field}"; '
                f'filename="{filename}"\r\n'
                f"Content-Type: application/octet-stream\r\n\r\n"
            ).encode()
        )
        lines.append(data)
        lines.append(b"\r\n")

    for key, value in fields.items():
        add_field(key, value)
    for field, path in files:
        add_file(field, path, path.name)
    lines.append(f"--{boundary}--\r\n".encode())
    body = b"".join(lines)
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type


def collect_package_files(package_dir: Path) -> list[Path]:
    report = package_dir / "report.json"
    if not report.is_file():
        raise SystemExit(f"Missing report.json in {package_dir}")
    extras = sorted(
        p
        for p in package_dir.iterdir()
        if p.is_file() and p.name not in SKIP_NAMES and p.name != "report.json"
    )
    return [report, *extras]


def build_manifest(patient_no: str, patient_name: str, sample_id: str, files: list[Path]) -> str:
    entries = []
    for path in files:
        role = "report_json" if path.name == "report.json" else "attachment"
        entries.append({"name": path.name, "role": role})
    return json.dumps(
        {
            "schema_version": "wes_package_v1",
            "patient_no": patient_no,
            "patient_name": patient_name,
            "sample_id": sample_id,
            "files": entries,
        },
        ensure_ascii=False,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload WES report package to Gaomei cloud")
    parser.add_argument("--dir", required=True, help="Package directory containing report.json")
    parser.add_argument("--patient-no", required=True)
    parser.add_argument("--patient-name", default="")
    parser.add_argument("--sample-id", required=True)
    parser.add_argument("--upload-id", default="")
    parser.add_argument("--node-id", default="node9-wes-executor")
    parser.add_argument("--api", default=os.environ.get("GAOMEI_PACKAGE_API", DEFAULT_API))
    args = parser.parse_args()

    token = os.environ.get("GAOMEI_BRIDGE_TOKEN", "").strip()
    if not token:
        print("Set env GAOMEI_BRIDGE_TOKEN to the plaintext Bridge token.", file=sys.stderr)
        return 1

    package_dir = Path(args.dir).expanduser().resolve()
    files = collect_package_files(package_dir)
    upload_id = args.upload_id or f"upload-{args.sample_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    manifest = build_manifest(args.patient_no, args.patient_name, args.sample_id, files)

    fields = {
        "upload_id": upload_id,
        "node_id": args.node_id,
        "patient_no": args.patient_no,
        "patient_name": args.patient_name,
        "sample_id": args.sample_id,
        "manifest": manifest,
    }
    body, content_type = _multipart_encode(fields, [("files", p) for p in files])

    print(f"POST {args.api}")
    print(f"upload_id={upload_id} sample_id={args.sample_id} patient_no={args.patient_no}")
    print(f"files ({len(files)}): " + ", ".join(p.name for p in files))

    req = urllib.request.Request(
        args.api,
        data=body,
        method="POST",
        headers={
            "X-Gaomei-Bridge-Token": token,
            "Content-Type": content_type,
            "Content-Length": str(len(body)),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}", file=sys.stderr)
        print(raw, file=sys.stderr)
        return 2
    except urllib.error.URLError as exc:
        print(f"Network error: {exc}", file=sys.stderr)
        return 3

    try:
        payload = json.loads(raw)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    except json.JSONDecodeError:
        print(raw)
        return 4

    if status >= 400:
        return 2
    if not payload.get("pdf_ready"):
        print("Upload ok but pdf_ready is not true — check pdf_error.", file=sys.stderr)
        return 5

    preview = payload.get("preview_url") or ""
    portal = payload.get("portal_report_url") or ""
    igv = payload.get("portal_igv_url") or ""
    print()
    print("OK: package ingested.")
    if payload.get("pdf_ready"):
        print("PDF generated.")
    else:
        print("PDF not ready — check pdf_error.", file=sys.stderr)
    if preview:
        print(f"HTML preview (admin): https://gomics.icu{preview}")
    if portal:
        print(f"3D portal report:     https://gomics.icu{portal}")
    if igv:
        print(f"IGV evidence:         https://gomics.icu{igv}")
    return 0 if payload.get("pdf_ready") else 5


if __name__ == "__main__":
    raise SystemExit(main())
