from __future__ import annotations

import io
from pathlib import Path

import pikepdf
from reportlab.pdfgen import canvas

from .schemas_types import OpResult

_POSITIONS = {
    "center": (0, 0),
    "top": (0, 1),
    "bottom": (0, -1),
    "diagonal": (45, 0),
}


def _overlay_page_bytes(width: float, height: float, text: str, opacity: float, position: str) -> bytes:
    angle, y_bias = _POSITIONS.get(position, (0, 0))
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.saveState()
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.setFillAlpha(opacity)
    font_size = max(12, min(width, height) / 10)
    c.setFont("Helvetica-Bold", font_size)
    c.translate(width / 2, height / 2 + y_bias * (height / 3))
    c.rotate(angle)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.showPage()
    c.save()
    return buf.getvalue()


def watermark_pdf(input_path: Path, text: str, opacity: float, position: str, output_path: Path) -> OpResult:
    with pikepdf.open(input_path) as pdf:
        for page in pdf.pages:
            box = page.mediabox
            width = float(box[2]) - float(box[0])
            height = float(box[3]) - float(box[1])
            overlay_bytes = _overlay_page_bytes(width, height, text, opacity, position)
            with pikepdf.open(io.BytesIO(overlay_bytes)) as overlay_pdf:
                page.add_overlay(overlay_pdf.pages[0])
        pdf.save(output_path)
    return OpResult(
        output_path=str(output_path),
        warnings=["A visible watermark was added to every page; this cannot be undone on this output file."],
    )
