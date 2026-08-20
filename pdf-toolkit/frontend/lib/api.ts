import type {
  DocumentOut,
  DocumentSummaryOut,
  EventOut,
  InspectOut,
  SignatureRequestOut,
} from "./types";
import type { SigningSessionOut } from "./signing-types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(
      0,
      "Sunucuya ulaşılamadı. Backend çalışıyor mu? (docker compose up ile başlatıldığından emin olun)"
    );
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export const api = {
  health: () => request<{ status: string; low_stakes_warning: string }>("/api/health"),

  listDocuments: () => request<DocumentSummaryOut[]>("/api/documents"),
  getDocument: (id: string) => request<DocumentOut>(`/api/documents/${id}`),
  uploadDocument: (file: File, title: string, retentionDays?: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    if (retentionDays) form.append("retention_days", String(retentionDays));
    return request<DocumentOut>("/api/documents", { method: "POST", body: form });
  },
  deleteDocument: (id: string) =>
    request<void>(`/api/documents/${id}?confirm=true`, { method: "DELETE" }),
  setExpiry: (id: string, retentionDays: number | null) =>
    request<DocumentOut>(
      `/api/documents/${id}/expiry${retentionDays ? `?retention_days=${retentionDays}` : ""}`,
      { method: "PUT" }
    ),
  downloadUrl: (documentId: string, versionId: string) =>
    `${BASE}/api/documents/${documentId}/versions/${versionId}/download`,
  previewUrl: (documentId: string, versionId: string, page: number) =>
    `${BASE}/api/documents/${documentId}/versions/${versionId}/preview/${page}`,
  pageCount: (documentId: string, versionId: string) =>
    request<{ page_count: number }>(
      `/api/documents/${documentId}/versions/${versionId}/page-count`
    ),
  inspectVersion: (documentId: string, versionId: string) =>
    request<InspectOut>(`/api/documents/${documentId}/versions/${versionId}/inspect`),
  preflightWarnings: (documentId: string, versionId: string) =>
    request<{ warnings: string[] }>(
      `/api/operations/${documentId}/versions/${versionId}/warnings`
    ),

  merge: (title: string, items: { document_id: string; version_id: string }[]) =>
    request(`/api/operations/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, items }),
    }),
  split: (documentId: string, versionId: string, ranges: number[][]) =>
    request(`/api/operations/${documentId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, ranges }),
    }),
  reorder: (documentId: string, versionId: string, order: number[]) =>
    request(`/api/operations/${documentId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, order }),
    }),
  rotate: (documentId: string, versionId: string, angle: number, pages?: number[]) =>
    request(`/api/operations/${documentId}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, angle, pages: pages || null }),
    }),
  compress: (documentId: string, versionId: string, quality: string) =>
    request(`/api/operations/${documentId}/compress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, quality }),
    }),
  watermark: (
    documentId: string,
    versionId: string,
    text: string,
    opacity: number,
    position: string
  ) =>
    request(`/api/operations/${documentId}/watermark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, text, opacity, position }),
    }),
  redact: (
    documentId: string,
    versionId: string,
    regions: { page: number; x: number; y: number; w: number; h: number }[]
  ) =>
    request(`/api/operations/${documentId}/redact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, regions }),
    }),
  ocr: (documentId: string, versionId: string, language: string) =>
    request(`/api/operations/${documentId}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, language }),
    }),
  convert: (documentId: string, versionId: string) =>
    request(`/api/operations/${documentId}/convert?version_id=${versionId}`, {
      method: "POST",
    }),

  listEvents: (documentId?: string) =>
    request<EventOut[]>(`/api/events${documentId ? `?document_id=${documentId}` : ""}`),

  createSignatureRequest: (
    versionId: string,
    signers: { name: string; email: string; order_index: number }[],
    fields: {
      signer_email: string;
      page_number: number;
      x: number;
      y: number;
      w: number;
      h: number;
      field_type: string;
    }[]
  ) =>
    request<SignatureRequestOut>(`/api/signatures/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId, signers, fields }),
    }),
  getSignatureRequest: (id: string) =>
    request<SignatureRequestOut>(`/api/signatures/requests/${id}`),
  sendInvites: (id: string) =>
    request<SignatureRequestOut>(`/api/signatures/requests/${id}/send`, { method: "POST" }),
  finalizeSignatureRequest: (id: string) =>
    request<SignatureRequestOut>(`/api/signatures/requests/${id}/finalize`, { method: "POST" }),

  getSigningSession: (token: string) =>
    request<SigningSessionOut>(`/api/signatures/sign/${token}`),
  recordConsent: (token: string, consentText: string) =>
    request<{ ok: boolean }>(`/api/signatures/sign/${token}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent_text: consentText, accepted: true }),
    }),
  submitFields: (token: string, fields: { field_id: string; value: string }[]) =>
    request<{ ok: boolean }>(`/api/signatures/sign/${token}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }),

  exportAllUrl: () => `${BASE}/api/backup/export`,
  exportDocumentUrl: (documentId: string) => `${BASE}/api/backup/documents/${documentId}/export`,
};
