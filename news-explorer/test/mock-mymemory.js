'use strict';

// MyMemory GET /get taklidi. quotaAfter: bu kadar istekten sonra kota uyarısı döner; fail: 500.
const http = require('node:http');

function createMockMyMemory({ quotaAfter = Infinity, fail = false } = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const q = url.searchParams.get('q');
    requests.push({ path: url.pathname, q, langpair: url.searchParams.get('langpair'), de: url.searchParams.get('de') });
    res.setHeader('content-type', 'application/json');
    if (fail) { res.writeHead(500); return res.end('{}'); }
    if (requests.length > quotaAfter) {
      return res.end(JSON.stringify({ responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' }, responseStatus: 429, quotaFinished: true }));
    }
    res.end(JSON.stringify({ responseData: { translatedText: `TR: ${q} &amp; it&#39;s` }, responseStatus: 200 }));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ requests, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

module.exports = { createMockMyMemory };
