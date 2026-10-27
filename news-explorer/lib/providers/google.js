'use strict';

const { dateOperators, buildSearchQuery } = require('../query');
const { findCountry, WORLD_EDITION_CODES } = require('../../data/meta');
const { parseRss } = require('../rss');
const { fetchText, errorText, langOf } = require('./common');

const CONCURRENCY = 6;
const PER_WINDOW_SINGLE = 100;
const PER_WINDOW_MULTI = 25;
const PER_EDITION_WORLD = 30;

async function fetchWindow(base, edition, query, win, limit) {
  const url = new URL('/rss/search', base);
  url.searchParams.set('q', `${query} ${dateOperators(win)}`);
  url.searchParams.set('hl', edition.hl);
  url.searchParams.set('gl', edition.gl || edition.code);
  url.searchParams.set('ceid', edition.ceid);
  return parseRss(await fetchText(url, { headers: { accept: 'application/rss+xml, text/xml' } }), limit);
}

// Tarih aralığını pencerelere bölerek her dönemin öne çıkan haberlerini getirir (geçmiş haberler için en güçlü kaynak).
// Dünya aramasında 10 yayın sürümü (ABD, Almanya, Türkiye, Japonya…) her biri kendi dilindeki terimlerle ayrı sorgulanır.
module.exports = {
  id: 'google',
  label: 'Google Haberler',
  kind: 'news',
  skip: () => null,
  async fetch(ctx, { bases }) {
    const editions = ctx.world ? WORLD_EDITION_CODES.map(findCountry) : [ctx.country];
    const limit = ctx.world ? PER_EDITION_WORLD : ctx.windows.length === 1 ? PER_WINDOW_SINGLE : PER_WINDOW_MULTI;
    const jobs = editions.flatMap((edition) => ctx.windows.map((win, w) => ({
      edition, win, w, query: ctx.world ? buildSearchQuery({ country: edition, city: '', topic: ctx.topic, keyword: ctx.keyword }) : ctx.query,
    })));
    const results = new Array(jobs.length);
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const i = next++;
        const { edition, win, query } = jobs[i];
        try {
          results[i] = { items: await fetchWindow(bases.google, edition, query, win, limit) };
        } catch (err) {
          results[i] = { items: [], error: errorText(err) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    if (results.every((r) => r.error)) throw new Error(results[0].error);

    const items = results.flatMap((r, i) => r.items.map((it) => ({
      ...it, window: jobs[i].w, country: jobs[i].edition.code, place: jobs[i].edition.name, lang: langOf(jobs[i].edition.hl),
    })));
    // Bir pencerede hata vardır = o pencereyi sorgulayan tüm sürümler başarısız olmuştur
    const windowErrors = ctx.windows.map((_, w) => {
      const mine = results.filter((_r, i) => jobs[i].w === w);
      return mine.every((r) => r.error) ? mine[0].error : null;
    });
    return { items, windowErrors };
  },
};
