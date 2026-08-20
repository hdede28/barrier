from __future__ import annotations

import mimetypes
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..events import log_event
from ..models import Document, DocumentVersion
from ..pdf_ops.inspect import inspect_pdf
from ..pdf_ops.preview import page_count, render_page_png
from ..schemas import DocumentOut, DocumentSummaryOut, InspectOut
from ..security import ValidationError, safe_filename, validate_mime_type, validate_title, validate_upload_extension
from ..storage import absolute_path, delete_document_files, preview_dir, store_new_version_file
from .deps import get_document_or_404, get_version_or_404

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    retention_days: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> Document:
    if not file.filename:
        raise HTTPException(status_code=400, detail="A filename is required")

    try:
        ext = validate_upload_extension(file.filename)
        validate_mime_type(file.content_type)
        clean_title = validate_title(title or Path(file.filename).stem)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    clean_name = safe_filename(file.filename)

    max_bytes = settings.max_upload_mb * 1024 * 1024
    tmp_path = settings.data_dir / "tmp" / f"upload_{uuid.uuid4().hex}{ext}"
    tmp_path.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with open(tmp_path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(status_code=413, detail=f"File exceeds the {settings.max_upload_mb}MB limit")
                out.write(chunk)
    except HTTPException:
        tmp_path.unlink(missing_ok=True)
        raise
    if size == 0:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    mime_type = mimetypes.guess_type(clean_name)[0] or "application/octet-stream"

    days = retention_days if retention_days is not None else settings.default_retention_days
    expires_at = datetime.now(timezone.utc) + timedelta(days=days) if days else None

    document = Document(
        title=clean_title,
        original_filename=clean_name,
        mime_type=mime_type,
        expires_at=expires_at,
    )
    db.add(document)
    db.flush()

    abs_path, digest, size_bytes = store_new_version_file(document.id, 1, "original", tmp_path, ext)
    from ..storage import relative_path

    version = DocumentVersion(
        document_id=document.id,
        version_number=1,
        operation_type="original",
        source_version_ids=[],
        file_path=relative_path(abs_path),
        sha256=digest,
        size_bytes=size_bytes,
        params={"original_filename": clean_name},
        warnings=[],
    )
    db.add(version)
    db.flush()

    log_event(
        db,
        event_type="document.upload",
        message=f"Uploaded '{clean_title}' ({clean_name})",
        document_id=document.id,
        version_id=version.id,
        sha256=digest,
        outcome="success",
    )
    db.commit()
    db.refresh(document)
    return document


@router.get("", response_model=list[DocumentSummaryOut])
def list_documents(db: Session = Depends(get_db)) -> list[dict]:
    docs = (
        db.query(Document)
        .filter(Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc())
        .all()
    )
    out = []
    for d in docs:
        if not d.versions:
            continue
        latest = d.versions[-1]
        out.append(
            {
                "id": d.id,
                "title": d.title,
                "original_filename": d.original_filename,
                "mime_type": d.mime_type,
                "created_at": d.created_at,
                "expires_at": d.expires_at,
                "latest_version": latest.version_number,
                "latest_operation": latest.operation_type,
            }
        )
    return out


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> Document:
    return get_document_or_404(db, document_id)


@router.get("/{document_id}/versions/{version_id}/download")
def download_version(document_id: uuid.UUID, version_id: uuid.UUID, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Stored file is missing from disk")
    log_event(
        db,
        event_type="document.download",
        message=f"Downloaded version {version.version_number} of '{document.title}'",
        document_id=document.id,
        version_id=version.id,
        sha256=version.sha256,
        outcome="success",
    )
    db.commit()
    download_name = f"{document.title}_v{version.version_number}{path.suffix}"
    return FileResponse(path, filename=download_name, media_type="application/octet-stream")


@router.get("/{document_id}/versions/{version_id}/inspect", response_model=InspectOut)
def inspect_version(document_id: uuid.UUID, version_id: uuid.UUID, db: Session = Depends(get_db)):
    get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() != ".pdf":
        return InspectOut(
            encrypted=False,
            has_forms=False,
            has_signature_fields=False,
            fonts_not_embedded=[],
            page_count=0,
            warnings=["This version is not a PDF yet; convert it before other operations."],
        )
    result = inspect_pdf(path)
    return InspectOut(**result.__dict__)


@router.get("/{document_id}/versions/{version_id}/preview/{page}")
def preview_page(
    document_id: uuid.UUID, version_id: uuid.UUID, page: int, db: Session = Depends(get_db)
):
    get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Preview is only available for PDF versions")

    cache_path = preview_dir(document_id, version_id) / f"page-{page}.png"
    if not cache_path.exists():
        try:
            render_page_png(path, page, cache_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(cache_path, media_type="image/png")


@router.get("/{document_id}/versions/{version_id}/page-count")
def version_page_count(document_id: uuid.UUID, version_id: uuid.UUID, db: Session = Depends(get_db)):
    get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() != ".pdf":
        return {"page_count": 0}
    return {"page_count": page_count(path)}


@router.put("/{document_id}/expiry", response_model=DocumentOut)
def set_expiry(document_id: uuid.UUID, retention_days: int | None = None, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    document.expires_at = (
        datetime.now(timezone.utc) + timedelta(days=retention_days) if retention_days else None
    )
    log_event(
        db,
        event_type="document.expiry_set",
        message=f"Set expiry for '{document.title}' to {document.expires_at or 'never'}",
        document_id=document.id,
        outcome="success",
    )
    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: uuid.UUID, confirm: bool = False, db: Session = Depends(get_db)):
    if not confirm:
        raise HTTPException(status_code=400, detail="Pass confirm=true to permanently delete this document")
    document = get_document_or_404(db, document_id)
    title = document.title
    log_event(
        db,
        event_type="document.delete",
        message=f"Permanently deleted '{title}' and all its versions",
        document_id=None,  # document row is about to be removed; keep the event, drop the FK
        outcome="success",
        meta={"document_id": str(document.id), "title": title},
    )
    delete_document_files(document.id)
    db.delete(document)
    db.commit()
    return None
