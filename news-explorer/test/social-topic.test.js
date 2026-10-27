'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { getNews } = require('../lib/news');
const { offTopic, topicScore } = require('../lib/relevance');
const { diagnose, formatText } = require('../lib/diagnose');
const { createProviders } = require('../lib/providers');
const { createMockGoogleNews } = require('./mock-google-news');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const qs = (o) => new URLSearchParams(o).toString();

async function start(mockOpts, feeds = []) {
  const mock = await createMockGoogleNews(mockOpts);
  const b = mock.base;
  const app = createServer({ newsBase: b, bases: { gdelt: b, bing: b, reddit: b, hn: b, mastodon: b }, feeds, translator: null });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = async (params) => {
    const r = await fetch(`${base}/api/news?${qs(params)}`);
    return { status: r.status, body: await r.json() };
  };
  return { mock, base, get, stop: () => { app.close(); mock.close(); } };
}

test('konu puanlaması: seçilen konu başka konudan az eşleşiyorsa elenir', () => {
  const cases = [
    ['education', 'tr', "İstanbul'da okul servisleri denetlendi", false],
    ['education', 'tr', 'Karne günü: 18 milyon öğrenci tatile giriyor', false],
    ['education', 'tr', 'Üniversite takımı şampiyon oldu', true],
    ['sports', 'tr', 'Üniversite takımı şampiyon oldu', false],
    ['education', 'tr', 'Fenerbahçe galibiyetle liderliği aldı', true],
    ['education', 'tr', 'Dolar güne yükselişle başladı', true],
    ['technology', 'tr', 'Yapay zeka modelleri yeni çipleriyle eğitim aldı', false],
    ['education', 'tr', 'Yapay zeka modelleri yeni çipleriyle eğitim aldı', true],
    ['education', 'en', 'Teachers strike in Chicago over class sizes', false],
    ['education', 'en', 'Premier League club signs striker in transfer deal', true],
    ['sports', 'en', 'Transport minister announces new rail plan', true],
    ['education', 'de', 'Lehrer streiken für mehr Gehalt', false],
    ['education', 'ko', '한국 학교 소식', false],
  ];
  for (const [topic, lang, title, expected] of cases) assert.equal(offTopic(title, topic, lang), expected, `${topic}/${lang}: ${title}`);
  assert.equal(topicScore('spor ve transport', 'sports', 'tr'), 1, '"transport" içindeki "spor" sayılmaz, yalnızca baştaki sözcük');
});

test('konu süzgeci API\'de: ilgisiz başlıklar gizlenir, sayıları bildirilir, tstrict=0 ile görünür', async () => {
  const mk = (title, link) => ({ title, link, source: 'x', lang: 'tr', published: new Date().toISOString() });
  const provider = { id: 'a', label: 'A', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [
    mk('Okullar yarın açılıyor', 'https://a/1'), mk('Derbide Galatasaray kazandı', 'https://a/2'),
    mk('Yeni telefon tanıtıldı', 'https://a/3'), mk('Öğretmen atamaları başladı', 'https://a/4'),
    { ...mk('Genel bir başlık', 'https://a/5'), topicTrusted: true },
  ] }) };
  const run = (extra = {}) => getNews(new URLSearchParams({ country: 'TR', topic: 'education', from: day(-3), to: day(0), ...extra }), { providers: [provider] });
  const strict = await run();
  assert.deepEqual(strict.items.map((i) => i.link).sort(), ['https://a/1', 'https://a/4', 'https://a/5']);
  assert.equal(strict.hiddenBy.topic, 2);
  assert.equal(strict.hidden, 2);
  const loose = await run({ tstrict: '0' });
  assert.equal(loose.total, 5);
  const general = await run({ topic: 'general' });
  assert.equal(general.total, 5, 'konu "Genel" iken süzgeç çalışmaz');
});

