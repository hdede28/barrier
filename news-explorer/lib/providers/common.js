'use strict';

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (now, n) => iso(new Date(now.getTime() - n * DAY));

async function fetchText(url, { timeout = 10000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; HaberAtlasi/1.0)', ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    // status ve Retry-After, çağıranın yeniden deneme kararı için (ör. 429)
    const ra = res.headers.get('retry-after');
    throw Object.assign(new Error(`Kaynak ${res.status} döndürdü`), { status: res.status, retryAfter: ra === null ? -1 : Number(ra) || 0 }); // -1: başlık yok
  }
  return res.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errorText = (err) => (err.name === 'TimeoutError' ? 'Zaman aşımı' : err.message);

// Yayın tarihi [from, to] (gün, dahil) aralığında mı? Tarihsiz kayıt yalnızca bugünü kapsayan aralıkta kabul edilir.
function inRange(published, from, to, now) {
  const day = published ? published.slice(0, 10) : iso(now);
  return day >= from && day <= to;
}

// Karşılaştırma için: küçük harf, aksan ve nokta farkları atılır ("İstanbul" = "Istanbul", "Köln" = "Koln").
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i');
// Kısa metinler (terimler, ülke/şehir adları) tekrar tekrar normalleştirilir: sonucu bellekte tutulur.
const foldCache = new Map();
const norm = (s) => {
  if (s.length > 40) return fold(s);
  let v = foldCache.get(s);
  if (v === undefined) { v = fold(s); if (foldCache.size < 20000) foldCache.set(s, v); }
  return v;
};
const BOUNDARY = '[^\\p{L}\\p{N}]';

// Terim eşleştiriciler bir kez derlenir. Kısa terimler ("AI", "IA") başka sözcüklerin içinde eşleşmesin diye sözcük sınırıyla aranır.
const termCache = new Map();
function termMatcher(term) {
  let m = termCache.get(term);
  if (!m) {
    const t = norm(term);
    if (t.length > 3) m = (text) => text.includes(t);
    else {
      const re = new RegExp(`(^|${BOUNDARY})${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|${BOUNDARY})`, 'u');
      m = (text) => re.test(text);
    }
    termCache.set(term, m);
  }
  return m;
}
const containsTerm = (text, term) => termMatcher(term)(text);

// Bir işlem zaman sınırını aşarsa reddeder (yavaş bir kaynak tüm aramayı bekletmesin).
function withDeadline(promise, ms) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`zaman sınırı aşıldı (${Math.round(ms / 1000)} sn)`), { name: 'DeadlineError' })), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

const langOf = (hl) => (hl || 'en').split('-')[0];

// GDELT dil adı -> ISO kodu (çeviri kaynağı için)
const LANG_CODES = {
  turkish: 'tr', english: 'en', german: 'de', french: 'fr', spanish: 'es', italian: 'it', portuguese: 'pt', russian: 'ru', arabic: 'ar',
  japanese: 'ja', greek: 'el', persian: 'fa', farsi: 'fa', albanian: 'sq', macedonian: 'mk', serbian: 'sr', malay: 'ms', dutch: 'nl',
  chinese: 'zh', korean: 'ko', hindi: 'hi', ukrainian: 'uk', polish: 'pl', romanian: 'ro', bulgarian: 'bg', croatian: 'hr', bosnian: 'bs',
};
const langFromName = (name) => LANG_CODES[(name || '').toLowerCase()] || 'en';

module.exports = { withDeadline, sleep, langOf, langFromName, DAY, iso, daysAgo, fetchText, errorText, inRange, norm, containsTerm };
