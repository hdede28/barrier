'use strict';

const { termsFor, findCountry } = require('../../data/meta');
const { parseFeed } = require('../rss');
const { mentions, namesOf } = require('../relevance');
const { mentionsMaarif } = require('../../data/maarif');
const { fetchText, errorText, daysAgo, inRange, norm, containsTerm, langOf } = require('./common');

// Aynı sunucuya (ör. 9 YouTube akışı) aynı anda en fazla 3 istek: aksi halde 429/404 ile geri çevrilirler.
const PER_HOST = 3;
const hosts = new Map();
async function withHost(url, fn) {
  const host = new URL(url).hostname;
  const h = hosts.get(host) || { active: 0, queue: [] };
  hosts.set(host, h);
  if (h.active >= PER_HOST) await new Promise((r) => h.queue.push(r));
  h.active++;
  try { return await fn(); } finally {
    h.active--;
    h.queue.shift()?.();
  }
}

const FEED_TTL_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 3 * 60 * 60 * 1000; // bundan eski kayıt bayat sayılmaz, beklenerek yenilenir
const FAIL_TTL_MS = 5 * 60 * 1000; // bozuk akış bu süre boyunca yeniden denenmez (her aramada 8 sn kaybettirmesin)
const FEED_LIMIT = 100;
const CONCURRENCY = 12;
const DEADLINE_MS = 14000; // toplam süre: yavaş akışlar sonuçları geciktirmesin
const MAX_AGE_DAYS = 60; // RSS akışları yalnızca son birkaç günü/haftayı taşır

// "Tunis / تونس" -> ['Tunis', 'تونس']
const cityNames = (city) => city.split('/').map((c) => c.trim()).filter(Boolean);

// Akışın dili ve ülkesi: ülkeye özel akışta ülkenin dili, '*' akışlarda İngilizce (feed.lang ile ezilebilir).
const feedCountry = (feed) => (feed.countries.length === 1 && feed.countries[0] !== '*' ? findCountry(feed.countries[0]) : null);
const feedLang = (feed) => feed.lang || (feedCountry(feed) ? langOf(feedCountry(feed).hl) : 'en');

function createMatcher(ctx) {
  const words = ctx.keyword.split(/\s+/).filter((w) => w && !/^(OR|AND)$/i.test(w));
  const cities = ctx.city ? cityNames(ctx.city) : [];
  const aliases = ctx.world ? [] : namesOf(ctx.country);
  const termCache = new Map();
  // Konu terimleri akışın dilinde (ve küresel akışlarda ayrıca İngilizce) aranır.
  const termsOf = (feed) => {
    if (ctx.topic === 'general') return [];
    if (!termCache.has(feed)) {
      const langs = [...new Set([feedLang(feed), ...(feed.countries.includes('*') || ctx.world ? ['en'] : [])])];
      termCache.set(feed, termsFor(ctx.topic, { terms: langs }));
    }
    return termCache.get(feed);
  };
  return (it, feed) => {
    if (ctx.mode === 'maarif') return mentionsMaarif(`${it.title} ${it.summary}`) && words.every((w) => norm(`${it.title} ${it.summary}`).includes(norm(w)));
    const text = norm(`${it.title} ${it.summary}`);
    if (!ctx.world) {
      const cityHit = cities.some((c) => containsTerm(text, c));
      if (ctx.city && !cityHit) return false;
      // Ülkeye özel olmayan ('*') akışlarda ülke adı BAŞLIKTA geçmeli (özet metnindeki anma ilgisizdir: "Washington" vb.).
      if (feed.countries.includes('*') && !cityHit && !aliases.some((a) => mentions(it.title, norm(it.title), a))) return false;
    }
    if (ctx.topic !== 'general' && !feed.topics?.includes(ctx.topic)) {
      const terms = termsOf(feed);
      // Sözlüğü olmayan dildeki akışta konuya göre karar verilemez: konu seçiliyken atlanır.
      if (!terms.length || !terms.some((t) => containsTerm(text, t))) return false;
    }
    return words.every((w) => text.includes(norm(w)));
  };
}

