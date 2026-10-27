'use strict';

const { findCountry, findTopic, termsFor, generalTerms, WORLD, WORLD_EDITION_CODES } = require('../data/meta');

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

function parseSearchParams(params, now = new Date()) {
  const world = params.get('country') === WORLD.code;
  const country = world ? { ...WORLD, hl: 'en', terms: ['en'], cities: [], world: true } : findCountry(params.get('country'));
  if (!country) throw new HttpError(400, 'Geçersiz ülke.');
  const topic = params.get('topic') || 'general';
  if (!findTopic(topic)) throw new HttpError(400, 'Geçersiz konu.');
  const city = world ? '' : cleanText(params.get('city'));
  const keyword = cleanText(params.get('q'), 120);
  if (world && topic === 'general' && !keyword) {
    throw new HttpError(400, 'Dünya geneli aramada bir konu seç ya da anahtar kelime / isim yaz.');
  }
  const windows = planWindows(params.get('from'), params.get('to'), now, world ? WORLD_MAX_WINDOWS : MAX_WINDOWS);
  const sources = (params.get('sources') || '').split(',').map((x) => x.trim()).filter(Boolean);
  // strict (varsayılan açık): başka ülkeleri konu alan başlıklar gizlenir. Dünya aramasında anlamsız.
  const strict = !world && params.get('strict') !== '0';
  const ctx = { country, topic, city, keyword, windows, sources, world, strict };
  ctx.query = world ? (keyword || '') : buildSearchQuery(ctx);
  return ctx;
}

module.exports = { HttpError, orClause, WORLD_EDITION_CODES, cityClause, parseDate, cleanText, buildSearchQuery, planWindows, dateOperators, parseSearchParams };
