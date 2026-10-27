'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { createFeedProvider } = require('../lib/providers/feeds');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

test('/api/news?stream=1: hızlı kaynak önce, yavaş kaynak sonra; satır satır JSON', async () => {
  const item = (t) => ({ title: t, link: `https://x/${t}`, source: 'S', published: new Date().toISOString() });
  const fast = { id: 'fast', label: 'Hızlı', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [item('Hızlı kaynak haberi')] }) };
  const slow = { id: 'slow', label: 'Yavaş', kind: 'news', available: true, skip: () => null, fetch: () => new Promise((r) => setTimeout(() => r({ items: [item('Yavaş kaynak haberi')] }), 200)) };
  const app = createServer({ providers: [slow, fast], feeds: [], translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const params = new URLSearchParams({ stream: '1', country: 'TR', from: day(-2), to: day(0), tstrict: '0' });
  const res = await fetch(`${base}/api/news?${params}`);
  assert.match(res.headers.get('content-type'), /ndjson/);
  const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.type), ['partial', 'final']);
  assert.equal(lines[0].body.total, 1);
  assert.equal(lines[0].body.pending, 1);
  assert.equal(lines[1].body.total, 2);
  assert.equal(lines[1].body.partial, false);
  // hata da akış içinde bildirilir
  const bad = await fetch(`${base}/api/news?${new URLSearchParams({ stream: '1', country: 'ZZ', from: day(-2), to: day(0) })}`);
  const err = JSON.parse((await bad.text()).trim());
  assert.deepEqual([err.type, err.status], ['error', 400]);
  assert.equal((await (await fetch(`${base}/api/meta`)).json()).stream, true);
  app.close();
});

test('akışlar: bayat önbellek anında sunulur ve arkada yenilenir; bozuk akış kısa süre yeniden denenmez', async () => {
  const mock = await createMockGoogleNews({ slowFeedMs: 300 });
  const b = mock.base;
  const feeds = [
    { name: 'Yavaş akış', url: `${b}/feeds/slow.xml`, kind: 'news', countries: ['TR'] },
    { name: 'Bozuk akış', url: `${b}/feeds/fail.xml`, kind: 'news', countries: ['TR'] },
  ];
  const provider = createFeedProvider({ kind: 'news', feeds, ttl: 0 }); // 0: kayıt hemen bayatlar
  const ctx = { mode: 'search', world: false, country: { code: 'TR', terms: ['tr'], hl: 'tr', cities: [] }, city: '', topic: 'general', keyword: '',
    windows: [{ from: day(-3), to: day(0) }] };
  const deps = { now: new Date() };

  let t = Date.now();
  const first = await provider.fetch(ctx, deps);
  const firstMs = Date.now() - t;
  assert.ok(firstMs >= 250, 'ilk çağrı yavaş akışı bekler');
  assert.equal(first.items.length, 2);
  assert.match(first.note, /1 tanesi alınamadı: Bozuk akış/);

  t = Date.now();
  const second = await provider.fetch(ctx, deps);
  assert.ok(Date.now() - t < 150, `bayat kayıt anında gelir (${Date.now() - t} ms)`);
  assert.equal(second.items.length, 2);
  await new Promise((r) => setTimeout(r, 450)); // arkadaki yenileme tamamlansın
  assert.equal(mock.requests.filter((x) => x.path === '/feeds/slow.xml').length, 2, 'arkada yenilendi');
  assert.equal(mock.requests.filter((x) => x.path === '/feeds/fail.xml').length, 1, 'bozuk akış yeniden denenmedi');
  mock.close();
});
