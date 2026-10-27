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

test('GDELT: Retry-After vermeyen 429\'da pes eder, sonraki istekler 2 dk sessiz kalır (sınırlamayı uzatmaz)', async () => {
  const mock = await createMockGoogleNews({ perRequest: 2, gdelt429Times: 99, gdeltNoRetryAfter: true });
  const b = mock.base;
  const app = createServer({ newsBase: b, bases: { gdelt: b }, feeds: [], translator: null, timing: { gdeltGap: 1, retryWait: 5, blockMs: 60000 } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (topic) => (await (await fetch(`${base}/api/news?${qs({ ...recent, sources: 'gdelt,google', topic })}`)).json());
  const t0 = Date.now();
  const a = await get('education');
  assert.ok(Date.now() - t0 < 3000, 'hızlı pes eder');
  assert.match(a.sources.find((x) => x.id === 'gdelt').error, /sınırladı/);
  assert.equal(mock.requests.filter((x) => x.path === '/api/v2/doc/doc').length, 1, 'Retry-After yok: yeniden deneme yok');
  const c = await get('sports');
  assert.match(c.sources.find((x) => x.id === 'gdelt').error, /sn sonra yeniden denenebilir/);
  assert.equal(mock.requests.filter((x) => x.path === '/api/v2/doc/doc').length, 1, 'sessizlik süresinde GDELT\'e istek gitmez');
  app.close(); mock.close();
});

test('takılan kaynak zaman sınırında kapanır, diğer kaynaklar beklemez', async () => {
  const hang = { id: 'slow', label: 'Yavaş', kind: 'news', available: true, deadline: 80, skip: () => null, fetch: () => new Promise(() => {}) };
  const ok = { id: 'fast', label: 'Hızlı', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [{ title: 'Hızlı kaynaktan bir haber', link: 'https://f/1', source: 'F', published: new Date().toISOString() }] }) };
  const { getNews } = require('../lib/news');
  const t0 = Date.now();
  const body = await getNews(new URLSearchParams({ country: 'TR', from: day(-2), to: day(0), tstrict: '0' }), { providers: [hang, ok] });
  assert.ok(Date.now() - t0 < 1500, 'zaman sınırında döner');
  assert.equal(body.total, 1);
  assert.match(body.sources.find((x) => x.id === 'slow').error, /zaman sınırı/);
});

test('ara sonuçlar: hızlı kaynak bitince önce o gönderilir, yavaş olan bitince son sonuç', async () => {
  const { getNews } = require('../lib/news');
  const item = (t) => ({ title: t, link: `https://x/${t}`, source: 'S', published: new Date().toISOString() });
  const late = { id: 'late', label: 'Geç', kind: 'news', available: true, skip: () => null, fetch: () => new Promise((r) => setTimeout(() => r({ items: [item('Geç gelen haber başlığı')] }), 120)) };
  const early = { id: 'early', label: 'Erken', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [item('Erken gelen haber başlığı')] }) };
  const partials = [];
  const body = await getNews(new URLSearchParams({ country: 'TR', from: day(-2), to: day(0), tstrict: '0' }), { providers: [late, early], onProgress: (b) => partials.push(b) });
  assert.equal(partials.length, 1);
  assert.equal(partials[0].partial, true);
  assert.equal(partials[0].total, 1);
  assert.equal(partials[0].pending, 1);
  assert.equal(partials[0].sources.find((x) => x.id === 'late').pending, true);
  assert.equal(body.partial, false);
  assert.equal(body.total, 2);
  assert.equal(body.pending, 0);
});

test('GDELT varsayılan kapalı ve sorgu İngilizce, şehir aksansız', async () => {
  const s = await start({ perRequest: 2 });
  const meta = await (await fetch(`${s.base}/api/meta`)).json();
  assert.equal(meta.sources.find((x) => x.id === 'gdelt').defaultOn, false);
  const def = await s.get({ ...recent, topic: 'education' });
  assert.ok(!def.body.sources.some((x) => x.id === 'gdelt'), 'varsayılan aramada GDELT çalışmaz');
  assert.ok(!s.mock.requests.some((x) => x.path === '/api/v2/doc/doc'));
  await s.get({ ...recent, topic: 'education', city: 'İstanbul', sources: 'gdelt' });
  const q = s.mock.requests.find((x) => x.path === '/api/v2/doc/doc').q;
  assert.match(q, /^\("İstanbul" OR "Istanbul"\) \(education OR school OR university OR teachers\) sourcecountry:TU$/);
  s.stop();
});

test('akış ayrıştırıcı: göreli bağlantı, guid ve FeedBurner yedekleri', () => {
  const { parseFeed, describeFeed } = require('../lib/rss');
  const xml = '<rss><channel><item><title>Göreli bağlantı</title><link>/haber/123</link></item>'
    + '<item><title>Guid yedeği</title><guid isPermaLink="true">https://s.example/p/9</guid></item>'
    + '<item><title>FeedBurner</title><link></link><feedburner:origLink>https://o.example/a</feedburner:origLink></item></channel></rss>';
  assert.deepEqual(parseFeed(xml, 100, 'https://site.example/rss').map((i) => i.link), ['https://site.example/haber/123', 'https://s.example/p/9', 'https://o.example/a']);
  assert.deepEqual(parseFeed(xml, 100).map((i) => i.link), ['https://s.example/p/9', 'https://o.example/a'], 'taban yoksa göreli bağlantı atlanır');
  assert.equal(describeFeed(xml).count, 3);
  assert.equal(describeFeed('<html>captcha</html>').count, 0);
});

test('varsayılan akış listesi: YouTube yok, sosyal kaynak listede yok; her akışın adresi benzersiz', () => {
  const { loadFeeds } = require('../data/feeds');
  const feeds = loadFeeds({});
  assert.ok(!feeds.some((f) => /youtube\.com/.test(f.url)));
  assert.equal(new Set(feeds.map((f) => f.url)).size, feeds.length);
  assert.ok(feeds.length >= 120);
});