test('Mastodon: etiketler konudan/şehirden türetilir; gönderi metni başlık olur; sosyal etiketli', async () => {
  const s = await start({});
  const r = await s.get({ country: 'TR', topic: 'education', city: 'İstanbul', sources: 'mastodon', from: day(-3), to: day(0), tstrict: '0' });
  assert.equal(r.status, 200);
  const tags = s.mock.requests.filter((x) => x.path.startsWith('/tags/')).map((x) => decodeURIComponent(x.path.split('/')[2].replace('.rss', '')));
  assert.ok(tags.includes('i̇stanbul') || tags.includes('istanbul') || tags.some((t) => t.startsWith('i') && t.endsWith('stanbul')), `şehir etiketi: ${tags}`);
  assert.ok(tags.includes('eğitim') && tags.includes('okul'), 'konu terimleri etiket olur');
  assert.equal(new Set(tags).size, tags.length, 'her etiket bir kez istenir');
  assert.ok(tags.length <= 6, 'en fazla 6 etiket');
  assert.ok(r.body.items.length > 0);
  assert.equal(r.body.items[0].kind, 'social');
  assert.match(r.body.items[0].source, /^Mastodon /);
  assert.match(r.body.items[0].title, /#/);
  // konu, şehir ve kelime yoksa atlanır
  const none = await s.get({ country: 'TR', sources: 'mastodon', from: day(-3), to: day(0) });
  assert.match(none.body.sources[0].skipped, /gerekli/);
  s.stop();
});

test('Reddit: ülkenin topluluğunda aranır, dünya aramasında tüm Reddit\'te', async () => {
  const s = await start({});
  const r = await s.get({ country: 'TR', topic: 'education', sources: 'reddit', from: day(-3), to: day(0), tstrict: '0' });
  const q = s.mock.requests.find((x) => x.path === '/r/turkey/search.rss');
  assert.ok(q, 'r/turkey içinde aranmalı');
  assert.match(q.q, /^\(eğitim OR okul OR üniversite OR öğretmen/);
  assert.equal(q.restrict, '1');
  assert.equal(q.t, 'week');
  assert.equal(r.body.items[0].source, 'Reddit r/turkey');
  assert.equal(r.body.items[0].kind, 'social');
  await s.get({ country: 'ALL', topic: 'education', sources: 'reddit', from: day(-3), to: day(0), tstrict: '0' });
  assert.ok(s.mock.requests.some((x) => x.path === '/search.rss'), 'dünya aramasında sitenin geneli');
  const general = await s.get({ country: 'TR', sources: 'reddit', from: day(-3), to: day(0) });
  assert.ok(s.mock.requests.some((x) => x.path === '/r/turkey/new.rss'), 'konu yoksa topluluğun yeni gönderileri');
  assert.equal(general.status, 200);
  s.stop();
});

test('Hacker News: yalnızca teknoloji/bilim ve kelime aramalarında; tarih filtresi saniye cinsinden', async () => {
  const s = await start({});
  const r = await s.get({ country: 'US', topic: 'technology', sources: 'hn', from: day(-3), to: day(0), tstrict: '0' });
  assert.equal(r.status, 200);
  const q = s.mock.requests.find((x) => x.path === '/api/v1/search_by_date');
  assert.match(q.filters, /^created_at_i>\d{10},created_at_i<\d{10}$/);
  assert.equal(r.body.items[0].source, 'Hacker News');
  assert.equal(r.body.items[1].link, 'https://news.ycombinator.com/item?id=2', 'harici adresi olmayan gönderi HN sayfasına bağlanır');
  const skip = await s.get({ country: 'US', topic: 'education', sources: 'hn', from: day(-3), to: day(0) });
  assert.match(skip.body.sources[0].skipped, /teknoloji/);
  s.stop();
});

test('tanı raporu: her kaynağın durumu, GDELT isteği ve metin biçimi', async () => {
  const mock = await createMockGoogleNews({ gdeltFail: true });
  const b = mock.base;
  const feeds = [
    { name: 'İyi akış', url: `${b}/feeds/news.xml`, kind: 'news', countries: ['TR'] },
    { name: 'Bozuk akış', url: 'http://127.0.0.1:1/yok.xml', kind: 'news', countries: ['TR'] },
  ];
  const providers = createProviders({ feeds });
  const report = await diagnose({ providers, feeds, bases: { gdelt: b, bing: b, reddit: b, hn: b, mastodon: b }, newsBase: b, withFeeds: true, version: 'abc1234' });
  const by = Object.fromEntries(report.sources.map((x) => [x.id, x]));
  assert.equal(by.gdelt.status, 'HATA');
  assert.match(by.gdelt.detail, /too short/);
  assert.match(by.gdelt.request, /sourcecountry%3ATU|sourcecountry:TU/);
  assert.equal(by.feeds.status, 'tamam');
  assert.deepEqual(report.feeds.map((f) => f.status), ['HATA', 'tamam'], 'bozuk akış önce listelenir');
  const text = formatText(report);
  assert.match(text, /sürüm abc1234/);
  assert.match(text, /✗ GDELT: HATA/);
  assert.match(text, /✗ Bozuk akış/);
  mock.close();
});
