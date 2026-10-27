// Cloudflare Worker girişi. Statik dosyalar (public/) Cloudflare tarafından doğrudan sunulur;
// yalnızca /api/* istekleri buraya gelir (bkz. wrangler.toml -> run_worker_first).
import { COUNTRIES, TOPICS } from './data/meta.js';
import { HttpError } from './lib/query.js';
import { getNews, createMemoryCache, CACHE_TTL_MS } from './lib/news.js';
import { translatorFromEnv } from './lib/translate.js';

const memory = createMemoryCache();

// Çevirmen isolate başına bir kez kurulur (önbelleği ve günlük sayacı orada tutulur).
let translator;
const getTranslator = (env) => (translator === undefined ? (translator = translatorFromEnv(env)) : translator);

const json = (body, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...extra } });

// Önbellek: Cloudflare Cache API (veri merkezi başına), yoksa isolate belleği.
function edgeCache(origin) {
  const store = globalThis.caches?.default;
  if (!store) return memory;
  const keyFor = (key) => new Request(`${origin}/__cache/${encodeURIComponent(key)}`);
  return {
    async get(key) {
      const res = await store.match(keyFor(key));
      return res ? res.json() : undefined;
    },
    async set(key, body) {
      await store.put(keyFor(key), Response.json(body, { headers: { 'cache-control': `public, max-age=${CACHE_TTL_MS / 1000}` } }));
    },
  };
}

export default {
  async fetch(request, env = {}) {
    try {
      const url = new URL(request.url);
      if (request.method === 'POST' && url.pathname === '/api/translate') {
        const t = getTranslator(env);
        if (!t) throw new HttpError(503, 'Çeviri bu sunucuda kapalı (ANTHROPIC_API_KEY tanımlı değil).');
        const raw = await request.text();
        if (raw.length > 100_000) throw new HttpError(413, 'İstek çok büyük.');
        let body;
        try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Geçersiz JSON.'); }
        return json({ translations: await t.translate(body?.texts), model: t.model });
      }
      if (request.method !== 'GET') return json({ error: 'Yalnızca GET desteklenir.' }, 405);
      if (url.pathname === '/api/meta') {
        return json({ countries: COUNTRIES, topics: TOPICS, translation: Boolean(getTranslator(env)) }, 200, { 'cache-control': 'public, max-age=300' });
      }
      if (url.pathname === '/api/news') {
        const body = await getNews(url.searchParams, {
          newsBase: env.GOOGLE_NEWS_BASE || 'https://news.google.com',
          cache: edgeCache(url.origin),
        });
        return json(body);
      }
      return json({ error: 'Bulunamadı' }, 404);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'Beklenmeyen bir hata oluştu.' }, 500);
    }
  },
};
