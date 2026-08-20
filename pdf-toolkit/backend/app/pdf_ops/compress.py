from __future__ import annotations

import io
from pathlib import Path

import pikepdf
from PIL import Image

from .schemas_types import OpResult

_QUALITY = {
    "low": {"jpeg_quality": 35, "max_dim": 900},
    "medium": {"jpeg_quality": 55, "max_dim": 1400},
    "high": {"jpeg_quality": 80, "max_dim": 2200},
}


def compress_pdf(input_path: Path, quality: str, output_path: Path) -> OpResult:
    if quality not in _QUALITY:
        raise ValueError(f"Unknown quality preset: {quality}")
    settings = _QUALITY[quality]
    warnings: list[str] = []

    with pikepdf.open(input_path) as pdf:
        for page in pdf.pages:
            try:
                images = dict(page.images)
            except Exception:
                images = {}
            for _name, raw_image in images.items():
                try:
                    pdf_image = pikepdf.PdfImage(raw_image)
                    pil = pdf_image.as_pil_image()
                except Exception:
                    warnings.append("One or more images could not be recompressed and were left as-is.")
                    continue
                try:
                    if pil.mode not in ("RGB", "L"):
                        pil = pil.convert("RGB")
                    max_dim = settings["max_dim"]
                    if max(pil.size) > max_dim:
                        ratio = max_dim / max(pil.size)
                        pil = pil.resize(
                            (max(1, int(pil.width * ratio)), max(1, int(pil.height * ratio))),
                            Image.LANCZOS,
                        )
                    buf = io.BytesIO()
                    pil.save(buf, format="JPEG", quality=settings["jpeg_quality"], optimize=True)
                    raw_image.write(buf.getvalue(), filter=pikepdf.Name("/DCTDecode"))
                except Exception:
                    warnings.append("One or more images could not be recompressed and were left as-is.")
                    continue

        pdf.remove_unreferenced_resources()
        pdf.save(
            output_path,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            linearize=False,
        )

    warnings.append(
        "Images were recompressed and may have been downsampled; text and vector content are unaffected."
    )
    return OpResult(output_path=str(output_path), warnings=warnings)
