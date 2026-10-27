'use strict';

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (now, n) => iso(new Date(now.getTime() - n * DAY));

async function fetchText(url, { timeout = 10000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; HaberAtlasi/1.0)', ...headers },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`Kaynak ${res.status} döndürdü`);
  return res.text();
}

const errorText = (err) => (err.name === 'TimeoutError' ? 'Zaman aşımı' : err.message);

// Yayın tarihi [from, to] (gün, dahil) aralığında mı? Tarihsiz kayıt yalnızca bugünü kapsayan aralıkta kabul edilir.
function inRange(published, from, to, now) {
  const day = published ? published.slice(0, 10) : iso(now);
  return day >= from && day <= to;
}

// Karşılaştırma için: küçük harf, aksan ve nokta farkları atılır ("İstanbul" = "Istanbul", "Köln" = "Koln").
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i');
const BOUNDARY = '[^\\p{L}\\p{N}]';

// Kısa terimler ("AI", "IA") başka sözcüklerin içinde eşleşmesin diye sözcük sınırıyla aranır.
function containsTerm(text, term) {
  const t = norm(term);
  if (t.length > 3) return text.includes(t);
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|${BOUNDARY})${esc}($|${BOUNDARY})`, 'u').test(text);
}

const langOf = (hl) => (hl || 'en').split('-')[0];

// GDELT dil adı -> ISO kodu (çeviri kaynağı için)
const LANG_CODES = {
  turkish: 'tr', english: 'en', german: 'de', french: 'fr', spanish: 'es', italian: 'it', portuguese: 'pt', russian: 'ru', arabic: 'ar',
  japanese: 'ja', greek: 'el', persian: 'fa', farsi: 'fa', albanian: 'sq', macedonian: 'mk', serbian: 'sr', malay: 'ms', dutch: 'nl',
  chinese: 'zh', korean: 'ko', hindi: 'hi', ukrainian: 'uk', polish: 'pl', romanian: 'ro', bulgarian: 'bg', croatian: 'hr', bosnian: 'bs',
};
const langFromName = (name) => LANG_CODES[(name || '').toLowerCase()] || 'en';

module.exports = { langOf, langFromName, DAY, iso, daysAgo, fetchText, errorText, inRange, norm, containsTerm };
