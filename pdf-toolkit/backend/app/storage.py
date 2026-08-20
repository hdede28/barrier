"""Local, user-owned file store. Nothing here ever leaves the machine."""
from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

from .config import get_settings

settings = get_settings()


def document_dir(document_id: uuid.UUID) -> Path:
    d = settings.store_dir / str(document_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def preview_dir(document_id: uuid.UUID, version_id: uuid.UUID) -> Path:
    d = document_dir(document_id) / "previews" / str(version_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def version_filename(version_number: int, operation_type: str, ext: str = ".pdf") -> str:
    return f"v{version_number}_{operation_type}{ext}"


def store_new_version_file(
    document_id: uuid.UUID, version_number: int, operation_type: str, src_path: Path, ext: str = ".pdf"
) -> tuple[Path, str, int]:
    """Move/copy a freshly produced file into the immutable version store.

    Returns (absolute_path, sha256, size_bytes). The stored path is never
    modified in place after this call -- later operations always read it and
    write a brand new file for the next version.
    """
    dest = document_dir(document_id) / version_filename(version_number, operation_type, ext)
    if str(src_path) != str(dest):
        shutil.move(str(src_path), str(dest))
    dest.chmod(0o444)  # best-effort: mark immutable on disk
    digest = sha256_of(dest)
    size = dest.stat().st_size
    return dest, digest, size


def relative_path(path: Path) -> str:
    return str(path.relative_to(settings.store_dir))


def absolute_path(rel: str) -> Path:
    return settings.store_dir / rel


def delete_document_files(document_id: uuid.UUID) -> None:
    d = settings.store_dir / str(document_id)
    if d.exists():
        # Immutable (0o444) files need write perms on the dir to unlink; shutil handles that.
        for p in d.rglob("*"):
            if p.is_file():
                p.chmod(0o644)
        shutil.rmtree(d, ignore_errors=True)
