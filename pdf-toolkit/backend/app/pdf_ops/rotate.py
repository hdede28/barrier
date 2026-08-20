from __future__ import annotations

from pathlib import Path

import pikepdf

from .schemas_types import OpResult


def rotate_pdf(input_path: Path, angle: int, pages: list[int] | None, output_path: Path) -> OpResult:
    if angle not in (90, 180, 270, -90, -180, -270):
        raise ValueError("Angle must be one of 90, 180, 270 degrees")

    with pikepdf.open(input_path) as pdf:
        total = len(pdf.pages)
        targets = pages or list(range(1, total + 1))
        for p in targets:
            if p < 1 or p > total:
                raise ValueError(f"Page {p} is out of bounds for a {total}-page document")
            pdf.pages[p - 1].rotate(angle, relative=True)
        pdf.save(output_path)
    return OpResult(output_path=str(output_path))
