'use strict';

const { buildSearchQuery } = require('../query');
const { COUNTRIES } = require('../../data/meta');
const { COUNTRY_ALIASES } = require('../../data/feeds');
const { fetchText, errorText, daysAgo, langFromName, langOf } = require('./common');

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
  skip: (ctx, { now }) => (ctx.windows.at(-1).to < daysAgo(now, MAX_AGE_DAYS) ? 'GDELT yalnızca son 3 ayı kapsar' : null),
  async fetch(ctx, { bases, now }) {
    const oldest = daysAgo(now, MAX_AGE_DAYS);
    const from = ctx.windows[0].from < oldest ? oldest : ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    // GDELT 3 karakterden kısa terimleri reddeder; ülke filtresi zaten sourcecountry ile yapılır.
    // Dünya aramasında ülke filtresi yok ve terimler İngilizcedir (GDELT İngilizce sorguyu çevrilmiş metinle eşleştirir; doğrulanmadı).
    const country = ctx.world ? { ...ctx.country, terms: ['en'] } : { ...ctx.country, approximate: false };
    const text = buildSearchQuery({ ...ctx, country, minTermLength: 3, generalPerTopic: 1 });
    const url = new URL('/api/v2/doc/doc', bases.gdelt);
    url.searchParams.set('query', ctx.world ? text : `${text} sourcecountry:${ctx.country.fips}`);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('maxrecords', '250');
    url.searchParams.set('startdatetime', `${from.replaceAll('-', '')}000000`);
    url.searchParams.set('enddatetime', `${to.replaceAll('-', '')}235959`);

    let body;
    try {
      body = (await fetchText(url, { timeout: 20000 })).trim();
    } catch (err) {
      throw new Error(errorText(err));
    }
    if (!body) return { items: [] };
    let json;
    try { json = JSON.parse(body); } catch { throw new Error(body.slice(0, 120)); } // GDELT hataları düz metindir
    return {
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
