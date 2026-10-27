'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { getNews, createMemoryCache } = require('../lib/news');
const { createProviders } = require('../lib/providers');
const { loadFeeds } = require('../data/feeds');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams({ tstrict: '0', ...o }).toString();

async function start(mockOpts, feedsFor) {
  const mock = await createMockGoogleNews(mockOpts);
  const feeds = feedsFor ? feedsFor(mock.base) : [];
  const app = createServer({ newsBase: mock.base, bases: { gdelt: mock.base, bing: mock.base, reddit: mock.base, hn: mock.base, mastodon: mock.base }, feeds, translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (params) => {
    const r = await fetch(`${base}/api/news?${qs(params)}`);
    return { status: r.status, body: await r.json() };
  };
  return { mock, base, get, stop: () => { app.close(); mock.close(); } };
}

const FEEDS = (b) => [
  { name: 'Test Yayıncı', url: `${b}/feeds/news.xml`, kind: 'news', countries: ['TR'] },
  { name: 'Küresel Yayıncı', url: `${b}/feeds/global.xml`, kind: 'news', countries: ['*'] },
  { name: 'Resmî Hesap', url: `${b}/feeds/social.xml`, kind: 'social', countries: ['TR'] },
];
const recent = { country: 'TR', from: day(-6), to: day(0) };

test('GDELT: FIPS ülke kodu, tarih parametreleri, kısa terim elenir, 3 ay sınırı', async () => {
  const s = await start({ perRequest: 5 });
  const r = await s.get({ ...recent, sources: 'gdelt', topic: 'technology', city: 'Ankara' });
  assert.equal(r.status, 200);
  const q = s.mock.requests.find((x) => x.path === '/api/v2/doc/doc');
  assert.match(q.q, /^"Ankara" \(teknoloji OR "yapay zeka" OR yazılım\) sourcecountry:TU$/);
  assert.equal(q.end.slice(8), '235959');
  assert.equal(r.body.items[0].source, 'gdelt-site.example');
  assert.equal(r.body.items[0].kind, 'news');

  await s.get({ country: 'US', from: day(-6), to: day(0), sources: 'gdelt', topic: 'technology' });
  const us = s.mock.requests.filter((x) => x.path === '/api/v2/doc/doc').at(-1).q;
  assert.ok(!/\bAI\b/.test(us), '2 harfli "AI" GDELT sorgusundan çıkarılmalı');
  assert.match(us, /sourcecountry:US$/);

  // Aralık tümüyle 3 aydan eski: GDELT atlanır, hata değil
  const old = await s.get({ country: 'TR', from: '2024-01-01', to: '2024-02-01', sources: 'gdelt' });
  assert.equal(old.status, 200);
  assert.match(old.body.sources[0].skipped, /3 ay/);
  assert.equal(old.body.total, 0);
  s.stop();
});

test('GDELT: aralığın eski kısmı son 3 aya kırpılır', async () => {
  const s = await start({ perRequest: 2 });
  await s.get({ country: 'TR', from: '2020-01-01', to: day(0), sources: 'gdelt' });
  const start8 = s.mock.requests.find((x) => x.path === '/api/v2/doc/doc').start.slice(0, 8);
  const oldest = day(-89).replaceAll('-', '');
  assert.equal(start8, oldest);
  s.stop();
});

test('Bing: pazar kodu, ülke, aralık filtresi, apiclick bağlantısı açılır, kaynak adı', async () => {
  const s = await start({ perRequest: 6 });
  const r = await s.get({ ...recent, sources: 'bing' });
  const q = s.mock.requests.find((x) => x.path === '/news/search');
  assert.equal(q.mkt, 'tr-TR');
  assert.equal(q.cc, 'TR');
  assert.equal(q.qft, 'interval="8"');
  assert.match(r.body.items[0].link, /^https:\/\/bing-site\.example\/a\/\d+$/);
  assert.equal(r.body.items[0].source, 'Bing Gazetesi');
  const month = await s.get({ country: 'TR', from: day(-20), to: day(0), sources: 'bing' });
  assert.equal(s.mock.requests.filter((x) => x.path === '/news/search').at(-1).qft, 'interval="9"');
  assert.ok(month.body.total > 0);
  const old = await s.get({ country: 'TR', from: '2024-01-01', to: '2024-02-01', sources: 'bing' });
  assert.match(old.body.sources[0].skipped, /30 gün/);
  s.stop();
});

test('yayıncı akışı: şehir + konu eşleşir, eski haber elenir, ülkeye özel olmayan akış ülke adı ister', async () => {
  const s = await start({}, FEEDS);
  const r = await s.get({ ...recent, sources: 'feeds', city: 'İstanbul', topic: 'education' });
  const titles = r.body.items.map((i) => i.title);
  assert.deepEqual(titles.sort(), ["İstanbul'da okul servisleri denetlendi", 'Istanbul school bus rules tighten'].sort());
  assert.ok(r.body.items.every((i) => ['Test Yayıncı', 'Küresel Yayıncı'].includes(i.source)));

  const all = await s.get({ ...recent, sources: 'feeds' });
  const t = all.body.items.map((i) => i.title).join('|');
  assert.ok(t.includes('Turkey unveils new school calendar'), 'küresel akışta ülke adı (Turkey) geçen haber gelir');
  assert.ok(!t.includes('France election'), 'başka ülke haberi gelmez');
  assert.ok(!t.includes('Eski haber'), '100 günlük haber aralık dışında');
  s.stop();
});

test('sosyal medya: Atom akışı, başlıksız gönderi metinden başlık alır, kind=social', async () => {
  const s = await start({}, FEEDS);
  const r = await s.get({ ...recent, sources: 'social', city: 'İstanbul' });
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.items[0].title, 'İstanbul okullarında karne töreni yapıldı');
  assert.equal(r.body.items[0].kind, 'social');
  assert.equal(r.body.items[0].source, 'Resmî Hesap');
  assert.equal(r.body.items[0].link, 'https://social.example/post/0');
  const meta = await (await fetch(`${s.base}/api/meta`)).json();
  assert.deepEqual(meta.sources.map((x) => x.id), ['google', 'gdelt', 'bing', 'feeds', 'social', 'mastodon', 'reddit', 'hn']);
  s.stop();
});

test('sosyal medya akışı tanımlı değilse kaynak listesinde yer almaz', async () => {
  const s = await start({}, (b) => FEEDS(b).filter((f) => f.kind === 'news'));
  const meta = await (await fetch(`${s.base}/api/meta`)).json();
  assert.ok(!meta.sources.some((x) => x.id === 'social'));
  const r = await s.get({ ...recent, sources: 'social' });
  assert.equal(r.status, 400);
  s.stop();
});

test('tüm kaynaklar birlikte: sayılar ve kaynak raporu; bir kaynak bozulsa da sonuç gelir', async () => {
  const s = await start({ perRequest: 5, gdeltFail: true }, FEEDS);
  const r = await s.get({ ...recent, city: 'İstanbul' });
  assert.equal(r.status, 200, 'GDELT hata verse bile diğerleri çalışır');
  const byId = Object.fromEntries(r.body.sources.map((x) => [x.id, x]));
  assert.match(byId.gdelt.error, /too short/);
  assert.equal(byId.google.error, null);
  assert.ok(byId.google.found > 0 && byId.bing.found > 0 && byId.feeds.found > 0 && byId.social.found > 0);
  assert.equal(r.body.total, r.body.sources.reduce((n, x) => n + x.count, 0));
  assert.ok(r.body.items.some((i) => i.kind === 'social') && r.body.items.some((i) => i.kind === 'news'));
  assert.ok(r.body.items.every((i, k, a) => k === 0 || a[k - 1].published >= i.published), 'tümü tarihe göre sıralı');
  assert.ok(r.body.items.every((i) => i.window === 0), 'tek pencerede hepsi pencere 0');
  s.stop();
});

test('hiçbir kaynak çalışmazsa 502; sources parametresi seçimi sınırlar; geçersiz kaynak 400', async () => {
  const s = await start({ fail: true, gdeltFail: true, bingFail: true });
  const bad = await s.get({ ...recent, sources: 'google,gdelt,bing' });
  assert.equal(bad.status, 502);
  assert.match(bad.body.error, /ulaşılamadı/);
  const only = await s.get({ ...recent, sources: 'feeds,zzz' });
  assert.equal(only.status, 400);
  s.stop();
  const t = await start({ perRequest: 3 });
  const r = await t.get({ ...recent, sources: 'bing' });
  assert.deepEqual(r.body.sources.map((x) => x.id), ['bing']);
  t.stop();
});

test('tekilleştirme: farklı kaynaklardaki aynı başlık tek satır, aynı kaynağın tekrarı korunur', async () => {
  const now = new Date();
  const mkItem = (title, link, h) => ({ title, link, source: 'x', published: new Date(now - h * 3600000).toISOString() });
  const fake = (id, label, items) => ({ id, label, kind: 'news', available: true, skip: () => null, fetch: async () => ({ items }) });
  const providers = [
    fake('a', 'A Kaynağı', [mkItem('Okullarda yeni dönem başlıyor bugün', 'https://a/1', 1), mkItem('Günlük hava durumu raporu', 'https://a/2', 2), mkItem('Günlük hava durumu raporu', 'https://a/3', 26)]),
    fake('b', 'B Kaynağı', [mkItem('Okullarda yeni dönem başlıyor bugün!', 'https://b/1', 1), mkItem('Başka bir haber başlığı burada', 'https://a/1', 3)]),
  ];
  const params = new URLSearchParams({ country: 'TR', from: day(-3), to: day(0) });
  const body = await getNews(params, { providers, cache: createMemoryCache() });
  assert.equal(body.total, 3, '4 + 1 kayıttan: başlık tekrarı (A/B) ve aynı adres (a/1) birleşti');
  const merged = body.items.find((i) => i.title.startsWith('Okullarda'));
  assert.deepEqual(merged.alsoIn, ['B Kaynağı']);
  assert.equal(merged.provider, 'a', 'öncelik sırasındaki ilk kaynak korunur');
  assert.equal(body.items.filter((i) => i.title === 'Günlük hava durumu raporu').length, 2, 'aynı kaynağın tekrarlanan başlığı silinmez');
});

test('EXTRA_FEEDS: geçerli akışlar eklenir, geçersizler atılır', () => {
  const base = loadFeeds({}).length;
  const extra = JSON.stringify([
    { name: 'Mastodon', url: 'https://m.example/@a.rss', kind: 'social', countries: ['TR'] },
    { name: 'kötü', url: 'ftp://x', kind: 'social', countries: ['TR'] },
    { name: 'türsüz', url: 'https://x.example/f', kind: 'blog', countries: ['TR'] },
    { name: 'ülkesiz', url: 'https://x.example/f', kind: 'news', countries: [] },
  ]);
  assert.equal(loadFeeds({ EXTRA_FEEDS: extra }).length, base + 1);
  assert.equal(loadFeeds({ EXTRA_FEEDS: '{bozuk' }).length, base);
  assert.ok(createProviders({ feeds: loadFeeds({ EXTRA_FEEDS: extra }) }).find((p) => p.id === 'social').available);
});
