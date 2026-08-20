"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { EventOut } from "@/lib/types";
import { EmptyState, ErrorBox, Loading } from "@/components/StateViews";

export default function EventsPage() {
  const [events, setEvents] = useState<EventOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setEvents(await api.listEvents());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Etkinlik günlüğü yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Etkinlik Günlüğü</h1>
        <p className="text-sm text-muted">
          Ekleme-yalnızca denetim kaydı: her işlem, indirme ve teslim sonucu zaman damgası ve
          belge özeti (sha256) ile burada tutulur.
        </p>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!error && events === null && <Loading label="Kayıtlar yükleniyor..." />}
      {!error && events !== null && events.length === 0 && (
        <EmptyState title="Henüz kayıt yok" description="Bir işlem yaptığınızda burada görünecek." />
      )}
      {!error && events !== null && events.length > 0 && (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-2xl border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.event_type}</span>
                <span className="text-xs text-muted">
                  {new Date(e.created_at).toLocaleString("tr-TR")}
                </span>
              </div>
              <p className="mt-1 text-muted">{e.message}</p>
              {e.sha256 && (
                <p className="mt-1 truncate font-mono text-xs text-muted" title={e.sha256}>
                  sha256: {e.sha256}
                </p>
              )}
              {e.outcome && (
                <span className="mt-1 inline-block rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                  sonuç: {e.outcome}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
