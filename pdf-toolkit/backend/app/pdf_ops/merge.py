from __future__ import annotations

from pathlib import Path

import pikepdf

from .schemas_types import OpResult


def merge_pdfs(input_paths: list[Path], output_path: Path) -> OpResult:
    if len(input_paths) < 2:
        raise ValueError("Merge requires at least two input files")

    warnings: list[str] = []
    dst = pikepdf.new()
    for p in input_paths:
        with pikepdf.open(p) as src:
            if src.is_encrypted:
                warnings.append(f"{p.name}: encryption removed during merge")
            dst.pages.extend(src.pages)
    dst.save(output_path)
    dst.close()
    return OpResult(output_path=str(output_path), warnings=warnings)
