export interface PublicFieldOut {
  id: string;
  page_number: number;
  x: number;
  y: number;
  w: number;
  h: number;
  field_type: string;
  value: string | null;
}

export interface SigningSessionOut {
  request_id: string;
  document_id: string;
  document_title: string;
  status: string;
  signer_id: string;
  signer_name: string;
  signer_email: string;
  signer_status: string;
  consent_recorded: boolean;
  consent_text: string;
  fields: PublicFieldOut[];
}
