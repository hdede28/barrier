'use strict';

const { findCountry, findTopic, termsFor, generalTerms, WORLD, WORLD_EDITION_CODES } = require('../data/meta');
const { validIds } = require('../data/radar');

const DAY = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_DATE = '2000-01-01';
const MAX_WINDOWS = 12;
const SHORT_SPAN_DAYS = 62;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY);

// Serbest metin alanlarını temizler: kontrol karakterleri, tırnaklar ve tarih operatörleri atılır.
function cleanText(s, max = 80) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f"]/g, ' ')
    .replace(/\b(after|before|when):\S*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const quoteTerm = (t) => (/\s/.test(t) ? `"${t}"` : t);

// "Tunis / تونس" gibi şehirler iki yazımı da arar.
function cityClause(city) {
  const names = city.split('/').map((n) => n.trim()).filter(Boolean);
  return names.length > 1 ? `(${names.map((n) => `"${n}"`).join(' OR ')})` : `"${names[0]}"`;
}

const hasCJK = (t) => /[\u3040-\u30ff\u3400-\u9fff]/.test(t);

const orClause = (terms) => (terms.length > 1 ? `(${terms.map(quoteTerm).join(' OR ')})` : quoteTerm(terms[0]));

// minTermLength: çok kısa terimleri (ör. "AI") reddeden kaynaklar için kısa terimleri eler (CJK hariç).
// generalPerTopic: konu "Genel" iken her konudan kaç terim aransın.
function buildSearchQuery({ country, city, topic, keyword, minTermLength = 0, generalPerTopic = 2 }) {
  const parts = [];
  if (city) parts.push(cityClause(city));
  // Ayrı Google Haberler sürümü olmayan ülkelerde ülke adı sorguya eklenir, sonuçlar dünyaya dağılmasın.
  else if (country.approximate) parts.push(quoteTerm(country.nativeName));
  const keep = (t) => t.length >= minTermLength || hasCJK(t);
  const terms = (topic && topic !== 'general' ? termsFor(topic, country) : []).filter(keep);
  if (terms.length) parts.push(orClause(terms));
  if (keyword) parts.push(keyword);
  // Konu da şehir de anahtar kelime de yoksa ülke adını aramak yerine tüm konulardan genel terimler aranır:
  // ülke adı "o ülkede olan" değil "adı geçen" haberleri (ör. ABD için Afganistan haberlerini) getirirdi.
  if (!parts.length) parts.push(orClause(generalTerms(country, generalPerTopic).filter(keep)));
  return parts.join(' ');
}

// Aralık kısaysa tek pencere, uzunsa en fazla 12 eşit pencere: her dönemin en ilgili haberleri gelsin.
function planWindows(fromStr, toStr, now = new Date(), maxWindows = MAX_WINDOWS) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (!from || !to) throw new HttpError(400, 'Tarihler YYYY-AA-GG biçiminde olmalı.');
  if (from > to) throw new HttpError(400, 'Başlangıç tarihi bitişten sonra olamaz.');
  if (fmt(from) < MIN_DATE) throw new HttpError(400, `En eski tarih ${MIN_DATE}.`);
  if (to > addDays(now, 1)) throw new HttpError(400, 'Bitiş tarihi gelecekte olamaz.');

  const days = Math.round((to - from) / DAY) + 1;
  const n = days <= SHORT_SPAN_DAYS ? 1 : Math.min(maxWindows, Math.ceil(days / 30));
  const size = Math.ceil(days / n);
  const windows = [];
  for (let i = 0; i < n; i++) {
    const start = addDays(from, i * size);
    if (start > to) break;
    const end = new Date(Math.min(addDays(start, size - 1).getTime(), to.getTime()));
    windows.push({ from: fmt(start), to: fmt(end) });
  }
  return windows;
}

// Google News "before:" bitiş gününü dışarıda bıraktığı için bir gün eklenir.
const dateOperators = (w) => `after:${w.from} before:${fmt(addDays(parseDate(w.to), 1))}`;

const WORLD_MAX_WINDOWS = 3; // her yayın sürümü ayrı sorgulandığı için dünya aramasında pencere sayısı sınırlı
const MAARIF_MAX_WINDOWS = 2;
const MODES = ['search', 'breaking', 'maarif', 'radar'];
const BREAKING_HOURS = [1, 3, 6, 24];

// mode: 'search' (arama), 'breaking' (son dakika: son N saat), 'maarif' (Türkiye Maarif Vakfı: tüm dünya, vakfın adları)
function parseSearchParams(params, now = new Date()) {
  const mode = MODES.includes(params.get('mode')) ? params.get('mode') : 'search';
  const maarif = mode === 'maarif';
  const breaking = mode === 'breaking';
  const radar = mode === 'radar'; // eğitim radarı: dünya geneli, konu hep eğitim, isteğe bağlı temalar
  const world = maarif || radar || params.get('country') === WORLD.code;
  const country = world ? { ...WORLD, hl: 'en', terms: ['en'], cities: [], world: true } : findCountry(params.get('country'));
  if (!country) throw new HttpError(400, 'Geçersiz ülke.');
  const topic = maarif ? 'general' : radar ? 'education' : params.get('topic') || 'general';
  if (!findTopic(topic)) throw new HttpError(400, 'Geçersiz konu.');
  const city = world ? '' : cleanText(params.get('city'));
  const keyword = cleanText(params.get('q'), 120);
  let windows;
  let hours = 0;
  if (breaking) {
    // Son dakika: tarih aralığı istemciden alınmaz; son N saat (bugün ve dün günlerini kapsayan tek pencere).
    hours = BREAKING_HOURS.includes(Number(params.get('hours'))) ? Number(params.get('hours')) : 3;
    windows = [{ from: fmt(addDays(now, -1)), to: fmt(now) }];
  } else {
    windows = planWindows(params.get('from'), params.get('to'), now, maarif ? MAARIF_MAX_WINDOWS : world ? WORLD_MAX_WINDOWS : MAX_WINDOWS);
  }
  const themes = radar ? validIds((params.get('themes') || '').split(',').map((x) => x.trim())) : [];
  const sources = (params.get('sources') || '').split(',').map((x) => x.trim()).filter(Boolean);
  // strict (varsayılan açık): başka ülkeleri konu alan başlıklar gizlenir. Dünya aramasında anlamsız.
  const strict = !world && params.get('strict') !== '0';
  // topicStrict (varsayılan açık): seçilen konuyla ilgisiz başlıklar gizlenir.
  const topicStrict = topic !== 'general' && params.get('tstrict') !== '0';
  // cluster: benzer başlıklı haberler tek haberde toplanır, kaç bağımsız kaynakta çıktığı sayılır (son dakika ve Maarif'te hep).
  const cluster = mode !== 'search' || params.get('cluster') === '1';
  const ctx = { mode, country, topic, city, keyword, windows, sources, world, strict, topicStrict, cluster, hours, themes, sinceMs: breaking ? now.getTime() - hours * 3600000 : 0 };
  ctx.query = world ? (keyword || '') : buildSearchQuery(ctx);
  return ctx;
}

module.exports = { HttpError, orClause, WORLD_EDITION_CODES, cityClause, parseDate, cleanText, buildSearchQuery, planWindows, dateOperators, parseSearchParams };
