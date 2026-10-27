'use strict';

// Google News RSS'in küçük bir taklidi: sorgudaki after:/before: aralığına düşen sahte haberler üretir.
const http = require('node:http');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function createMockGoogleNews({ perRequest = 40, fail = false } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const q = url.searchParams.get('q') || '';
    requests.push({ path: url.pathname, q, hl: url.searchParams.get('hl'), gl: url.searchParams.get('gl'), ceid: url.searchParams.get('ceid') });
    if (fail) { res.writeHead(503); return res.end('down'); }
    const after = /after:(\d{4}-\d{2}-\d{2})/.exec(q)?.[1];
    const before = /before:(\d{4}-\d{2}-\d{2})/.exec(q)?.[1];
    const t0 = Date.parse(`${after}T00:00:00Z`);
    const t1 = Date.parse(`${before}T00:00:00Z`);
    const items = [];
    for (let i = 0; i < perRequest; i++) {
      const when = new Date(t1 - ((i + 1) * (t1 - t0)) / (perRequest + 1));
      const src = ['Anadolu Ajansı', 'Hürriyet', 'BBC', 'Reuters'][i % 4];
      items.push(`<item>
  <title>${esc(`Haber ${i} – ${q.slice(0, 30)} - ${src}`)}</title>
  <link>https://news.example.com/${after}/${i}</link>
  <pubDate>${when.toUTCString()}</pubDate>
  <source url="https://${src.replace(/\W/g, '').toLowerCase()}.example.com">${src}</source>
</item>`);
    }
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>mock</title>${items.join('')}</channel></rss>`);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, requests, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

module.exports = { createMockGoogleNews };
