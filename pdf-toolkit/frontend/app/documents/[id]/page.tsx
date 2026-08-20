"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { DocumentOut, DocumentSummaryOut, InspectOut } from "@/lib/types";
import { ErrorBox, Loading } from "@/components/StateViews";
import { VersionsList } from "@/components/VersionsList";
import { PreviewGrid } from "@/components/PreviewGrid";
import { OperationsPanel } from "@/components/OperationsPanel";

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectOut | null>(null);
  const [otherDocs, setOtherDocs] = useState<DocumentSummaryOut[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.getDocument(id);
      setDoc(d);
      const latest = d.versions[d.versions.length - 1];
      setActiveVersionId((prev) => prev ?? latest.id);
      const all = await api.listDocuments();
      setOtherDocs(all.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Belge yüklenemedi.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!doc || !activeVersionId) return;
    let cancelled = false;
    setInspect(null);
    api
      .inspectVersion(doc.id, activeVersionId)
      .then((res) => {
        if (!cancelled) setInspect(res);
      })
      .catch(() => {
        if (!cancelled) setInspect(null);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, activeVersionId]);

  async function handleChanged() {
    const refreshed = await api.getDocument(id);
    setDoc(refreshed);
    setActiveVersionId(refreshed.versions[refreshed.versions.length - 1].id);
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    await api.deleteDocument(id);
    router.push("/");
  }

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!doc || !activeVersionId) return <Loading label="Belge yükleniyor..." />;

  const activeVersion = doc.versions.find((v) => v.id === activeVersionId) ?? doc.versions[doc.versions.length - 1];
  const isPdf = inspect !== null && (inspect.page_count > 0 || activeVersion.operation_type !== "original" || doc.mime_type === "application/pdf");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{doc.title}</h1>
          <p className="text-sm text-muted">{doc.original_filename}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={api.exportDocumentUrl(doc.id)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background"
          >
            Dışa aktar (.zip)
          </a>
          <button
            onClick={handleDelete}
            className="rounded-md border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
          >
            {deleteConfirm ? "Emin misiniz? Tekrar tıklayın" : "Kalıcı olarak sil"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Sayfa önizlemeleri (v{activeVersion.version_number})
            </h2>
            <PreviewGrid documentId={doc.id} versionId={activeVersion.id} />
          </div>
          <OperationsPanel
            documentId={doc.id}
            version={activeVersion}
            isPdf={isPdf}
            warnings={inspect?.warnings ?? activeVersion.warnings}
            otherDocuments={otherDocs}
            onChanged={handleChanged}
          />
        </div>
        <div>
          <VersionsList
            documentId={doc.id}
            versions={doc.versions}
            activeVersionId={activeVersion.id}
            onSelect={setActiveVersionId}
          />
        </div>
      </div>
    </div>
  );
}
