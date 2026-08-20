from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..events import log_event
from ..mailer import send_invite_email
from ..models import ConsentRecord, Document, DocumentVersion, SignatureField, SignatureRequest, Signer
from ..pdf_ops.seal import flatten_signature_fields
from ..schemas import ConsentIn, SignatureRequestCreate, SignFieldIn
from ..storage import absolute_path
from ..version_service import create_version
from .deps import get_document_or_404, get_version_or_404

router = APIRouter(prefix="/api/signatures", tags=["signatures"])
settings = get_settings()

LOW_STAKES_CONSENT_TEXT = (
    "I agree that typing my name below constitutes my electronic signature on this document, "
    "for personal or internal use only. This is not a qualified, notarized, or government-identity-verified "
    "signature and should not be relied on for regulated, legal, medical, or otherwise high-stakes transactions."
)


class SignerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    email: str
    order_index: int
    status: str
    signed_at: datetime | None
    token: str


class FieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    signer_id: uuid.UUID
    page_number: int
    x: float
    y: float
    w: float
    h: float
    field_type: str
    value: str | None


class RequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    document_id: uuid.UUID
    source_version_id: uuid.UUID
    status: str
    sealed_version_id: uuid.UUID | None
    sealed_hash: str | None
    sealed_at: datetime | None
    created_at: datetime
    signers: list[SignerOut]
    fields: list[FieldOut]


class PublicFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    page_number: int
    x: float
    y: float
    w: float
    h: float
    field_type: str
    value: str | None


class SigningSessionOut(BaseModel):
    """What a signer sees at their link -- deliberately excludes every other
    signer's token/email/name and any signer's already-entered field values
    but their own, so one invite link can never be used to act as, or learn
    about, anyone else on the same request."""

    model_config = ConfigDict(from_attributes=True)
    request_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    status: str
    signer_id: uuid.UUID
    signer_name: str
    signer_email: str
    signer_status: str
    consent_recorded: bool
    consent_text: str
    fields: list[PublicFieldOut]


