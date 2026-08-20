"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DocumentSummaryOut } from "@/lib/types";
import { EmptyState, ErrorBox, Loading } from "@/components/StateViews";
import { UploadForm } from "@/components/UploadForm";

const OPERATION_LABELS: Record<string, string> = {
  original: "Orijinal",
  merge: "Birleştirildi",
  split: "Bölündü",
  reorder: "Yeniden sıralandı",
  rotate: "Döndürüldü",
  compress: "Sıkıştırıldı",
  watermark: "Filigranlandı",
  redact: "Sansürlendi",
  ocr: "OCR uygulandı",
  convert: "PDF'e dönüştürüldü",
  signature_seal: "İmzalandı ve mühürlendi",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR");
}

export default function DashboardPage() {
  const [docs, setDocs] = useState<DocumentSummaryOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.listDocuments();
      setDocs(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Belgeler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Belgeleriniz</h1>
        <p className="text-sm text-muted">
          Tüm dosyalar bu makinede yerel olarak saklanır. Hiçbir şey bir sağlayıcıya yüklenmez.
        </p>
      </div>

      <UploadForm onUploaded={load} />

      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && docs === null && <Loading label="Belgeler yükleniyor..." />}
      {!error && docs !== null && docs.length === 0 && (
        <EmptyState
          title="Henüz belge yok"
          description="Başlamak için yukarıdan bir PDF veya ofis dosyası yükleyin."
        />
      )}
      {!error && docs !== null && docs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 hover:border-accent"
              >
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted">
                    {doc.original_filename} · v{doc.latest_version} (
                    {OPERATION_LABELS[doc.latest_operation] || doc.latest_operation}) ·{" "}
                    {formatDate(doc.created_at)}
                  </p>
                </div>
                {doc.expires_at && (
                  <span className="rounded-full bg-warn-bg px-2 py-1 text-xs text-warn-fg">
                    {formatDate(doc.expires_at)} tarihinde silinecek
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
