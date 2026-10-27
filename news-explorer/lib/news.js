'use strict';

const { HttpError, parseSearchParams } = require('./query');
const { createProviders, selectProviders, DEFAULT_BASES } = require('./providers');
const { errorText, withDeadline } = require('./providers/common');
const { foreignFocus, offTopic, themesOf } = require('./relevance');
const { clusterStories, tokens } = require('./cluster');
const { classifySource } = require('../data/source-types');

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;

// Başlıkları "aynı haber mi?" diye kıyaslamak için: harf ve rakam dışını atar.
const titleKey = (t) => t.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Aynı haberin farklı adresleri aynı sayılsın: izleme parametreleri, # parçası, sondaki / ve büyük/küçük harf farkı atılır.
const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_|oc$|cmpid|ocid|smid|source$)/i;
function canonLink(link) {
  try {
    const u = new URL(link);
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    return `${u.hostname}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return link;
  }
}

// Doğrulama kuruluşlarının incelemelerini, başlığı benzeyen haberlere "ilgili doğrulama" olarak bağlar.
// Bu bir hüküm değildir: eşleşme başlık benzerliğine dayanır ve yanlış eşleşebilir, bu yüzden kullanıcıya bağlantı olarak sunulur.
function linkFactChecks(items) {
  const checks = items.filter((it) => it.kind === 'factcheck');
  if (!checks.length) return;
  const checkTokens = checks.map((c) => tokens(c.title));
  for (const it of items) {
    if (it.kind !== 'news') continue;
    const t = tokens(it.title);
    if (t.size < 3) continue;
    const found = [];
    checks.forEach((c, i) => {
      let shared = 0;
      for (const x of t) if (checkTokens[i].has(x)) shared++;
      if (shared >= 3 && shared / Math.min(t.size, checkTokens[i].size) >= 0.5) found.push({ source: c.source, link: c.link, title: c.title });
    });
    if (found.length) it.factchecks = found.slice(0, 3);
  }
}

function windowIndex(windows, published) {
  if (!published) return null;
  const day = published.slice(0, 10);
  const i = windows.findIndex((w) => day >= w.from && day <= w.to);
  return i < 0 ? null : i;
}

const DEFAULT_DEADLINE_MS = 15000; // bir kaynağın en fazla bekleneceği süre (kaynağın kendi `deadline` değeri öncelikli)
const EMIT_GAP_MS = 800; // ara sonuçlar en fazla bu sıklıkta gönderilir

// Tek bir kaynağı çalıştırır. Yavaş ya da takılan kaynak zaman sınırında hata olarak kapanır; diğer kaynaklar beklemez.
async function runProvider(p, ctx, deps) {
  const skipped = p.skip(ctx, deps);
  if (skipped) return { p, items: [], skipped, ms: 0 };
  const limit = deps.deadlines?.[p.id] ?? p.deadline ?? DEFAULT_DEADLINE_MS;
  const t0 = Date.now();
  try {
    return { p, ...(await withDeadline(p.fetch(ctx, deps), limit)), ms: Date.now() - t0 };
  } catch (err) {
    return { p, items: [], error: errorText(err), ms: Date.now() - t0 };
  }
}

// Biten kaynakların sonuçlarını tek gövdede birleştirir (runs[i] === null: o kaynak hâlâ bekleniyor).
function buildBody(ctx, providers, runs, partial) {
  const done = runs.filter(Boolean);

  // Aynı haber tek satırda toplanır; hangi kaynaklarda göründüğü saklanır. Adres aynıysa her zaman aynı haberdir;
  // başlık aynıysa yalnızca farklı kaynaklar arasında (aynı kaynağın günlük tekrarlanan başlıkları silinmesin).
  const byLink = new Map();
  const byTitle = new Map();
  const items = [];
  for (const run of done) {
    for (const it of run.items) {
      const tk = titleKey(it.title);
      const sameTitle = tk.length >= 15 ? byTitle.get(tk) : null;
      const dup = byLink.get(canonLink(it.link)) || (sameTitle && sameTitle.provider !== run.p.id ? sameTitle : null);
      if (dup) {
        if (dup.provider !== run.p.id && !dup.alsoIn.includes(run.p.label)) dup.alsoIn.push(run.p.label);
        continue;
      }
      const item = { ...it, provider: run.p.id, kind: run.p.kind, alsoIn: [], window: it.window ?? windowIndex(ctx.windows, it.published) };
      byLink.set(canonLink(it.link), item);
      if (tk.length >= 15 && !sameTitle) byTitle.set(tk, item);
      items.push(item);
    }
  }
  for (const it of items) {
    const c = it.kind === 'factcheck' ? { types: ['factcheck'] } : classifySource(it.source);
    if (c) it.sourceType = c;
  }
  linkFactChecks(items);
  // Süzgeçler: (1) ülke seçiliyken başlığı başka bir ülkeyi/bölgeyi konu alan, (2) konu seçiliyken başlığı o konuyla ilgisiz haberler.
  const hiddenBy = { country: 0, topic: 0 };
  const own = ctx.city ? ctx.city.split('/').map((c) => c.trim()).filter(Boolean) : [];
  // Son dakika: yalnızca son N saatte yayınlanmış ve tarihi bilinen haberler.
  const fresh = ctx.mode === 'breaking' ? items.filter((it) => it.published && Date.parse(it.published) >= ctx.sinceMs) : items;
  const passed = fresh.filter((it) => {
    if (ctx.strict && foreignFocus(it.title, ctx.country, own)) { hiddenBy.country++; return false; }
    // Konuya özel akıştan (ör. BBC Eğitim) gelen haber zaten konuya aittir.
    if (ctx.topicStrict && !it.topicTrusted && offTopic(it.title, ctx.topic, it.lang || 'en')) { hiddenBy.topic++; return false; }
    return true;
  });
  const hidden = hiddenBy.country + hiddenBy.topic;
  // Eğitim radarı: her habere hangi temalara girdiği eklenir; tema seçildiyse yalnızca o temalara girenler kalır.
  let themed = passed;
  const themeCounts = {};
  if (ctx.mode === 'radar') {
    themed = [];
    for (const it of passed) {
      it.themes = themesOf(it.title);
      if (!ctx.themes.length || it.themes.some((t) => ctx.themes.includes(t))) themed.push(it);
    }
    for (const it of themed) for (const t of it.themes) themeCounts[t] = (themeCounts[t] || 0) + 1;
  }
  // Benzer başlıklı haberler tek habere toplanır (kaç bağımsız kaynakta çıktığı story.count'ta). Sıra: en son güncellenen önce.
  const visible = ctx.cluster ? clusterStories(themed) : themed;
  const recency = (it) => it.story?.last || it.published || '';
  visible.sort((a, b) => recency(b).localeCompare(recency(a)));

  const google = runs.find((r) => r?.p.id === 'google');
  const counts = ctx.windows.map(() => 0);
  visible.forEach((it) => { if (it.window !== null) counts[it.window]++; });
  const shown = {};
  visible.forEach((it) => { shown[it.provider] = (shown[it.provider] || 0) + 1; });

  return {
    query: ctx.query,
    windows: ctx.windows.map((w, i) => ({ ...w, count: counts[i], error: google?.windowErrors?.[i] || null })),
    total: visible.length,
    hidden,
    hiddenBy,
    mode: ctx.mode,
    hours: ctx.hours || null,
    generatedAt: new Date().toISOString(),
    world: ctx.world,
    themeCounts: ctx.mode === 'radar' ? themeCounts : undefined,
    partial,
    pending: runs.filter((r) => !r).length,
    items: visible,
    sources: providers.map((p, i) => {
      const r = runs[i];
      if (!r) return { id: p.id, label: p.label, kind: p.kind, pending: true, count: 0, found: 0, error: null, skipped: null, note: null };
      return {
        id: p.id, label: p.label, kind: p.kind, pending: false,
        count: shown[p.id] || 0, found: r.items.length, error: r.error || null, skipped: r.skipped || null, note: r.note || null, ms: r.ms,
      };
    }),
  };
}

// Node ve Cloudflare Worker ortak çekirdeği: yalnızca fetch ve AbortSignal kullanır.
// onProgress(body): kaynaklar bittikçe (en fazla EMIT_GAP_MS aralıkla) o ana kadarki birleşik sonuç.
async function search(ctx, providers, deps, onProgress) {
  const runs = new Array(providers.length).fill(null);
  let lastEmit = 0;
  await Promise.all(providers.map(async (p, i) => {
    runs[i] = await runProvider(p, ctx, deps);
    const waiting = runs.some((r) => !r);
    if (onProgress && waiting && Date.now() - lastEmit >= EMIT_GAP_MS) {
      lastEmit = Date.now();
      onProgress(buildBody(ctx, providers, runs, true));
    }
  }));
  return buildBody(ctx, providers, runs, false);
}

// cache: { get(key) -> body | undefined, set(key, body) } (eşzamansız olabilir)
async function getNews(searchParams, { newsBase, bases = {}, cache, providers = createProviders(), now = new Date(), timing, breakingTtl = 60, deadlines, onProgress }) {
  const ctx = parseSearchParams(searchParams, now);
  const chosen = selectProviders(providers, ctx.sources);
  if (!chosen.length) throw new HttpError(400, 'Geçerli bir kaynak seçilmedi.');
  const deps = { bases: { ...DEFAULT_BASES, ...bases, ...(newsBase && { google: newsBase }) }, now, ...(timing && { timing }), ...(deadlines && { deadlines }) };

  // Son dakika önbelleği kısa tutulur (varsayılan 60 sn); 0 = önbellek yok
  const bucket = ctx.mode === 'breaking' ? (breakingTtl > 0 ? Math.floor(Date.now() / (breakingTtl * 1000)) : Math.random()) : '';
  const key = `${ctx.mode}|${ctx.hours}|${bucket}|${ctx.country.code}|${ctx.topic}|${ctx.city}|${ctx.query}|${ctx.windows[0].from}|${ctx.windows.at(-1).to}|${chosen.map((p) => p.id).join(',')}|${ctx.strict}|${ctx.topicStrict}|${ctx.cluster}|${ctx.themes.join('+')}`;
  const hit = await cache?.get(key);
  if (hit) return { ...hit, cached: true };

  const body = await search(ctx, chosen, deps, onProgress);
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
