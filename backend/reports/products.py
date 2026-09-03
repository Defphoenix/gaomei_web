"""Product catalog for portal display and report template routing."""
from __future__ import annotations

# code → display / template keys
PRODUCT_CATALOG: dict[str, dict[str, str]] = {
    "WES_TN": {
        "label": "WES 肿瘤-正常",
        "short": "WES",
        "document_type": "clinical_v2",
        "template": "report.html",
    },
    "GENE_PANEL": {
        "label": "靶向基因 Panel",
        "short": "Panel",
        "document_type": "panel_v1",
        "template": "report.html",
    },
    "LUNG_PANEL": {
        "label": "肺癌 Panel",
        "short": "肺癌Panel",
        "document_type": "panel_v1",
        "template": "report.html",
    },
}

DEFAULT_PRODUCT_CODE = "WES_TN"


def normalize_product_code(value: str | None) -> str:
    code = str(value or "").strip().upper()
    return code if code in PRODUCT_CATALOG else (code or DEFAULT_PRODUCT_CODE)


def product_label(code: str | None) -> str:
    raw = str(code or "").strip()
    meta = PRODUCT_CATALOG.get(raw.upper()) or PRODUCT_CATALOG.get(raw)
    if meta:
        return meta["label"]
    return raw or "未指定产品"


def document_type_for_product(code: str | None) -> str:
    meta = PRODUCT_CATALOG.get(normalize_product_code(code), {})
    return meta.get("document_type") or "clinical_v2"
