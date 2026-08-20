"""Best-effort redaction.

Draws an opaque rectangle over each requested region (so nothing is
*visible*) and additionally attempts to strip text-showing operators whose
origin falls inside a region, so the text is not trivially copy/pasteable
either. The text-stripping pass is a heuristic based on tracking the
current text matrix through BT/ET, Tm, Td, and TD operators; it does not
handle every possible content-stream structure (e.g. text inside nested
XObjects, or positioning via unusual operator sequences).

This is NOT a guarantee of forensic-grade redaction. Treat it as raising the
bar against casual inspection, not as sufficient for legally or physically
sensitive material -- verify manually before sharing a redacted file outside
your own machine.
"""
from __future__ import annotations

import io
from pathlib import Path

import pikepdf
from reportlab.pdfgen import canvas

from .schemas_types import OpResult


def _redaction_overlay_bytes(width: float, height: float, boxes_pdf_coords: list[tuple[float, float, float, float]]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.setFillColorRGB(0, 0, 0)
    for (x, y, w, h) in boxes_pdf_coords:
        c.rect(x, y, w, h, fill=1, stroke=0)
    c.showPage()
    c.save()
    return buf.getvalue()


def _to_pdf_box(x: float, y: float, w: float, h: float, page_w: float, page_h: float) -> tuple[float, float, float, float]:
    # Input is normalized [0,1] with origin top-left; PDF space has origin bottom-left.
    px = x * page_w
    pw = w * page_w
    ph = h * page_h
    py = page_h - (y * page_h) - ph
    return px, py, pw, ph


def _strip_text_in_boxes(pdf: pikepdf.Pdf, page: pikepdf.Page, boxes: list[tuple[float, float, float, float]]) -> bool:
    """Remove text-showing operators whose current text origin lies in a box.
    Returns True if anything was stripped."""

    def in_any_box(px: float, py: float) -> bool:
        return any(bx <= px <= bx + bw and by <= py <= by + bh for (bx, by, bw, bh) in boxes)

    try:
        instructions = pikepdf.parse_content_stream(page)
    except Exception:
        return False

    new_instructions = []
    tx, ty = 0.0, 0.0
    stripped = False
    in_text = False
    for instr in instructions:
        op = str(instr.operator)
        operands = instr.operands
        if op == "BT":
            tx, ty = 0.0, 0.0
            in_text = True
            new_instructions.append(instr)
        elif op == "ET":
            in_text = False
            new_instructions.append(instr)
        elif op == "Tm" and len(operands) == 6:
            tx, ty = float(operands[4]), float(operands[5])
            new_instructions.append(instr)
        elif op in ("Td", "TD") and len(operands) == 2:
            tx += float(operands[0])
            ty += float(operands[1])
            new_instructions.append(instr)
        elif in_text and op in ("Tj", "TJ", "'", '"'):
            if in_any_box(tx, ty):
                stripped = True
                continue  # drop this text-showing operator entirely
            new_instructions.append(instr)
        else:
            new_instructions.append(instr)

    if stripped:
        new_stream = pikepdf.unparse_content_stream(new_instructions)
        page.obj.Contents = pdf.make_stream(new_stream)
    return stripped


def redact_pdf(input_path: Path, regions: list[dict], output_path: Path) -> OpResult:
    warnings: list[str] = [
        "Redaction is best-effort: opaque boxes were drawn and underlying text was stripped where detected. "
        "Verify manually before sharing this file outside your own machine.",
    ]
    by_page: dict[int, list[dict]] = {}
    for r in regions:
        by_page.setdefault(int(r["page"]), []).append(r)

    with pikepdf.open(input_path) as pdf:
        total = len(pdf.pages)
        for page_num, regs in by_page.items():
            if page_num < 1 or page_num > total:
                raise ValueError(f"Page {page_num} is out of bounds for a {total}-page document")
            page = pdf.pages[page_num - 1]
            box = page.mediabox
            page_w = float(box[2]) - float(box[0])
            page_h = float(box[3]) - float(box[1])
            pdf_boxes = [
                _to_pdf_box(r["x"], r["y"], r["w"], r["h"], page_w, page_h) for r in regs
            ]

            any_stripped = _strip_text_in_boxes(pdf, page, pdf_boxes)
            if not any_stripped:
                warnings.append(
                    f"Page {page_num}: could not confirm underlying text removal; relying on the opaque overlay."
                )

            overlay_bytes = _redaction_overlay_bytes(page_w, page_h, pdf_boxes)
            with pikepdf.open(io.BytesIO(overlay_bytes)) as overlay_pdf:
                page.add_overlay(overlay_pdf.pages[0])

        pdf.save(output_path)

    return OpResult(output_path=str(output_path), warnings=warnings)
