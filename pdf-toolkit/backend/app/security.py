"""Input validation and filename safety helpers."""
from __future__ import annotations

import re
import unicodedata

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_ALLOWED_UPLOAD_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".odt",
    ".rtf",
    ".xls",
    ".xlsx",
    ".ods",
    ".ppt",
    ".pptx",
    ".odp",
    ".txt",
}

_ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument",
    "application/vnd.oasis.opendocument",
    "application/rtf",
    "text/rtf",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
)


class ValidationError(ValueError):
    pass


def safe_filename(name: str) -> str:
    """Collapse a user-supplied filename to a safe basename.

    Strips any path components, normalizes unicode, and restricts the
    character set so the result can never escape the store directory or be
    interpreted as a shell/path special sequence.
    """
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    # Drop any directory components regardless of platform separators.
    name = name.replace("\\", "/").split("/")[-1]
    name = name.strip().lstrip(".") or "file"
    name = _SAFE_CHARS.sub("_", name)
    if len(name) > 150:
        stem, _, ext = name.rpartition(".")
        name = (stem[:140] + "." + ext) if ext else name[:150]
    return name or "file"


def validate_upload_extension(filename: str) -> str:
    lower = filename.lower()
    for ext in _ALLOWED_UPLOAD_EXTENSIONS:
        if lower.endswith(ext):
            return ext
    raise ValidationError(
        f"Unsupported file type. Allowed: {', '.join(sorted(_ALLOWED_UPLOAD_EXTENSIONS))}"
    )


def validate_mime_type(content_type: str | None) -> None:
    if not content_type:
        return
    if not content_type.startswith(_ALLOWED_MIME_PREFIXES) and content_type != "application/octet-stream":
        raise ValidationError(f"Unsupported content type: {content_type}")


def validate_title(title: str) -> str:
    title = (title or "").strip()
    if not title:
        raise ValidationError("Title must not be empty")
    if len(title) > 255:
        raise ValidationError("Title must be 255 characters or fewer")
    return title
