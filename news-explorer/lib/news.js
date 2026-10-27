'use strict';

const { HttpError, parseSearchParams } = require('./query');
const { createProviders, selectProviders, DEFAULT_BASES } = require('./providers');
const { errorText } = require('./providers/common');

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;

// Başlıkları "aynı haber mi?" diye kıyaslamak için: harf ve rakam dışını atar.
const titleKey = (t) => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function windowIndex(windows, published) {
  if (!published) return null;
  const day = published.slice(0, 10);
  const i = windows.findIndex((w) => day >= w.from && day <= w.to);
  return i < 0 ? null : i;
}

// Node ve Cloudflare Worker ortak çekirdeği: yalnızca fetch ve AbortSignal kullanır.
async function search(ctx, providers, deps) {
  const runs = await Promise.all(providers.map(async (p) => {
    const skipped = p.skip(ctx, deps);
    if (skipped) return { p, items: [], skipped };
    try {
      return { p, ...(await p.fetch(ctx, deps)) };
    } catch (err) {
      return { p, items: [], error: errorText(err) };
    }
  }));

  // Aynı haber tek satırda toplanır; hangi kaynaklarda göründüğü saklanır. Adres aynıysa her zaman aynı haberdir;
  // başlık aynıysa yalnızca farklı kaynaklar arasında (aynı kaynağın günlük tekrarlanan başlıkları silinmesin).
  const byLink = new Map();
  const byTitle = new Map();
  const items = [];
  for (const run of runs) {
    for (const it of run.items) {
      const tk = titleKey(it.title);
      const sameTitle = tk.length >= 15 ? byTitle.get(tk) : null;
      const dup = byLink.get(it.link) || (sameTitle && sameTitle.provider !== run.p.id ? sameTitle : null);
      if (dup) {
        if (dup.provider !== run.p.id && !dup.alsoIn.includes(run.p.label)) dup.alsoIn.push(run.p.label);
        continue;
      }
      const item = { ...it, provider: run.p.id, kind: run.p.kind, alsoIn: [], window: it.window ?? windowIndex(ctx.windows, it.published) };
      byLink.set(it.link, item);
      if (tk.length >= 15 && !sameTitle) byTitle.set(tk, item);
      items.push(item);
    }
  }
  items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));

  const google = runs.find((r) => r.p.id === 'google');
  const counts = ctx.windows.map(() => 0);
  items.forEach((it) => { if (it.window !== null) counts[it.window]++; });
  const shown = {};
  items.forEach((it) => { shown[it.provider] = (shown[it.provider] || 0) + 1; });

  return {
    query: ctx.query,
    windows: ctx.windows.map((w, i) => ({ ...w, count: counts[i], error: google?.windowErrors?.[i] || null })),
    total: items.length,
    items,
    sources: runs.map((r) => ({
      id: r.p.id, label: r.p.label, kind: r.p.kind,
      count: shown[r.p.id] || 0, found: r.items.length, error: r.error || null, skipped: r.skipped || null, note: r.note || null,
    })),
  };
}

// cache: { get(key) -> body | undefined, set(key, body) } (eşzamansız olabilir)
async function getNews(searchParams, { newsBase, bases = {}, cache, providers = createProviders(), now = new Date() }) {
  const ctx = parseSearchParams(searchParams, now);
  const chosen = selectProviders(providers, ctx.sources);
  if (!chosen.length) throw new HttpError(400, 'Geçerli bir kaynak seçilmedi.');
  const deps = { bases: { ...DEFAULT_BASES, ...bases, ...(newsBase && { google: newsBase }) }, now };

  const key = `${ctx.country.code}|${ctx.query}|${ctx.windows[0].from}|${ctx.windows.at(-1).to}|${chosen.map((p) => p.id).join(',')}`;
  const hit = await cache?.get(key);
  if (hit) return { ...hit, cached: true };

  const body = await search(ctx, chosen, deps);
  // Çalışan hiçbir kaynak yoksa (hepsi hata verdiyse) önbelleğe alma: geçici bir kesinti 10 dakika sürmesin.
  const failed = body.sources.filter((s) => s.error);
  if (failed.length && failed.length === body.sources.filter((s) => !s.skipped).length) {
    throw new HttpError(502, `Haber kaynaklarına ulaşılamadı (${failed[0].label}: ${failed[0].error}).`);
  }
  await cache?.set(key, body);
  return { ...body, cached: false };
}

function createMemoryCache({ ttl = CACHE_TTL_MS, max = CACHE_MAX } = {}) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      return hit && Date.now() - hit.at < ttl ? hit.body : undefined;
    },
    set(key, body) {
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { at: Date.now(), body });
    },
  };
}

module.exports = { getNews, createMemoryCache, CACHE_TTL_MS };
