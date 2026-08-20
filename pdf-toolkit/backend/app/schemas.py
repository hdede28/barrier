from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version_number: int
    operation_type: str
    source_version_ids: list
    sha256: str
    size_bytes: int
    params: dict
    warnings: list[str]
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    original_filename: str
    mime_type: str
    created_at: datetime
    expires_at: datetime | None
    versions: list[VersionOut] = Field(default_factory=list)


class DocumentSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    original_filename: str
    mime_type: str
    created_at: datetime
    expires_at: datetime | None
    latest_version: int
    latest_operation: str


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    document_id: uuid.UUID | None
    version_id: uuid.UUID | None
    event_type: str
    message: str
    sha256: str | None
    outcome: str | None
    meta: dict
    created_at: datetime


class InspectOut(BaseModel):
    encrypted: bool
    has_forms: bool
    has_signature_fields: bool
    fonts_not_embedded: list[str]
    page_count: int
    warnings: list[str]


class ReorderRequest(BaseModel):
    version_id: uuid.UUID
    order: list[int] = Field(description="1-based source page numbers in desired output order")


class RotateRequest(BaseModel):
    version_id: uuid.UUID
    angle: int = Field(description="Degrees clockwise: 90, 180, or 270")
    pages: list[int] | None = Field(default=None, description="1-based pages; omit for all pages")


class CompressRequest(BaseModel):
    version_id: uuid.UUID
    quality: str = Field(default="medium", pattern="^(low|medium|high)$")


class WatermarkRequest(BaseModel):
    version_id: uuid.UUID
    text: str = Field(min_length=1, max_length=200)
    opacity: float = Field(default=0.3, ge=0.05, le=1.0)
    position: str = Field(default="center", pattern="^(center|top|bottom|diagonal)$")


class RedactRegion(BaseModel):
    page: int
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)


class RedactRequest(BaseModel):
    version_id: uuid.UUID
    regions: list[RedactRegion] = Field(min_length=1)


class OcrRequest(BaseModel):
    version_id: uuid.UUID
    language: str = Field(default="eng")


class SplitRequest(BaseModel):
    version_id: uuid.UUID
    ranges: list[list[int]] = Field(description="List of [start, end] 1-based inclusive page ranges")


class MergeRequest(BaseModel):
    items: list[dict] = Field(
        description="Ordered list of {document_id, version_id} to concatenate into a new document"
    )
    title: str = Field(default="Merged document")


class SignatureFieldIn(BaseModel):
    signer_email: str
    page_number: int
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    w: float = Field(gt=0, le=1)
    h: float = Field(gt=0, le=1)
    field_type: str = Field(default="signature", pattern="^(signature|initial|date|text)$")


class SignerIn(BaseModel):
    name: str
    email: str
    order_index: int = 0


class SignatureRequestCreate(BaseModel):
    version_id: uuid.UUID
    signers: list[SignerIn]
    fields: list[SignatureFieldIn]


class ConsentIn(BaseModel):
    consent_text: str
    accepted: bool


class SignFieldIn(BaseModel):
    field_id: uuid.UUID
    value: str
