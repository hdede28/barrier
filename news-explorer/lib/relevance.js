'use strict';

const { COUNTRIES, TOPICS, TOPIC_TERMS } = require('../data/meta');
const { EXTRA } = require('../data/lexicon');
const { COUNTRY_ALIASES, OTHER_PLACES } = require('../data/feeds');
const { norm, containsTerm } = require('./providers/common');

// Büyük harfli kısa adlar ("US", "UK", "USA") büyük/küçük harf duyarlı aranır: "help us" ABD sayılmasın.
const isAcronym = (a) => a.length <= 3 && a === a.toUpperCase() && /[A-Z]/.test(a);

function mentions(title, folded, alias) {
  if (isAcronym(alias)) return new RegExp(`(^|[^\\p{L}\\p{N}])${alias.replace(/\./g, '\\.')}($|[^\\p{L}\\p{N}])`, 'u').test(title);
  return containsTerm(folded, alias);
}

// Ülkenin adları + şehirleri. Kısa şehir adları ("Bar") sıradan sözcüklerle karışmasın diye 4 harften azsa alınmaz.
const cityNamesOf = (c) => c.cities.flatMap((x) => x.split('/').map((n) => n.trim())).filter((n) => n.length >= 4);
const namesOf = (c) => [...(COUNTRY_ALIASES[c.code] || []), c.nativeName, c.name, ...cityNamesOf(c)];
const PLACES = [
  ...COUNTRIES.map((c) => ({ code: c.code, names: namesOf(c) })),
  ...OTHER_PLACES.map((names, i) => ({ code: `X${i}`, names })),
];

// Başlık başka bir ülkeyi/bölgeyi konu alıyor ve seçilen ülkeyi hiç anmıyorsa true.
// Sezgisel bir süzgeçtir: başlıkta geçmeyen ama metinde geçen ilişkiyi göremez.
function foreignFocus(title, country, extraOwnNames = []) {
  const folded = norm(title);
  const own = [...namesOf(country), ...extraOwnNames];
  if (own.some((a) => mentions(title, folded, a))) return false;
  return PLACES.some((p) => p.code !== country.code && p.names.some((n) => mentions(title, folded, n)));
}

// ---- Konu süzgeci -------------------------------------------------------------------------------------------------
// Arama kaynakları kelimeleri haberin gövdesinde de arar ("eğitim" -> antrenman eğitimi, yapay zeka eğitimi). Bu yüzden başlık
// her konunun sözlüğüyle puanlanır; seçilen konuya, başka herhangi bir konudan daha az uyan başlık elenir.
const RICH_LANGS = new Set(['tr', 'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ar']); // sözlüğü geniş olan diller
const NO_BOUNDARY = new Set(['ar', 'fa', 'ja', 'zh', 'ko']); // sözcük sınırı olmayan / önekli yazılar: aranan, içinde geçmesi yeter
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const cache = new Map();

function lexicon(topic, lang) {
  const key = `${topic}|${lang}`;
  if (!cache.has(key)) {
    const terms = [...(TOPIC_TERMS[topic]?.[lang] || []), ...(EXTRA[topic]?.[lang] || [])].map(norm);
    cache.set(key, [...new Set(terms)].map((t) => ({
      t,
      re: NO_BOUNDARY.has(lang) || CJK.test(t) ? null : new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u'),
    })));
  }
  return cache.get(key);
}

// Sözcük başından eşleşir ("okul" -> okullar; "spor" -> transport'u yakalamaz).
function topicScore(title, topic, lang) {
  const text = ` ${norm(title)} `;
  return lexicon(topic, lang).reduce((n, { t, re }) => n + ((re ? re.test(text) : text.includes(t)) ? 1 : 0), 0);
}

const TOPIC_IDS = TOPICS.map((t) => t.id).filter((id) => id !== 'general');

// Başlık seçilen konuyla ilgisiz mi? Sözlüğü zayıf dillerde (ör. Korece) karar verilemez, elenmez.
function offTopic(title, topic, lang) {
  if (!RICH_LANGS.has(lang)) return false;
  const mine = topicScore(title, topic, lang);
  if (!mine) return true;
  return TOPIC_IDS.some((id) => id !== topic && topicScore(title, id, lang) > mine);
}

module.exports = { foreignFocus, mentions, namesOf, topicScore, offTopic };
