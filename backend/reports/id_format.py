"""Canonical ID formats for Patient / Report / Sample (Data V2).

External login usernames (zhangsan, analyst1, …) are separate from these IDs.

Formats:
  patient_no     GM-P-NNN
  report_number  GM-R-NNN
  sample_id      GMNN   (also used as wes_report_id / disk folder name)
"""
from __future__ import annotations

import re
from django.db.models import Max

PATIENT_RE = re.compile(r"^GM-P-(\d{3,})$", re.I)
REPORT_RE = re.compile(r"^GM-R-(\d{3,})$", re.I)
SAMPLE_RE = re.compile(r"^GM(\d{2,})$", re.I)


def normalize_patient_no(value: str) -> str:
    return (value or "").strip().upper()


def normalize_report_number(value: str) -> str:
    return (value or "").strip().upper()


def normalize_sample_id(value: str) -> str:
    return (value or "").strip().upper()


def _next_int(existing: list[int], width: int) -> str:
    n = (max(existing) + 1) if existing else 1
    return str(n).zfill(width)


def next_patient_no() -> str:
    from reports.models import Patient

    nums: list[int] = []
    for raw in Patient.objects.values_list("patient_no", flat=True):
        m = PATIENT_RE.match(str(raw or ""))
        if m:
            nums.append(int(m.group(1)))
    return f"GM-P-{_next_int(nums, 3)}"


def next_report_number() -> str:
    from reports.models import Report

    nums: list[int] = []
    for raw in Report.objects.values_list("report_number", flat=True):
        m = REPORT_RE.match(str(raw or ""))
        if m:
            nums.append(int(m.group(1)))
    return f"GM-R-{_next_int(nums, 3)}"


def next_sample_id() -> str:
    """Next GM## sample / wes_report_id."""
    from reports.models import Report

    nums: list[int] = []
    for raw in Report.objects.values_list("sample_id", flat=True):
        m = SAMPLE_RE.match(str(raw or ""))
        if m:
            nums.append(int(m.group(1)))
    # also scan analysis_data wes ids is expensive; sample_id is enough for seed/ingest
    return f"GM{_next_int(nums, 2)}"


def allocate_ids(
    *,
    patient_no: str = "",
    report_number: str = "",
    sample_id: str = "",
) -> dict[str, str]:
    """Fill missing IDs with next canonical values; normalize provided ones."""
    out = {
        "patient_no": normalize_patient_no(patient_no) or next_patient_no(),
        "report_number": normalize_report_number(report_number) or next_report_number(),
        "sample_id": normalize_sample_id(sample_id) or next_sample_id(),
    }
    return out
