'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server');
const { createFactChecker } = require('../lib/factcheck');
const { createSummarizer, parseSummary } = require('../lib/summarize');
const { createFeedbackStore } = require('../lib/feedback');
const { createProviders } = require('../lib/providers');
const { getNews } = require('../lib/news');
const { classifySource, brandOf } = require('../data/source-types');
const { clusterStories } = require('../lib/cluster');
const { createMockGoogleNews } = require('./mock-google-news');
const { createMockAnthropic } = require('./mock-anthropic');

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const item = (title, source, kind = 'news', extra = {}) => ({ title, source, kind, link: `https://${source.replace(/\W/g, '')}.example/${title.length}`, published: new Date().toISOString(), ...extra });

test('kaynak türü: olgusal etiketler, bilinmeyene etiket yok, aynı marka tek sayılır', () => {
  assert.deepEqual(classifySource('BBC News Türkçe').types, ['public']);
  assert.deepEqual(classifySource('Anadolu Ajansı').types, ['agency', 'state']);
  assert.deepEqual(classifySource('Reuters').types, ['agency']);
  assert.deepEqual(classifySource('Al Jazeera English').types, ['state']);
  assert.deepEqual(classifySource('UN News').types, ['official']);
  assert.deepEqual(classifySource('Teyit').types, ['factcheck']);
  assert.deepEqual(classifySource('Reuters Fact Check').types, ['factcheck'], 'doğrulama deseni önce gelir');
  assert.equal(classifySource('Hürriyet'), null);
  assert.equal(classifySource('Sabah'), null);
  assert.equal(classifySource('Mastodon mastodon.social'), null);
  assert.equal(brandOf('BBC News Türkçe'), brandOf('BBC UK'));
  assert.notEqual(brandOf('Teyit'), brandOf('Snopes'));
});

test('kümeleme: aynı marka tek yayıncı, ajans içeriği işaretlenir, doğrulama haber sayısına girmez', () => {
  const out = clusterStories([
    item('Merkez Bankası faiz kararını açıkladı bugün', 'BBC News Türkçe'),
    item('Merkez Bankası bugün faiz kararını açıkladı', 'BBC UK'),
    item('Merkez Bankası faiz kararı açıklandı bugün', 'Anadolu Ajansı'),
    item('Merkez Bankası faiz kararını açıkladı: iddia incelemesi', 'Teyit', 'factcheck'),
  ]);
  assert.equal(out.length, 1);
  const s = out[0].story;
  assert.equal(s.count, 3, '3 kaynak adı');
  assert.equal(s.brands, 2, 'ama 2 yayıncı (BBC + AA)');
  assert.deepEqual(s.agencies, ['AA']);
  assert.equal(out[0].factchecks.length, 1);
  assert.equal(out[0].factchecks[0].source, 'Teyit');
});

test('aramada: haberlere kaynak türü ve ilgili doğrulama bağlantısı eklenir; doğrulama haber gibi sayılmaz', async () => {
  const mk = (title, source, kind, link) => ({ title, source, link, published: new Date().toISOString(), lang: 'tr' });
  const news = { id: 'feeds', label: 'Yayıncı', kind: 'news', available: true, skip: () => null, fetch: async () => ({ items: [
    mk('Okul servislerinde yeni denetim dönemi başlıyor bugün', 'Anadolu Ajansı', 'news', 'https://aa/1'),
    mk('Maç sonucu açıklandı', 'Sabah', 'news', 'https://s/2') ] }) };
  const checks = { id: 'factcheck', label: 'Doğrulama', kind: 'factcheck', available: true, skip: () => null, fetch: async () => ({ items: [
    mk('İddia: okul servislerinde yeni denetim dönemi başlıyor', 'Teyit', 'factcheck', 'https://teyit.org/x') ] }) };
  const body = await getNews(new URLSearchParams({ country: 'TR', from: day(-2), to: day(0), tstrict: '0' }), { providers: [news, checks] });
  const aa = body.items.find((i) => i.source === 'Anadolu Ajansı');
  assert.deepEqual(aa.sourceType.types, ['agency', 'state']);
  assert.equal(aa.factchecks[0].source, 'Teyit');
  assert.equal(body.items.find((i) => i.source === 'Sabah').sourceType, undefined, 'bilinmeyen kaynağa etiket yok');
  assert.equal(body.items.find((i) => i.source === 'Sabah').factchecks, undefined);
  assert.equal(body.items.find((i) => i.kind === 'factcheck').sourceType.types[0], 'factcheck');
});

test('doğrulama araması: RSS önbelleğinden benzer incelemeler, Google API anahtarla; hüküm vermez', async () => {
  const mock = await createMockGoogleNews({});
  const b = mock.base;
  const feeds = [{ name: 'Teyit', url: `${b}/feeds/factcheck.xml`, kind: 'factcheck', countries: ['TR'], lang: 'tr' }];
  const providers = createProviders({ feeds });
  const fc = createFactChecker({ providers, baseURL: b, apiKey: 'k' });
  const r = await fc.lookup('Okul servislerinde yeni denetim dönemi başlıyor', 'tr');
  assert.ok(r.results.some((x) => x.via === 'rss' && x.source === 'Teyit'));
  const g = r.results.find((x) => x.via === 'google');
  assert.equal(g.source, 'Teyit Google');
  assert.equal(g.rating, 'Yanlış');
  assert.equal(mock.requests.find((x) => x.path === '/v1alpha1/claims:search').key, 'k');
  assert.deepEqual(r.searched, ['Doğrulama kuruluşlarının RSS akışları', 'Google Fact Check API']);
  await assert.rejects(fc.lookup('kısa', 'tr'), (e) => e.status === 400);
  const none = await createFactChecker({ providers, baseURL: b }).lookup('Tamamen alakasız başka bir konu hakkında uzun başlık');
  assert.deepEqual(none.results, []);
  mock.close();
});

