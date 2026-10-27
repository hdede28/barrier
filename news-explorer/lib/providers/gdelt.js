'use strict';

const { buildSearchQuery } = require('../query');
const { COMPACT, quoted } = require('../../data/maarif');
const { clause } = require('../../data/radar');
const { COUNTRIES } = require('../../data/meta');
const { COUNTRY_ALIASES } = require('../../data/feeds');
const { fetchText, errorText, daysAgo, langFromName, langOf, sleep } = require('./common');

const MAX_AGE_DAYS = 89; // DOC API yalnızca son ~3 ayı tarar
const LIMIT = 150;

// GDELT istekleri arasında en az 5 sn bırakılmasını ister ve sunucu adresi başına sınır uygular. Bu yüzden:
//  - aynı anda tek istek (başkası bekliyorsa hemen "meşgul" denir; kuyrukta beklemek arama süresini aşardı),
//  - aynı sorgu 20 dk önbellekten gelir,
//  - 429 gelirse yalnızca sunucu "birkaç sn sonra" diyorsa (Retry-After <= 3) bir kez daha denenir,
//  - sınırlanınca 2 dk boyunca yeni istek gönderilmez (her yeni istek sınırlamayı uzatır) ve hemen açıklayıcı hata verilir.
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();
const states = new Map(); // sunucu adresi -> { busy, lastAt, blockedUntil }
const state = (url) => {
  const origin = new URL(url).origin;
  if (!states.has(origin)) states.set(origin, { busy: false, lastAt: 0, blockedUntil: 0 });
  return states.get(origin);
};

async function request(url, timing) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  const st = state(url);
  if (st.blockedUntil > Date.now()) {
    throw new Error(`GDELT bu sunucuyu geçici olarak sınırladı (429); ${Math.ceil((st.blockedUntil - Date.now()) / 1000)} sn sonra yeniden denenebilir.`);
  }
  if (st.busy) throw new Error('GDELT şu an başka bir aramaya yanıt veriyor (hız sınırı); birkaç saniye sonra yeniden dene.');
  st.busy = true;
  try {
    let body = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const wait = st.lastAt + timing.gdeltGap - Date.now();
      if (wait > 0) await sleep(wait);
      let retryAfter = -1;
      try {
        body = (await fetchText(url, { timeout: 10000 })).trim();
        if (!/limit requests/i.test(body)) break;
        retryAfter = 5; // düz metin hız sınırı uyarısı: "5 saniyede bir istek"
      } catch (err) {
        if (err.status !== 429) throw new Error(errorText(err));
        retryAfter = err.retryAfter;
      } finally {
        st.lastAt = Date.now();
      }
      // Kısa bir bekleme isteyen sınır için yeniden dene; aksi halde pes edip bir süre sus.
      if (attempt < 2 && retryAfter >= 0 && retryAfter <= 3) { await sleep(Math.max(retryAfter * 1000, timing.retryWait)); continue; }
      st.blockedUntil = Date.now() + timing.blockMs;
      throw new Error('GDELT bu sunucuyu geçici olarak sınırladı (429). Birkaç dakika sonra yeniden dene.');
    }
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    if (body) cache.set(url, { at: Date.now(), body });
    return body;
  } finally {
    st.busy = false;
  }
}

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
  deadline: 12000,
  // Varsayılan kapalı: canlıda yavaş (~19 sn) ve sık sık hız sınırına takılıyor; Google sürümü olmayan ülkelerde elle açılır.
  defaultOn: false,
  label: 'GDELT',
  kind: 'news',
  skip: (ctx, { now }) => {
    if (ctx.mode === 'breaking') return 'Son dakika modunda kullanılmaz (hız sınırı)';
    return ctx.windows.at(-1).to < daysAgo(now, MAX_AGE_DAYS) ? 'GDELT yalnızca son 3 ayı kapsar' : null;
  },
  async fetch(ctx, { bases, now, timing = {} }) {
    const oldest = daysAgo(now, MAX_AGE_DAYS);
    const from = ctx.windows[0].from < oldest ? oldest : ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    // GDELT 3 karakterden kısa terimleri reddeder; ülke filtresi zaten sourcecountry ile yapılır.
    // GDELT haberleri İngilizce çevirisi üzerinden arıyor gibi görünüyor (Türkçe terimler canlıda 0 sonuç verdi): konu terimleri hep
    // İngilizce, şehir adları aksansız ("İstanbul" -> "Istanbul"). Ülke filtresi sourcecountry ile yapılır (dünya aramasında yok).
    const country = { ...ctx.country, approximate: false, terms: ['en'] };
    const latin = (c) => c.split('/').map((n) => n.trim()).flatMap((n) => { const f = n.normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/İ/g, 'I'); return f === n ? [n] : [n, f]; }).join(' / ');
    const text = ctx.mode === 'maarif'
      ? `(${quoted(COMPACT)})${ctx.keyword ? ` ${ctx.keyword}` : ''}`
      : ctx.mode === 'radar'
        ? buildSearchQuery({ country, city: '', topic: 'education', keyword: [clause(ctx.themes, 'en'), ctx.keyword].filter(Boolean).join(' '), minTermLength: 3 })
        : buildSearchQuery({ ...ctx, country, city: ctx.city ? latin(ctx.city) : '', minTermLength: 3, generalPerTopic: 1 });
    const url = new URL('/api/v2/doc/doc', bases.gdelt);
    url.searchParams.set('query', ctx.world ? text : `${text} sourcecountry:${ctx.country.fips}`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('maxrecords', '250');
    url.searchParams.set('startdatetime', `${from.replaceAll('-', '')}000000`);
    url.searchParams.set('enddatetime', `${to.replaceAll('-', '')}235959`);

    const body = await request(url.toString(), { gdeltGap: 5500, retryWait: 3000, blockMs: 120000, ...timing });
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
