'use strict';

const { buildSearchQuery } = require('../query');
const { COMPACT, quoted } = require('../../data/maarif');
const { COUNTRIES } = require('../../data/meta');
const { COUNTRY_ALIASES } = require('../../data/feeds');
const { fetchText, errorText, daysAgo, langFromName, langOf, sleep } = require('./common');

// GDELT istekleri arasında en az 5 sn bırakılması ister ve sunucu adresi başına sınır uygular. Tüm aramalar tek sıradan geçer,
// aynı sorgu 20 dakika önbellekten gelir; 429 gelirse bekleyip yeniden denenir.
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();
let gate = Promise.resolve();
let lastAt = 0;

function queued(task, gap) {
  const run = gate.then(async () => {
    const wait = lastAt + gap - Date.now();
    if (wait > 0) await sleep(wait);
    try { return await task(); } finally { lastAt = Date.now(); }
  });
  gate = run.catch(() => {});
  return run;
}

async function request(url, timing) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  let body;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      body = (await queued(() => fetchText(url, { timeout: 20000 }), timing.gdeltGap)).trim();
    } catch (err) {
      if (err.status !== 429) throw new Error(errorText(err));
      if (attempt === 2) throw new Error('GDELT bu sunucuyu geçici olarak sınırladı (429). Birkaç dakika sonra yeniden dene.');
      await sleep(Math.min(Math.max(err.retryAfter * 1000, timing.retryWait), 15000));
      continue;
    }
    if (/limit requests/i.test(body) && attempt < 2) { await sleep(timing.retryWait); continue; }
    break;
  }
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  if (body && !/limit requests/i.test(body)) cache.set(url, { at: Date.now(), body });
  return body;
}


const MAX_AGE_DAYS = 89; // DOC API yalnızca son ~3 ayı tarar
const LIMIT = 150;

// "20260102T130500Z" -> ISO
function seen(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z` : null;
}

// GDELT sourcecountry İngilizce ülke adı verir ("Turkey"): bizim ülkelerimizden biriyse kodu ve Türkçe adı döner.
function placeOf(name) {
  const c = COUNTRIES.find((x) => (COUNTRY_ALIASES[x.code] || []).some((a) => a.toLowerCase() === (name || '').toLowerCase()));
  return c ? { country: c.code, place: c.name } : { country: '', place: name || '' };
}

// Çok dilli, ülke bazlı (yayıncının ülkesi) geniş tarama; Google sürümü olmayan ülkelerde özellikle işe yarar.
module.exports = {
  id: 'gdelt',
  label: 'GDELT',
  kind: 'news',
  skip: (ctx, { now }) => {
    if (ctx.mode === 'breaking') return 'Son dakika modunda kullanılmaz (hız sınırı)';
    return ctx.windows.at(-1).to < daysAgo(now, MAX_AGE_DAYS) ? 'GDELT yalnızca son 3 ayı kapsar' : null;
  },
  async fetch(ctx, { bases, now, timing = { gdeltGap: 5500, retryWait: 6000 } }) {
    const oldest = daysAgo(now, MAX_AGE_DAYS);
    const from = ctx.windows[0].from < oldest ? oldest : ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    // GDELT 3 karakterden kısa terimleri reddeder; ülke filtresi zaten sourcecountry ile yapılır.
    // Dünya aramasında ülke filtresi yok ve terimler İngilizcedir (GDELT İngilizce sorguyu çevrilmiş metinle eşleştirir; doğrulanmadı).
    const country = ctx.world ? { ...ctx.country, terms: ['en'] } : { ...ctx.country, approximate: false };
    const text = ctx.mode === 'maarif'
      ? `(${quoted(COMPACT)})${ctx.keyword ? ` ${ctx.keyword}` : ''}`
      : buildSearchQuery({ ...ctx, country, minTermLength: 3, generalPerTopic: 1 });
    const url = new URL('/api/v2/doc/doc', bases.gdelt);
    url.searchParams.set('query', ctx.world ? text : `${text} sourcecountry:${ctx.country.fips}`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('maxrecords', '250');
    url.searchParams.set('startdatetime', `${from.replaceAll('-', '')}000000`);
    url.searchParams.set('enddatetime', `${to.replaceAll('-', '')}235959`);

    const body = await request(url.toString(), timing);
    if (!body) return { items: [], debug: { url: url.toString() } };
    let json;
    try { json = JSON.parse(body); } catch { throw Object.assign(new Error(body.slice(0, 160)), { debug: { url: url.toString() } }); } // GDELT hataları düz metindir
    return {
      debug: { url: url.toString() },
      items: (json.articles || []).slice(0, LIMIT).filter((a) => /^https?:\/\//i.test(a.url) && a.title).map((a) => ({
        title: a.title.trim(),
        link: a.url,
        source: a.domain || '',
        sourceUrl: a.domain ? `https://${a.domain}` : '',
        published: seen(a.seendate),
        lang: a.language ? langFromName(a.language) : langOf(ctx.country.hl),
        ...placeOf(a.sourcecountry),
      })),
    };
  },
};