// kind: 'news' (yayıncı akışları) ya da 'social' (herkese açık sosyal medya hesapları).
function createFeedProvider({ kind, feeds, ttl = FEED_TTL_MS }) {
  const mine = feeds.filter((f) => f.kind === kind);
  const cache = new Map(); // url -> { at, items }
  const failures = new Map(); // url -> { at, message }
  const inflight = new Map(); // url -> Promise (aynı akış için tek istek)

  function refresh(feed) {
    if (inflight.has(feed.url)) return inflight.get(feed.url);
    const run = (async () => {
      try {
        const items = parseFeed(await withHost(feed.url, () => fetchText(feed.url, { timeout: 8000 })), FEED_LIMIT, feed.url);
        cache.set(feed.url, { at: Date.now(), items });
        failures.delete(feed.url);
        return items;
      } catch (err) {
        failures.set(feed.url, { at: Date.now(), message: errorText(err) });
        throw err;
      } finally {
        inflight.delete(feed.url);
      }
    })();
    inflight.set(feed.url, run);
    return run;
  }

  // Bayat-ama-kullanılabilir önbellek: kayıt varsa (bayat olsa bile) anında döner, bayatsa arkada yenilenir.
  async function load(feed) {
    const hit = cache.get(feed.url);
    if (hit && Date.now() - hit.at < MAX_STALE_MS) {
      if (Date.now() - hit.at >= ttl) refresh(feed).catch(() => {});
      return hit.items;
    }
    const bad = failures.get(feed.url);
    if (bad && Date.now() - bad.at < FAIL_TTL_MS) throw new Error(bad.message);
    return refresh(feed);
  }

  return {
    id: kind === 'news' ? 'feeds' : 'social',
    label: kind === 'news' ? 'Yayıncı akışları' : 'Sosyal medya hesapları',
    kind,
    available: mine.length > 0,
    deadline: 16000,
    // Sunucu açılırken akışları arka planda ısıtır: ilk aramalar bellekten anında yanıt alır.
    async warm(concurrency = 4) {
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(concurrency, mine.length) }, async () => {
        while (next < mine.length) await load(mine[next++]).catch(() => {});
      }));
    },
    skip(ctx, { now }) {
      if (ctx.mode === 'breaking' && kind === 'social') return 'Son dakika modunda kullanılmaz';
      if (!ctx.world && !mine.some((f) => f.countries.includes('*') || f.countries.includes(ctx.country.code))) return 'Bu ülke için tanımlı akış yok';
      return ctx.windows.at(-1).to < daysAgo(now, MAX_AGE_DAYS) ? 'Akışlar yalnızca güncel haberleri kapsar' : null;
    },
    async fetch(ctx, { now }) {
      const forCountry = ctx.world ? mine : mine.filter((f) => f.countries.includes('*') || f.countries.includes(ctx.country.code));
      // Konuya özel akışlar yalnızca o konuda (ya da "Genel"de) kullanılır.
      const applicable = forCountry.filter((f) => ctx.mode === 'maarif' || !f.topics || ctx.topic === 'general' || f.topics.includes(ctx.topic));
      if (!applicable.length) return { items: [], note: 'Bu konu için tanımlı akış yok' };
      const startedAt = Date.now();
      const from = ctx.windows[0].from;
      const to = ctx.windows.at(-1).to;
      const match = createMatcher(ctx);
      const results = new Array(applicable.length);
      let next = 0;
      const worker = async () => {
        while (next < applicable.length) {
          const i = next++;
          const feed = applicable[i];
          if (Date.now() - startedAt > DEADLINE_MS) { results[i] = { items: [], error: 'zaman sınırı' }; continue; }
          try {
            const items = (await load(feed))
              .filter((it) => inRange(it.published, from, to, now) && match(it, feed))
              .map(({ summary, ...it }) => ({
                ...it, source: feed.name, sourceUrl: new URL(feed.url).origin,
                lang: feedLang(feed), country: feedCountry(feed)?.code || '', place: feedCountry(feed)?.name || '',
                ...(ctx.topic !== 'general' && feed.topics?.includes(ctx.topic) && { topicTrusted: true }),
              }));
            results[i] = { items };
          } catch (err) {
            results[i] = { items: [], error: errorText(err) };
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, applicable.length) }, worker));
      const failed = results.map((r, i) => (r.error ? applicable[i].name : null)).filter(Boolean);
      if (failed.length === results.length) throw new Error(`hiçbir akış alınamadı (${results[0].error})`);
      return {
        items: results.flatMap((r) => r.items),
        note: failed.length ? `${applicable.length} akıştan ${failed.length} tanesi alınamadı: ${failed.slice(0, 6).join(', ')}${failed.length > 6 ? '…' : ''}` : null,
      };
    },
  };
}

module.exports = { createFeedProvider };
