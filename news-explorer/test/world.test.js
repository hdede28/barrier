'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { getNews, createMemoryCache } = require('../lib/news');
const { foreignFocus } = require('../lib/relevance');
const { findCountry, generalTerms } = require('../data/meta');
const { buildSearchQuery, parseSearchParams } = require('../lib/query');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams(o).toString();

async function start(mockOpts, feeds = []) {
  const mock = await createMockGoogleNews(mockOpts);
  const app = createServer({ newsBase: mock.base, bases: { gdelt: mock.base, bing: mock.base }, feeds, translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (params) => {
    const r = await fetch(`${base}/api/news?${qs(params)}`);
    return { status: r.status, body: await r.json() };
  };
  return { mock, base, get, stop: () => { app.close(); mock.close(); } };
}

test('ABD hatası: Genel konuda ülke adı aranmaz, genel terimler aranır', () => {
  const q = buildSearchQuery({ country: findCountry('US'), city: '', topic: 'general', keyword: '' });
  assert.ok(!/United States/.test(q), 'ülke adı sorguda olmamalı');
  assert.match(q, /^\(education OR school OR politics OR government/);
  assert.ok(generalTerms(findCountry('TR'), 1).length === 10, 'her konudan 1 terim');
});

test('foreignFocus: başka ülkeyi konu alan başlık gizlenir, ülkeyi anan kalır', () => {
  const us = findCountry('US');
  assert.equal(foreignFocus('Taliban bans women from universities in Afghanistan', us), true);
  assert.equal(foreignFocus('US troops leave Afghanistan after two decades', us), false);
  assert.equal(foreignFocus('Afghan refugees arrive in US cities', us), false);
  assert.equal(foreignFocus('Teachers strike in Chicago over class sizes', us), false);
  assert.equal(foreignFocus('Please help us with schools', us), false, '"us" zamiri ABD sayılmaz');
  const tr = findCountry('TR');
  assert.equal(foreignFocus("Afganistan'da deprem: yüzlerce ölü", tr), true);
  assert.equal(foreignFocus("Ukrayna'da savaş sürüyor", tr), true);
  assert.equal(foreignFocus('Türkiye ile Ukrayna arasında yeni anlaşma', tr), false);
  assert.equal(foreignFocus("Bakü'de okul açıldı", tr, ['Bakü']), false, 'seçilen şehir adı ülke gibi sayılır');
});

test('strict süzgeç: Afganistan haberi ABD aramasında gizlenir, strict=0 ile görünür', async () => {
  const mk = (title, link) => ({ title, link, source: 'x', published: new Date().toISOString() });
  const provider = { id: 'a', label: 'A', kind: 'news', available: true, skip: () => null,
    fetch: async () => ({ items: [mk('Taliban bans women from universities in Afghanistan', 'https://a/1'), mk('School budget vote in Ohio', 'https://a/2'), mk('US envoy visits Kabul', 'https://a/3')] }) };
  const run = (extra) => getNews(new URLSearchParams({ country: 'US', topic: 'education', from: day(-3), to: day(0), ...extra }), { providers: [provider] });
  const strict = await run({});
  assert.deepEqual(strict.items.map((i) => i.link).sort(), ['https://a/2', 'https://a/3']);
  assert.equal(strict.hidden, 1);
  const loose = await run({ strict: '0' });
  assert.equal(loose.total, 3);
  assert.equal(loose.hidden, 0);
});

test('dünya araması: konu ya da kelime şart; önbellek konuya göre ayrılır', async () => {
  assert.throws(() => parseSearchParams(new URLSearchParams({ country: 'ALL', from: day(-3), to: day(0) })), /konu seç/);
  const ctx = parseSearchParams(new URLSearchParams({ country: 'ALL', topic: 'education', from: '2022-01-01', to: day(0) }));
  assert.equal(ctx.world, true);
  assert.equal(ctx.windows.length, 3, 'dünya aramasında en fazla 3 pencere');
  assert.equal(ctx.strict, false);
  let calls = 0;
  const provider = { id: 'a', label: 'A', kind: 'news', available: true, skip: () => null, fetch: async () => { calls++; return { items: [] }; } };
  const cache = createMemoryCache();
  const base = { country: 'ALL', q: 'Putin', from: day(-3), to: day(0) };
  await getNews(new URLSearchParams({ ...base, topic: 'politics' }), { providers: [provider], cache });
  await getNews(new URLSearchParams({ ...base, topic: 'sports' }), { providers: [provider], cache });
  assert.equal(calls, 2, 'aynı kelime ama farklı konu aynı önbellek kaydını paylaşmamalı');
});

test('dünya araması / Google: 10 yayın sürümü, her biri kendi dilinde terimlerle; haberler ülke ve dil taşır', async () => {
  const s = await start({ perRequest: 3 });
  const r = await s.get({ country: 'ALL', topic: 'education', sources: 'google', from: day(-6), to: day(0) });
  assert.equal(r.status, 200);
  const g = s.mock.requests.filter((x) => x.path === '/rss/search');
  assert.equal(g.length, 10, '10 sürüm x 1 pencere');
  const byGl = Object.fromEntries(g.map((x) => [x.gl, x]));
  assert.match(byGl.TR.q, /eğitim OR okul/);
  assert.match(byGl.DE.q, /Bildung OR Schule/);
  assert.match(byGl.JP.q, /教育 OR 学校/);
  assert.match(byGl.SA.q, /تعليم/);
  assert.equal(byGl.BR.hl, 'pt-BR');
  const countries = new Set(r.body.items.map((i) => i.country));
  assert.equal(countries.size, 10);
  const tr = r.body.items.find((i) => i.country === 'TR');
  assert.equal(tr.place, 'Türkiye');
  assert.equal(tr.lang, 'tr');
  assert.equal(r.body.items.find((i) => i.country === 'JP').lang, 'ja');
  assert.equal(r.body.world, true);
  assert.equal(r.body.hidden, 0, 'dünya aramasında ülke süzgeci çalışmaz');
  s.stop();
});

test('dünya araması / isim: kelime her sürümde aynen aranır; GDELT ülke filtresiz, Bing en-US', async () => {
  const s = await start({ perRequest: 4 });
  const r = await s.get({ country: 'ALL', q: 'Erdoğan OR Erdogan', sources: 'google,gdelt,bing', from: day(-6), to: day(0) });
  assert.equal(r.status, 200);
  assert.ok(s.mock.requests.filter((x) => x.path === '/rss/search').every((x) => x.q.startsWith('Erdoğan OR Erdogan after:')));
  const gd = s.mock.requests.find((x) => x.path === '/api/v2/doc/doc');
  assert.equal(gd.q, 'Erdoğan OR Erdogan', 'sourcecountry yok');
  const bing = s.mock.requests.find((x) => x.path === '/news/search');
  assert.equal(bing.mkt, 'en-US');
  assert.equal(bing.cc, null);
  const gi = r.body.items.find((i) => i.provider === 'gdelt');
  assert.equal(gi.country, 'TR');
  assert.equal(gi.place, 'Türkiye');
  assert.equal(gi.lang, 'tr');
  s.stop();
});

test('dünya araması / akışlar: ülke şartı yok, her akış kendi dilinde aranır', async () => {
  const feeds = (b) => [
    { name: 'Yerli Yayıncı', url: `${b}/feeds/news.xml`, kind: 'news', countries: ['TR'] },
    { name: 'Küresel', url: `${b}/feeds/global.xml`, kind: 'news', countries: ['*'] },
  ];
  const mock = await createMockGoogleNews({});
  const app = createServer({ newsBase: mock.base, bases: {}, feeds: feeds(mock.base), translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const r = await (await fetch(`${base}/api/news?${qs({ country: 'ALL', topic: 'education', sources: 'feeds', from: day(-6), to: day(0) })}`)).json();
  const titles = r.items.map((i) => i.title);
  assert.ok(titles.includes("İstanbul'da okul servisleri denetlendi"), 'Türkçe akışta Türkçe terim');
  assert.ok(titles.includes('Turkey unveils new school calendar'), 'küresel akışta İngilizce terim, ülke adı şartı yok');
  assert.ok(titles.includes('Istanbul school bus rules tighten'));
  assert.ok(!titles.some((t) => /France election/.test(t)), 'konuyla ilgisiz haber gelmez');
  assert.equal(r.items.find((i) => i.source === 'Yerli Yayıncı').lang, 'tr');
  assert.equal(r.items.find((i) => i.source === 'Küresel').lang, 'en');
  app.close(); mock.close();
});

test('küresel akışta ülke adı yalnızca başlıkta aranır (özet metni sayılmaz)', async () => {
  const mock = await createMockGoogleNews({});
  const feeds = [{ name: 'Küresel', url: `${mock.base}/feeds/global.xml`, kind: 'news', countries: ['*'] }];
  const app = createServer({ newsBase: mock.base, bases: {}, feeds, translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const r = await (await fetch(`${base}/api/news?${qs({ country: 'TR', sources: 'feeds', from: day(-6), to: day(0), strict: '0' })}`)).json();
  assert.deepEqual(r.items.map((i) => i.title).sort(), ['Istanbul school bus rules tighten', 'Turkey unveils new school calendar'].sort());
  app.close(); mock.close();
});
