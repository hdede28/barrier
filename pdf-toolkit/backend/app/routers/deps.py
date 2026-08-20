from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Document, DocumentVersion


def get_document_or_404(db: Session, document_id: uuid.UUID) -> Document:
    doc = db.get(Document, document_id)
    if doc is None or doc.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


def get_version_or_404(db: Session, document_id: uuid.UUID, version_id: uuid.UUID) -> DocumentVersion:
    version = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.id == version_id, DocumentVersion.document_id == document_id)
        .first()
    )
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


def get_latest_version(db: Session, document_id: uuid.UUID) -> DocumentVersion:
    version = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
        .first()
    )
    if version is None:
        raise HTTPException(status_code=404, detail="Document has no versions")
    return version
