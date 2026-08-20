from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..events import log_event
from ..storage import document_dir
from .deps import get_document_or_404

router = APIRouter(prefix="/api/backup", tags=["backup"])
settings = get_settings()


def _cleanup(path):
    path.unlink(missing_ok=True)


@router.get("/export")
def export_all(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Zip the entire local file store for a one-click, vendor-free export.
    Database rows (documents/versions/events) can be exported separately via
    scripts/backup.sh, which also runs pg_dump."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_base = settings.backup_dir / f"export_{stamp}"
    archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=settings.store_dir)

    log_event(db, event_type="backup.export_all", message="Exported full local file store", outcome="success")
    db.commit()

    background_tasks.add_task(_cleanup, Path(archive_path))
    return FileResponse(archive_path, filename=f"pdf-toolkit-export-{stamp}.zip", media_type="application/zip")


@router.get("/documents/{document_id}/export")
def export_document(document_id: uuid.UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_base = settings.backup_dir / f"{document.title}_{stamp}"
    archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=document_dir(document.id))

    log_event(
        db,
        event_type="backup.export_document",
        message=f"Exported '{document.title}'",
        document_id=document.id,
        outcome="success",
    )
    db.commit()

    background_tasks.add_task(_cleanup, Path(archive_path))
    return FileResponse(archive_path, filename=f"{document.title}_{stamp}.zip", media_type="application/zip")
