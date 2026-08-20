"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Loading } from "@/components/StateViews";

export function PreviewGrid({ documentId, versionId }: { documentId: string; versionId: string }) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPageCount(null);
    setError(null);
    api
      .pageCount(documentId, versionId)
      .then((res) => {
        if (!cancelled) setPageCount(res.page_count);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Önizleme alınamadı.");
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, versionId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (pageCount === null) return <Loading label="Sayfa önizlemeleri hazırlanıyor..." />;
  if (pageCount === 0)
    return <p className="text-sm text-muted">Bu sürüm PDF değil, önizleme mevcut değil.</p>;

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
        <div key={page} className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={api.previewUrl(documentId, versionId, page)}
            alt={`Sayfa ${page}`}
            className="w-full rounded border border-border bg-white object-contain shadow-sm"
            loading="lazy"
          />
          <span className="text-xs text-muted">{page}</span>
        </div>
      ))}
    </div>
  );
}
