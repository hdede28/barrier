'use strict';

// Google News sürümleri: gl = ülke, hl = dil, ceid = "ÜLKE:dil".
// terms, konu anahtar kelimelerinin dile göre karşılıklarıdır (arama sorgusunda OR ile birleştirilir).
const COUNTRIES = [
  { code: 'TR', name: 'Türkiye', nativeName: 'Türkiye', flag: '🇹🇷', hl: 'tr', ceid: 'TR:tr',
    cities: ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya', 'Gaziantep', 'Trabzon', 'Adana', 'Kayseri'] },
  { code: 'US', name: 'Amerika Birleşik Devletleri', nativeName: 'United States', flag: '🇺🇸', hl: 'en-US', ceid: 'US:en',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Washington', 'San Francisco', 'Boston'] },
  { code: 'GB', name: 'Birleşik Krallık', nativeName: 'United Kingdom', flag: '🇬🇧', hl: 'en-GB', ceid: 'GB:en',
    cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Liverpool'] },
  { code: 'DE', name: 'Almanya', nativeName: 'Deutschland', flag: '🇩🇪', hl: 'de', ceid: 'DE:de',
    cities: ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Stuttgart'] },
  { code: 'FR', name: 'Fransa', nativeName: 'France', flag: '🇫🇷', hl: 'fr', ceid: 'FR:fr',
    cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Lille'] },
  { code: 'ES', name: 'İspanya', nativeName: 'España', flag: '🇪🇸', hl: 'es', ceid: 'ES:es',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao'] },
  { code: 'IT', name: 'İtalya', nativeName: 'Italia', flag: '🇮🇹', hl: 'it', ceid: 'IT:it',
    cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Firenze'] },
  { code: 'NL', name: 'Hollanda', nativeName: 'Nederland', flag: '🇳🇱', hl: 'nl', ceid: 'NL:nl', terms: 'en',
    cities: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht', 'Eindhoven'] },
  { code: 'BR', name: 'Brezilya', nativeName: 'Brasil', flag: '🇧🇷', hl: 'pt-BR', ceid: 'BR:pt-419', terms: 'pt',
    cities: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'] },
  { code: 'RU', name: 'Rusya', nativeName: 'Россия', flag: '🇷🇺', hl: 'ru', ceid: 'RU:ru',
    cities: ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск'] },
  { code: 'JP', name: 'Japonya', nativeName: '日本', flag: '🇯🇵', hl: 'ja', ceid: 'JP:ja',
    cities: ['東京', '大阪', '京都', '横浜'] },
  { code: 'IN', name: 'Hindistan', nativeName: 'India', flag: '🇮🇳', hl: 'en-IN', ceid: 'IN:en', terms: 'en',
    cities: ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata'] },
  { code: 'CA', name: 'Kanada', nativeName: 'Canada', flag: '🇨🇦', hl: 'en-CA', ceid: 'CA:en', terms: 'en',
    cities: ['Toronto', 'Vancouver', 'Montréal', 'Ottawa', 'Calgary'] },
  { code: 'AU', name: 'Avustralya', nativeName: 'Australia', flag: '🇦🇺', hl: 'en-AU', ceid: 'AU:en', terms: 'en',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Canberra'] },
  { code: 'SA', name: 'Suudi Arabistan', nativeName: 'السعودية', flag: '🇸🇦', hl: 'ar', ceid: 'SA:ar', terms: 'ar',
    cities: ['الرياض', 'جدة', 'مكة المكرمة', 'الدمام'] },
  { code: 'EG', name: 'Mısır', nativeName: 'مصر', flag: '🇪🇬', hl: 'ar', ceid: 'EG:ar', terms: 'ar',
    cities: ['القاهرة', 'الإسكندرية', 'الجيزة'] },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri', nativeName: 'الإمارات', flag: '🇦🇪', hl: 'ar', ceid: 'AE:ar', terms: 'ar',
    cities: ['دبي', 'أبو ظبي', 'الشارقة'] },
].map((c) => ({ ...c, terms: c.terms || c.hl.split('-')[0] }));

const TOPICS = [
  { id: 'general', label: 'Genel (tüm konular)', icon: '🗞️' },
  { id: 'education', label: 'Eğitim', icon: '🎓' },
  { id: 'politics', label: 'Siyaset', icon: '🏛️' },
  { id: 'economy', label: 'Ekonomi', icon: '💹' },
  { id: 'sports', label: 'Spor', icon: '⚽' },
  { id: 'technology', label: 'Teknoloji', icon: '💻' },
  { id: 'health', label: 'Sağlık', icon: '🩺' },
  { id: 'science', label: 'Bilim ve uzay', icon: '🔬' },
  { id: 'culture', label: 'Kültür ve sanat', icon: '🎭' },
  { id: 'environment', label: 'Çevre ve iklim', icon: '🌍' },
  { id: 'security', label: 'Güvenlik ve asayiş', icon: '🚓' },
];

// konu -> dil -> arama terimleri
const TOPIC_TERMS = {
  education: {
    tr: ['eğitim', 'okul', 'üniversite', 'öğretmen'], en: ['education', 'school', 'university', 'teachers'],
    de: ['Bildung', 'Schule', 'Universität', 'Lehrer'], fr: ['éducation', 'école', 'université', 'enseignants'],
    es: ['educación', 'escuela', 'universidad', 'docentes'], it: ['istruzione', 'scuola', 'università', 'insegnanti'],
    pt: ['educação', 'escola', 'universidade', 'professores'], ru: ['образование', 'школа', 'университет', 'учителя'],
    ar: ['تعليم', 'مدرسة', 'جامعة', 'معلمين'], ja: ['教育', '学校', '大学', '教師'],
  },
  politics: {
    tr: ['siyaset', 'hükümet', 'seçim'], en: ['politics', 'government', 'election'],
    de: ['Politik', 'Regierung', 'Wahl'], fr: ['politique', 'gouvernement', 'élections'],
    es: ['política', 'gobierno', 'elecciones'], it: ['politica', 'governo', 'elezioni'],
    pt: ['política', 'governo', 'eleições'], ru: ['политика', 'правительство', 'выборы'],
    ar: ['سياسة', 'حكومة', 'انتخابات'], ja: ['政治', '政府', '選挙'],
  },
  economy: {
    tr: ['ekonomi', 'enflasyon', 'borsa'], en: ['economy', 'inflation', 'business'],
    de: ['Wirtschaft', 'Inflation', 'Börse'], fr: ['économie', 'inflation', 'bourse'],
    es: ['economía', 'inflación', 'mercado'], it: ['economia', 'inflazione', 'borsa'],
    pt: ['economia', 'inflação', 'mercado'], ru: ['экономика', 'инфляция', 'рынок'],
    ar: ['اقتصاد', 'تضخم', 'بورصة'], ja: ['経済', 'インフレ', '株価'],
  },
  sports: {
    tr: ['spor', 'maç', 'futbol'], en: ['sports', 'match', 'football'],
    de: ['Sport', 'Spiel', 'Fußball'], fr: ['sport', 'match', 'football'],
    es: ['deportes', 'partido', 'fútbol'], it: ['sport', 'partita', 'calcio'],
    pt: ['esporte', 'jogo', 'futebol'], ru: ['спорт', 'матч', 'футбол'],
    ar: ['رياضة', 'مباراة', 'كرة القدم'], ja: ['スポーツ', '試合', 'サッカー'],
  },
  technology: {
    tr: ['teknoloji', 'yapay zeka', 'yazılım'], en: ['technology', 'AI', 'software'],
    de: ['Technologie', 'KI', 'Software'], fr: ['technologie', 'IA', 'logiciel'],
    es: ['tecnología', 'IA', 'software'], it: ['tecnologia', 'IA', 'software'],
    pt: ['tecnologia', 'IA', 'software'], ru: ['технологии', 'ИИ', 'программное обеспечение'],
    ar: ['تكنولوجيا', 'ذكاء اصطناعي', 'برمجيات'], ja: ['テクノロジー', 'AI', 'ソフトウェア'],
  },
  health: {
    tr: ['sağlık', 'hastane', 'salgın'], en: ['health', 'hospital', 'disease'],
    de: ['Gesundheit', 'Krankenhaus', 'Krankheit'], fr: ['santé', 'hôpital', 'maladie'],
    es: ['salud', 'hospital', 'enfermedad'], it: ['salute', 'ospedale', 'malattia'],
    pt: ['saúde', 'hospital', 'doença'], ru: ['здоровье', 'больница', 'болезнь'],
    ar: ['صحة', 'مستشفى', 'مرض'], ja: ['健康', '病院', '病気'],
  },
  science: {
    tr: ['bilim', 'araştırma', 'uzay'], en: ['science', 'research', 'space'],
    de: ['Wissenschaft', 'Forschung', 'Weltraum'], fr: ['science', 'recherche', 'espace'],
    es: ['ciencia', 'investigación', 'espacio'], it: ['scienza', 'ricerca', 'spazio'],
    pt: ['ciência', 'pesquisa', 'espaço'], ru: ['наука', 'исследование', 'космос'],
    ar: ['علوم', 'بحث', 'فضاء'], ja: ['科学', '研究', '宇宙'],
  },
  culture: {
    tr: ['kültür', 'sanat', 'sinema'], en: ['culture', 'arts', 'film'],
    de: ['Kultur', 'Kunst', 'Film'], fr: ['culture', 'art', 'cinéma'],
    es: ['cultura', 'arte', 'cine'], it: ['cultura', 'arte', 'cinema'],
    pt: ['cultura', 'arte', 'cinema'], ru: ['культура', 'искусство', 'кино'],
    ar: ['ثقافة', 'فن', 'سينما'], ja: ['文化', '芸術', '映画'],
  },
  environment: {
    tr: ['çevre', 'iklim', 'doğa'], en: ['environment', 'climate', 'nature'],
    de: ['Umwelt', 'Klima', 'Natur'], fr: ['environnement', 'climat', 'nature'],
    es: ['medio ambiente', 'clima', 'naturaleza'], it: ['ambiente', 'clima', 'natura'],
    pt: ['meio ambiente', 'clima', 'natureza'], ru: ['экология', 'климат', 'природа'],
    ar: ['بيئة', 'مناخ', 'طبيعة'], ja: ['環境', '気候', '自然'],
  },
  security: {
    tr: ['güvenlik', 'polis', 'suç'], en: ['security', 'police', 'crime'],
    de: ['Sicherheit', 'Polizei', 'Kriminalität'], fr: ['sécurité', 'police', 'crime'],
    es: ['seguridad', 'policía', 'crimen'], it: ['sicurezza', 'polizia', 'crimine'],
    pt: ['segurança', 'polícia', 'crime'], ru: ['безопасность', 'полиция', 'преступность'],
    ar: ['أمن', 'شرطة', 'جريمة'], ja: ['治安', '警察', '犯罪'],
  },
};

const findCountry = (code) => COUNTRIES.find((c) => c.code === code);
const findTopic = (id) => TOPICS.find((t) => t.id === id);

function termsFor(topicId, country) {
  const byLang = TOPIC_TERMS[topicId];
  if (!byLang) return [];
  return byLang[country.terms] || byLang.en;
}

module.exports = { COUNTRIES, TOPICS, findCountry, findTopic, termsFor };
