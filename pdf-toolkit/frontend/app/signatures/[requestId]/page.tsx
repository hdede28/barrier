"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SignatureRequestOut } from "@/lib/types";
import { ErrorBox, Loading, SuccessBox } from "@/components/StateViews";

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  sent: "Davetler gönderildi",
  completed: "Tamamlandı ve mühürlendi",
  void: "İptal edildi",
};

export default function SignatureRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [req, setReq] = useState<SignatureRequestOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReq(await api.getSignatureRequest(requestId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İmza isteği yüklenemedi.");
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    setBusy(true);
    setActionError(null);
    try {
      await api.sendInvites(requestId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Davetler gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize() {
    setBusy(true);
    setActionError(null);
    try {
      await api.finalizeSignatureRequest(requestId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Mühürleme başarısız oldu.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!req) return <Loading label="İmza isteği yükleniyor..." />;

  const allSigned = req.signers.every((s) => s.status === "signed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">İmza İsteği</h1>
        <p className="text-sm text-muted">Durum: {STATUS_LABELS[req.status] || req.status}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">İmzacılar</h2>
        <ul className="flex flex-col gap-2">
          {req.signers.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
              <div>
                <p className="font-medium">
                  {s.name} · {s.email}
                </p>
                <p className="text-xs text-muted">
                  Durum: {s.status === "signed" ? "İmzalandı" : s.status === "viewed" ? "Görüntülendi" : "Bekliyor"}
                  {s.signed_at && ` (${new Date(s.signed_at).toLocaleString("tr-TR")})`}
                </p>
              </div>
              <code className="rounded bg-background px-2 py-1 text-xs">/sign/{s.token}</code>
            </li>
          ))}
        </ul>
      </div>

      {actionError && <ErrorBox message={actionError} />}

      {req.status === "draft" && (
        <button
          onClick={handleSend}
          disabled={busy}
          className="self-start rounded-md cta-gradient px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          {busy ? "Gönderiliyor..." : "Davetleri Gönder"}
        </button>
      )}

      {req.status === "sent" && (
        <button
          onClick={handleFinalize}
          disabled={busy || !allSigned}
          className="self-start rounded-md cta-gradient px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          title={!allSigned ? "Tüm imzacılar tamamlamadan mühürlenemez" : undefined}
        >
          {busy ? "Mühürleniyor..." : "Son PDF'i Mühürle"}
        </button>
      )}

      {req.status === "completed" && (
        <SuccessBox
          message={`Mühürlendi. SHA-256: ${req.sealed_hash} (${req.sealed_at ? new Date(req.sealed_at).toLocaleString("tr-TR") : ""})`}
        />
      )}
    </div>
  );
}
