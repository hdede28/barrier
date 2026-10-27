'use strict';

const { dateOperators } = require('../query');
const { parseRss } = require('../rss');
const { fetchText, errorText } = require('./common');

const CONCURRENCY = 4;
const PER_WINDOW_SINGLE = 100;
const PER_WINDOW_MULTI = 25;

async function fetchWindow(base, ctx, win, limit) {
  const url = new URL('/rss/search', base);
  url.searchParams.set('q', `${ctx.query} ${dateOperators(win)}`);
  url.searchParams.set('hl', ctx.country.hl);
  url.searchParams.set('gl', ctx.country.gl || ctx.country.code);
  url.searchParams.set('ceid', ctx.country.ceid);
  return parseRss(await fetchText(url, { headers: { accept: 'application/rss+xml, text/xml' } }), limit);
}

// Tarih aralığını pencerelere bölerek her dönemin öne çıkan haberlerini getirir (geçmiş haberler için en güçlü kaynak).
module.exports = {
  id: 'google',
  label: 'Google Haberler',
  kind: 'news',
  skip: () => null,
  async fetch(ctx, { bases }) {
    const limit = ctx.windows.length === 1 ? PER_WINDOW_SINGLE : PER_WINDOW_MULTI;
    const results = new Array(ctx.windows.length);
    let next = 0;
    const worker = async () => {
      while (next < ctx.windows.length) {
        const i = next++;
        try {
          results[i] = { items: await fetchWindow(bases.google, ctx, ctx.windows[i], limit) };
        } catch (err) {
          results[i] = { items: [], error: errorText(err) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ctx.windows.length) }, worker));
    if (results.every((r) => r.error)) throw new Error(results[0].error);
    return {
      items: results.flatMap((r, i) => r.items.map((it) => ({ ...it, window: i }))),
      windowErrors: results.map((r) => r.error || null),
    };
  },
};
