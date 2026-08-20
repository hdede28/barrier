"""Helpers for building small throwaway PDFs in tests."""
from __future__ import annotations

from pathlib import Path

import pikepdf


def make_pdf(path: Path, num_pages: int = 1, size: tuple[float, float] = (200, 300)) -> Path:
    pdf = pikepdf.new()
    for _ in range(num_pages):
        pdf.add_blank_page(page_size=size)
    pdf.save(path)
    pdf.close()
    return path
