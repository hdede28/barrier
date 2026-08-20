"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SigningSessionOut } from "@/lib/signing-types";
import { ErrorBox, Loading, SuccessBox } from "@/components/StateViews";

const FIELD_LABELS: Record<string, string> = {
  signature: "İmza (adınızı yazın)",
  initial: "Paraf",
  date: "Tarih",
  text: "Metin",
};

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<SigningSessionOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await api.getSigningSession(token);
      setSession(s);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İmza bağlantısı geçersiz veya süresi dolmuş.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConsent() {
    if (!session) return;
    setBusy(true);
    try {
      await api.recordConsent(token, session.consent_text);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Onay kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!session) return;
    setBusy(true);
    try {
      await api.submitFields(
        token,
        session.fields.map((f) => ({ field_id: f.id, value: values[f.id] || "" }))
      );
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İmza gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!session) return <Loading label="İmza bağlantısı yükleniyor..." />;

  if (submitted || session.signer_status === "signed") {
    return (
      <SuccessBox message="İmzanız kaydedildi. Belgeyi gönderen kişi tüm imzalar tamamlandığında son PDF'i mühürleyecek." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{session.document_title}</h1>
        <p className="text-sm text-muted">İmzacı: {session.signer_name} ({session.signer_email})</p>
      </div>

      <p className="text-sm text-warn-fg">
        ⚠ Bu yazılı-ad tabanlı elektronik imzadır; resmi kimlik doğrulama veya nitelikli elektronik
        imza sağlamaz. Yalnızca kişisel/düşük riskli kullanım içindir.
      </p>

      {!session.consent_recorded ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Onay</h2>
          <p className="text-sm text-muted">{session.consent_text}</p>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
            />
            Okudum ve kabul ediyorum.
          </label>
          <button
            onClick={handleConsent}
            disabled={!consentChecked || busy}
            className="mt-3 rounded-md cta-gradient px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Kaydediliyor..." : "Onayla ve devam et"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">İmza alanlarınız</h2>
          {session.fields.length === 0 && (
            <p className="text-sm text-muted">Size atanmış bir alan yok.</p>
          )}
          <div className="flex flex-col gap-3">
            {session.fields.map((f) => (
              <div key={f.id}>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {FIELD_LABELS[f.field_type] || f.field_type} · sayfa {f.page_number}
                </label>
                <input
                  value={values[f.id] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder={f.field_type === "signature" ? "Adınızı yazın" : ""}
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="mt-4 rounded-md cta-gradient px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "Gönderiliyor..." : "İmzala ve gönder"}
          </button>
        </div>
      )}
    </div>
  );
}
