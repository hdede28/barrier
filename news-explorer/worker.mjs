// Cloudflare Worker girişi. Statik dosyalar (public/) Cloudflare tarafından doğrudan sunulur;
// yalnızca /api/* istekleri buraya gelir (bkz. wrangler.toml -> run_worker_first).
import { COUNTRIES, TOPICS, WORLD } from './data/meta.js';
import { HttpError } from './lib/query.js';
import { getNews, createMemoryCache, CACHE_TTL_MS } from './lib/news.js';
import { translatorFromEnv, translationResponse } from './lib/translators.js';
import { createProviders, describe } from './lib/providers/index.js';
import { loadFeeds } from './data/feeds.js';
import { diagnose, formatText } from './lib/diagnose.js';
import { NAMES as MAARIF_NAMES } from './data/maarif.js';
import { TYPES as SOURCE_TYPES } from './data/source-types.js';
import { THEMES } from './data/radar.js';

const memory = createMemoryCache();

// Çevirmen isolate başına bir kez kurulur (önbelleği ve günlük sayacı orada tutulur).
let providers;
const getProviders = (env) => (providers ||= createProviders({ feeds: loadFeeds(env), disabled: (env.DISABLED_SOURCES || '').split(',').map((x) => x.trim()).filter(Boolean) }));
const baseUrls = (env) => Object.fromEntries(Object.entries({ gdelt: env.GDELT_BASE_URL, bing: env.BING_BASE_URL, reddit: env.REDDIT_BASE_URL, hn: env.HN_BASE_URL, mastodon: env.MASTODON_INSTANCES }).filter(([, v]) => v));

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
        if (!t) throw new HttpError(503, 'Çeviri bu sunucuda kapalı.');
        const raw = await request.text();
        if (raw.length > 100_000) throw new HttpError(413, 'İstek çok büyük.');
        let body;
        try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'Geçersiz JSON.'); }
        return json(translationResponse(t, await t.translate(body?.texts, { source: body?.source })));
      }
      if (request.method !== 'GET') return json({ error: 'Yalnızca GET desteklenir.' }, 405);
      if (url.pathname === '/api/meta') {
        return json({ countries: COUNTRIES, topics: TOPICS, world: WORLD, sourceTypes: SOURCE_TYPES, radar: { themes: THEMES.map(({ id, icon, label }) => ({ id, icon, label })) }, maarif: { names: MAARIF_NAMES }, version: env.APP_VERSION || 'worker', sources: describe(getProviders(env)), translation: getTranslator(env)?.provider || false }, 200, { 'cache-control': 'public, max-age=300' });
      }
      if (url.pathname === '/api/diagnose') {
        const report = await diagnose({ providers: getProviders(env), feeds: loadFeeds(env), bases: baseUrls(env), withFeeds: url.searchParams.get('feeds') === '1', version: env.APP_VERSION || 'worker' });
        if (url.searchParams.get('json') === '1') return json(report);
        return new Response(formatText(report), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (url.pathname === '/api/news') {
        const body = await getNews(url.searchParams, {
          newsBase: env.GOOGLE_NEWS_BASE,
          bases: baseUrls(env),
          providers: getProviders(env),
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