def _get_request_or_404(db: Session, request_id: uuid.UUID) -> SignatureRequest:
    req = db.get(SignatureRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Signature request not found")
    return req


def _get_signer_by_token_or_404(db: Session, token: str) -> Signer:
    signer = db.query(Signer).filter(Signer.token == token).first()
    if signer is None:
        raise HTTPException(status_code=404, detail="Invalid or expired signing link")
    return signer


@router.post("/requests", response_model=RequestOut, status_code=201)
def create_signature_request(body: SignatureRequestCreate, db: Session = Depends(get_db)):
    version = db.get(DocumentVersion, body.version_id)
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    document = get_document_or_404(db, version.document_id)
    path = absolute_path(version.file_path)
    if path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Signature fields can only be placed on a PDF version")

    req = SignatureRequest(document_id=document.id, source_version_id=version.id)
    db.add(req)
    db.flush()

    signers_by_email: dict[str, Signer] = {}
    for s in body.signers:
        signer = Signer(
            request_id=req.id,
            name=s.name,
            email=s.email,
            order_index=s.order_index,
            token=secrets.token_urlsafe(32),
        )
        db.add(signer)
        db.flush()
        signers_by_email[s.email] = signer

    for f in body.fields:
        signer = signers_by_email.get(f.signer_email)
        if signer is None:
            raise HTTPException(status_code=400, detail=f"Field references unknown signer email {f.signer_email}")
        db.add(
            SignatureField(
                request_id=req.id,
                signer_id=signer.id,
                page_number=f.page_number,
                x=f.x,
                y=f.y,
                w=f.w,
                h=f.h,
                field_type=f.field_type,
            )
        )

    log_event(
        db,
        event_type="signature.request_created",
        message=f"Created signature request for '{document.title}' with {len(body.signers)} signer(s)",
        document_id=document.id,
        version_id=version.id,
        outcome="success",
    )
    db.commit()
    db.refresh(req)
    return req


@router.get("/requests/{request_id}", response_model=RequestOut)
def get_signature_request(request_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_request_or_404(db, request_id)


@router.post("/requests/{request_id}/send", response_model=RequestOut)
def send_invites(request_id: uuid.UUID, db: Session = Depends(get_db)):
    req = _get_request_or_404(db, request_id)
    document = get_document_or_404(db, req.document_id)

    for signer in req.signers:
        link = f"{settings.app_base_url}/sign/{signer.token}"
        sent, outcome = send_invite_email(
            signer.email,
            subject=f"Please sign: {document.title}",
            body=f"Hello {signer.name},\n\nPlease review and sign '{document.title}':\n{link}\n",
        )
        log_event(
            db,
            event_type="signature.invite_delivery",
            message=f"Invite to {signer.email} for '{document.title}': {outcome}",
            document_id=document.id,
            outcome=outcome,
            meta={"signer_id": str(signer.id), "link": link},
        )

    req.status = "sent"
    db.commit()
    db.refresh(req)
    return req


@router.get("/sign/{token}", response_model=SigningSessionOut)
def get_signing_session(token: str, db: Session = Depends(get_db)):
    signer = _get_signer_by_token_or_404(db, token)
    req = _get_request_or_404(db, signer.request_id)
    document = get_document_or_404(db, req.document_id)
    if signer.status == "pending":
        signer.status = "viewed"
        db.commit()
        db.refresh(signer)

    consent = db.query(ConsentRecord).filter(ConsentRecord.signer_id == signer.id).first()
    own_fields = [f for f in req.fields if f.signer_id == signer.id]

    return SigningSessionOut(
        request_id=req.id,
        document_id=document.id,
        document_title=document.title,
        status=req.status,
        signer_id=signer.id,
        signer_name=signer.name,
        signer_email=signer.email,
        signer_status=signer.status,
        consent_recorded=consent is not None,
        consent_text=LOW_STAKES_CONSENT_TEXT,
        fields=[PublicFieldOut.model_validate(f) for f in own_fields],
    )


@router.post("/sign/{token}/consent")
def record_consent(token: str, body: ConsentIn, request: Request, db: Session = Depends(get_db)):
    signer = _get_signer_by_token_or_404(db, token)
    if not body.accepted:
        raise HTTPException(status_code=400, detail="Consent must be accepted to proceed")

    existing = db.query(ConsentRecord).filter(ConsentRecord.signer_id == signer.id).first()
    if existing is None:
        consent = ConsentRecord(
            signer_id=signer.id,
            consent_text=body.consent_text or LOW_STAKES_CONSENT_TEXT,
            ip_address=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent", "unknown")[:512],
        )
        db.add(consent)
        log_event(
            db,
            event_type="signature.consent_recorded",
            message=f"{signer.name} <{signer.email}> recorded consent to sign",
            document_id=signer.request.document_id,
            outcome="success",
            meta={"signer_id": str(signer.id)},
        )
        db.commit()
    return {"ok": True}


@router.post("/sign/{token}/fields")
def submit_fields(token: str, body: list[SignFieldIn], db: Session = Depends(get_db)):
    signer = _get_signer_by_token_or_404(db, token)
    consent = db.query(ConsentRecord).filter(ConsentRecord.signer_id == signer.id).first()
    if consent is None:
        raise HTTPException(status_code=400, detail="Consent must be recorded before submitting fields")

    field_ids = {f.id for f in signer.request.fields if f.signer_id == signer.id}
    for item in body:
        if item.field_id not in field_ids:
            raise HTTPException(status_code=400, detail="Field does not belong to this signer")

    by_id = {f.id: f for f in signer.request.fields}
    for item in body:
        by_id[item.field_id].value = item.value

    signer.status = "signed"
    signer.signed_at = datetime.now(timezone.utc)
    log_event(
        db,
        event_type="signature.signer_completed",
        message=f"{signer.name} <{signer.email}> completed signing",
        document_id=signer.request.document_id,
        outcome="success",
        meta={"signer_id": str(signer.id)},
    )
    db.commit()
    return {"ok": True}


@router.post("/requests/{request_id}/finalize", response_model=RequestOut)
def finalize_request(request_id: uuid.UUID, db: Session = Depends(get_db)):
    req = _get_request_or_404(db, request_id)
    document = get_document_or_404(db, req.document_id)

    if req.status == "completed":
        raise HTTPException(status_code=400, detail="Signature request is already sealed")
    unsigned = [s for s in req.signers if s.status != "signed"]
    if unsigned:
        raise HTTPException(
            status_code=400,
            detail=f"Waiting on signer(s): {', '.join(s.email for s in unsigned)}",
        )

    source_version = db.get(DocumentVersion, req.source_version_id)
    path = absolute_path(source_version.file_path)
    fields_data = [
        {
            "page_number": f.page_number,
            "x": f.x,
            "y": f.y,
            "w": f.w,
            "h": f.h,
            "field_type": f.field_type,
            "value": f.value,
        }
        for f in req.fields
    ]

    tmp = settings.data_dir / "tmp" / f"seal_{uuid.uuid4().hex}.pdf"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = flatten_signature_fields(path, fields_data, tmp)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Sealing failed: {exc}") from exc

    sealed_version = create_version(
        db,
        document=document,
        operation_type="signature_seal",
        produced_file=Path(result.output_path),
        source_version_ids=[source_version.id],
        params={"signature_request_id": str(req.id), "signers": [str(s.id) for s in req.signers]},
        warnings=result.warnings,
    )

    req.status = "completed"
    req.sealed_version_id = sealed_version.id
    req.sealed_hash = sealed_version.sha256
    req.sealed_at = datetime.now(timezone.utc)

    log_event(
        db,
        event_type="signature.sealed",
        message=f"Sealed final signed PDF for '{document.title}'",
        document_id=document.id,
        version_id=sealed_version.id,
        sha256=sealed_version.sha256,
        outcome="success",
    )
    db.commit()
    db.refresh(req)
    return req
