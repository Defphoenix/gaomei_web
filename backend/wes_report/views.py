from __future__ import annotations

import json
from copy import deepcopy
from html import escape
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST
from pydantic import ValidationError

from .schemas import ReportData
from .services import (
    STYLE_DIR,
    TEMPLATE_DIR,
    current_report_path,
    load_report_data,
    render_editor_html,
    render_design_page_html,
    render_report_html,
    report_storage_payload,
    save_report_data,
    validate_report_id,
    write_pdf,
)


def _data_path(report_id: str) -> Path:
    try:
        current = current_report_path(settings.WES_REPORT_DATA_DIR, report_id)
    except ValueError as error:
        raise Http404(str(error)) from error
    if current.exists():
        return current
    if report_id == "sample":
        return Path(settings.WES_REPORT_EXAMPLE_DIR) / "sample_report.json"
    raise Http404("报告数据不存在")


def _load_data(report_id: str) -> ReportData:
    """Load saved data and apply additive sample-template migrations."""
    source = _data_path(report_id)
    data = load_report_data(source)
    if report_id == "sample" and (not data.chapters or data.charts is None):
        example = load_report_data(Path(settings.WES_REPORT_EXAMPLE_DIR) / "sample_report.json")
        payload = data.model_dump(mode="json")
        defaults = example.model_dump(mode="json")
        if not data.chapters:
            payload["chapters"] = defaults["chapters"]
        if data.charts is None:
            payload["charts"] = defaults["charts"]
        data = ReportData.model_validate(payload)
    return data


def _request_payload(request) -> dict:
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("请求内容不是有效 JSON") from error
    if not isinstance(payload, dict):
        raise ValueError("报告数据必须是 JSON 对象")
    return payload


def _validation_error(error: Exception) -> JsonResponse:
    if isinstance(error, ValidationError):
        details = error.errors(include_url=False)
    else:
        details = [{"msg": str(error)}]
    return JsonResponse({"ok": False, "errors": details}, status=400)


def home(request):
    return HttpResponse(
        '<meta charset="utf-8"><title>高美 WES 报告</title>'
        '<div style="font-family:sans-serif;max-width:720px;margin:80px auto">'
        '<h1>高美基因 WES 报告生成器</h1>'
        '<p><a href="/reports/sample/">打开示例报告</a></p>'
        '<p><a href="/reports/sample/edit/">编辑示例报告数据</a></p>'
        '<p><a href="/template-source/">打开模板样式预览</a></p>'
        '<p><a href="/template-source/raw/">查看 Jinja2 原始源码</a></p></div>'
    )


def report_preview(request, report_id: str):
    data = _load_data(report_id)
    html = render_report_html(
        data,
        pdf_url=reverse("wes_report:pdf", kwargs={"report_id": report_id}),
        edit_url=reverse("wes_report:edit", kwargs={"report_id": report_id}),
    )
    return HttpResponse(html)


@require_GET
def report_edit(request, report_id: str):
    data = _load_data(report_id)
    preview = render_report_html(data, embedded=True)
    urls = {
        "preview": reverse("wes_report:preview", kwargs={"report_id": report_id}),
        "render": reverse("wes_report:render", kwargs={"report_id": report_id}),
        "save": reverse("wes_report:save", kwargs={"report_id": report_id}),
        "pdf": reverse("wes_report:pdf", kwargs={"report_id": report_id}),
        "design_cover": reverse("wes_report:design_page", kwargs={"report_id": report_id, "page_name": "cover"}),
        "design_message": reverse("wes_report:design_page", kwargs={"report_id": report_id, "page_name": "executive-message"}),
        "design_divider": reverse("wes_report:design_page", kwargs={"report_id": report_id, "page_name": "divider"}),
        "design_back": reverse("wes_report:design_page", kwargs={"report_id": report_id, "page_name": "back-cover"}),
    }
    html = render_editor_html(
        data,
        preview_html=preview,
        report_id=report_id,
        csrf_token=get_token(request),
        urls=urls,
    )
    return HttpResponse(html)


@require_GET
def report_design_page(request, report_id: str, page_name: str):
    data = _load_data(report_id)
    try:
        html = render_design_page_html(data, page_name)
    except ValueError as error:
        raise Http404(str(error)) from error
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    if request.GET.get("download") == "1":
        response["Content-Disposition"] = (
            f'attachment; filename="{report_id}-{page_name}.html"'
        )
    return response


