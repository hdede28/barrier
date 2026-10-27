'use strict';

const { COUNTRIES } = require('../data/meta');
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

module.exports = { foreignFocus, mentions, namesOf };
