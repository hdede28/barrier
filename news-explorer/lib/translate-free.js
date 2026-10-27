'use strict';

const { HttpError } = require('./query');
const { decode } = require('./rss');
const { validateTexts } = require('./translate');

const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 10000;
const MAX_QUERY_BYTES = 500; // MyMemory tek sorguda en fazla 500 bayt kabul eder
const CACHE_MAX = 5000;
const QUOTA_RE = /MYMEMORY WARNING|USED ALL AVAILABLE|QUOTA/i;

// Anahtarsız ücretsiz çeviri (MyMemory). Kota küçüktür: anahtarsız ~5.000, e-postayla ~50.000 karakter/gün.
// Kota dolunca çevrilebilen başlıklar çevrilir, kalanı null döner (arayüz orijinalini gösterir).
function createFreeTranslator({ email, dailyChars, baseURL = 'https://api.mymemory.translated.net' } = {}) {
  const limit = Number(dailyChars) > 0 ? Number(dailyChars) : email ? 45000 : 4500;
  const cache = new Map();
  let day = '';
  let used = 0;

  function reserve(chars) {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; used = 0; }
    if (used + chars > limit) return false;
    used += chars;
    return true;
  }

  async function translateOne(text, source) {
    const url = new URL('/get', baseURL);
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${source}|tr`);
    if (email) url.searchParams.set('de', email);
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const json = await res.json().catch(() => null);
    const out = json?.responseData?.translatedText;
    const status = Number(json?.responseStatus ?? res.status);
    if (res.status === 429 || status === 429 || json?.quotaFinished || (typeof out === 'string' && QUOTA_RE.test(out))) return { quota: true };
    if (!res.ok || status !== 200 || typeof out !== 'string' || !out.trim()) return { failed: true };
    return { text: decode(out).trim() };
  }

  async function translate(texts, { source } = {}) {
    validateTexts(texts);
    if (!/^[a-z]{2,3}$/.test(source || '')) throw new HttpError(400, 'Kaynak dil gerekli.');
    if (source === 'tr') return texts;

    const skip = (t) => !t.trim() || Buffer.byteLength(t) > MAX_QUERY_BYTES;
    const key = (t) => `${source}|${t}`;
    const missing = [...new Set(texts.filter((t) => !skip(t) && !cache.has(key(t))))];
    let quota = false;
    let ok = 0;
    let failed = 0;
    let next = 0;
    const worker = async () => {
      while (!quota && next < missing.length) {
        const t = missing[next++];
        if (!reserve(t.length)) { quota = true; return; }
        try {
          const r = await translateOne(t, source);
          if (r.quota) quota = true;
          else if (r.failed) failed++;
          else {
            ok++;
            if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
            cache.set(key(t), r.text);
          }
        } catch {
          failed++;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, worker));

    if (missing.length && !ok && !quota) throw new HttpError(502, 'Ücretsiz çeviri servisine ulaşılamadı.');
    return texts.map((t) => (skip(t) ? t : cache.get(key(t)) ?? null));
  }

  return { translate, model: 'mymemory', provider: 'mymemory' };
}

module.exports = { createFreeTranslator };
