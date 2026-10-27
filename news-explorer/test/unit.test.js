'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRss } = require('../lib/rss');
const { buildSearchQuery, planWindows, cleanText, dateOperators, parseSearchParams } = require('../lib/query');
const { findCountry, COUNTRIES, TOPICS, TOPIC_TERMS, termsFor } = require('../data/meta');

test('parseRss: başlık, kaynak, tarih ve CDATA/varlık çözümü', () => {
  const xml = `<rss><channel>
  <item><title><![CDATA[Okullar açıldı & yeni dönem - Hürriyet]]></title>
    <link>https://n.example/1</link><pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
    <source url="https://hurriyet.example">Hürriyet</source></item>
  <item><title>Q&amp;A: &#304;stanbul &#x41;</title><link>javascript:alert(1)</link></item>
  <item><title>Tarihsiz - BBC</title><link>https://n.example/3</link><pubDate>bozuk</pubDate><source url="u">BBC</source></item>
  </channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 2, 'http(s) olmayan bağlantı atlanmalı');
  assert.equal(items[0].title, 'Okullar açıldı & yeni dönem');
  assert.equal(items[0].source, 'Hürriyet');
  assert.equal(items[0].published, '2024-01-15T10:00:00.000Z');
  assert.equal(items[1].title, 'Tarihsiz');
  assert.equal(items[1].published, null);
  assert.equal(parseRss('<item><title>Q&amp;A: &#304;stanbul &#x41; - X</title><link>https://a.b/c</link><source url="">X</source></item>')[0].title, 'Q&A: İstanbul A');
});

test('buildSearchQuery: şehir, konu terimleri ve anahtar kelime', () => {
  const tr = findCountry('TR');
  assert.equal(buildSearchQuery({ country: tr, city: 'İzmir', topic: 'education', keyword: '' }),
    '"İzmir" (eğitim OR okul OR üniversite OR öğretmen)');
  // Konu/şehir/kelime yoksa ülke adı DEĞİL, genel terimler aranır ("Türkiye" aramak adı geçen her haberi getirirdi)
  const general = buildSearchQuery({ country: tr, city: '', topic: 'general', keyword: '' });
  assert.ok(!general.includes('Türkiye'));
  assert.match(general, /^\(eğitim OR okul OR siyaset OR hükümet OR ekonomi/);
  assert.equal(buildSearchQuery({ country: tr, city: 'Ankara', topic: 'technology', keyword: 'robot' }),
    '"Ankara" (teknoloji OR "yapay zeka" OR yazılım) robot');
  // Dil karşılığı olmayan ülkede İngilizce terimlere düşer
  assert.match(buildSearchQuery({ country: findCountry('NL'), city: 'Utrecht', topic: 'sports', keyword: '' }), /sports OR match OR football/);
});

test('cleanText: tırnak ve tarih operatörlerini temizler', () => {
  assert.equal(cleanText('  okul "bahçe" after:2020-01-01 when:1d  güvenliği '), 'okul bahçe güvenliği');
  assert.equal(cleanText('x'.repeat(500)).length, 80);
});

test('planWindows: kısa aralık tek pencere, uzun aralık eşit parçalar', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  assert.deepEqual(planWindows('2026-10-01', '2026-10-27', now), [{ from: '2026-10-01', to: '2026-10-27' }]);
  const w = planWindows('2021-10-28', '2026-10-27', now);
  assert.equal(w.length, 12);
  assert.equal(w[0].from, '2021-10-28');
  assert.equal(w.at(-1).to, '2026-10-27');
  for (let i = 1; i < w.length; i++) {
    const gap = (Date.parse(w[i].from) - Date.parse(w[i - 1].to)) / 86400000;
    assert.equal(gap, 1, 'pencereler boşluksuz ve çakışmasız olmalı');
  }
});

test('planWindows: geçersiz girdiler', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  assert.throws(() => planWindows('2026-13-01', '2026-10-27', now), /biçiminde/);
  assert.throws(() => planWindows('2026-10-27', '2026-10-01', now), /sonra olamaz/);
  assert.throws(() => planWindows('1999-01-01', '2026-10-01', now), /En eski/);
  assert.throws(() => planWindows('2026-10-01', '2027-03-01', now), /gelecekte/);
});

test('dateOperators: bitiş günü dahil olsun diye before bir gün ilerlenir', () => {
  assert.equal(dateOperators({ from: '2024-02-28', to: '2024-02-29' }), 'after:2024-02-28 before:2024-03-01');
});

test('parseSearchParams: ülke ve konu doğrulaması', () => {
  const p = (o) => new URLSearchParams(o);
  const base = { country: 'TR', from: '2026-10-01', to: '2026-10-27' };
  assert.throws(() => parseSearchParams(p({ ...base, country: 'XX' })), /ülke/);
  assert.throws(() => parseSearchParams(p({ ...base, topic: 'nope' })), /konu/);
  assert.equal(parseSearchParams(p({ ...base, topic: 'sports', city: 'İstanbul' }), new Date('2026-10-27')).windows.length, 1);
});

test('her ülkenin her konu için terimi var ve kodlar benzersiz', () => {
  assert.equal(new Set(COUNTRIES.map((c) => c.code)).size, COUNTRIES.length);
  for (const c of COUNTRIES) {
    assert.ok(c.cities.length > 0, c.code);
    for (const lang of c.terms) {
      for (const t of TOPICS.filter((x) => x.id !== 'general')) {
        assert.ok(TOPIC_TERMS[t.id][lang]?.length >= 3, `${c.code}/${t.id}/${lang} terimi eksik`);
      }
    }
  }
});

test('yeni ülkeler: istenen on ülke listede', () => {
  for (const code of ['AL', 'XK', 'MK', 'RS', 'ME', 'GR', 'IR', 'AF', 'TN', 'MY', 'GM']) assert.ok(findCountry(code), code);
});

test('termsFor: çok dilli ülkede diller birleşir (Tunus: Arapça + Fransızca)', () => {
  const t = termsFor('education', findCountry('TN'));
  assert.ok(t.includes('تعليم') && t.includes('école'));
});

test('buildSearchQuery: şehir takma adları OR ile aranır', () => {
  assert.equal(buildSearchQuery({ country: findCountry('TN'), city: 'Tunis / تونس', topic: 'general', keyword: '' }),
    '("Tunis" OR "تونس")');
});

test('buildSearchQuery: yaklaşık sürümlü ülkede şehir yoksa ülke adı eklenir, sürümü olanda eklenmez', () => {
  assert.equal(buildSearchQuery({ country: findCountry('AL'), city: '', topic: 'sports', keyword: '' }),
    'Shqipëri (sport OR ndeshje OR futboll)');
  assert.equal(buildSearchQuery({ country: findCountry('XK'), city: 'Prizren', topic: 'sports', keyword: '' }),
    '"Prizren" (sport OR ndeshje OR futboll)');
  assert.equal(buildSearchQuery({ country: findCountry('GR'), city: '', topic: 'sports', keyword: '' }),
    '(αθλητικά OR αγώνας OR ποδόσφαιρο)');
});
