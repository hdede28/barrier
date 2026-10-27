'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { COUNTRIES, TOPICS } = require('./data/meta');
const { HttpError, parseSearchParams, dateOperators } = require('./lib/query');
const { parseRss } = require('./lib/rss');

const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 300;
const FETCH_TIMEOUT_MS = 10000;
const CONCURRENCY = 4;
const PER_WINDOW_SINGLE = 100;
const PER_WINDOW_MULTI = 25;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createServer({ newsBase = process.env.GOOGLE_NEWS_BASE || 'https://news.google.com' } = {}) {
  const cache = new Map();

  async function fetchWindow(ctx, win) {
    const q = `${ctx.query} ${dateOperators(win)}`;
    const url = new URL('/rss/search', newsBase);
    url.searchParams.set('q', q);
    url.searchParams.set('hl', ctx.country.hl);
    url.searchParams.set('gl', ctx.country.code);
    url.searchParams.set('ceid', ctx.country.ceid);
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HaberAtlasi/1.0)', accept: 'application/rss+xml, text/xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Kaynak ${res.status} döndürdü`);
    return parseRss(await res.text());
  }

  async function search(ctx) {
    const limit = ctx.windows.length === 1 ? PER_WINDOW_SINGLE : PER_WINDOW_MULTI;
    const results = new Array(ctx.windows.length);
    let next = 0;
    const worker = async () => {
      while (next < ctx.windows.length) {
        const i = next++;
        try {
          results[i] = { items: (await fetchWindow(ctx, ctx.windows[i])).slice(0, limit) };
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

  async function handleNews(url) {
    const ctx = parseSearchParams(url.searchParams);
    const key = `${ctx.country.code}|${ctx.query}|${ctx.windows[0].from}|${ctx.windows.at(-1).to}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.body, cached: true };

    const body = await search(ctx);
    // Tüm pencereler hata verdiyse sonucu önbelleğe alma: geçici bir kesinti 10 dakika sürmesin.
    if (body.windows.some((w) => !w.error)) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), body });
    } else {
      throw new HttpError(502, `Haber kaynağına ulaşılamadı (${body.windows[0].error}).`);
    }
    return { ...body, cached: false };
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

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Yalnızca GET desteklenir.' });
      if (url.pathname === '/api/meta') return sendJson(res, 200, { countries: COUNTRIES, topics: TOPICS });
      if (url.pathname === '/api/news') return sendJson(res, 200, await handleNews(url));
      return serveStatic(url, res);
    } catch (err) {
      if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
      if (err instanceof URIError) return sendJson(res, 400, { error: 'Geçersiz adres.' });
      console.error(err);
      return sendJson(res, 500, { error: 'Beklenmeyen bir hata oluştu.' });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => console.log(`Haber Atlası: http://${host}:${port}`));
}

module.exports = { createServer };
