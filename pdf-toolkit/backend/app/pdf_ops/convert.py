from __future__ import annotations

import subprocess
from pathlib import Path

from .schemas_types import OpResult


class ConversionUnavailableError(RuntimeError):
    """Raised when LibreOffice headless is not installed/reachable."""


def convert_office_to_pdf(input_path: Path, output_dir: Path, soffice_bin: str, timeout: int = 120) -> OpResult:
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            [
                soffice_bin,
                "--headless",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_dir),
                str(input_path),
            ],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise ConversionUnavailableError(
            "Office-to-PDF conversion is unavailable: LibreOffice (soffice) is not installed on this machine."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Office-to-PDF conversion timed out.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr.strip() or result.stdout.strip()}")

    expected = output_dir / (input_path.stem + ".pdf")
    if not expected.exists():
        raise RuntimeError("LibreOffice reported success but no output PDF was found.")

    return OpResult(
        output_path=str(expected),
        warnings=["Converted from an office document; layout, fonts, or embedded macros may render differently than in the original application."],
    )
