'use strict';

const { HttpError, parseSearchParams, dateOperators } = require('./query');
const { parseRss } = require('./rss');

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const FETCH_TIMEOUT_MS = 10000;
const CONCURRENCY = 4;
const PER_WINDOW_SINGLE = 100;
const PER_WINDOW_MULTI = 25;

// Node ve Cloudflare Worker ortak çekirdeği: yalnızca fetch ve AbortSignal kullanır.
async function fetchWindow(newsBase, ctx, win, limit) {
  const url = new URL('/rss/search', newsBase);
  url.searchParams.set('q', `${ctx.query} ${dateOperators(win)}`);
  url.searchParams.set('hl', ctx.country.hl);
  url.searchParams.set('gl', ctx.country.gl || ctx.country.code);
  url.searchParams.set('ceid', ctx.country.ceid);
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; HaberAtlasi/1.0)', accept: 'application/rss+xml, text/xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Kaynak ${res.status} döndürdü`);
  return parseRss(await res.text(), limit);
}

async function search(newsBase, ctx) {
  const limit = ctx.windows.length === 1 ? PER_WINDOW_SINGLE : PER_WINDOW_MULTI;
  const results = new Array(ctx.windows.length);
  let next = 0;
  const worker = async () => {
    while (next < ctx.windows.length) {
      const i = next++;
      try {
        results[i] = { items: await fetchWindow(newsBase, ctx, ctx.windows[i], limit) };
      } catch (err) {
        results[i] = { items: [], error: err.name === 'TimeoutError' ? 'Zaman aşımı' : err.message };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ctx.windows.length) }, worker));

  const seen = new Set();
  const items = [];
  results.forEach((r, i) => {
    for (const it of r.items) {
      const key = it.link || `${it.title}|${it.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ ...it, window: i });
    }
  });
  items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));

  return {
    query: ctx.query,
    windows: ctx.windows.map((w, i) => ({ ...w, count: results[i].items.length, error: results[i].error || null })),
    total: items.length,
    items,
  };
}

// cache: { get(key) -> body | undefined, set(key, body) } (eşzamansız olabilir)
async function getNews(searchParams, { newsBase, cache }) {
  const ctx = parseSearchParams(searchParams);
  const key = `${ctx.country.code}|${ctx.query}|${ctx.windows[0].from}|${ctx.windows.at(-1).to}`;
  const hit = await cache?.get(key);
  if (hit) return { ...hit, cached: true };

  const body = await search(newsBase, ctx);
  // Tüm pencereler hata verdiyse önbelleğe alma: geçici bir kesinti 10 dakika sürmesin.
  if (body.windows.every((w) => w.error)) throw new HttpError(502, `Haber kaynağına ulaşılamadı (${body.windows[0].error}).`);
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
