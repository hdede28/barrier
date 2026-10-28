'use strict';

const { dateOperators, buildSearchQuery, orClause } = require('../query');
const { findCountry, WORLD_EDITION_CODES } = require('../../data/meta');
const { EDITION_CODES: MAARIF_EDITIONS, namesFor, quoted } = require('../../data/maarif');
const { EDITION_CODES: RADAR_EDITIONS, clause } = require('../../data/radar');
const balkan = require('../../data/balkan');
const { parseRss } = require('../rss');
const { fetchText, errorText, langOf } = require('./common');

const CONCURRENCY = 6;
const PER_WINDOW_SINGLE = 100;
const PER_WINDOW_MULTI = 25;
const PER_EDITION_WORLD = 30;

async function fetchJob(base, job, limit) {
  const { edition, query, win, top } = job;
  const url = new URL(top ? '/rss' : '/rss/search', base);
  if (!top) url.searchParams.set('q', win ? `${query} ${dateOperators(win)}` : query);
  url.searchParams.set('hl', edition.hl);
  url.searchParams.set('gl', edition.gl || edition.code);
  url.searchParams.set('ceid', edition.ceid);
  return parseRss(await fetchText(url, { headers: { accept: 'application/rss+xml, text/xml' } }), limit);
}

// Son dakika: Google "when:" operatörü (1h, 6h, 1d).
const whenOp = (hours) => (hours >= 24 ? 'when:1d' : `when:${hours}h`);

// İşleri üretir. Her iş = (yayın sürümü, sorgu, pencere).
function planJobs(ctx) {
  if (ctx.mode === 'maarif') {
    return MAARIF_EDITIONS.map(findCountry).flatMap((edition) => {
      const names = `(${quoted(namesFor(edition.terms))})${ctx.keyword ? ` ${ctx.keyword}` : ''}`;
      return ctx.windows.map((win, w) => ({ edition, query: names, win, w }));
    });
  }
  if (ctx.mode === 'radar') {
    // Eğitim radarı: Türkçe/İngilizce terimlerimiz olan sürümlerde "eğitim" terimleri + seçili temaların terimleri.
    return RADAR_EDITIONS.map(findCountry).flatMap((edition) => {
      const lang = edition.terms[0];
      const themeClause = clause(ctx.themes, lang);
      const query = buildSearchQuery({ country: edition, city: '', topic: 'education', keyword: [themeClause, ctx.keyword].filter(Boolean).join(' ') });
      return ctx.windows.map((win, w) => ({ edition, query, win, w }));
    });
  }
  if (ctx.mode === 'balkan') {
    // Balkanlar: seçilen her ülkenin kendi Google Haberler sürümü, kendi dilindeki terimlerle (tek ülkede ctx.query: şehir dahil)
    const jobs = ctx.region.map(findCountry).flatMap((edition) => {
      const query = ctx.world
        ? buildSearchQuery({ country: edition, city: '', topic: 'general', keyword: [balkan.clause(ctx.themes, balkan.LANG_OF[edition.code] || 'en'), ctx.keyword].filter(Boolean).join(' ') })
        : ctx.query;
      return ctx.windows.map((win, w) => ({ edition, query, win, w }));
    });
    if (ctx.trPress) {
      // Türkiye basınında bölge haberleri: Türkçe ülke adları + seçili başlıkların Türkçe terimleri (şehir seçiliyse şehir de)
      const names = ctx.region.flatMap((c) => (ctx.region.length <= 3 ? balkan.TR_NAMES[c] : balkan.TR_NAMES[c].slice(0, 1)));
      const query = [orClause(ctx.city ? [ctx.city.split('/')[0].trim()] : names), balkan.clause(ctx.themes, 'tr'), ctx.keyword].filter(Boolean).join(' ');
      const edition = findCountry('TR');
      jobs.push(...ctx.windows.map((win, w) => ({ edition, query, win, w, press: true })));
    }
    return jobs;
  }
  const editions = ctx.world ? WORLD_EDITION_CODES.map(findCountry) : [ctx.country];
  const queryFor = (edition) => (ctx.world ? buildSearchQuery({ country: edition, city: '', topic: ctx.topic, keyword: ctx.keyword }) : ctx.query);
  if (ctx.mode === 'breaking') {
    const generic = ctx.topic === 'general' && !ctx.keyword && !ctx.city;
    return editions.flatMap((edition) => [
      { edition, query: `${queryFor(edition)} ${whenOp(ctx.hours)}`, win: null, w: 0 },
      // Konu/şehir/kelime yoksa sürümün "öne çıkan haberleri" de eklenir (en çok haberleştirilenler).
      ...(generic ? [{ edition, top: true, w: 0 }] : []),
    ]);
  }
  return editions.flatMap((edition) => ctx.windows.map((win, w) => ({ edition, query: queryFor(edition), win, w })));
}

// Tarih aralığını pencerelere bölerek her dönemin öne çıkan haberlerini getirir (geçmiş haberler için en güçlü kaynak).
// Dünya aramasında 10 yayın sürümü (ABD, Almanya, Türkiye, Japonya…) her biri kendi dilindeki terimlerle ayrı sorgulanır.
module.exports = {
  id: 'google',
  deadline: 15000,
  label: 'Google Haberler',
  kind: 'news',
  skip: () => null,
  async fetch(ctx, { bases }) {
    const jobs = planJobs(ctx);
    const multi = ctx.world || (ctx.mode !== 'search' && ctx.mode !== 'balkan');
    const limitOf = (job) => (multi || job.press ? PER_EDITION_WORLD : ctx.windows.length === 1 ? PER_WINDOW_SINGLE : PER_WINDOW_MULTI);
    const results = new Array(jobs.length);
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const i = next++;
        try {
          results[i] = { items: await fetchJob(bases.google, jobs[i], limitOf(jobs[i])) };
        } catch (err) {
          results[i] = { items: [], error: errorText(err) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    if (results.every((r) => r.error)) throw new Error(results[0].error);

    const items = results.flatMap((r, i) => r.items.map((it) => ({
      ...it, window: jobs[i].w, country: jobs[i].edition.code, place: jobs[i].press ? 'Türkiye basını' : jobs[i].edition.name, lang: langOf(jobs[i].edition.hl),
      ...(jobs[i].press && { press: true }),
    })));
    // Bir pencerede hata vardır = o pencereyi sorgulayan tüm işler başarısız olmuştur
    const windowErrors = ctx.windows.map((_, w) => {
      const mine = results.filter((_r, i) => jobs[i].w === w);
      return mine.length && mine.every((r) => r.error) ? mine[0].error : null;
    });
    const failed = results.filter((r) => r.error).length;
    return { items, windowErrors, note: failed ? `${jobs.length} sorgudan ${failed} tanesi alınamadı` : null };
  },
};
