from __future__ import annotations

from pathlib import Path

import pypdfium2 as pdfium


def page_count(path: Path) -> int:
    doc = pdfium.PdfDocument(str(path))
    try:
        return len(doc)
    finally:
        doc.close()


def render_page_png(path: Path, page_number: int, out_path: Path, scale: float = 1.5) -> Path:
    """Render a single 1-based page to a PNG thumbnail."""
    doc = pdfium.PdfDocument(str(path))
    try:
        if page_number < 1 or page_number > len(doc):
            raise ValueError(f"Page {page_number} is out of bounds for a {len(doc)}-page document")
        page = doc[page_number - 1]
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        pil_image.save(out_path, format="PNG")
        return out_path
    finally:
        doc.close()
