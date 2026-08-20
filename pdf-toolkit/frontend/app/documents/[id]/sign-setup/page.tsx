"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { PreviewGrid } from "@/components/PreviewGrid";
import { ErrorBox } from "@/components/StateViews";

interface SignerRow {
  name: string;
  email: string;
}

interface FieldRow {
  signer_email: string;
  page_number: number;
  x: number;
  y: number;
  w: number;
  h: number;
  field_type: string;
}

export default function SignSetupPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const versionId = searchParams.get("version") || "";
  const router = useRouter();

  const [signers, setSigners] = useState<SignerRow[]>([{ name: "", email: "" }]);
  const [fields, setFields] = useState<FieldRow[]>([
    { signer_email: "", page_number: 1, x: 0.1, y: 0.8, w: 0.3, h: 0.08, field_type: "signature" },
  ]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setStatus("loading");
    setError("");
    try {
      const req = await api.createSignatureRequest(
        versionId,
        signers.map((s, i) => ({ name: s.name, email: s.email, order_index: i })),
        fields
      );
      router.push(`/signatures/${req.id}`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "İmza isteği oluşturulamadı.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">İmza Alanlarını Yerleştir</h1>
      <p className="text-sm text-warn-fg">
        ⚠ Bu tip elektronik imza yazılı ad tabanlıdır; resmi kimlik doğrulama veya nitelikli
        elektronik imza sağlamaz.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Belge önizlemesi (koordinat tahmini için)</h2>
        <PreviewGrid documentId={id} versionId={versionId} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">İmzacılar</h2>
        {signers.map((s, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input
              placeholder="Ad Soyad"
              value={s.name}
              onChange={(e) =>
                setSigners((prev) => prev.map((row, idx) => (idx === i ? { ...row, name: e.target.value } : row)))
              }
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              placeholder="E-posta"
              value={s.email}
              onChange={(e) =>
                setSigners((prev) => prev.map((row, idx) => (idx === i ? { ...row, email: e.target.value } : row)))
              }
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <button onClick={() => setSigners((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-danger">
              Kaldır
            </button>
          </div>
        ))}
        <button
          onClick={() => setSigners((prev) => [...prev, { name: "", email: "" }])}
          className="text-xs text-accent hover:underline"
        >
          + İmzacı ekle
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">İmza Alanları</h2>
        {fields.map((f, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <select
              value={f.signer_email}
              onChange={(e) =>
                setFields((prev) => prev.map((row, idx) => (idx === i ? { ...row, signer_email: e.target.value } : row)))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">İmzacı e-postası seç…</option>
              {signers.filter((s) => s.email).map((s) => (
                <option key={s.email} value={s.email}>
                  {s.email}
                </option>
              ))}
            </select>
            {(["page_number", "x", "y", "w", "h"] as const).map((field) => (
              <input
                key={field}
                type="number"
                step={field === "page_number" ? 1 : 0.01}
                value={f[field]}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setFields((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
                }}
                className="w-16 rounded-md border border-border bg-background px-1 py-1 text-xs"
                title={field}
              />
            ))}
            <select
              value={f.field_type}
              onChange={(e) =>
                setFields((prev) => prev.map((row, idx) => (idx === i ? { ...row, field_type: e.target.value } : row)))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="signature">İmza</option>
              <option value="initial">Paraf</option>
              <option value="date">Tarih</option>
              <option value="text">Metin</option>
            </select>
            <button onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-danger">
              Kaldır
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setFields((prev) => [
              ...prev,
              { signer_email: "", page_number: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.08, field_type: "signature" },
            ])
          }
          className="text-xs text-accent hover:underline"
        >
          + Alan ekle
        </button>
        <p className="mt-2 text-xs text-muted">
          Koordinatlar sayfa boyutuna göre 0–1 arası orandır (x,y sol üstten başlar).
        </p>
      </div>

      {status === "error" && <ErrorBox message={error} />}
      <button
        onClick={handleSubmit}
        disabled={status === "loading"}
        className="self-start rounded-md cta-gradient px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {status === "loading" ? "Oluşturuluyor..." : "İmza İsteği Oluştur"}
      </button>
    </div>
  );
}
