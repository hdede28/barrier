'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { getNews, createMemoryCache } = require('../lib/news');
const { clusterStories } = require('../lib/cluster');
const { mentionsMaarif, NAMES } = require('../data/maarif');
const { COUNTRIES, findCountry } = require('../data/meta');
const { buildSearchQuery } = require('../lib/query');
const { foreignFocus } = require('../lib/relevance');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams({ tstrict: '0', ...o }).toString();

async function start(mockOpts, feeds = []) {
  const mock = await createMockGoogleNews(mockOpts);
  const b = mock.base;
  const app = createServer({ newsBase: b, bases: { gdelt: b, bing: b, reddit: b, hn: b, mastodon: b }, feeds, translator: null, timing: { gdeltGap: 1, retryWait: 5 } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (params) => {
    const r = await fetch(`${base}/api/news?${qs(params)}`);
    return { status: r.status, body: await r.json() };
  };
  return { mock, base, get, stop: () => { app.close(); mock.close(); } };
}

test('son dakika / Google: when: operatörü, öne çıkan haberler akışı, yalnızca son N saat, en yeni önce', async () => {
  const s = await start({ perRequest: 12 });
  const r = await s.get({ mode: 'breaking', country: 'TR', hours: '3', sources: 'google' });
  assert.equal(r.status, 200);
  assert.equal(r.body.mode, 'breaking');
  assert.equal(r.body.hours, 3);
  const search = s.mock.requests.filter((x) => x.path === '/rss/search');
  const top = s.mock.requests.filter((x) => x.path === '/rss');
  assert.equal(search.length, 1);
  assert.match(search[0].q, /when:3h$/);
  assert.ok(!/after:/.test(search[0].q), 'son dakikada tarih aralığı operatörü yok');
  assert.equal(top.length, 1, 'konu/şehir/kelime yoksa öne çıkan haberler de çekilir');
  assert.equal(top[0].gl, 'TR');
  const cutoff = Date.now() - 3 * 3600000;
  assert.ok(r.body.items.length > 0);
  assert.ok(r.body.items.every((i) => Date.parse(i.published) >= cutoff - 60000), 'hepsi son 3 saatte');
  const times = r.body.items.map((i) => i.story.last);
  assert.deepEqual(times, [...times].sort().reverse(), 'en yeni önce');
  s.stop();
});

test('son dakika: saat seçenekleri, konu varken öne çıkan haberler çekilmez, geçersiz saat 3 olur', async () => {
  const s = await start({ perRequest: 6 });
  await s.get({ mode: 'breaking', country: 'TR', hours: '1', sources: 'google', topic: 'sports' });
  await s.get({ mode: 'breaking', country: 'TR', hours: '24', sources: 'google', topic: 'sports' });
  const bad = await s.get({ mode: 'breaking', country: 'TR', hours: '99', sources: 'google', topic: 'sports' });
  const q = s.mock.requests.filter((x) => x.path === '/rss/search').map((x) => /when:\S+$/.exec(x.q)[0]);
  assert.deepEqual(q, ['when:1h', 'when:1d', 'when:3h']);
  assert.equal(s.mock.requests.filter((x) => x.path === '/rss').length, 0);
  assert.equal(bad.body.hours, 3);
  s.stop();
});

test('son dakika / dünya: 10 yayın sürümü; GDELT ve sosyal kaynaklar atlanır; Bing son 24 saat', async () => {
  const s = await start({ perRequest: 4 });
  const r = await s.get({ mode: 'breaking', country: 'ALL', hours: '3', sources: 'google,gdelt,bing,mastodon,hn' });
  assert.equal(r.status, 200);
  const gl = new Set(s.mock.requests.filter((x) => x.path === '/rss/search').map((x) => x.gl));
  assert.equal(gl.size, 10);
  const by = Object.fromEntries(r.body.sources.map((x) => [x.id, x]));
  assert.match(by.gdelt.skipped, /Son dakika/);
  assert.match(by.mastodon.skipped, /Son dakika/);
  assert.match(by.hn.skipped, /kullanılmaz/);
  assert.equal(s.mock.requests.find((x) => x.path === '/news/search').qft, 'interval="7"');
  await s.get({ mode: 'breaking', country: 'TR', hours: '1', sources: 'bing' });
  assert.equal(s.mock.requests.filter((x) => x.path === '/news/search').at(-1).qft, 'interval="4"');
  s.stop();
});

test('Maarif: vakfın adı her yayın sürümünün dilinde aranır; GDELT ülke filtresiz; akışlarda yalnızca vakıf haberleri', async () => {
  const feeds = (b) => [{ name: 'Test Akış', url: `${b}/feeds/maarif.xml`, kind: 'news', countries: ['*'] }];
  const mock = await createMockGoogleNews({ perRequest: 3 });
  const b = mock.base;
  const app = createServer({ newsBase: b, bases: { gdelt: b, bing: b, reddit: b, hn: b, mastodon: b }, feeds: feeds(b), translator: null, timing: { gdeltGap: 1, retryWait: 5 } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const r = await (await fetch(`${base}/api/news?${qs({ mode: 'maarif', from: day(-29), to: day(0), sources: 'google,gdelt,bing,feeds,mastodon,hn' })}`)).json();
  const g = mock.requests.filter((x) => x.path === '/rss/search');
  assert.equal(g.length, 18, '18 sürüm x 1 pencere (30 günlük aralık)');
  const byGl = Object.fromEntries(g.map((x) => [x.gl, x.q]));
  assert.match(byGl.TR, /^\("Türkiye Maarif Vakfı" OR/);
  assert.match(byGl.SA, /مؤسسة المعارف التركية/);
  assert.match(byGl.RU, /Фонд «Маариф»/);
  assert.match(byGl.FR, /Fondation Maarif de Turquie/);
  assert.match(byGl.AL, /Fondacioni Maarif/);
  assert.match(byGl.US, /Turkish Maarif Foundation/);
  const gd = mock.requests.find((x) => x.path === '/api/v2/doc/doc');
  assert.ok(!/sourcecountry/.test(gd.q));
  assert.match(gd.q, /Türkiye Maarif Vakfı/);
  assert.match(gd.q, /مؤسسة المعارف التركية/);
  const feedOnly = await (await fetch(`${base}/api/news?${qs({ mode: 'maarif', from: day(-29), to: day(0), sources: 'feeds' })}`)).json();
  const f = feedOnly.items.map((i) => i.title).sort();
  assert.deepEqual(f, ["Türkiye Maarif Vakfı Nijer'de yeni okul açtı", 'Turkish Maarif Foundation signs deal in Somalia'].sort(), "Ma'arif NU ve alakasız haber elenir");
  const tags = mock.requests.filter((x) => x.path.startsWith('/tags/')).map((x) => x.path);
  assert.ok(tags.includes('/tags/maarif.rss') && tags.includes('/tags/maariffoundation.rss'));
  assert.match(r.sources.find((x) => x.id === 'hn').skipped, /kullanılmaz/);
  assert.equal(r.mode, 'maarif');
  assert.equal(r.hidden, 0, 'Maarif modunda ülke/konu süzgeci çalışmaz');
  app.close(); mock.close();
});

test('Maarif adları: ana diller dahil, mentionsMaarif ilgisiz kurumları elemiş', () => {
  for (const lang of ['tr', 'en', 'ar', 'fr', 'ru', 'sq', 'mk', 'fa', 'az', 'id', 'ja']) assert.ok(NAMES[lang]?.length, lang);
  assert.ok(Object.keys(NAMES).length >= 25, '25+ dil');
  assert.equal(mentionsMaarif('Türkiye Maarif Vakfı Kosova\'da yeni okul açtı'), true);
  assert.equal(mentionsMaarif('Fondacioni Maarif hapi shkollë të re'), true);
  assert.equal(mentionsMaarif('Maarif foundation, a Turkish institution, opened a campus'), true);
  assert.equal(mentionsMaarif("Ma'arif NU Jakarta toplantısı"), false);
  assert.equal(mentionsMaarif('Maarif Ministry of Education announces exams'), false);
});

test('kümeleme: aynı haberi veren kaynaklar tek haberde, bağımsız kaynak sayısı ve diğer bağlantılar', () => {
  const it = (title, source, kind = 'news', h = 1) => ({ title, source, kind, link: `https://${source}.example/${title.length}`, provider: 'a', published: new Date(Date.now() - h * 3600000).toISOString() });
  const out = clusterStories([
    it("Deprem sonrası İstanbul'da okullar bir gün tatil edildi", 'ntv', 'news', 3),
    it("İstanbul'da okullar deprem nedeniyle tatil edildi", 'hurriyet', 'news', 2),
    it("Okullar deprem sonrası İstanbul'da tatil", 'bbc', 'news', 1),
    it("İstanbul'da okullar tatil edildi, paylaşım", 'mastodon', 'social', 0.5),
    it('Galatasaray Fenerbahçe derbisini kazandı', 'sabah'),
  ]);
  assert.equal(out.length, 2);
  const story = out.find((o) => o.title.includes('Deprem'));
  assert.equal(story.story.count, 3, '3 bağımsız haber kaynağı');
  assert.equal(story.story.social, 1, 'sosyal medya ayrı sayılır');
  assert.equal(story.story.also.length, 3);
  assert.ok(story.story.first < story.story.last);
  assert.equal(out.find((o) => o.title.includes('Galatasaray')).story.count, 1);
});

test('bağlantı temizleme: izleme parametreleri ve www/m farkı aynı haberi iki kez göstermez', async () => {
  const p = (id, items) => ({ id, label: id, kind: 'news', available: true, skip: () => null, fetch: async () => ({ items }) });
  const mk = (link) => ({ title: `Başlık ${link.length} farklı`, link, source: 'x', published: new Date().toISOString() });
  const providers = [
    p('a', [mk('https://www.site.example/haber/1?utm_source=twitter&id=7')]),
    p('b', [mk('https://m.site.example/haber/1/?utm_campaign=x&id=7#yorumlar'), mk('https://site.example/haber/1?id=8')]),
  ];
  const body = await getNews(new URLSearchParams({ country: 'TR', from: day(-2), to: day(0), tstrict: '0' }), { providers, cache: createMemoryCache() });
  assert.equal(body.total, 2, 'id=7 ve id=8 farklı haberler; utm/hash/www farkı aynı haber');
});

test('son dakika kümelemesi API\'de: story alanı; arama modunda kümeleme varsayılan kapalı', async () => {
  const mk = (title, link, source) => ({ title, link, source, kind: 'news', published: new Date().toISOString(), lang: 'tr' });
  const provider = { id: 'a', label: 'A', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [
    mk('Merkez Bankası faiz kararını açıkladı bugün', 'https://a/1', 'NTV'), mk('Merkez Bankası bugün faiz kararını açıkladı', 'https://a/2', 'Sabah'),
    mk('Merkez Bankası faiz kararı açıklandı bugün', 'https://a/3', 'BBC') ] }) };
  const base = { country: 'TR', tstrict: '0', from: day(-2), to: day(0) };
  const search = await getNews(new URLSearchParams(base), { providers: [provider] });
  assert.equal(search.total, 3);
  assert.equal(search.items[0].story, undefined);
  const clustered = await getNews(new URLSearchParams({ ...base, cluster: '1' }), { providers: [provider] });
  assert.equal(clustered.total, 1);
  assert.equal(clustered.items[0].story.count, 3);
  const breaking = await getNews(new URLSearchParams({ mode: 'breaking', country: 'TR', tstrict: '0' }), { providers: [provider] });
  assert.equal(breaking.total, 1);
});

test('yeni ülkeler: 65 ülke, komşular dahil; sorgu ülkenin dilinde; yer adları iki kez sayılmaz', () => {
  assert.ok(COUNTRIES.length >= 60);
  for (const code of ['AZ', 'GE', 'AM', 'IQ', 'SY', 'BG', 'CY', 'UA', 'RO', 'BA', 'KZ', 'UZ', 'LB', 'IL', 'PS', 'LY', 'DZ', 'MA', 'SD', 'SO', 'PK', 'ID', 'NG', 'KR']) {
    const c = findCountry(code);
    assert.ok(c && c.fips && c.cities.length, code);
  }
  assert.match(buildSearchQuery({ country: findCountry('IQ'), city: '', topic: 'education', keyword: '' }), /تعليم/);
  assert.match(buildSearchQuery({ country: findCountry('AZ'), city: 'Bakı', topic: 'education', keyword: '' }), /^"Bakı" \(təhsil OR məktəb/);
  assert.match(buildSearchQuery({ country: findCountry('UA'), city: '', topic: 'sports', keyword: '' }), /футбол/);
  assert.match(buildSearchQuery({ country: findCountry('DZ'), city: '', topic: 'sports', keyword: '' }), /football/, 'Fransızca terimler de');
  // Ukrayna artık ülke: Ukrayna seçiliyken "Ukrayna" haberi yabancı sayılmaz, Türkiye seçiliyken sayılır
  assert.equal(foreignFocus('Kyiv under attack overnight', findCountry('UA')), false);
  assert.equal(foreignFocus("Ukrayna'da savaş sürüyor", findCountry('TR')), true);
});
