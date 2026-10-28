'use strict';

const { termsFor } = require('../../data/meta');
const { SUBREDDITS } = require('../../data/feeds');
const { namesFor, quoted } = require('../../data/maarif');
const { parseFeed } = require('../rss');
const { fetchText, errorText, daysAgo, inRange, langOf } = require('./common');

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();
async function cachedText(url, opts) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.text;
  const text = await fetchText(url, opts);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(url, { at: Date.now(), text });
  return text;
}

// Aranacak kelimeler: seçili konunun terimleri (ülke dili + İngilizce), şehir ve anahtar kelime.
function searchTerms(ctx) {
  const langs = ctx.world ? ['en'] : [...new Set([...ctx.country.terms, 'en'])];
  const topic = ctx.topic !== 'general' ? termsFor(ctx.topic, { terms: langs }) : [];
  const city = ctx.city ? ctx.city.split('/').map((c) => c.trim()).filter(Boolean) : [];
  const words = ctx.keyword.split(/\s+/).filter((w) => w && !/^(OR|AND)$/i.test(w));
  return { topic, city, words };
}

// "yapay zeka" -> "yapayzeka": Mastodon etiketleri boşluksuz, harf ve rakamdan oluşur.
const toTag = (t) => t.normalize('NFC').replace(/[^\p{L}\p{N}_]+/gu, '');

const HOUR = 3600 * 1000;

// ---- Mastodon: herkese açık etiket (hashtag) akışları, anahtarsız RSS ------------------------------------------------
const mastodon = {
  id: 'mastodon',
  deadline: 12000,
  label: 'Mastodon',
  kind: 'social',
  available: true,
  skip(ctx, { now }) {
    if (ctx.mode === 'breaking') return 'Son dakika modunda kullanılmaz';
    if (ctx.mode === 'balkan') return 'Balkanlar bölümünde kullanılmaz';
    if (ctx.windows.at(-1).to < daysAgo(now, 30)) return 'Mastodon yalnızca güncel gönderileri kapsar';
    if (ctx.mode === 'maarif' || ctx.mode === 'radar') return null;
    const { topic, city, words } = searchTerms(ctx);
    return topic.length + city.length + words.length ? null : 'Konu, şehir ya da kelime gerekli';
  },
  async fetch(ctx, { bases, now }) {
    const { topic, city, words } = searchTerms(ctx);
    // Konu seçiliyken etiketler konudan (en fazla 4), yoksa şehir ve kelimelerden gelir; şehir/kelime her zaman eklenir.
    // Maarif modunda vakfın bilinen etiketleri.
    const tags = ctx.mode === 'maarif'
      ? ['maarif', 'maariffoundation', 'turkiyemaarifvakfi', 'turkishmaariffoundation', 'maarifvakfi']
      : ctx.mode === 'radar'
        ? ['edtech', 'aied', 'education', 'teachers', 'schoolleadership', 'egitim']
      : [...new Set([...city, ...words, ...topic.slice(0, 4)].map(toTag).map((t) => t.toLowerCase()).filter((t) => t.length >= 3 && t.length <= 30))].slice(0, 6);
    if (!tags.length) return { items: [] };
    const hosts = (bases.mastodon || 'https://mastodon.social,https://journa.host,https://mastodon.world,https://mstdn.social,https://mastodon.online').split(',');
    const jobs = hosts.flatMap((h) => tags.map((tag) => ({ host: h.trim(), tag })));
    const from = ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    const lang = ctx.world ? 'en' : langOf(ctx.country.hl);
    const results = await Promise.all(jobs.map(async ({ host, tag }) => {
      try {
        const items = parseFeed(await cachedText(`${host}/tags/${encodeURIComponent(tag)}.rss`, { timeout: 8000 }), 40);
        return { items: items.filter((it) => inRange(it.published, from, to, now)).map(({ summary, ...it }) => ({ ...it, source: `Mastodon ${new URL(host).hostname}`, sourceUrl: host, lang })) };
      } catch (err) {
        return { items: [], error: errorText(err) };
      }
    }));
    if (results.every((r) => r.error)) throw new Error(results[0].error);
    return { items: results.flatMap((r) => r.items) };
  },
};

