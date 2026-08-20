"""Append-only audit event log.

Rows are inserted and never updated or deleted by application code. Every
transformation, delivery attempt, and deletion writes a timestamped event
here so the full history of a document remains auditable.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from .models import Event


def log_event(
    db: Session,
    *,
    event_type: str,
    message: str,
    document_id: uuid.UUID | None = None,
    version_id: uuid.UUID | None = None,
    sha256: str | None = None,
    outcome: str | None = None,
    meta: dict | None = None,
) -> Event:
    event = Event(
        document_id=document_id,
        version_id=version_id,
        event_type=event_type,
        message=message,
        sha256=sha256,
        outcome=outcome,
        meta=meta or {},
    )
    db.add(event)
    db.flush()
    return event
