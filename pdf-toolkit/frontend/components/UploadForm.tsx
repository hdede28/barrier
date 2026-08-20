"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setError("Lütfen bir dosya seçin.");
      return;
    }
    const title = titleRef.current?.value?.trim() || file.name;
    setStatus("loading");
    setError("");
    try {
      await api.uploadDocument(file, title);
      setStatus("success");
      if (fileRef.current) fileRef.current.value = "";
      if (titleRef.current) titleRef.current.value = "";
      onUploaded();
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Yükleme başarısız oldu.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">Başlık (opsiyonel)</label>
        <input
          ref={titleRef}
          type="text"
          placeholder="Belge başlığı"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">
          Dosya (PDF, Word, Excel, PowerPoint, ODF, RTF, TXT)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.odt,.rtf,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.txt"
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-md cta-gradient px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {status === "loading" ? "Yükleniyor..." : "Yükle"}
      </button>
      {status === "error" && <p className="text-sm text-danger sm:basis-full">{error}</p>}
      {status === "success" && (
        <p className="text-sm text-success sm:basis-full">Belge yüklendi.</p>
      )}
    </form>
  );
}
