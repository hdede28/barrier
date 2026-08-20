"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useOperation } from "@/lib/useOperation";
import type { DocumentSummaryOut, VersionOut } from "@/lib/types";
import { WarningsList } from "@/components/StateViews";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-border bg-surface p-4" open={false}>
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

function RunButton({
  status,
  error,
  onClick,
  label = "Uygula",
}: {
  status: "idle" | "loading" | "error" | "success";
  error: string;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div>
      <button
        onClick={onClick}
        disabled={status === "loading"}
        className="rounded-md cta-gradient px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
      >
        {status === "loading" ? "Çalışıyor..." : label}
      </button>
      {status === "error" && <p className="mt-1 text-xs text-danger">{error}</p>}
      {status === "success" && <p className="mt-1 text-xs text-success">Yeni sürüm oluşturuldu.</p>}
    </div>
  );
}

export function OperationsPanel({
  documentId,
  version,
  isPdf,
  warnings,
  otherDocuments,
  onChanged,
}: {
  documentId: string;
  version: VersionOut;
  isPdf: boolean;
  warnings: string[];
  otherDocuments: DocumentSummaryOut[];
  onChanged: () => void;
}) {
  const router = useRouter();

  const convertOp = useOperation(() => api.convert(documentId, version.id));

  const [angle, setAngle] = useState(90);
  const [pagesText, setPagesText] = useState("");
  const rotateOp = useOperation(() =>
    api.rotate(
      documentId,
      version.id,
      angle,
      pagesText.trim() ? pagesText.split(",").map((n) => parseInt(n.trim(), 10)) : undefined
    )
  );

  const [orderText, setOrderText] = useState("");
  const reorderOp = useOperation(() =>
    api.reorder(
      documentId,
      version.id,
      orderText.split(",").map((n) => parseInt(n.trim(), 10))
    )
  );

  const [quality, setQuality] = useState("medium");
  const compressOp = useOperation(() => api.compress(documentId, version.id, quality));

  const [wmText, setWmText] = useState("TASLAK");
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmPosition, setWmPosition] = useState("diagonal");
  const watermarkOp = useOperation(() =>
    api.watermark(documentId, version.id, wmText, wmOpacity, wmPosition)
  );

  const [regions, setRegions] = useState([{ page: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.1 }]);
  const redactOp = useOperation(() => api.redact(documentId, version.id, regions));

  const [ocrLang, setOcrLang] = useState("eng");
  const ocrOp = useOperation(() => api.ocr(documentId, version.id, ocrLang));

  const [rangesText, setRangesText] = useState("1-1");
  const splitOp = useOperation(() =>
    api.split(
      documentId,
      version.id,
      rangesText.split(",").map((r) => r.trim().split("-").map((n) => parseInt(n, 10)))
    )
  );

  const [mergeTargetId, setMergeTargetId] = useState("");
  const mergeOp = useOperation(async () => {
    const target = await api.getDocument(mergeTargetId);
    const targetVersion = target.versions[target.versions.length - 1];
    return api.merge(`${target.title} + belge`, [
      { document_id: documentId, version_id: version.id },
      { document_id: target.id, version_id: targetVersion.id },
    ]);
  });

  async function withRefresh(op: { run: () => Promise<unknown> }) {
    await op.run();
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <WarningsList warnings={warnings} />

      {!isPdf && (
        <Section title="PDF'e Dönüştür">
          <p className="text-xs text-muted">
            Bu sürüm bir ofis belgesi. Diğer işlemleri kullanabilmek için önce PDF&apos;e
            dönüştürün (LibreOffice ile yerel olarak).
          </p>
          <RunButton
            status={convertOp.status}
            error={convertOp.error}
            onClick={() => withRefresh(convertOp)}
            label="PDF'e dönüştür"
          />
        </Section>
      )}

      {isPdf && (
        <>
          <Section title="Döndür">
            <div className="flex gap-2">
              <select
                value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value, 10))}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
              <input
                value={pagesText}
                onChange={(e) => setPagesText(e.target.value)}
                placeholder="Sayfalar (ör. 1,3) — boş = tümü"
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </div>
            <RunButton status={rotateOp.status} error={rotateOp.error} onClick={() => withRefresh(rotateOp)} />
          </Section>

          <Section title="Yeniden Sırala">
            <input
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder="Yeni sayfa sırası, ör. 3,1,2"
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <RunButton status={reorderOp.status} error={reorderOp.error} onClick={() => withRefresh(reorderOp)} />
          </Section>

          <Section title="Sıkıştır">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="low">Düşük boyut (daha çok kayıp)</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek kalite</option>
            </select>
            <RunButton status={compressOp.status} error={compressOp.error} onClick={() => withRefresh(compressOp)} />
          </Section>

          <Section title="Filigran Ekle">
            <input
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <select
                value={wmPosition}
                onChange={(e) => setWmPosition(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <option value="center">Orta</option>
                <option value="diagonal">Çapraz</option>
                <option value="top">Üst</option>
                <option value="bottom">Alt</option>
              </select>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
              />
              <span className="text-xs text-muted">Saydamlık {wmOpacity}</span>
            </div>
            <RunButton status={watermarkOp.status} error={watermarkOp.error} onClick={() => withRefresh(watermarkOp)} />
          </Section>

          <Section title="Sansürle (best-effort)">
            <p className="text-xs text-warn-fg">
              ⚠ Bu sansürleme opak kutu çizer ve tespit edebildiği metni siler; garanti değildir —
              paylaşmadan önce görsel olarak doğrulayın.
            </p>
            {regions.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Bölge {i + 1}</span>
                {(["page", "x", "y", "w", "h"] as const).map((field) => (
                  <input
                    key={field}
                    type="number"
                    step={field === "page" ? 1 : 0.01}
                    value={r[field]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setRegions((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, [field]: v } : row))
                      );
                    }}
                    className="w-16 rounded-md border border-border bg-background px-1 py-1 text-xs"
                    title={field}
                  />
                ))}
                <button
                  onClick={() => setRegions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-danger"
                >
                  Kaldır
                </button>
              </div>
            ))}
            <button
              onClick={() => setRegions((prev) => [...prev, { page: 1, x: 0.1, y: 0.1, w: 0.2, h: 0.05 }])}
              className="self-start text-xs text-accent hover:underline"
            >
              + Bölge ekle
            </button>
            <p className="text-xs text-muted">
              Koordinatlar sayfa boyutuna göre 0–1 arası orandır (x,y sol üstten).
            </p>
            <RunButton status={redactOp.status} error={redactOp.error} onClick={() => withRefresh(redactOp)} />
          </Section>

          <Section title="OCR (Aranabilir metin ekle)">
            <input
              value={ocrLang}
              onChange={(e) => setOcrLang(e.target.value)}
              placeholder="Dil kodu (ör. eng, tur)"
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <RunButton status={ocrOp.status} error={ocrOp.error} onClick={() => withRefresh(ocrOp)} />
          </Section>

          <Section title="Böl">
            <input
              value={rangesText}
              onChange={(e) => setRangesText(e.target.value)}
              placeholder="Aralıklar, ör. 1-2,3-6"
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <p className="text-xs text-muted">Her aralık yeni, ayrı bir belge olarak oluşturulur.</p>
            <RunButton status={splitOp.status} error={splitOp.error} onClick={() => withRefresh(splitOp)} />
          </Section>

          {otherDocuments.length > 0 && (
            <Section title="Başka Bir Belgeyle Birleştir">
              <select
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              >
                <option value="">Belge seçin…</option>
                {otherDocuments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Bu belgenin görüntülenen sürümü, seçilen belgenin son sürümüyle birleştirilerek
                yeni bir belge oluşturulur.
              </p>
              <RunButton
                status={mergeOp.status}
                error={mergeOp.error}
                onClick={() => mergeTargetId && withRefresh(mergeOp)}
                label="Birleştir"
              />
            </Section>
          )}

          <Section title="İmza İsteği Oluştur">
            <p className="text-xs text-muted">
              İmza alanları yerleştirin, imzacıları davet edin ve son PDF&apos;i mühürleyin. Bu tip
              elektronik imza (yazılı ad) resmi/nitelikli bir imza değildir.
            </p>
            <button
              onClick={() => router.push(`/documents/${documentId}/sign-setup?version=${version.id}`)}
              className="self-start rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/5"
            >
              İmza akışını başlat
            </button>
          </Section>
        </>
      )}
    </div>
  );
}
