'use strict';

// Türkiye Maarif Vakfı'nın farklı dillerdeki adları. Yazımlar çeviri/translitere edilmiştir: resmî olmayan bir yazım
// eksikse buraya ekle, uygulama bütün dillerdeki adları birlikte arar.
const NAMES = {
  tr: ['Türkiye Maarif Vakfı', 'Maarif Vakfı', 'TMV Maarif', 'Maarif Vakfı okulları'],
  en: ['Turkish Maarif Foundation', 'Türkiye Maarif Foundation', 'Turkiye Maarif Foundation', 'Turkey Maarif Foundation', 'Maarif Foundation of Turkey', 'Maarif Foundation'],
  ar: ['مؤسسة المعارف التركية', 'وقف المعارف التركي', 'وقف معارف تركيا', 'مؤسسة معارف تركيا', 'وقف المعارف التركية'],
  fr: ['Fondation Maarif de Turquie', 'Fondation turque Maarif', 'Fondation Maarif turque', 'Fondation Turquie Maarif'],
  ru: ['Фонд «Маариф»', 'Турецкий фонд Маариф', 'Фонд Маариф Турции', 'Турецкий фонд образования Маариф'],
  de: ['Türkische Maarif-Stiftung', 'Maarif-Stiftung', 'Türkiye Maarif Stiftung'],
  es: ['Fundación Maarif de Turquía', 'Fundación Turca Maarif', 'Fundación Maarif'],
  pt: ['Fundação Maarif da Turquia', 'Fundação Turca Maarif', 'Fundação Maarif'],
  it: ['Fondazione Maarif turca', 'Fondazione Maarif della Turchia', 'Fondazione Maarif'],
  sq: ['Fondacioni Maarif', 'Fondacioni Turk Maarif', 'Fondacioni Maarif i Turqisë', 'Fondacioni Maarif të Turqisë'],
  mk: ['Фондација Мааріф', 'Фондацијата Маариф', 'Турска фондација Маариф', 'Фондација Маариф'],
  sr: ['Turska zaklada Maarif', 'Zaklada Maarif', 'Turska fondacija Maarif', 'Fondacija Maarif', 'Фондација Мааріф'],
  hr: ['Turska zaklada Maarif', 'Zaklada Maarif', 'Turska fondacija Maarif', 'Fondacija Maarif'],
  bg: ['Фондация Маариф', 'Турска фондация Маариф'],
  ro: ['Fundația Maarif din Turcia', 'Fundația Turcă Maarif', 'Fundația Maarif'],
  el: ['Ίδρυμα Μααρίφ', 'Τουρκικό Ίδρυμα Μααρίφ'],
  fa: ['بنیاد معارف ترکیه', 'بنیاد معارف ترکیه‌ای', 'بنیاد تورکیه معارف'],
  az: ['Türkiyə Maarif Vəqfi', 'Maarif Vəqfi', 'Türkiyə Maarif Fondu'],
  uz: ["Turkiya Maorif jamg'armasi", "Maorif jamg'armasi", 'Туркия Маориф жамғармаси'],
  kk: ['Түркия Маариф қоры', 'Маариф қоры'],
  ky: ['Түркия Маариф фонду', 'Маариф фонду'],
  id: ['Yayasan Maarif Turki', 'Yayasan Maarif Turkiye'],
  ms: ['Yayasan Maarif Turki'],
  ur: ['ترکی معارف فاؤنڈیشن', 'ترک معارف فاؤنڈیشن'],
  ja: ['トルコ・マアリフ財団', 'トルコ マアリフ財団'],
  zh: ['土耳其马阿里夫基金会', '土耳其教育基金会', '土耳其马里夫基金会'],
  ko: ['튀르키예 마아리프 재단', '터키 마아리프 재단'],
  ka: ['თურქეთის მაარიფის ფონდი'],
  hy: ['Թուրքիայի Մաարիֆ հիմնադրամ'],
  sw: ['Wakfu wa Maarif wa Uturuki', 'Taasisi ya Maarif ya Uturuki'],
};

// Google Haberler'de aranacak yayın sürümleri (Maarif'in çalıştığı bölgelerin dillerini kapsar).
const EDITION_CODES = ['TR', 'GB', 'US', 'FR', 'SA', 'EG', 'RU', 'DE', 'PK', 'NG', 'ID', 'MA', 'AL', 'XK', 'MK', 'BA', 'AZ', 'KZ'];

const flat = (langs, max = Infinity) => [...new Set(langs.flatMap((l) => NAMES[l] || []))].slice(0, max);

// Bir yayın sürümü/ülke için aranacak adlar: ülkenin dili + İngilizce + Türkçe.
const namesFor = (langs, max = 8) => flat([...langs, 'en', 'tr'], max);

// Tek bir sorguda (GDELT, Bing) kullanılacak, farklı yazı sistemlerini kapsayan kısa liste.
const COMPACT = [...flat(['tr']).slice(0, 2), ...flat(['en']).slice(0, 3), ...flat(['ar']).slice(0, 2), ...flat(['fr']).slice(0, 1), ...flat(['ru']).slice(0, 1)];

const quoted = (names) => names.map((n) => `"${n}"`).join(' OR ');

// Metin Maarif Vakfı'ndan söz ediyor mu? Tam ad ya da "maarif" + Türkiye işareti. (Endonezya'daki "Ma'arif NU" gibi ilgisiz
// kurumları elemek için yalnız "maarif" yetmez.)
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i');
const FULL = [...new Set(Object.values(NAMES).flat())].filter((n) => n.length > 10).map(fold);
const MAARIF = /maarif|maorif|маариф|мааріф|معارف|μααρίφ|マアリフ|马阿里夫|마아리프|maarifi/u;
const TURKISH = /turk|türk|turkey|turquie|turqi|turska|turchia|turquia|turkiye|vakf|vaqf|турц|турец|туркия|тюрк|تركي|ترك|ترکی|ترکیه|tuerk/u;
function mentionsMaarif(text) {
  const t = fold(text);
  return FULL.some((n) => t.includes(n)) || (MAARIF.test(t) && TURKISH.test(t));
}

module.exports = { NAMES, EDITION_CODES, namesFor, COMPACT, quoted, mentionsMaarif };
