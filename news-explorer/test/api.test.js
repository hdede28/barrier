'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { createMockGoogleNews } = require('./mock-google-news');

async function start(mockOpts) {
  const mock = await createMockGoogleNews(mockOpts);
  const app = createServer({ newsBase: mock.base, bases: {}, feeds: [] });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  return { mock, base, stop: () => { app.close(); mock.close(); } };
}

const qs = (o) => new URLSearchParams({ sources: 'google', tstrict: '0', ...o }).toString();

test('GET /api/meta ülke ve konu listesini verir', async () => {
  const { base, stop } = await start();
  const meta = await (await fetch(`${base}/api/meta`)).json();
  assert.ok(meta.countries.find((c) => c.code === 'TR').cities.includes('İstanbul'));
  assert.ok(meta.topics.find((t) => t.id === 'education'));
  stop();
});

test('kısa aralık: tek istek, doğru sürüm parametreleri ve sorgu', async () => {
  const { base, mock, stop } = await start();
  const r = await fetch(`${base}/api/news?${qs({ country: 'TR', city: 'İstanbul', topic: 'education', from: '2026-10-20', to: '2026-10-27' })}`);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(mock.requests.length, 1);
  assert.equal(mock.requests[0].path, '/rss/search');
  assert.equal(mock.requests[0].gl, 'TR');
  assert.equal(mock.requests[0].hl, 'tr');
  assert.equal(mock.requests[0].ceid, 'TR:tr');
  assert.match(mock.requests[0].q, /^"İstanbul" \(eğitim OR okul OR üniversite OR öğretmen\) after:2026-10-20 before:2026-10-28$/);
  assert.equal(body.windows.length, 1);
  assert.equal(body.total, 40);
  assert.ok(body.items.every((it, i, a) => i === 0 || a[i - 1].published >= it.published), 'yeniden eskiye sıralı');
  assert.equal(body.items[0].source.length > 0, true);
  stop();
});

test('uzun aralık: 12 pencere, tekilleştirme ve pencere başına sınır', async () => {
  const { base, mock, stop } = await start();
  const r = await fetch(`${base}/api/news?${qs({ country: 'DE', city: 'Berlin', topic: 'sports', from: '2021-10-28', to: '2026-10-27' })}`);
  const body = await r.json();
  assert.equal(mock.requests.length, 12);
  assert.equal(body.windows.length, 12);
  assert.equal(body.total, 12 * 25);
  assert.equal(new Set(body.items.map((i) => i.link)).size, body.total);
  assert.ok(body.items.some((i) => i.published < '2022-06-01'), 'eski dönemden haber gelmeli');
  assert.ok(body.items.some((i) => i.published > '2026-09-01'), 'güncel dönemden haber gelmeli');
  stop();
});

test('ikinci aynı istek önbellekten gelir', async () => {
  const { base, mock, stop } = await start();
  const url = `${base}/api/news?${qs({ country: 'FR', topic: 'culture', from: '2026-10-01', to: '2026-10-27' })}`;
  assert.equal((await (await fetch(url)).json()).cached, false);
  assert.equal((await (await fetch(url)).json()).cached, true);
  assert.equal(mock.requests.length, 1);
  stop();
});

test('geçersiz parametreler 400 döner', async () => {
  const { base, stop } = await start();
  for (const bad of [
    { country: 'ZZ', from: '2026-10-01', to: '2026-10-27' },
    { country: 'TR', from: 'dün', to: '2026-10-27' },
    { country: 'TR', topic: 'x', from: '2026-10-01', to: '2026-10-27' },
  ]) {
    const r = await fetch(`${base}/api/news?${qs(bad)}`);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok((await r.json()).error);
  }
  stop();
});

test('kaynak çökerse 502 döner ve önbelleğe alınmaz', async () => {
  const { base, stop } = await start({ fail: true });
  const r = await fetch(`${base}/api/news?${qs({ country: 'TR', from: '2026-10-01', to: '2026-10-27' })}`);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /ulaşılamadı/);
  stop();
});

test('statik dosyalar sunulur, dizin dışına çıkılamaz', async () => {
  const { base, stop } = await start();
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  const raw = await fetch(`${base}/..%2fserver.js`);
  assert.ok([403, 404].includes(raw.status));
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  stop();
});