test('olay özeti: başlıklar veri olarak gönderilir, yanıt doğrulanır, önbellek ve günlük sınır', async () => {
  const mock = await createMockAnthropic({ reply: () => JSON.stringify({ summary: 'Üç kaynak aynı olayı bildiriyor.', common: ['Karar açıklandı'], differences: [], caveats: ['Yalnızca başlıklara dayanır'] }) });
  const s = createSummarizer({ apiKey: 'k', baseURL: mock.base, dailyLimit: 2 });
  const items = [{ source: 'NTV', title: 'Karar açıklandı bugün' }, { source: 'Sabah', title: 'Bugün karar açıklandı', snippet: 'ayrıntı' }];
  const r = await s.summarize(items);
  assert.match(r.summary, /Üç kaynak/);
  assert.match(r.basis, /haber metinleri okunmadı/);
  const req = mock.requests[0].body;
  assert.match(req.system, /güvenilmeyen veri/);
  assert.deepEqual(JSON.parse(req.messages[0].content)[1], { source: 'Sabah', title: 'Bugün karar açıklandı', snippet: 'ayrıntı' });
  assert.equal((await s.summarize(items)).cached, true);
  assert.equal(mock.requests.length, 1);
  await assert.rejects(s.summarize([{ title: 'tek' }]), (e) => e.status === 400);
  await s.summarize([...items, { source: 'BBC', title: 'Üçüncü kaynak başlığı' }]);
  await assert.rejects(s.summarize([...items, { source: 'AA', title: 'Dördüncü kaynak başlığı' }]), (e) => e.status === 429);
  assert.throws(() => parseSummary('Elbette! İşte özet.'), /okunamadı/);
  assert.equal(createSummarizer({}), null);
  mock.close();
});

test('geri bildirim: doğrulama, hız sınırı; okuma yalnızca ADMIN_TOKEN ile', () => {
  const st = createFeedbackStore({ file: 'off', adminToken: 'gizli', perMinute: 2 });
  assert.deepEqual(st.add({ reason: 'offtopic', title: 'Spor haberi', source: 'X', topic: 'education', country: 'TR', mode: 'search' }, '1.1.1.1'), { ok: true });
  assert.throws(() => st.add({ reason: 'zzz', title: 'x' }, '1.1.1.1'), (e) => e.status === 400);
  assert.throws(() => st.add({ reason: 'offtopic', title: '' }, '1.1.1.1'), (e) => e.status === 400);
  st.add({ reason: 'source', title: 'Başlık', source: 'Kötü Kaynak' }, '1.1.1.1');
  assert.throws(() => st.add({ reason: 'other', title: 'Üçüncü' }, '1.1.1.1'), (e) => e.status === 429);
  assert.throws(() => st.report('gizli-degil'), (e) => e.status === 403);
  const rep = st.report('gizli');
  assert.equal(rep.total, 2);
  assert.equal(rep.topSourcesReported[0].name, 'Kötü Kaynak');
  assert.equal(rep.recentOffTopic[0].title, 'Spor haberi');
  assert.throws(() => createFeedbackStore({ file: 'off' }).report('x'), (e) => e.status === 404);
});

test('HTTP uçları: factcheck, summarize, feedback ve meta bayrakları', async () => {
  const mock = await createMockAnthropic({ reply: () => JSON.stringify({ summary: 'Özet metni', common: [], differences: [], caveats: [] }) });
  const feedback = createFeedbackStore({ file: 'off', adminToken: 'tok' });
  const checker = { lookup: async (q) => ({ query: q, results: [{ source: 'Teyit', title: 'İnceleme', link: 'https://teyit.org/a', via: 'rss' }], searched: ['x'], notes: [] }), available: true, hasApi: false };
  const app = createServer({ feeds: [], translator: null, summarizer: createSummarizer({ apiKey: 'k', baseURL: mock.base }), feedback, factChecker: checker });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const meta = await (await fetch(`${base}/api/meta`)).json();
  assert.equal(meta.summary, true);
  assert.equal(meta.factcheck.available, true);
  assert.equal(meta.sourceTypes.agency.label, 'Haber ajansı');
  assert.equal((await (await fetch(`${base}/api/factcheck?q=${encodeURIComponent('Bir başlık metni')}`)).json()).results[0].source, 'Teyit');
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
  const sum = await (await post('/api/summarize', { items: [{ source: 'A', title: 'Birinci başlık' }, { source: 'B', title: 'İkinci başlık' }] })).json();
  assert.equal(sum.summary, 'Özet metni');
  assert.equal((await post('/api/summarize', { items: [] })).status, 400);
  assert.equal((await post('/api/feedback', { reason: 'offtopic', title: 'Alakasız bir haber', source: 'Z' })).status, 200);
  assert.equal((await fetch(`${base}/api/feedback?token=yanlis`)).status, 403);
  assert.equal((await (await fetch(`${base}/api/feedback?token=tok`)).json()).total, 1);
  app.close(); mock.close();

  const off = createServer({ feeds: [], translator: null, summarizer: null, feedback });
  await new Promise((r) => off.listen(0, '127.0.0.1', r));
  const b2 = `http://127.0.0.1:${off.address().port}`;
  assert.equal((await (await fetch(`${b2}/api/meta`)).json()).summary, false);
  assert.equal((await fetch(`${b2}/api/summarize`, { method: 'POST', body: '{"items":[]}' })).status, 503);
  off.close();
});
