'use strict';

const { norm } = require('./providers/common');

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'after', 'will', 'over', 'into', 'about', 'has', 'have', 'are', 'was', 'were',
  'not', 'but', 'new', 'says', 'said', 'video', 'live', 'son', 'dakika', 'canli', 'ile', 'icin', 'bir', 'bu', 'olarak', 'daha', 'der', 'die', 'das', 'und', 'les', 'des', 'une', 'pour']);

// Kaba kök: ilk 5 harf ("kararını"/"kararı" -> "karar", "açıkladı"/"açıklandı" -> "acikl"). Ekli dillerde (Türkçe, Rusça) aynı
// haberin farklı çekimlerini eşleştirir.
const stem = (t) => (t.length > 5 ? t.slice(0, 5) : t);
const tokens = (title) => new Set(norm(title).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3 && !STOP.has(t)).map(stem));

// "Aynı haber" mi? Ortak sözcük payı yüksek ve en az 3 ortak sözcük.
function similar(a, b, shared) {
  if (shared < 3) return false;
  const small = Math.min(a.size, b.size);
  const union = a.size + b.size - shared;
  return shared / small >= 0.75 || shared / union >= 0.6;
}

// Benzer başlıklı haberleri tek habere toplar ve kaç BAĞIMSIZ kaynakta yer aldığını sayar: bir haberin birden çok
// kaynakta çıkması, tek bir kaynağa göre doğruluk için daha güçlü bir işarettir (kesin kanıt değil).
// items: yayın tarihine göre değil öncelik sırasına göre verilir; ilk görülen temsilci olur.
function clusterStories(items) {
  const toks = items.map((it) => tokens(it.title));
  const index = new Map(); // sözcük -> küme numaraları
  const clusters = [];
  items.forEach((it, i) => {
    const counts = new Map();
    for (const t of toks[i]) for (const c of index.get(t) || []) counts.set(c, (counts.get(c) || 0) + 1);
    let best = -1;
    let bestShared = 0;
    for (const [c, shared] of counts) {
      if (shared > bestShared && similar(toks[i], clusters[c].tokens, shared)) { best = c; bestShared = shared; }
    }
    if (best < 0) {
      clusters.push({ rep: it, members: [it], tokens: toks[i] });
      best = clusters.length - 1;
    } else {
      clusters[best].members.push(it);
      for (const t of toks[i]) clusters[best].tokens.add(t);
    }
    for (const t of toks[i]) {
      const set = index.get(t) || new Set();
      set.add(best);
      index.set(t, set);
    }
  });

  return clusters.map(({ rep, members }) => {
    const news = new Set(members.filter((m) => m.kind === 'news').map((m) => m.source || m.provider));
    const dates = members.map((m) => m.published).filter(Boolean).sort();
    const others = members.filter((m) => m !== rep);
    return {
      ...rep,
      story: {
        count: Math.max(1, news.size),
        social: members.filter((m) => m.kind === 'social').length,
        first: dates[0] || null,
        last: dates.at(-1) || null,
        also: others.slice(0, 8).map((m) => ({ source: m.source || m.provider, link: m.link })),
      },
    };
  });
}

module.exports = { clusterStories, tokens, similar };
