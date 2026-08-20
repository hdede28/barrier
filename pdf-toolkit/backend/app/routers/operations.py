from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..events import log_event
from ..models import Document
from ..pdf_ops.compress import compress_pdf
from ..pdf_ops.convert import ConversionUnavailableError, convert_office_to_pdf
from ..pdf_ops.inspect import inspect_pdf
from ..pdf_ops.merge import merge_pdfs
from ..pdf_ops.ocr import OcrUnavailableError, ocr_pdf
from ..pdf_ops.redact import redact_pdf
from ..pdf_ops.reorder import reorder_pdf
from ..pdf_ops.rotate import rotate_pdf
from ..pdf_ops.split import split_pdf
from ..pdf_ops.watermark import watermark_pdf
from ..schemas import (
    CompressRequest,
    MergeRequest,
    OcrRequest,
    RedactRequest,
    ReorderRequest,
    RotateRequest,
    SplitRequest,
    VersionOut,
    WatermarkRequest,
)
from ..storage import absolute_path
from ..version_service import create_version
from .deps import get_document_or_404, get_version_or_404

router = APIRouter(prefix="/api/operations", tags=["operations"])
settings = get_settings()


def _tmp_file(suffix: str = ".pdf") -> Path:
    d = settings.data_dir / "tmp"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"op_{uuid.uuid4().hex}{suffix}"


def _require_pdf(path: Path) -> None:
    if path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="This operation requires a PDF version; convert the source first.")


@router.post("/merge", response_model=VersionOut, status_code=201)
def merge(req: MergeRequest, db: Session = Depends(get_db)):
    if len(req.items) < 2:
        raise HTTPException(status_code=400, detail="Merge requires at least two source files")

    input_paths: list[Path] = []
    source_version_ids: list[uuid.UUID] = []
    for item in req.items:
        doc_id = uuid.UUID(str(item["document_id"]))
        ver_id = uuid.UUID(str(item["version_id"]))
        get_document_or_404(db, doc_id)
        version = get_version_or_404(db, doc_id, ver_id)
        path = absolute_path(version.file_path)
        _require_pdf(path)
        input_paths.append(path)
        source_version_ids.append(version.id)

    out_path = _tmp_file()
    try:
        result = merge_pdfs(input_paths, out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Merge failed: {exc}") from exc

    new_doc = Document(title=req.title, original_filename=f"{req.title}.pdf", mime_type="application/pdf")
    db.add(new_doc)
    db.flush()

    version = create_version(
        db,
        document=new_doc,
        operation_type="merge",
        produced_file=Path(result.output_path),
        source_version_ids=source_version_ids,
        params={"source_items": [str(v) for v in source_version_ids]},
        warnings=result.warnings,
    )
    log_event(
        db,
        event_type="document.created_by_merge",
        message=f"Created '{new_doc.title}' by merging {len(input_paths)} documents",
        document_id=new_doc.id,
        version_id=version.id,
        sha256=version.sha256,
        outcome="success",
    )
    db.commit()
    db.refresh(version)
    return version


@router.post("/{document_id}/split", response_model=list[VersionOut], status_code=201)
def split(document_id: uuid.UUID, req: SplitRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_dir = settings.data_dir / "tmp" / uuid.uuid4().hex
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        outputs = split_pdf(path, req.ranges, out_dir, "part")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Split failed: {exc}") from exc

    created: list = []
    for idx, out_path in enumerate(outputs, start=1):
        rng = req.ranges[idx - 1]
        new_doc = Document(
            title=f"{document.title} (pages {rng[0]}-{rng[1]})",
            original_filename=f"{document.title}_part{idx}.pdf",
            mime_type="application/pdf",
        )
        db.add(new_doc)
        db.flush()
        v = create_version(
            db,
            document=new_doc,
            operation_type="split",
            produced_file=out_path,
            source_version_ids=[version.id],
            params={"range": rng, "source_document_id": str(document.id)},
            warnings=[],
        )
        created.append(v)

    log_event(
        db,
        event_type="document.split",
        message=f"Split '{document.title}' into {len(created)} document(s)",
        document_id=document.id,
        version_id=version.id,
        sha256=version.sha256,
        outcome="success",
    )
    db.commit()
    for v in created:
        db.refresh(v)
    return created


@router.post("/{document_id}/reorder", response_model=VersionOut, status_code=201)
def reorder(document_id: uuid.UUID, req: ReorderRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = reorder_pdf(path, req.order, out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Reorder failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="reorder",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"order": req.order},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/rotate", response_model=VersionOut, status_code=201)
def rotate(document_id: uuid.UUID, req: RotateRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = rotate_pdf(path, req.angle, req.pages, out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Rotate failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="rotate",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"angle": req.angle, "pages": req.pages},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/compress", response_model=VersionOut, status_code=201)
def compress(document_id: uuid.UUID, req: CompressRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = compress_pdf(path, req.quality, out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Compress failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="compress",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"quality": req.quality},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/watermark", response_model=VersionOut, status_code=201)
def watermark(document_id: uuid.UUID, req: WatermarkRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = watermark_pdf(path, req.text, req.opacity, req.position, out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Watermark failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="watermark",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"text": req.text, "opacity": req.opacity, "position": req.position},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/redact", response_model=VersionOut, status_code=201)
def redact(document_id: uuid.UUID, req: RedactRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = redact_pdf(path, [r.model_dump() for r in req.regions], out_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Redact failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="redact",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"regions": [r.model_dump() for r in req.regions]},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/ocr", response_model=VersionOut, status_code=201)
def ocr(document_id: uuid.UUID, req: OcrRequest, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, req.version_id)
    path = absolute_path(version.file_path)
    _require_pdf(path)

    out_path = _tmp_file()
    try:
        result = ocr_pdf(path, req.language, out_path)
    except OcrUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OCR failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="ocr",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"language": req.language},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.post("/{document_id}/convert", response_model=VersionOut, status_code=201)
def convert(document_id: uuid.UUID, version_id: uuid.UUID, db: Session = Depends(get_db)):
    document = get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() == ".pdf":
        raise HTTPException(status_code=400, detail="This version is already a PDF")

    out_dir = settings.data_dir / "tmp" / uuid.uuid4().hex
    try:
        result = convert_office_to_pdf(path, out_dir, settings.soffice_bin)
    except ConversionUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Conversion failed: {exc}") from exc

    new_version = create_version(
        db,
        document=document,
        operation_type="convert",
        produced_file=Path(result.output_path),
        source_version_ids=[version.id],
        params={"source_format": path.suffix},
        warnings=result.warnings,
    )
    db.commit()
    db.refresh(new_version)
    return new_version


@router.get("/{document_id}/versions/{version_id}/warnings")
def preflight_warnings(document_id: uuid.UUID, version_id: uuid.UUID, db: Session = Depends(get_db)):
    """Convenience endpoint the UI calls before showing an operation's
    confirm dialog, so warnings appear before the user commits to a change."""
    get_document_or_404(db, document_id)
    version = get_version_or_404(db, document_id, version_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() != ".pdf":
        return {"warnings": ["This version is not a PDF; convert it first."]}
    result = inspect_pdf(path)
    return {"warnings": result.warnings}
