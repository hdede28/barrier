'use strict';

const { findCountry, findTopic, termsFor } = require('../data/meta');

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

function buildSearchQuery({ country, city, topic, keyword }) {
  const parts = [];
  if (city) parts.push(`"${city}"`);
  const terms = topic && topic !== 'general' ? termsFor(topic, country) : [];
  if (terms.length) parts.push(terms.length > 1 ? `(${terms.map(quoteTerm).join(' OR ')})` : quoteTerm(terms[0]));
  if (keyword) parts.push(keyword);
  if (!parts.length) parts.push(quoteTerm(country.nativeName));
  return parts.join(' ');
}

// Aralık kısaysa tek pencere, uzunsa en fazla 12 eşit pencere: her dönemin en ilgili haberleri gelsin.
function planWindows(fromStr, toStr, now = new Date()) {
  const from = parseDate(fromStr);
  const to = parseDate(toStr);
  if (!from || !to) throw new HttpError(400, 'Tarihler YYYY-AA-GG biçiminde olmalı.');
  if (from > to) throw new HttpError(400, 'Başlangıç tarihi bitişten sonra olamaz.');
  if (fmt(from) < MIN_DATE) throw new HttpError(400, `En eski tarih ${MIN_DATE}.`);
  if (to > addDays(now, 1)) throw new HttpError(400, 'Bitiş tarihi gelecekte olamaz.');

  const days = Math.round((to - from) / DAY) + 1;
  const n = days <= SHORT_SPAN_DAYS ? 1 : Math.min(MAX_WINDOWS, Math.ceil(days / 30));
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

function parseSearchParams(params, now = new Date()) {
  const country = findCountry(params.get('country'));
  if (!country) throw new HttpError(400, 'Geçersiz ülke.');
  const topic = params.get('topic') || 'general';
  if (!findTopic(topic)) throw new HttpError(400, 'Geçersiz konu.');
  const city = cleanText(params.get('city'));
  const keyword = cleanText(params.get('q'), 120);
  const windows = planWindows(params.get('from'), params.get('to'), now);
  return { country, topic, city, keyword, windows, query: buildSearchQuery({ country, city, topic, keyword }) };
}

module.exports = { HttpError, parseDate, cleanText, buildSearchQuery, planWindows, dateOperators, parseSearchParams };
