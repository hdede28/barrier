"""Flatten completed signature fields into a PDF and produce a sealed
version. This is a typed-signature flow only -- no handwriting capture, no
cryptographic PKI signature, no qualified/regulated electronic signature."""
from __future__ import annotations

import io
from pathlib import Path

import pikepdf
from reportlab.pdfgen import canvas

from .schemas_types import OpResult


def _field_overlay_bytes(width: float, height: float, fields: list[dict]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    for f in fields:
        x = f["x"] * width
        w = f["w"] * width
        h = f["h"] * height
        y = height - (f["y"] * height) - h  # normalized top-left -> PDF bottom-left
        value = f.get("value") or ""
        font_size = max(8, min(h * 0.6, 22))
        c.setFillColorRGB(0.05, 0.05, 0.4)
        if f["field_type"] == "signature":
            c.setFont("Helvetica-Oblique", font_size)
        else:
            c.setFont("Helvetica", font_size)
        c.drawString(x + 2, y + h / 2 - font_size / 3, value[:120])
        c.setStrokeColorRGB(0.4, 0.4, 0.4)
        c.setLineWidth(0.5)
        c.line(x, y, x + w, y)
    c.showPage()
    c.save()
    return buf.getvalue()


def flatten_signature_fields(input_path: Path, fields: list[dict], output_path: Path) -> OpResult:
    by_page: dict[int, list[dict]] = {}
    for f in fields:
        by_page.setdefault(int(f["page_number"]), []).append(f)

    with pikepdf.open(input_path) as pdf:
        total = len(pdf.pages)
        for page_num, page_fields in by_page.items():
            if page_num < 1 or page_num > total:
                raise ValueError(f"Page {page_num} is out of bounds for a {total}-page document")
            page = pdf.pages[page_num - 1]
            box = page.mediabox
            width = float(box[2]) - float(box[0])
            height = float(box[3]) - float(box[1])
            overlay_bytes = _field_overlay_bytes(width, height, page_fields)
            with pikepdf.open(io.BytesIO(overlay_bytes)) as overlay_pdf:
                page.add_overlay(overlay_pdf.pages[0])
        pdf.save(output_path)

    return OpResult(
        output_path=str(output_path),
        warnings=[
            "This is a typed electronic signature for personal/internal use only -- it is not a qualified or "
            "government-verified electronic signature and has no independent legal evidentiary weight.",
        ],
    )
