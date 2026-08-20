from __future__ import annotations

from pathlib import Path

import pikepdf

from .schemas_types import OpResult


def reorder_pdf(input_path: Path, order: list[int], output_path: Path) -> OpResult:
    with pikepdf.open(input_path) as src:
        total = len(src.pages)
        if sorted(order) != list(range(1, total + 1)):
            raise ValueError(
                f"Order must be a permutation of all {total} pages (1-based); got {order!r}"
            )
        dst = pikepdf.new()
        for page_num in order:
            dst.pages.append(src.pages[page_num - 1])
        dst.save(output_path)
        dst.close()
    return OpResult(output_path=str(output_path))
