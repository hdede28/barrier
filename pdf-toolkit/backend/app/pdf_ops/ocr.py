from __future__ import annotations

from pathlib import Path

import ocrmypdf

from .schemas_types import OpResult


class OcrUnavailableError(RuntimeError):
    """Raised when the OCR engine (tesseract) is not installed/reachable."""


def ocr_pdf(input_path: Path, language: str, output_path: Path) -> OpResult:
    try:
        ocrmypdf.ocr(
            str(input_path),
            str(output_path),
            language=language or "eng",
            skip_text=True,  # keep any existing text layer, only OCR image-only pages
            progress_bar=False,
            optimize=1,
        )
    except ocrmypdf.exceptions.MissingDependencyError as exc:
        raise OcrUnavailableError(
            "OCR is unavailable: tesseract (or a required OCR dependency) is not installed on this machine."
        ) from exc
    except ocrmypdf.exceptions.PriorOcrFoundError:
        # Nothing to do -- file already has a text layer on every page.
        output_path.write_bytes(input_path.read_bytes())
        return OpResult(output_path=str(output_path), warnings=["Document already had a text layer; OCR was skipped."])
    except Exception as exc:  # ocrmypdf raises a variety of typed errors
        raise RuntimeError(f"OCR failed: {exc}") from exc

    return OpResult(
        output_path=str(output_path),
        warnings=["A searchable text layer was added over image-only pages."],
    )
