'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMockAnthropic } = require('./mock-anthropic');

// Çevirmen isolate başına bir kez kurulduğu için bu dosya ayrı bir süreçte, anahtarla başlar.
test('worker: /api/translate anahtar varken çalışır, meta.translation true olur', async () => {
  const worker = (await import('../worker.mjs')).default;
  const mock = await createMockAnthropic();
  const env = { ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: mock.base, TRANSLATE_MODEL: 'claude-haiku-5-5' };
  const call = (path, init) => worker.fetch(new Request(`https://haber.example${path}`, init), env);

  assert.equal((await (await call('/api/meta')).json()).translation, true);
  const res = await call('/api/translate', { method: 'POST', body: JSON.stringify({ texts: ['Zgjedhjet', 'Arsimi'] }) });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.translations, ['TR: Zgjedhjet', 'TR: Arsimi']);
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.equal((await call('/api/translate', { method: 'POST', body: 'bozuk{' })).status, 400);
  assert.equal((await call('/api/translate', { method: 'POST', body: JSON.stringify({ texts: [] }) })).status, 400);
  mock.close();
});
