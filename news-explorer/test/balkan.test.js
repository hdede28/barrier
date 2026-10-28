'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { getNews } = require('../lib/news');
const { parseSearchParams } = require('../lib/query');
const { createFeedProvider } = require('../lib/providers/feeds');
const { lensesOf, regionOf } = require('../lib/relevance');
const balkan = require('../data/balkan');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const range = { from: day(-6), to: day(0) };
const params = (o) => new URLSearchParams({ mode: 'balkan', ...range, ...o });

test('balkan: parametreler; varsayılan tüm bölge, tek ülke seçilince ülke aramasına döner, geçersizler atılır', () => {
  const all = parseSearchParams(params({}));
  assert.deepEqual(all.region, balkan.COUNTRY_CODES);
  assert.equal(all.world, true);
  assert.equal(all.topic, 'general');
  assert.equal(all.cluster, true);
  assert.equal(all.trPress, true);
  assert.ok(all.windows.length <= 3);
  const one = parseSearchParams(params({ balkan: 'al,XX', city: 'Tiranë', themes: 'turkey,nope,life' }));
  assert.deepEqual(one.region, ['AL']);
  assert.equal(one.world, false);
  assert.equal(one.country.code, 'AL');
  assert.equal(one.city, 'Tiranë');
  assert.deepEqual(one.themes, ['turkey', 'life']);
  assert.match(one.query, /^"Tiranë" \(Turqia OR /, 'başlık terimleri Arnavutça sorguya girer');
  assert.match(one.query, /"leje qëndrimi"/);
  assert.equal(parseSearchParams(params({ trpress: '0' })).trPress, false);
  assert.deepEqual(parseSearchParams(params({ balkan: 'ZZ' })).region, balkan.COUNTRY_CODES, 'hiç geçerli ülke yoksa tüm bölge');
});

test('balkan: başlıklar çok dilli terimlerle sınıflanır, ülke başlıktan bulunur', () => {
  assert.deepEqual(lensesOf('Qeveria miratoi buxhetin e ri dhe rritjen e pagave'), ['politics', 'economy']);
  assert.ok(lensesOf('Турција ќе инвестира во Македонија').includes('turkey'));
  assert.ok(lensesOf('Zemljotres pogodio Crnu Goru').includes('disaster'));
  assert.ok(!lensesOf('Politika dhe tika janë fjalë').includes('turkey'), 'TIKA gibi kısa kısaltma "politika" içinde eşleşmez');
  assert.deepEqual(regionOf('Tirana and Pristina agree on new border crossing'), ['AL', 'XK']);
  assert.deepEqual(regionOf('Weather: sunny in Vlorë'), ['AL']);
  assert.deepEqual(regionOf('Paris hosts summit'), []);
});

test('balkan / Google: her seçili ülke kendi sürümünde kendi dilinde; Türkiye basını ayrı sorgulanır', async () => {
  const mock = await createMockGoogleNews({ perRequest: 3 });
  const app = createServer({ newsBase: mock.base, bases: { gdelt: mock.base, bing: mock.base }, feeds: [], translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (o) => (await fetch(`${base}/api/news?${params({ sources: 'google,bing,gdelt', ...o })}`)).json();

  const multi = await get({ balkan: 'AL,XK,RS', themes: 'turkey' });
  const g = mock.requests.filter((x) => x.path === '/rss/search');
  assert.equal(g.length, 4, '3 ülke + Türkiye basını');
  const by = Object.fromEntries(g.map((x) => [x.gl, x.q]));
  assert.match(by.AL, /Turqia/);
  assert.match(by.RS, /Turska/);
  assert.match(by.TR, /^\(Arnavutluk OR Tiran OR Kosova OR Priştine OR Sırbistan OR Belgrad\) \(Türkiye OR/);
  assert.equal(multi.sources.find((s) => s.id === 'bing').skipped.includes('tek ülke'), true);
  assert.equal(multi.sources.find((s) => s.id === 'gdelt').skipped.includes('tek ülke'), true);
  assert.ok(multi.total > 0);

  mock.requests.length = 0;
  const one = await get({ balkan: 'AL', city: 'Durrës', trpress: '0' });
  const g1 = mock.requests.filter((x) => x.path === '/rss/search');
  assert.equal(g1.length, 1, 'Türkiye basını kapalı');
  assert.match(g1[0].q, /"Durrës"/);
  assert.equal(g1[0].gl, 'AL');
  assert.ok(!one.sources.find((s) => s.id === 'bing').skipped, 'tek ülkede Bing çalışır');
  assert.ok(mock.requests.some((x) => x.path === '/news/search'));

  mock.requests.length = 0;
  await get({ balkan: 'AL', city: 'Durrës' });
  const press = mock.requests.filter((x) => x.path === '/rss/search' && x.gl === 'TR');
  assert.equal(press.length, 1);
  assert.match(press[0].q, /^Durrës|^\(?"?Durrës/, 'şehir seçiliyse Türkiye basını sorgusu şehirle');
  app.close();
  mock.close();
});

test('balkan: ülke atanır, seçili bölge dışındaki bölge haberleri elenir, başlık sayıları döner', async () => {
  const mk = (title, link, extra = {}) => ({ title, link, source: `Kaynak${link.length}`, lang: 'sq', published: new Date().toISOString(), ...extra });
  const provider = { id: 'a', label: 'A', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [
    mk('Tirana: qeveria miratoi buxhetin e ri', 'https://a/1', { country: 'AL', place: 'Arnavutluk' }),
    mk('Pristina and Tirana sign tourism deal', 'https://a/22', { lang: 'en' }),
    mk('Belgrade protests continue over election result', 'https://a/333', { lang: 'en' }),
    mk('Weekly regional digest', 'https://a/4444', { lang: 'en' }),
    mk('Arnavutluk\'ta oturma izni kuralları değişti', 'https://a/55555', { lang: 'tr', country: 'TR', place: 'Türkiye basını', press: true }),
  ] }) };
  const r = await getNews(params({ balkan: 'AL,XK' }), { providers: [provider] });
  const byTitle = (re) => r.items.find((i) => re.test(i.title));
  assert.ok(!byTitle(/Belgrade/), 'Sırbistan seçili değil: elenir');
  assert.equal(r.hiddenBy.country, 1);
  assert.equal(byTitle(/Pristina and Tirana/).country, 'AL', 'ilk seçili bölge ülkesi');
  assert.equal(byTitle(/Weekly regional/).place, 'Bölge geneli');
  assert.equal(byTitle(/oturma izni/).place, 'Türkiye basını', 'Türkiye basını etiketi korunur');
  assert.deepEqual(r.region, ['AL', 'XK']);
  assert.equal(r.themeCounts.politics, 1);
  assert.equal(r.themeCounts.tourism, 1);
  assert.equal(r.themeCounts.life, 1);
  const only = await getNews(params({ balkan: 'AL,XK', themes: 'life' }), { providers: [provider] });
  assert.deepEqual(only.items.map((i) => i.link), ['https://a/55555']);
  // tek ülke: strict açıkken başka ülke haberi elenir, kapalıyken kalır
  const one = await getNews(params({ balkan: 'AL' }), { providers: [provider] });
  assert.ok(!one.items.some((i) => /Belgrade/.test(i.title)));
});

test('balkan / RSS akışları: ülkeye özel akışlar ve başlıkta ülke adı geçen küresel akışlar; başlık terimleri tüm dillerde', async () => {
  const mock = await createMockGoogleNews({});
  const xml = (items) => items.map(([title, n]) => `<item><title>${title}</title><link>https://x.example/${n}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`).join('');
  const http = require('node:http');
  const feedServer = http.createServer((req, res) => {
    const body = {
      '/al.xml': xml([['Qeveria shqiptare miraton ligjin e ri', 1], ['Tërmet i lehtë në Vlorë këtë fundjavë', 2]]),
      '/rs.xml': xml([['Vlada Srbije usvojila budžet', 3]]),
      '/tr.xml': xml([["Arnavutluk'ta hükümet yeni kararı açıkladı", 4], ["Fransa'da hükümet krizi", 5], ["Kosova'da seçim tarihi belli oldu", 6]]),
    }[req.url];
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/rss+xml' });
    res.end(body ? `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${body}</channel></rss>` : '');
  });
  await new Promise((r) => feedServer.listen(0, '127.0.0.1', r));
  const fb = `http://127.0.0.1:${feedServer.address().port}`;
  const feeds = [
    { name: 'AL Gazete', url: `${fb}/al.xml`, kind: 'news', countries: ['AL'], lang: 'sq' },
    { name: 'RS Gazete', url: `${fb}/rs.xml`, kind: 'news', countries: ['RS'], lang: 'sr' },
    { name: 'TR Dünya', url: `${fb}/tr.xml`, kind: 'news', countries: ['*'], lang: 'tr' },
  ];
  const provider = createFeedProvider({ kind: 'news', feeds });
  const run = (o) => getNews(params({ sources: 'feeds', ...o }), { providers: [provider] });

  const alOnly = await run({ balkan: 'AL' });
  assert.deepEqual(alOnly.items.map((i) => i.source).sort(), ['AL Gazete', 'AL Gazete', 'TR Dünya']);
  assert.ok(alOnly.items.find((i) => i.source === 'TR Dünya').title.includes('Arnavutluk'), 'küresel akışta yalnızca seçili ülkeyi anan başlık');

  const multi = await run({ balkan: 'AL,XK' });
  assert.equal(multi.items.filter((i) => i.source === 'TR Dünya').length, 2, 'Arnavutluk + Kosova; Fransa elenir');
  assert.ok(!multi.items.some((i) => i.source === 'RS Gazete'), 'Sırbistan seçili değil');

  const themed = await run({ balkan: 'AL,XK,RS', themes: 'politics' });
  assert.deepEqual(themed.items.map((i) => i.link).sort(), ['https://x.example/1', 'https://x.example/3', 'https://x.example/4', 'https://x.example/6']);
  const weather = await run({ balkan: 'AL', themes: 'disaster' });
  assert.deepEqual(weather.items.map((i) => i.link), ['https://x.example/2'], 'Arnavutça "tërmet" terimi eşleşir');
  feedServer.close();
  mock.close();
});

test('balkan: /api/meta bölge ülkelerini ve başlıkları verir; yeni akışlar ülkelere dağılmıştır', async () => {
  const app = createServer({ feeds: [], translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const meta = await (await fetch(`http://127.0.0.1:${app.address().port}/api/meta`)).json();
  assert.equal(meta.balkan.focus, 'AL');
  assert.equal(meta.balkan.countries.length, 10);
  assert.ok(meta.balkan.countries.every((c) => meta.countries.some((x) => x.code === c)));
  assert.ok(meta.balkan.lenses.length >= 10 && meta.balkan.lenses.every((l) => l.id && l.icon && l.label));
  app.close();
  const { FEEDS } = require('../data/feeds');
  const perCountry = Object.fromEntries(balkan.COUNTRY_CODES.map((c) => [c, FEEDS.filter((f) => f.countries.includes(c)).length]));
  for (const [c, n] of Object.entries(perCountry)) assert.ok(n >= 2, `${c} için en az 2 akış`);
  assert.ok(perCountry.AL >= 10, 'Arnavutluk odak ülke');
  console.log('Balkan akışları:', JSON.stringify(perCountry));
});
