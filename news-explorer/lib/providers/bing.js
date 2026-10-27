'use strict';

const { buildSearchQuery } = require('../query');
const { namesFor, quoted } = require('../../data/maarif');
const { parseRss } = require('../rss');
const { fetchText, daysAgo, inRange, langOf } = require('./common');

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
    // Dünya aramasında pazar en-US, terimler İngilizce; ülke seçiliyken ülkenin pazarı.
    const q = ctx.mode === 'maarif'
      ? `(${quoted(namesFor(['en', 'tr', 'ar', 'fr']))})${ctx.keyword ? ` ${ctx.keyword}` : ''}`
      : ctx.world ? buildSearchQuery({ ...ctx, country: { ...country, terms: ['en'] }, generalPerTopic: 1 }) : ctx.query;
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'rss');
    url.searchParams.set('setmkt', ctx.world ? 'en-US' : lang);
    if (!ctx.world) url.searchParams.set('cc', country.code);
    // qft=interval: 4 = son 1 saat, 7 = son 24 saat, 8 = 7 gün, 9 = 30 gün
    const interval = ctx.mode === 'breaking' ? (ctx.hours <= 1 ? 4 : 7) : from >= daysAgo(now, 7) ? 8 : 9;
    url.searchParams.set('qft', `interval="${interval}"`);
    const xml = await fetchText(url, { headers: { accept: 'application/rss+xml, text/xml' } });
    const l = ctx.world ? 'en' : langOf(country.hl);
    return {
      items: parseRss(xml, LIMIT * 2).filter((it) => inRange(it.published, from, to, now)).slice(0, LIMIT).map((it) => ({ ...it, lang: l })),
    };
  },
};
