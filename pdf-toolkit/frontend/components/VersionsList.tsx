"use client";

import type { VersionOut } from "@/lib/types";
import { api } from "@/lib/api";

const OPERATION_LABELS: Record<string, string> = {
  original: "Orijinal (değiştirilemez)",
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

export function VersionsList({
  documentId,
  versions,
  activeVersionId,
  onSelect,
}: {
  documentId: string;
  versions: VersionOut[];
  activeVersionId: string;
  onSelect: (versionId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">Sürüm geçmişi (her biri değiştirilemez)</h2>
      <ul className="flex flex-col gap-2">
        {[...versions].reverse().map((v) => (
          <li
            key={v.id}
            className={`rounded-md border p-3 text-sm ${
              v.id === activeVersionId ? "border-accent bg-accent/5" : "border-border"
            }`}
          >
            <button className="w-full text-left" onClick={() => onSelect(v.id)}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  v{v.version_number} · {OPERATION_LABELS[v.operation_type] || v.operation_type}
                </span>
                <span className="text-xs text-muted">
                  {new Date(v.created_at).toLocaleString("tr-TR")}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-xs text-muted" title={v.sha256}>
                sha256: {v.sha256.slice(0, 16)}… · {(v.size_bytes / 1024).toFixed(0)} KB
              </p>
            </button>
            <a
              href={api.downloadUrl(documentId, v.id)}
              className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
            >
              İndir
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
