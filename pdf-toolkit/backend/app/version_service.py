"""Shared helper for turning a freshly produced file into an immutable
DocumentVersion row plus an audit event, used by every operation router."""
from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from .events import log_event
from .models import Document, DocumentVersion
from .storage import store_new_version_file


def next_version_number(db: Session, document_id: uuid.UUID) -> int:
    last = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
        .first()
    )
    return (last.version_number + 1) if last else 1


def create_version(
    db: Session,
    *,
    document: Document,
    operation_type: str,
    produced_file: Path,
    source_version_ids: list[uuid.UUID],
    params: dict,
    warnings: list[str],
    ext: str = ".pdf",
) -> DocumentVersion:
    version_number = next_version_number(db, document.id)
    abs_path, digest, size = store_new_version_file(
        document.id, version_number, operation_type, produced_file, ext
    )
    from .storage import relative_path

    version = DocumentVersion(
        document_id=document.id,
        version_number=version_number,
        operation_type=operation_type,
        source_version_ids=[str(v) for v in source_version_ids],
        file_path=relative_path(abs_path),
        sha256=digest,
        size_bytes=size,
        params=params,
        warnings=warnings,
    )
    db.add(version)
    db.flush()

    log_event(
        db,
        event_type=f"operation.{operation_type}",
        message=f"Created version {version_number} ({operation_type}) of '{document.title}'",
        document_id=document.id,
        version_id=version.id,
        sha256=digest,
        outcome="success",
        meta={"params": params, "warnings": warnings},
    )
    return version
