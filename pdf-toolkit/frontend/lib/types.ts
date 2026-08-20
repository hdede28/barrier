export interface VersionOut {
  id: string;
  version_number: number;
  operation_type: string;
  source_version_ids: string[];
  sha256: string;
  size_bytes: number;
  params: Record<string, unknown>;
  warnings: string[];
  created_at: string;
}

export interface DocumentOut {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  created_at: string;
  expires_at: string | null;
  versions: VersionOut[];
}

export interface DocumentSummaryOut {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  created_at: string;
  expires_at: string | null;
  latest_version: number;
  latest_operation: string;
}

export interface EventOut {
  id: string;
  document_id: string | null;
  version_id: string | null;
  event_type: string;
  message: string;
  sha256: string | null;
  outcome: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface InspectOut {
  encrypted: boolean;
  has_forms: boolean;
  has_signature_fields: boolean;
  fonts_not_embedded: string[];
  page_count: number;
  warnings: string[];
}

export interface SignerOut {
  id: string;
  name: string;
  email: string;
  order_index: number;
  status: string;
  signed_at: string | null;
  token: string;
}

export interface SignatureFieldOut {
  id: string;
  signer_id: string;
  page_number: number;
  x: number;
  y: number;
  w: number;
  h: number;
  field_type: string;
  value: string | null;
}

export interface SignatureRequestOut {
  id: string;
  document_id: string;
  source_version_id: string;
  status: string;
  sealed_version_id: string | null;
  sealed_hash: string | null;
  sealed_at: string | null;
  created_at: string;
  signers: SignerOut[];
  fields: SignatureFieldOut[];
}
