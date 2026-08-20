from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Event
from ..schemas import EventOut

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventOut])
def list_events(
    document_id: uuid.UUID | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
) -> list[Event]:
    q = db.query(Event).order_by(Event.created_at.desc())
    if document_id is not None:
        q = q.filter(Event.document_id == document_id)
    return q.limit(min(limit, 1000)).all()
