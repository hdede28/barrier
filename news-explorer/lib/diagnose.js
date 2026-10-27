'use strict';

const { parseSearchParams } = require('./query');
const { selectProviders, DEFAULT_BASES } = require('./providers');
const { parseFeed } = require('./rss');
const { fetchText, errorText } = require('./providers/common');

const TTL_MS = 60 * 1000;
let last = { key: '', at: 0, body: null };

const ms = (t) => `${((Date.now() - t) / 1000).toFixed(1)} sn`;

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

// Her kaynağı sabit bir sorguyla (Türkiye, Eğitim, son 7 gün) ayrı ayrı dener ve ne olduğunu raporlar.
// Canlı ortamda hangi kaynağın neden çalışmadığını görmek içindir.
async function diagnose({ providers, feeds, bases, now = new Date(), withFeeds = false, version = '' }) {
  const key = `${withFeeds}`;
  if (last.key === key && Date.now() - last.at < TTL_MS) return { ...last.body, cached: true };

  const day = (n) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
  const ctx = parseSearchParams(new URLSearchParams({ country: 'TR', topic: 'education', from: day(6), to: day(0) }), now);
  const deps = { bases: { ...DEFAULT_BASES, ...bases }, now };

  const sources = await Promise.all(selectProviders(providers, []).map(async (p) => {
    const t = Date.now();
    const skipped = p.skip(ctx, deps);
    if (skipped) return { id: p.id, label: p.label, status: 'atlandı', detail: skipped, took: ms(t) };
    try {
      const r = await p.fetch(ctx, deps);
      return { id: p.id, label: p.label, status: 'tamam', count: r.items.length, detail: r.note || '', request: r.debug?.url, took: ms(t) };
    } catch (err) {
      return { id: p.id, label: p.label, status: 'HATA', detail: errorText(err), request: err.debug?.url, took: ms(t) };
    }
  }));

  let feedResults = null;
  if (withFeeds) {
    feedResults = await pool(feeds, 12, async (f) => {
      const t = Date.now();
      try {
        const text = await fetchText(f.url, { timeout: 8000 });
        const items = parseFeed(text, 100);
        // Boş çıkan akışta ilk karakterler (HTML hata sayfası mı, farklı biçim mi?) nedeni gösterir.
        return { name: f.name, kind: f.kind, url: f.url, status: items.length ? 'tamam' : 'boş', count: items.length, took: ms(t),
          ...(items.length ? {} : { sample: text.replace(/\s+/g, ' ').slice(0, 160) }) };
      } catch (err) {
        return { name: f.name, kind: f.kind, url: f.url, status: 'HATA', detail: errorText(err), took: ms(t) };
      }
    });
    feedResults.sort((a, b) => (a.status === 'tamam') - (b.status === 'tamam'));
  }

  const body = { version, at: now.toISOString(), query: 'Türkiye · Eğitim · son 7 gün', sources, feeds: feedResults };
  last = { key, at: Date.now(), body };
  return body;
}

function formatText(d) {
  const lines = [`Haber Atlası tanı raporu${d.version ? ` · sürüm ${d.version}` : ''}`, `${d.at} · ${d.query}`, ''];
  for (const s of d.sources) {
    lines.push(`${s.status === 'tamam' ? '✓' : s.status === 'atlandı' ? '–' : '✗'} ${s.label}: ${s.status}${s.count !== undefined ? ` · ${s.count} haber` : ''} · ${s.took}`);
    if (s.detail) lines.push(`    ${s.detail}`);
    if (s.request) lines.push(`    istek: ${s.request}`);
  }
  if (d.feeds) {
    const bad = d.feeds.filter((f) => f.status !== 'tamam');
    lines.push('', `Akışlar: ${d.feeds.length - bad.length}/${d.feeds.length} çalışıyor`);
    for (const f of bad) lines.push(`✗ ${f.name} (${f.kind}): ${f.status}${f.detail ? ` · ${f.detail}` : ''}\n    ${f.url}${f.sample ? `\n    içerik: ${f.sample}` : ''}`);
  } else {
    lines.push('', 'Tek tek akışları da denemek için adrese ?feeds=1 ekle.');
  }
  return lines.join('\n');
}

module.exports = { diagnose, formatText };
