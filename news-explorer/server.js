'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { COUNTRIES, TOPICS } = require('./data/meta');
const { HttpError } = require('./lib/query');
const { getNews, createMemoryCache } = require('./lib/news');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createServer({ newsBase = process.env.GOOGLE_NEWS_BASE || 'https://news.google.com' } = {}) {
  const cache = createMemoryCache();
  const handleNews = (url) => getNews(url.searchParams, { newsBase, cache });

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
  // Barındırma servisleri PORT tanımlar ve dışarıdan erişim ister; yerelde yalnızca localhost.
  const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
  createServer().listen(port, host, () => console.log(`Haber Atlası: http://${host}:${port}`));
}

module.exports = { createServer };
