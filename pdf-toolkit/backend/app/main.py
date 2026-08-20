from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import Base, SessionLocal, engine
from .events import log_event
from .models import Document  # noqa: F401 -- imported so metadata sees all tables
from .routers import backup, documents, events, operations, signatures

logger = logging.getLogger("pdf_toolkit")
settings = get_settings()


def purge_expired_documents() -> int:
    from .storage import delete_document_files

    db = SessionLocal()
    purged = 0
    try:
        now = datetime.now(timezone.utc)
        expired = (
            db.query(Document)
            .filter(Document.deleted_at.is_(None), Document.expires_at.isnot(None), Document.expires_at < now)
            .all()
        )
        for doc in expired:
            log_event(
                db,
                event_type="document.expired_purge",
                message=f"Purged expired document '{doc.title}'",
                outcome="success",
                meta={"document_id": str(doc.id), "title": doc.title},
            )
            delete_document_files(doc.id)
            db.delete(doc)
            purged += 1
        db.commit()
    finally:
        db.close()
    return purged


async def _purge_loop() -> None:
    while True:
        try:
            purged = await asyncio.to_thread(purge_expired_documents)
            if purged:
                logger.info("Purged %d expired document(s)", purged)
        except Exception:  # never let the background loop die silently
            logger.exception("Expired-document purge failed")
        await asyncio.sleep(settings.purge_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    task = asyncio.create_task(_purge_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="PDF Toolkit", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(operations.router)
app.include_router(signatures.router)
app.include_router(events.router)
app.include_router(backup.router)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "low_stakes_warning": (
            "Personal local tool. Not for regulated, legal, medical, or otherwise high-stakes documents. "
            "No qualified electronic signatures, no identity verification, no enterprise document governance."
        ),
    }