// ---- Reddit: herkese açık arama RSS'i (bulut sunucularından engellenebilir) ---------------------------------------------
const reddit = {
  id: 'reddit',
  deadline: 8000,
  label: 'Reddit',
  kind: 'social',
  available: true,
  defaultOn: false, // Reddit bulut sunucularını (429) sistematik olarak engeller; istenirse elle açılır
  skip(ctx) {
    if (ctx.mode === 'breaking' || ctx.mode === 'radar') return 'Bu modda kullanılmaz';
    if (ctx.mode === 'balkan' && ctx.world) return 'Birden çok ülke seçiliyken kullanılmaz (tek ülke seç)';
    const { topic, city, words } = searchTerms(ctx);
    return ctx.mode !== 'maarif' && ctx.world && !topic.length && !city.length && !words.length ? 'Konu ya da kelime gerekli' : null;
  },
  async fetch(ctx, { bases, now }) {
    const { topic, city, words } = searchTerms(ctx);
    const parts = [];
    if (ctx.mode === 'maarif') parts.push(`(${quoted(namesFor(['en', 'tr']))})`);
    else if (topic.length) parts.push(`(${topic.slice(0, 8).map((t) => (/\s/.test(t) ? `"${t}"` : t)).join(' OR ')})`);
    if (city.length) parts.push(city.length > 1 ? `(${city.map((c) => `"${c}"`).join(' OR ')})` : `"${city[0]}"`);
    parts.push(...words);
    const from = ctx.windows[0].from;
    const to = ctx.windows.at(-1).to;
    const age = from >= daysAgo(now, 7) ? 'week' : from >= daysAgo(now, 30) ? 'month' : from >= daysAgo(now, 365) ? 'year' : 'all';
    const sub = ctx.world ? null : SUBREDDITS[ctx.country.code];
    const base = bases.reddit || 'https://www.reddit.com';
    const url = new URL(sub ? `/r/${sub}/${parts.length ? 'search.rss' : 'new.rss'}` : '/search.rss', base);
    if (parts.length) {
      url.searchParams.set('q', parts.join(' '));
      url.searchParams.set('sort', 'new');
      url.searchParams.set('t', age);
      if (sub) url.searchParams.set('restrict_sr', '1');
    }
    const xml = await cachedText(url.toString(), { timeout: 10000, headers: { 'user-agent': 'web:haber-atlasi:1.0 (news search app)' } });
    const lang = ctx.world ? 'en' : langOf(ctx.country.hl);
    return {
      items: parseFeed(xml, 100).filter((it) => inRange(it.published, from, to, now))
        .map(({ summary, ...it }) => ({ ...it, source: sub ? `Reddit r/${sub}` : 'Reddit', sourceUrl: base, lang })),
    };
  },
};

// ---- Hacker News: Algolia'nın resmî, anahtarsız API'si (teknoloji/bilim konuları ve dünya araması) --------------------------
const hn = {
  id: 'hn',
  deadline: 8000,
  label: 'Hacker News',
  kind: 'social',
  available: true,
  skip(ctx) {
    if (ctx.mode === 'breaking' || ctx.mode === 'maarif' || ctx.mode === 'radar' || ctx.mode === 'balkan') return 'Bu modda kullanılmaz';
    const relevant = ctx.world || ['technology', 'science'].includes(ctx.topic) || ctx.keyword;
    return relevant ? null : 'Yalnızca teknoloji/bilim konularında ve kelime aramalarında';
  },
  async fetch(ctx, { bases }) {
    const { city, words } = searchTerms(ctx);
    const english = ctx.topic !== 'general' ? termsFor(ctx.topic, { terms: ['en'] }) : [];
    const q = [...new Set([...(words.length ? [] : english), ...city, ...words])].join(' ');
    const from = Math.floor(Date.parse(`${ctx.windows[0].from}T00:00:00Z`) / 1000);
    const to = Math.floor(Date.parse(`${ctx.windows.at(-1).to}T23:59:59Z`) / 1000);
    const url = new URL('/api/v1/search_by_date', bases.hn || 'https://hn.algolia.com');
    url.searchParams.set('query', q);
    url.searchParams.set('tags', 'story');
    url.searchParams.set('numericFilters', `created_at_i>${from},created_at_i<${to}`);
    url.searchParams.set('hitsPerPage', '60');
    const json = JSON.parse(await fetchText(url, { timeout: 10000 }));
    return {
      items: (json.hits || []).filter((h) => h.title).map((h) => ({
        title: h.title,
        link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: 'Hacker News',
        sourceUrl: 'https://news.ycombinator.com',
        published: h.created_at || null,
        lang: 'en',
      })),
    };
  },
};

module.exports = { mastodon, reddit, hn };
