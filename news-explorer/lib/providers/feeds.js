'use strict';

const { termsFor } = require('../../data/meta');
const { COUNTRY_ALIASES } = require('../../data/feeds');
const { parseFeed } = require('../rss');
const { fetchText, errorText, daysAgo, inRange, norm, containsTerm } = require('./common');

const FEED_TTL_MS = 5 * 60 * 1000;
const FEED_LIMIT = 100;
const CONCURRENCY = 6;
const MAX_AGE_DAYS = 60; // RSS akışları yalnızca son birkaç günü/haftayı taşır

// "Tunis / تونس" -> ['Tunis', 'تونس']
const cityNames = (city) => city.split('/').map((c) => c.trim()).filter(Boolean);

function createMatcher(ctx) {
  const own = ctx.topic !== 'general' ? termsFor(ctx.topic, ctx.country) : [];
  // Küresel akışlar çoğunlukla İngilizcedir: ülkenin diline ek olarak İngilizce terimler de aranır.
  const global = ctx.topic !== 'general' ? [...new Set([...own, ...termsFor(ctx.topic, { terms: ['en'] })])] : [];
  const words = ctx.keyword.split(/\s+/).filter((w) => w && !/^(OR|AND)$/i.test(w));
  const cities = ctx.city ? cityNames(ctx.city) : [];
  const aliases = COUNTRY_ALIASES[ctx.country.code] || [];
  return (it, feed) => {
    const text = norm(`${it.title} ${it.summary}`);
    const cityHit = cities.some((c) => containsTerm(text, c));
    if (ctx.city && !cityHit) return false;
    const isGlobal = feed.countries.includes('*');
    // Ülkeye özel olmayan ('*') akışlarda haber, şehir ya da ülke adı geçerek ülkeyle ilgisini göstermeli.
    if (isGlobal && !cityHit && !aliases.some((a) => containsTerm(text, a))) return false;
    const terms = isGlobal ? global : own;
    if (terms.length && !terms.some((t) => containsTerm(text, t))) return false;
    return words.every((w) => text.includes(norm(w)));
  };
}

// kind: 'news' (yayıncı akışları) ya da 'social' (herkese açık sosyal medya hesapları).
function createFeedProvider({ kind, feeds }) {
  const mine = feeds.filter((f) => f.kind === kind);
  const cache = new Map(); // url -> { at, items }

  async function load(feed) {
    const hit = cache.get(feed.url);
    if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.items;
    const items = parseFeed(await fetchText(feed.url, { timeout: 8000 }), FEED_LIMIT);
    cache.set(feed.url, { at: Date.now(), items });
    return items;
  }

  return {
    id: kind === 'news' ? 'feeds' : 'social',
    label: kind === 'news' ? 'Yayıncı akışları' : 'Sosyal medya hesapları',
    kind,
    available: mine.length > 0,
    skip(ctx, { now }) {
      if (!mine.some((f) => f.countries.includes('*') || f.countries.includes(ctx.country.code))) return 'Bu ülke için tanımlı akış yok';
      return ctx.windows.at(-1).to < daysAgo(now, MAX_AGE_DAYS) ? 'Akışlar yalnızca güncel haberleri kapsar' : null;
    },
    async fetch(ctx, { now }) {
      const applicable = mine.filter((f) => f.countries.includes('*') || f.countries.includes(ctx.country.code));
      const from = ctx.windows[0].from;
      const to = ctx.windows.at(-1).to;
      const match = createMatcher(ctx);
      const results = new Array(applicable.length);
      let next = 0;
      const worker = async () => {
        while (next < applicable.length) {
          const i = next++;
          const feed = applicable[i];
          try {
            const items = (await load(feed))
              .filter((it) => inRange(it.published, from, to, now) && match(it, feed))
              .map(({ summary, ...it }) => ({ ...it, source: feed.name, sourceUrl: new URL(feed.url).origin }));
            results[i] = { items };
          } catch (err) {
            results[i] = { items: [], error: errorText(err) };
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, applicable.length) }, worker));
      const failed = results.filter((r) => r.error);
      if (failed.length === results.length) throw new Error(failed[0].error);
      return {
        items: results.flatMap((r) => r.items),
        note: failed.length ? `${applicable.length} akıştan ${failed.length} tanesi alınamadı` : null,
      };
    },
  };
}

module.exports = { createFeedProvider };
