'use strict';

const { parseRss } = require('../rss');
const { fetchText, daysAgo, inRange } = require('./common');

const LIMIT = 100;

// Bing Haberler RSS: yalnızca son 30 gün. qft=interval: 8 = 7 gün, 9 = 30 gün.
module.exports = {
  id: 'bing',
  label: 'Bing Haberler',
  kind: 'news',
  skip: (ctx, { now }) => (ctx.windows.at(-1).to < daysAgo(now, 30) ? 'Bing yalnızca son 30 günü kapsar' : null),
  async fetch(ctx, { bases, now }) {
    const from = ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    const { country } = ctx;
    const lang = country.hl.includes('-') ? country.hl : `${country.hl}-${country.code}`;
    const url = new URL('/news/search', bases.bing);
    url.searchParams.set('q', ctx.query);
    url.searchParams.set('format', 'rss');
    url.searchParams.set('setmkt', lang);
    url.searchParams.set('cc', country.code);
    url.searchParams.set('qft', `interval="${from >= daysAgo(now, 7) ? 8 : 9}"`);
    const xml = await fetchText(url, { headers: { accept: 'application/rss+xml, text/xml' } });
    return { items: parseRss(xml, LIMIT * 2).filter((it) => inRange(it.published, from, to, now)).slice(0, LIMIT) };
  },
};
