"""Inspect a PDF for characteristics that a transformation might alter.

Used to populate the pre-operation warnings shown in the UI: encryption,
form fields, signature fields, and fonts that are not embedded (and so may
render differently on another machine).
"""
from __future__ import annotations

from pathlib import Path

import pikepdf

from .schemas_types import InspectResult


def inspect_pdf(path: Path) -> InspectResult:
    warnings: list[str] = []
    try:
        pdf = pikepdf.open(path)
    except pikepdf.PasswordError:
        return InspectResult(
            encrypted=True,
            has_forms=False,
            has_signature_fields=False,
            fonts_not_embedded=[],
            page_count=0,
            warnings=["File is password-protected; it cannot be inspected or transformed until unlocked."],
        )

    with pdf:
        encrypted = bool(pdf.is_encrypted)
        if encrypted:
            warnings.append("Source is encrypted; the operation will remove encryption from the output.")

        acroform = pdf.Root.get("/AcroForm")
        has_forms = bool(acroform)
        has_sig_fields = False
        if has_forms:
            for field in acroform.get("/Fields", []):
                try:
                    if str(field.get("/FT")) == "/Sig":
                        has_sig_fields = True
                except Exception:
                    continue
            warnings.append("Document contains form fields; some operations may flatten or drop their values.")
        if has_sig_fields:
            warnings.append("Document contains digital signature fields; modifying it will invalidate those signatures.")

        fonts_not_embedded: set[str] = set()
        for page in pdf.pages:
            resources = page.obj.get("/Resources", {})
            fonts = resources.get("/Font", {}) if resources else {}
            try:
                items = fonts.items()
            except Exception:
                items = []
            for _name, font in items:
                try:
                    descriptor = font.get("/FontDescriptor")
                    base_font = str(font.get("/BaseFont", "unknown"))
                    if descriptor is not None:
                        embedded = any(
                            k in descriptor for k in ("/FontFile", "/FontFile2", "/FontFile3")
                        )
                        if not embedded:
                            fonts_not_embedded.add(base_font)
                except Exception:
                    continue
        if fonts_not_embedded:
            warnings.append(
                "Some fonts are not embedded (" + ", ".join(sorted(fonts_not_embedded)[:5]) +
                "); text appearance may change on a machine without those fonts."
            )

        page_count = len(pdf.pages)

    return InspectResult(
        encrypted=encrypted,
        has_forms=has_forms,
        has_signature_fields=has_sig_fields,
        fonts_not_embedded=sorted(fonts_not_embedded),
        page_count=page_count,
        warnings=warnings,
    )
