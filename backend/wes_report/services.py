from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import base64
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from .schemas import ReportData

PACKAGE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = PACKAGE_DIR / "templates"
STYLE_DIR = PACKAGE_DIR / "static" / "css"
VENDOR_DIR = PACKAGE_DIR / "static" / "vendor"
IMAGE_DIR = PACKAGE_DIR / "static" / "images"
REPORT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
CLINICAL_V2_LEGACY_FIELDS = {
    "project_description", "result_summary", "quality_metrics", "coverage_chart",
    "variants", "interpretations", "methods", "limitations", "references",
    "notices", "chapters", "charts",
}


def report_storage_payload(data: ReportData) -> dict[str, Any]:
    """Return the compact JSON contract used by the selected report template."""
    if data.layout.document_type == "clinical_v2":
        return data.model_dump(
            mode="json",
            exclude=CLINICAL_V2_LEGACY_FIELDS,
            exclude_none=True,
        )
    return data.model_dump(mode="json", exclude_none=True)


def load_report_data(path: str | Path) -> ReportData:
    source = Path(path)
    with source.open("r", encoding="utf-8") as stream:
        payload = _merge_legacy_table_chunks(json.load(stream))
    return ReportData.model_validate(payload)


def _merge_legacy_table_chunks(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Upgrade old fixed-page table chunks to one continuous logical table.

    Older clinical_v2 JSON split a long table into multiple anonymous sections.
    Loading now joins only those unambiguous continuation chunks; unrelated tables
    and user-authored sections remain untouched.
    """
    result = deepcopy(dict(payload))
    for module in result.values():
        if not isinstance(module, dict) or not isinstance(module.get("sections"), list):
            continue
        merged_sections: list[dict[str, Any]] = []
        for current in module["sections"]:
            previous = merged_sections[-1] if merged_sections else None
            current_tables = current.get("tables") if isinstance(current, dict) else None
            previous_tables = previous.get("tables") if isinstance(previous, dict) else None
            is_continuation = (
                isinstance(previous, dict)
                and isinstance(current, dict)
                and not current.get("number")
                and current.get("show_heading") is False
                and current.get("title") == previous.get("title")
                and isinstance(current_tables, list)
                and isinstance(previous_tables, list)
                and len(current_tables) == len(previous_tables) == 1
                and current_tables[0].get("columns") == previous_tables[0].get("columns")
                and current_tables[0].get("title") == previous_tables[0].get("title")
                and current_tables[0].get("css_class") == previous_tables[0].get("css_class")
            )
            if not is_continuation:
                merged_sections.append(current)
                continue
            previous_tables[0].setdefault("rows", []).extend(current_tables[0].get("rows", []))
            for field in ("paragraphs", "bullets", "notes"):
                existing = previous.setdefault(field, [])
                for value in current.get(field, []):
                    if value not in existing:
                        existing.append(value)
        module["sections"] = merged_sections
    return result


def validate_report_id(report_id: str) -> str:
    if not REPORT_ID_PATTERN.fullmatch(report_id):
        raise ValueError("报告 ID 只能包含字母、数字、下划线和连字符")
    return report_id


def current_report_path(data_root: str | Path, report_id: str) -> Path:
    return Path(data_root) / validate_report_id(report_id) / "current.json"


def save_report_data(
    data_root: str | Path,
    report_id: str,
    report_data: ReportData | Mapping[str, Any],
) -> tuple[Path, Path | None]:
    data = (
        report_data
        if isinstance(report_data, ReportData)
        else ReportData.model_validate(report_data)
    )
    target = current_report_path(data_root, report_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    history_dir = target.parent / "history"
    backup = None
    if target.exists():
        history_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup = history_dir / f"{stamp}.json"
        shutil.copy2(target, backup)

    payload = json.dumps(report_storage_payload(data), ensure_ascii=False, indent=2)
    temporary = target.with_suffix(".json.tmp")
    temporary.write_text(payload + "\n", encoding="utf-8")
    os.replace(temporary, target)
    return target, backup


def _environment() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(("html", "xml")),
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def _brand_assets() -> dict[str, str]:
    """Return self-contained data URIs for HTML preview, export and PDF."""
    files = {
        "logo": ("gaomei-logo.png", "image/png"),
        "qr": ("gaomei-qr.jpg", "image/jpeg"),
        "seal": ("gaomei-seal.png", "image/png"),
    }
    return {
        key: f"data:{mime};base64,{base64.b64encode((IMAGE_DIR / name).read_bytes()).decode('ascii')}"
        for key, (name, mime) in files.items()
    }


def render_report_html(
    report_data: ReportData | Mapping[str, Any],
    *,
    pdf_mode: bool = False,
    pdf_url: str = "",
    edit_url: str = "",
    template_preview: bool = False,
    embedded: bool = False,
) -> str:
    data = (
        report_data
        if isinstance(report_data, ReportData)
        else ReportData.model_validate(report_data)
    )
    template = _environment().get_template("report.html")
    styles = {
        "common": (STYLE_DIR / "common.css").read_text(encoding="utf-8"),
        "screen": (STYLE_DIR / "screen.css").read_text(encoding="utf-8"),
        "print": (STYLE_DIR / "print.css").read_text(encoding="utf-8"),
    }
    context_data = data.model_dump()
    context_data["coverage_chart_rendered"] = _coverage_chart_geometry(
        context_data.get("coverage_chart", [])
    )
    chart_scripts = {"echarts": "", "d3": ""}
    if (data.charts and data.charts.enabled) or data.quality_control:
        chart_scripts = {
            "echarts": (VENDOR_DIR / "echarts-6.1.0.min.js").read_text(encoding="utf-8").replace("</script", "<\\/script"),
            "d3": (VENDOR_DIR / "d3-7.9.0.min.js").read_text(encoding="utf-8").replace("</script", "<\\/script"),
        }
    return template.render(
        data=context_data,
        assets=_brand_assets(),
        styles=styles,
        pdf_mode=pdf_mode,
        pdf_url=pdf_url,
        edit_url=edit_url,
        template_preview=template_preview,
        embedded=embedded,
        chart_scripts=chart_scripts,
    )


DESIGN_PAGE_NAMES = {"cover", "executive-message", "divider", "back-cover"}


def render_design_page_html(
    report_data: ReportData | Mapping[str, Any], page_name: str
) -> str:
    """Render one editable, standalone design page with embedded brand assets."""
    if page_name not in DESIGN_PAGE_NAMES:
        raise ValueError("不支持的独立设计页面")
    data = (
        report_data
        if isinstance(report_data, ReportData)
        else ReportData.model_validate(report_data)
    )
    template = _environment().get_template("design_page.html")
    return template.render(
        data=data.model_dump(),
        assets=_brand_assets(),
        page_name=page_name,
        styles={
            "common": (STYLE_DIR / "common.css").read_text(encoding="utf-8"),
            "screen": (STYLE_DIR / "screen.css").read_text(encoding="utf-8"),
        },
    )


def render_editor_html(
    report_data: ReportData,
    *,
    preview_html: str,
    report_id: str,
    csrf_token: str,
    urls: Mapping[str, str],
) -> str:
    template_name = "editor_v2.html" if report_data.layout.document_type == "clinical_v2" else "editor.html"
    template = _environment().get_template(template_name)
    editor_style = (STYLE_DIR / "editor.css").read_text(encoding="utf-8")
    return template.render(
        data=report_storage_payload(report_data),
        preview_html=preview_html,
        report_id=report_id,
        csrf_token=csrf_token,
        urls=dict(urls),
        editor_style=editor_style,
    )


def _coverage_chart_geometry(points: list[dict[str, object]]) -> list[dict[str, object]]:
    """Convert numeric chart values into SVG geometry shared by HTML and PDF."""
    if not points:
        return []
    chart_left = 140
    chart_top = 35
    chart_width = 485
    chart_height = 155
    bar_width = min(105, chart_width / max(len(points), 1) * 0.55)
    gap = chart_width / max(len(points), 1)
    rendered = []
    for index, point in enumerate(points):
        value = float(point["value"])
        height = chart_height * value / 100
        rendered.append(
            {
                "label": point["label"],
                "value": f"{value:g}%",
                "x": round(chart_left + index * gap + (gap - bar_width) / 2, 2),
                "y": round(chart_top + chart_height - height, 2),
                "width": round(bar_width, 2),
                "height": round(height, 2),
                "label_x": round(chart_left + index * gap + gap / 2, 2),
            }
        )
    return rendered


def write_html(
    report_data: ReportData | Mapping[str, Any], output_path: str | Path
) -> Path:
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render_report_html(report_data), encoding="utf-8")
    return target


def write_pdf(
    report_data: ReportData | Mapping[str, Any], output_path: str | Path
) -> Path:
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Chromium on Windows requires the print target itself to end in .pdf.
    # Keep the atomic replacement while using a browser-compatible suffix.
    temporary = target.with_name(f"{target.stem}.tmp.pdf")
    temporary.unlink(missing_ok=True)
    html = render_report_html(report_data, pdf_mode=True)
    try:
        if os.name == "nt" and os.environ.get("WES_REPORT_FORCE_WEASYPRINT") != "1":
            _write_pdf_with_browser(html, temporary)
        else:
            try:
                from weasyprint import HTML

                HTML(string=html, base_url=str(PACKAGE_DIR)).write_pdf(
                    temporary,
                    pdf_variant="pdf/a-3u",
                    custom_metadata=True,
                )
            except OSError as error:
                if os.name != "nt":
                    raise RuntimeError("WeasyPrint 原生依赖不可用") from error
                _write_pdf_with_browser(html, temporary)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def _find_browser() -> Path:
    candidates = [
        Path(os.environ.get("WES_REPORT_BROWSER", "")),
        # Chrome's headless PDF mode is more reliable than recent Edge builds
        # when invoked from a Django/CLI child process on Windows.
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ]
    for candidate in candidates:
        if str(candidate) and candidate.is_file():
            return candidate
    discovered = shutil.which("msedge") or shutil.which("chrome")
    if discovered:
        return Path(discovered)
    raise RuntimeError(
        "未找到 WeasyPrint 原生依赖，也未找到 Edge/Chrome。"
        "可通过 WES_REPORT_BROWSER 指定浏览器路径。"
    )


def _write_pdf_with_browser(html: str, target: Path) -> None:
    browser = _find_browser()
    temp_root = PACKAGE_DIR.parent / "tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="browser-pdf-", dir=temp_root) as folder:
        workdir = Path(folder)
        html_path = workdir / "report.html"
        profile_path = workdir / "browser-profile"
        html_path.write_text(html, encoding="utf-8")
        command = [
            str(browser),
            "--headless=new",
            "--disable-gpu",
            "--disable-extensions",
            "--allow-file-access-from-files",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=4000",
            "--no-pdf-header-footer",
            f"--user-data-dir={profile_path}",
            f"--print-to-pdf={target.resolve()}",
            html_path.resolve().as_uri(),
        ]
        completed = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        if completed.returncode != 0 or not target.exists():
            details = (completed.stderr or completed.stdout).strip()
            raise RuntimeError(f"浏览器 PDF 导出失败：{details}")
