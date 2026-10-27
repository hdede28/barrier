'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { COUNTRIES, TOPICS, WORLD } = require('./data/meta');
const { HttpError } = require('./lib/query');
const { getNews, createMemoryCache } = require('./lib/news');
const { createProviders, describe } = require('./lib/providers');
const { loadFeeds } = require('./data/feeds');
const { diagnose, formatText } = require('./lib/diagnose');
const { NAMES: MAARIF_NAMES } = require('./data/maarif');
const { TYPES: SOURCE_TYPES } = require('./data/source-types');
const { THEMES } = require('./data/radar');
const { createFactChecker } = require('./lib/factcheck');
const { summarizerFromEnv } = require('./lib/summarize');
const { createFeedbackStore } = require('./lib/feedback');
const { translatorFromEnv, translationResponse } = require('./lib/translators');

// Tanımsız ortam değişkenlerini at, varsayılanlar devreye girsin.
const cleanBases = (b) => Object.fromEntries(Object.entries(b).filter(([, v]) => v));

// Hangi sürümün yayında olduğunu görmek için (Render commit numarasını verir).
const VERSION = (process.env.APP_VERSION || process.env.RENDER_GIT_COMMIT || require('./package.json').version).slice(0, 7);

// Hız sınırı için istemci adresi (kayıt altına alınmaz). Render gibi bir vekilin arkasında ilk X-Forwarded-For değeri.
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function createServer({
  newsBase = process.env.GOOGLE_NEWS_BASE,
  bases = { gdelt: process.env.GDELT_BASE_URL, bing: process.env.BING_BASE_URL, reddit: process.env.REDDIT_BASE_URL, hn: process.env.HN_BASE_URL, mastodon: process.env.MASTODON_INSTANCES },
  feeds = loadFeeds(),
  translator = translatorFromEnv(),
  timing,
  factChecker,
  summarizer = summarizerFromEnv(),
  feedback = createFeedbackStore({ file: process.env.FEEDBACK_FILE, adminToken: process.env.ADMIN_TOKEN }),
  breakingTtl = process.env.BREAKING_CACHE_SECONDS === undefined ? 60 : Number(process.env.BREAKING_CACHE_SECONDS),
  providers = createProviders({ feeds, disabled: (process.env.DISABLED_SOURCES || '').split(',').map((x) => x.trim()).filter(Boolean) }),
} = {}) {
  const cache = createMemoryCache();
  const checker = factChecker || createFactChecker({ providers, apiKey: process.env.FACTCHECK_API_KEY });
  const handleNews = (url, extra = {}) => getNews(url.searchParams, { newsBase, bases: cleanBases(bases), cache, providers, timing, breakingTtl, ...extra });

  // Akışlı yanıt (NDJSON): kaynaklar bittikçe ara sonuç ("partial"), sonunda "final". Yavaş bir kaynak, hızlı olanların sonuçlarını bekletmez.
  async function streamNews(url, res) {
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
    const write = (o) => { if (!res.writableEnded) res.write(`${JSON.stringify(o)}\n`); };
    try {
      write({ type: 'final', body: await handleNews(url, { onProgress: (body) => write({ type: 'partial', body }) }) });
    } catch (err) {
      const known = err instanceof HttpError;
      if (!known) console.error(err);
      write({ type: 'error', status: known ? err.status : 500, error: known ? err.message : 'Beklenmeyen bir hata oluştu.' });
    }
    res.end();
  }


  function readJson(req, maxBytes = 100_000) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let tooBig = false;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) tooBig = true;
        else chunks.push(c);
      });
      req.on('end', () => {
        if (tooBig) return reject(new HttpError(413, 'İstek çok büyük.'));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'Geçersiz JSON.')); }
      });
      req.on('error', reject);
    });
  }

  async function handleTranslate(req) {
    if (!translator) throw new HttpError(503, 'Çeviri bu sunucuda kapalı.');
    const body = await readJson(req);
    const translations = await translator.translate(body?.texts, { source: body?.source });
    return translationResponse(translator, translations);
  }

  function sendJson(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(data);
  }

  function serveStatic(url, res) {
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(PUBLIC_DIR, rel);
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'Yasak' });
    fs.readFile(file, (err, buf) => {
      if (err) return sendJson(res, 404, { error: 'Bulunamadı' });
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
      });
      res.end(buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'POST' && url.pathname === '/api/translate') return sendJson(res, 200, await handleTranslate(req));
      if (req.method === 'POST' && url.pathname === '/api/summarize') {
        if (!summarizer) throw new HttpError(503, 'Özet bu sunucuda kapalı (ANTHROPIC_API_KEY gerekir).');
        return sendJson(res, 200, await summarizer.summarize((await readJson(req))?.items));
      }
      if (req.method === 'POST' && url.pathname === '/api/feedback') return sendJson(res, 200, feedback.add(await readJson(req), clientIp(req)));
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Yalnızca GET desteklenir.' });
      if (url.pathname === '/api/meta') return sendJson(res, 200, { countries: COUNTRIES, topics: TOPICS, world: WORLD, stream: true, summary: Boolean(summarizer), factcheck: { available: checker.available, api: checker.hasApi }, sourceTypes: SOURCE_TYPES, radar: { themes: THEMES.map(({ id, icon, label }) => ({ id, icon, label })) }, maarif: { names: MAARIF_NAMES }, version: VERSION, sources: describe(providers), translation: translator?.provider || false });
      if (url.pathname === '/api/factcheck') return sendJson(res, 200, await checker.lookup(url.searchParams.get('q'), (url.searchParams.get('lang') || '').slice(0, 5)));
      if (url.pathname === '/api/feedback') return sendJson(res, 200, feedback.report(url.searchParams.get('token')));
      if (url.pathname === '/api/diagnose') {
        const report = await diagnose({ providers, feeds, bases: cleanBases(bases), withFeeds: url.searchParams.get('feeds') === '1', version: VERSION });
        if (url.searchParams.get('json') === '1') return sendJson(res, 200, report);
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(formatText(report));
      }
      if (url.pathname === '/api/news') return url.searchParams.get('stream') === '1' ? await streamNews(url, res) : sendJson(res, 200, await handleNews(url));
      return serveStatic(url, res);
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      if (err instanceof URIError) return sendJson(res, 400, { error: 'Geçersiz adres.' });
      console.error(err);
      return sendJson(res, 500, { error: 'Beklenmeyen bir hata oluştu.' });
    }
  });
  // Akışları arka planda ısıtır (ilk aramalar bellekten yanıtlansın); testlerde çağrılmaz.
  server.warm = () => providers.forEach((p) => p.warm?.());
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  // Barındırma servisleri PORT tanımlar ve dışarıdan erişim ister; yerelde yalnızca localhost.
  const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Haber Atlası: http://${host}:${port}`);
    if (process.env.WARM_FEEDS !== '0') setTimeout(() => server.warm(), 1500);
  });
}

module.exports = { createServer };
