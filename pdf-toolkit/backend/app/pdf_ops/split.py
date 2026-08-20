from __future__ import annotations

from pathlib import Path

import pikepdf

from .schemas_types import OpResult


def split_pdf(input_path: Path, ranges: list[list[int]], output_dir: Path, base_name: str) -> list[Path]:
    """Split a PDF into one output file per [start, end] 1-based inclusive range.

    Returns the list of created file paths, one per range, in order.
    """
    if not ranges:
        raise ValueError("At least one page range is required")

    outputs: list[Path] = []
    with pikepdf.open(input_path) as src:
        total = len(src.pages)
        for idx, rng in enumerate(ranges, start=1):
            if len(rng) != 2:
                raise ValueError(f"Range {rng!r} must be [start, end]")
            start, end = rng
            if start < 1 or end > total or start > end:
                raise ValueError(f"Range {rng!r} is out of bounds for a {total}-page document")
            dst = pikepdf.new()
            dst.pages.extend(src.pages[start - 1 : end])
            out_path = output_dir / f"{base_name}_part{idx}.pdf"
            dst.save(out_path)
            dst.close()
            outputs.append(out_path)
    return outputs
