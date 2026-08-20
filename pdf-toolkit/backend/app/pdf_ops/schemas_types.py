"""Plain dataclasses shared across pdf_ops modules (kept free of FastAPI/Pydantic
so this package has no dependency on the web layer)."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class InspectResult:
    encrypted: bool
    has_forms: bool
    has_signature_fields: bool
    fonts_not_embedded: list[str]
    page_count: int
    warnings: list[str] = field(default_factory=list)


@dataclass
class OpResult:
    """Result of a transformation: the output file path plus any warnings
    that should be attached to the new version for audit/UI display."""

    output_path: str
    warnings: list[str] = field(default_factory=list)
