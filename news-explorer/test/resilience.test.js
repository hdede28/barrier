'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { createProviders } = require('../lib/providers');
const { diagnose, formatText } = require('../lib/diagnose');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams({ tstrict: '0', ...o }).toString();
const FAST = { gdeltGap: 1, retryWait: 5 };

async function start(mockOpts, extra = {}) {
  const mock = await createMockGoogleNews(mockOpts);
  const b = mock.base;
  const app = createServer({ newsBase: b, bases: { gdelt: b, bing: b, reddit: b, hn: b, mastodon: b }, feeds: [], translator: null, timing: FAST, ...extra });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (params) => {
    const r = await fetch(`${base}/api/news?${qs(params)}`);
    return { status: r.status, body: await r.json() };
  };
  return { mock, base, get, stop: () => { app.close(); mock.close(); } };
}
const recent = { country: 'TR', from: day(-6), to: day(0) };

test('GDELT 429: bekleyip yeniden dener ve sonunda sonuç verir', async () => {
  const s = await start({ perRequest: 4, gdelt429Times: 2 });
  const r = await s.get({ ...recent, sources: 'gdelt', topic: 'education' });
  assert.equal(r.status, 200);
  assert.equal(r.body.sources[0].error, null);
  assert.equal(r.body.items.length, 4);
  assert.equal(s.mock.requests.filter((x) => x.path === '/api/v2/doc/doc').length, 3, '2 kez 429 + 1 başarılı');
  s.stop();
});

test('GDELT 429 sürerse anlaşılır bir hata mesajı verir; diğer kaynaklar çalışır', async () => {
  const s = await start({ perRequest: 3, gdelt429Times: 99 });
  const r = await s.get({ ...recent, sources: 'gdelt,bing' });
  assert.equal(r.status, 200, 'Bing çalıştığı için 502 değil');
  const g = r.body.sources.find((x) => x.id === 'gdelt');
  assert.match(g.error, /sınırladı \(429\)/);
  assert.equal(s.mock.requests.filter((x) => x.path === '/api/v2/doc/doc').length, 3, 'en fazla 3 deneme');
  s.stop();
});

test('GDELT: aynı sorgu önbellekten gelir (ikinci istek GDELT\'e gitmez)', async () => {
  const s = await start({ perRequest: 3 });
  const p = { ...recent, sources: 'gdelt', topic: 'sports' };
  await s.get(p);
  await s.get({ ...p, tstrict: '1' }); // farklı önbellek anahtarı (getNews), aynı GDELT adresi
  assert.equal(s.mock.requests.filter((x) => x.path === '/api/v2/doc/doc').length, 1);
  s.stop();
});

test('Reddit varsayılan kapalı: kaynak belirtilmezse çalışmaz, açıkça istenirse çalışır; meta defaultOn bildirir', async () => {
  const s = await start({});
  const meta = await (await fetch(`${s.base}/api/meta`)).json();
  assert.equal(meta.sources.find((x) => x.id === 'reddit').defaultOn, false);
  assert.equal(meta.sources.find((x) => x.id === 'google').defaultOn, true);
  const def = await s.get({ ...recent, topic: 'education' });
  assert.ok(!def.body.sources.some((x) => x.id === 'reddit'), 'varsayılan aramada Reddit yok');
  assert.ok(!s.mock.requests.some((x) => x.path.endsWith('search.rss')));
  const on = await s.get({ ...recent, topic: 'education', sources: 'reddit' });
  assert.equal(on.body.sources[0].id, 'reddit');
  s.stop();
});

test('DISABLED_SOURCES: kapatılan kaynak listeden ve aramalardan çıkar', async () => {
  const providers = createProviders({ feeds: [], disabled: ['bing', 'hn'] });
  const s = await start({}, { providers });
  const meta = await (await fetch(`${s.base}/api/meta`)).json();
  assert.ok(!meta.sources.some((x) => ['bing', 'hn'].includes(x.id)));
  assert.ok(meta.sources.some((x) => x.id === 'google'));
  const r = await s.get({ ...recent, sources: 'bing' });
  assert.equal(r.status, 400);
  s.stop();
});

test('tanı raporu: boş çıkan akışın içeriğinden örnek gösterilir', async () => {
  const mock = await createMockGoogleNews({});
  const feeds = [{ name: 'Engelli akış', url: `${mock.base}/feeds/empty.xml`, kind: 'news', countries: ['TR'] }];
  const report = await diagnose({ providers: createProviders({ feeds }), feeds, bases: { gdelt: mock.base, bing: mock.base, reddit: mock.base, hn: mock.base, mastodon: mock.base }, withFeeds: true, timing: FAST });
  assert.equal(report.feeds[0].status, 'boş');
  assert.equal(report.feeds[0].sample, '<html><body>Access denied by bot protection</body></html>');
  assert.match(formatText(report), /içerik: <html><body>Access denied/);
  mock.close();
});