@require_GET
def report_data(request, report_id: str):
    data = _load_data(report_id)
    return JsonResponse(report_storage_payload(data), json_dumps_params={"ensure_ascii": False})


@require_POST
def report_render(request, report_id: str):
    try:
        validate_report_id(report_id)
        payload = _request_payload(request)
        _data_path(report_id)
        data = ReportData.model_validate(payload)
    except (ValueError, ValidationError) as error:
        return _validation_error(error)
    return JsonResponse(
        {"ok": True, "html": render_report_html(data, embedded=True)},
        json_dumps_params={"ensure_ascii": False},
    )


@require_POST
def report_save(request, report_id: str):
    try:
        validate_report_id(report_id)
        payload = _request_payload(request)
        _data_path(report_id)
        data = ReportData.model_validate(payload)
        target, backup = save_report_data(settings.WES_REPORT_DATA_DIR, report_id, data)
    except (ValueError, ValidationError) as error:
        return _validation_error(error)
    return JsonResponse(
        {
            "ok": True,
            "message": "JSON 已保存，报告首页和 PDF 将使用最新数据。",
            "saved_file": target.name,
            "backup_file": backup.name if backup else None,
            "data": report_storage_payload(data),
        },
        json_dumps_params={"ensure_ascii": False},
    )


def report_pdf(request, report_id: str):
    data = _load_data(report_id)
    output = Path(settings.WES_REPORT_OUTPUT_DIR) / "pdf" / f"{report_id}.pdf"
    source = _data_path(report_id)
    # PDF generation is expensive and may be unavailable in a restricted
    # Windows server process. Serve the last successful PDF until the report
    # JSON changes; generation itself is atomic, so a failed attempt can never
    # corrupt the existing download.
    stale = not output.exists() or output.stat().st_mtime < source.stat().st_mtime
    if stale or request.GET.get("refresh") == "1":
        try:
            write_pdf(data, output)
        except RuntimeError as error:
            if not output.exists():
                return HttpResponse(
                    f"PDF 生成失败：{error}",
                    status=503,
                    content_type="text/plain; charset=utf-8",
                )
    return FileResponse(
        output.open("rb"),
        as_attachment=True,
        filename=f"{data.report.report_id}.pdf",
        content_type="application/pdf",
    )


def template_source(request):
    """Render the layout with explicit placeholder values for designers."""
    data = _load_data("sample")
    payload = deepcopy(data.model_dump())
    payload["report"]["report_id"] = "【模板预览-报告编号】"
    payload["sample"].update(
        {
            "sample_id": "【模板预览-样本编号】",
            "name": "【受检者姓名】",
            "clinical_diagnosis": "【临床信息】",
        }
    )
    payload["result_summary"] = "【这里显示由数据适配器生成的检测结果摘要】"
    payload["variants"][0].update(
        {
            "gene": "【基因】",
            "nucleotide_change": "【c.变异】",
            "classification": "【临床分类】",
        }
    )
    preview_data = type(data).model_validate(payload)
    html = render_report_html(preview_data, template_preview=True)
    return HttpResponse(html)


def template_source_raw(request):
    """Show raw Jinja2/CSS source without evaluating it."""
    template_text = (TEMPLATE_DIR / "report.html").read_text(encoding="utf-8")
    css_text = (STYLE_DIR / "common.css").read_text(encoding="utf-8")
    body = """<!doctype html><meta charset='utf-8'><title>Jinja2 模板源码</title>
    <style>body{margin:0;background:#17232b;color:#e6f2f4;font:14px/1.6 Consolas,monospace}header{position:sticky;top:0;padding:18px 28px;background:#0b536c;color:white;font-family:Arial,sans-serif}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px}section{min-width:0}h2{font:700 18px Arial,sans-serif;color:#78e0dc}pre{white-space:pre-wrap;overflow:auto;padding:18px;background:#0d171d;border:1px solid #2d4b56;border-radius:6px}a{color:#9df4ee}</style>
    <header><a href='/template-source/'>← 返回模板样式预览</a><h1>Jinja2 模板源码</h1><p>这里显示未经 JSON 渲染的模板和 CSS。</p></header>
    <main><section><h2>report.html</h2><pre>""" + escape(template_text) + """</pre></section><section><h2>common.css</h2><pre>""" + escape(css_text) + """</pre></section></main>"""
    return HttpResponse(body)
