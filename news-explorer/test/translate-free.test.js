'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFreeTranslator } = require('../lib/translate-free');
const { translatorFromEnv, translationResponse } = require('../lib/translators');
const { createServer } = require('../server');
const { createMockMyMemory } = require('./mock-mymemory');

const mk = (mock, extra = {}) => createFreeTranslator({ baseURL: mock.base, ...extra });

test('istek biçimi: langpair kaynak|tr, e-posta de parametresi, HTML varlıkları çözülür', async () => {
  const mock = await createMockMyMemory();
  const out = await mk(mock, { email: 'a@b.co' }).translate(['Zgjedhjet'], { source: 'sq' });
  assert.deepEqual(out, ["TR: Zgjedhjet & it's"]);
  assert.deepEqual(mock.requests[0], { path: '/get', q: 'Zgjedhjet', langpair: 'sq|tr', de: 'a@b.co' });
  mock.close();
});

test('e-posta yoksa de gönderilmez; kaynak dil zorunlu; kaynak tr ise çağrı yok', async () => {
  const mock = await createMockMyMemory();
  const t = mk(mock);
  await t.translate(['a'], { source: 'el' });
  assert.equal(mock.requests[0].de, null);
  await assert.rejects(t.translate(['a'], {}), (e) => e.status === 400);
  await assert.rejects(t.translate(['a'], { source: 'ç!' }), (e) => e.status === 400);
  assert.deepEqual(await t.translate(['merhaba'], { source: 'tr' }), ['merhaba']);
  assert.equal(mock.requests.length, 1);
  mock.close();
});

test('önbellek: aynı başlık tekrar istenmez', async () => {
  const mock = await createMockMyMemory();
  const t = mk(mock);
  await t.translate(['a', 'b', 'a'], { source: 'sq' });
  await t.translate(['a', 'b'], { source: 'sq' });
  assert.equal(mock.requests.length, 2);
  mock.close();
});

test('kota dolunca kısmi sonuç: çevrilenler dolu, kalanlar null, hata yok', async () => {
  const mock = await createMockMyMemory({ quotaAfter: 2 });
  const out = await mk(mock).translate(['bir', 'iki', 'üç', 'dört', 'beş'], { source: 'mk' });
  assert.equal(out.filter((x) => x !== null).length, 2);
  assert.equal(out.filter((x) => x === null).length, 3);
  const resp = translationResponse({ provider: 'mymemory', model: 'mymemory' }, out);
  assert.match(resp.warning, /kota/i);
  assert.equal(translationResponse({ provider: 'x', model: 'x' }, ['a']).warning, undefined);
  mock.close();
});

test('kota uyarısı çevrilmiş metin sanılıp önbelleğe alınmaz', async () => {
  const mock = await createMockMyMemory({ quotaAfter: 0 });
  const t = mk(mock);
  assert.deepEqual(await t.translate(['x'], { source: 'sq' }), [null]);
  mock.close();
});

test('günlük karakter sınırı: sınır aşılınca istek atılmaz', async () => {
  const mock = await createMockMyMemory();
  const t = mk(mock, { dailyChars: 10 });
  const out = await t.translate(['12345', '67890', 'abcde'], { source: 'sq' });
  assert.deepEqual(out.map((x) => x === null), [false, false, true]);
  assert.equal(mock.requests.length, 2);
  mock.close();
});

test('servis tamamen çökerse 502; uzun (500 bayttan büyük) başlık olduğu gibi kalır', async () => {
  const down = await createMockMyMemory({ fail: true });
  await assert.rejects(mk(down).translate(['a'], { source: 'sq' }), (e) => e.status === 502);
  down.close();
  const mock = await createMockMyMemory();
  const long = 'ç'.repeat(300); // 600 bayt
  assert.deepEqual(await mk(mock).translate([long], { source: 'sq' }), [long]);
  assert.equal(mock.requests.length, 0);
  mock.close();
});

test('sağlayıcı seçimi: anahtar varsa Claude, yoksa MyMemory', () => {
  assert.equal(translatorFromEnv({}).provider, 'mymemory');
  assert.equal(translatorFromEnv({ ANTHROPIC_API_KEY: 'k' }).provider, 'claude');
});

test('HTTP: anahtarsız sunucu /api/translate ve meta.translation = mymemory', async () => {
  const mock = await createMockMyMemory({ quotaAfter: 1 });
  const app = createServer({ newsBase: 'http://127.0.0.1:1', translator: mk(mock) });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  assert.equal((await (await fetch(`${base}/api/meta`)).json()).translation, 'mymemory');
  const r = await (await fetch(`${base}/api/translate`, { method: 'POST', body: JSON.stringify({ texts: ['a', 'b'], source: 'sq' }) })).json();
  assert.equal(r.provider, 'mymemory');
  assert.equal(r.translations.filter((x) => x === null).length, 1);
  assert.match(r.warning, /kota/i);
  app.close(); mock.close();
});
