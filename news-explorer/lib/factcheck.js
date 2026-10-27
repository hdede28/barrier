'use strict';

const { HttpError } = require('./query');
const { fetchText, errorText } = require('./providers/common');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Bir başlıkla ilgili doğrulama (fact-check) incelemelerini bulur:
//  1) doğrulama kuruluşlarının RSS önbelleği (anahtarsız),
//  2) FACTCHECK_API_KEY verilmişse Google Fact Check Tools API'si (ücretsiz anahtar).
// Sonuç bir HÜKÜM değildir: bulunamaması haberin doğru olduğu anlamına gelmez, bulunması da başlığın aynı iddiayı kapsadığını garanti etmez.
function createFactChecker({ providers = [], apiKey, baseURL = 'https://factchecktools.googleapis.com', perMinute = 60 } = {}) {
  const feeds = providers.find((p) => p.id === 'factcheck' && p.available);
  const cache = new Map();
  let windowStart = 0;
  let used = 0;

  async function google(query, lang) {
    const url = new URL('/v1alpha1/claims:search', baseURL);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '5');
    if (lang) url.searchParams.set('languageCode', lang);
    url.searchParams.set('key', apiKey);
    const json = JSON.parse(await fetchText(url, { timeout: 6000 }));
    return (json.claims || []).flatMap((c) => (c.claimReview || []).map((r) => ({
      source: r.publisher?.name || r.publisher?.site || 'Doğrulama kuruluşu',
      title: r.title || c.text || '',
      link: r.url,
      rating: r.textualRating || '',
      claimant: c.claimant || '',
      published: r.reviewDate || null,
      via: 'google',
    }))).filter((r) => /^https?:\/\//i.test(r.link)).slice(0, 5);
  }

  async function lookup(query, lang = '') {
    const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (q.length < 8) throw new HttpError(400, 'Doğrulama araması için daha uzun bir başlık gerekli.');
    const key = `${lang}|${q}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
    if (Date.now() - windowStart > 60000) { windowStart = Date.now(); used = 0; }
    if (++used > perMinute) throw new HttpError(429, 'Çok fazla doğrulama araması yapıldı; bir dakika sonra yeniden dene.');

    const notes = [];
    const [local, remote] = await Promise.all([
      feeds?.lookup ? feeds.lookup(q).catch((e) => { notes.push(`RSS: ${errorText(e)}`); return []; }) : [],
      apiKey ? google(q, lang).catch((e) => { notes.push(`Google Fact Check: ${errorText(e)}`); return []; }) : [],
    ]);
    const seen = new Set();
    const results = [...remote, ...local].filter((r) => !seen.has(r.link) && seen.add(r.link)).slice(0, 8);
    const body = { query: q, results, searched: [feeds ? 'Doğrulama kuruluşlarının RSS akışları' : null, apiKey ? 'Google Fact Check API' : null].filter(Boolean), notes };
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    if (!notes.length) cache.set(key, { at: Date.now(), body });
    return body;
  }

  return { lookup, hasApi: Boolean(apiKey), available: Boolean(feeds || apiKey) };
}

module.exports = { createFactChecker };
