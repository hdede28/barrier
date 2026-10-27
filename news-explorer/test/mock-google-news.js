'use strict';

// Haber kaynaklarının küçük bir taklidi (tek sunucuda):
//   /rss/search          Google Haberler RSS (after:/before: aralığına düşen sahte haberler)
//   /api/v2/doc/doc      GDELT DOC API (JSON)
//   /news/search         Bing Haberler RSS (apiclick yönlendirmeli bağlantılar, News:Source)
//   /feeds/*.xml         yayıncı RSS'i, küresel RSS ve Atom (sosyal medya) akışları
const http = require('node:http');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rss = (items) => `<?xml version="1.0"?><rss version="2.0" xmlns:News="https://www.bing.com/news"><channel><title>mock</title>${items.join('')}</channel></rss>`;
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);

function createMockGoogleNews({ perRequest = 40, fail = false, gdeltFail = false, bingFail = false, gdelt429Times = 0 } = {}) {
  let gdeltCalls = 0;
  const requests = [];
  const log = (url, extra) => requests.push({ path: url.pathname, q: url.searchParams.get('q') || url.searchParams.get('query'), ...extra });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');

    if (url.pathname === '/api/v2/doc/doc') {
      log(url, { start: url.searchParams.get('startdatetime'), end: url.searchParams.get('enddatetime') });
      if (gdeltFail) { res.writeHead(200); return res.end('Your query was too short or too common.'); }
      if (++gdeltCalls <= gdelt429Times) { res.writeHead(429, { 'retry-after': '0' }); return res.end('slow down'); }
      const d = (s) => Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`);
      const t0 = d(url.searchParams.get('startdatetime'));
      const t1 = d(url.searchParams.get('enddatetime'));
      const articles = Array.from({ length: perRequest }, (_, i) => {
        const when = new Date(t1 - ((i + 1) * (t1 - t0)) / (perRequest + 1));
        return {
          url: `https://gdelt-site.example/a/${i}`, title: `GDELT haber ${i}`, domain: 'gdelt-site.example',
          seendate: when.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''), language: 'Turkish', sourcecountry: 'Turkey',
        };
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ articles }));
    }

    if (url.pathname === '/news/search') {
      log(url, { mkt: url.searchParams.get('setmkt'), cc: url.searchParams.get('cc'), qft: url.searchParams.get('qft') });
      if (bingFail) { res.writeHead(500); return res.end('x'); }
      const items = Array.from({ length: Math.min(perRequest, 10) }, (_, i) => `<item>
  <title>Bing haber ${i}</title>
  <link>https://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=1&amp;url=${encodeURIComponent(`https://bing-site.example/a/${i}`)}&amp;c=1</link>
  <pubDate>${hoursAgo(i * 5 + 1).toUTCString()}</pubDate>
  <News:Source>Bing Gazetesi</News:Source>
</item>`);
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss(items));
    }

    if (/^\/tags\/[^/]+\.rss$/.test(url.pathname)) {
      log(url, {});
      const tag = decodeURIComponent(url.pathname.split('/')[2].replace('.rss', ''));
      const post = (h, text, n) => `<item><title></title><link>https://masto.example/@u/${tag}${n}</link><pubDate>${hoursAgo(h).toUTCString()}</pubDate><description>${esc(`<p>${text} #${tag}</p>`)}</description></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss([post(1, `Okullarda yeni dönem ${tag}`, 0), post(2, `Yapay zeka ile ilgili ${tag} paylaşımı`, 1)]));
    }

    if (url.pathname === '/search.rss' || /^\/r\/[^/]+\/(search|new)\.rss$/.test(url.pathname)) {
      log(url, { sort: url.searchParams.get('sort'), t: url.searchParams.get('t'), restrict: url.searchParams.get('restrict_sr') });
      const entry = (h, title, n) => `<entry><title>${esc(title)}</title><link href="https://reddit.example/comments/${n}"/><updated>${hoursAgo(h).toISOString()}</updated><author><name>/u/biri</name></author></entry>`;
      res.writeHead(200, { 'content-type': 'application/atom+xml' });
      return res.end(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>r</title>${entry(1, 'Okul servisleri hakkında tartışma', 0)}${entry(2, 'Maç sonrası yorumlar', 1)}</feed>`);
    }

    if (url.pathname === '/api/v1/search_by_date') {
      log(url, { filters: url.searchParams.get('numericFilters') });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ hits: [
        { title: 'New AI chip announced', url: 'https://hn-target.example/1', objectID: '1', created_at: hoursAgo(2).toISOString() },
        { title: 'Ask HN: school software', url: null, objectID: '2', created_at: hoursAgo(3).toISOString() },
      ] }));
    }

    if (url.pathname === '/feeds/maarif.xml') {
      const it = (h, title, n) => `<item><title>${esc(title)}</title><link>https://maarif-site.example/${n}</link><pubDate>${hoursAgo(h).toUTCString()}</pubDate><description>${esc(title)}</description></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss([
        it(5, "Türkiye Maarif Vakfı Nijer'de yeni okul açtı", 0),
        it(6, "Ma'arif NU holds annual meeting in Jakarta", 1),
        it(7, 'Turkish Maarif Foundation signs deal in Somalia', 2),
        it(8, 'Galatasaray won the derby', 3),
      ]));
    }

    if (url.pathname === '/feeds/empty.xml') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<html><body>Access   denied\n  by bot protection</body></html>');
    }

    if (url.pathname === '/feeds/news.xml') {
      const it = (h, title, n) => `<item><title>${esc(title)}</title><link>https://yayinci.example/${n}</link><pubDate>${hoursAgo(h).toUTCString()}</pubDate><description>${esc(`<p>${title} ayrıntılar</p>`)}</description></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss([
        it(1, "İstanbul'da okul servisleri denetlendi", 0),
        it(2, "Ankara'da yeni üniversite açıldı", 1),
        it(3, 'Borsa güne yükselişle başladı', 2),
        it(4, 'Maç sonucu: derbi berabere bitti', 3),
        it(24 * 100, "Eski haber: İstanbul okul yıllığı", 4),
      ]));
    }

    if (url.pathname === '/feeds/global.xml') {
      const it = (h, title, n) => `<item><title>${esc(title)}</title><link>https://global.example/${n}</link><pubDate>${hoursAgo(h).toUTCString()}</pubDate></item>`;
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss([it(2, 'Turkey unveils new school calendar', 0), it(3, 'France election results announced', 1), it(4, 'Istanbul school bus rules tighten', 2)]));
    }

    if (url.pathname === '/feeds/social.xml') {
      const entry = (h, title, html, n) => `<entry><title>${esc(title)}</title><link rel="alternate" href="https://social.example/post/${n}"/><updated>${hoursAgo(h).toISOString()}</updated><summary type="html">${esc(html)}</summary><author><name>Resmî Hesap</name></author></entry>`;
      res.writeHead(200, { 'content-type': 'application/atom+xml' });
      return res.end(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>hesap</title>${[
        entry(1, '', '<p>İstanbul okullarında karne töreni yapıldı</p>', 0),
        entry(2, '', '<p>Hava durumu: yarın yağmur bekleniyor</p>', 1),
      ].join('')}</feed>`);
    }

    // Google Haberler: /rss = "öne çıkan haberler" (sorgusuz), /rss/search = arama
    if (url.pathname === '/rss') {
      requests.push({ path: url.pathname, q: '', hl: url.searchParams.get('hl'), gl: url.searchParams.get('gl'), ceid: url.searchParams.get('ceid') });
      const gl = url.searchParams.get('gl');
      const items = Array.from({ length: 5 }, (_, i) => `<item><title>${esc(`Öne çıkan ${i} ${gl}`)}</title><link>https://top.example/${gl}/${i}</link><pubDate>${hoursAgo(0.3 * (i + 1)).toUTCString()}</pubDate><source url="https://top.example">Top Gazete</source></item>`);
      res.writeHead(200, { 'content-type': 'application/rss+xml' });
      return res.end(rss(items));
    }

    // Google Haberler
    const q = url.searchParams.get('q') || '';
    requests.push({ path: url.pathname, q, hl: url.searchParams.get('hl'), gl: url.searchParams.get('gl'), ceid: url.searchParams.get('ceid') });
    if (fail) { res.writeHead(503); return res.end('down'); }
    const when = /when:(\d+)([hd])/.exec(q);
    const after = /after:(\d{4}-\d{2}-\d{2})/.exec(q)?.[1];
    const before = /before:(\d{4}-\d{2}-\d{2})/.exec(q)?.[1];
    // when:Nh → son N saat; aksi halde after/before aralığı
    const t1 = when ? Date.now() : Date.parse(`${before}T00:00:00Z`);
    const t0 = when ? t1 - Number(when[1]) * (when[2] === 'd' ? 24 : 1) * 3600000 : Date.parse(`${after}T00:00:00Z`);
    const items = [];
    for (let i = 0; i < perRequest; i++) {
      const when = new Date(t1 - ((i + 1) * (t1 - t0)) / (perRequest + 1));
      const src = ['Anadolu Ajansı', 'Hürriyet', 'BBC', 'Reuters'][i % 4];
      items.push(`<item>
  <title>${esc(`Haber ${i} – ${q.slice(0, 30)} - ${src}`)}</title>
  <link>https://news.example.com/${url.searchParams.get('gl')}/${after || 'when'}/${i}</link>
  <pubDate>${when.toUTCString()}</pubDate>
  <source url="https://${src.replace(/\W/g, '').toLowerCase()}.example.com">${src}</source>
</item>`);
    }
    res.writeHead(200, { 'content-type': 'application/rss+xml' });
    res.end(rss(items));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, requests, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

module.exports = { createMockGoogleNews };
