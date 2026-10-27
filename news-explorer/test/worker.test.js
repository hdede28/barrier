'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockGoogleNews } = require('./mock-google-news');

const load = () => import('../worker.mjs').then((m) => m.default);
const qs = (o) => new URLSearchParams({ sources: 'google', tstrict: '0', ...o }).toString();

test('worker: /api/meta, /api/news, hata ve yöntem kontrolleri', async () => {
  const worker = await load();
  const mock = await createMockGoogleNews();
  const env = { GOOGLE_NEWS_BASE: mock.base };
  const call = (path, init) => worker.fetch(new Request(`https://haber.example${path}`, init), env);

  const meta = await (await call('/api/meta')).json();
  assert.ok(meta.countries.length >= 15);

  const ok = await call(`/api/news?${qs({ country: 'TR', city: 'Ankara', topic: 'education', from: '2022-01-01', to: '2026-10-27' })}`);
  const body = await ok.json();
  assert.equal(ok.status, 200);
  assert.equal(body.windows.length, 12);
  assert.equal(body.total, 12 * 25);
  assert.equal(body.cached, false);

  const again = await (await call(`/api/news?${qs({ country: 'TR', city: 'Ankara', topic: 'education', from: '2022-01-01', to: '2026-10-27' })}`)).json();
  assert.equal(again.cached, true);
  assert.equal(mock.requests.length, 12, 'ikinci istek önbellekten gelmeli');

  assert.equal((await call('/api/news?country=ZZ&from=2026-10-01&to=2026-10-02')).status, 400);
  assert.equal((await call('/api/news', { method: 'POST' })).status, 405);
  assert.equal((await call('/baska')).status, 404);
  mock.close();
});

test('worker: kaynak çökerse 502', async () => {
  const worker = await load();
  const mock = await createMockGoogleNews({ fail: true });
  const res = await worker.fetch(new Request(`https://haber.example/api/news?${qs({ country: 'DE', from: '2026-10-01', to: '2026-10-27' })}`), { GOOGLE_NEWS_BASE: mock.base });
  assert.equal(res.status, 502);
  mock.close();
});
