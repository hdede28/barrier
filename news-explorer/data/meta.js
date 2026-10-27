'use strict';

// Google News sürümleri: gl = ülke (code), hl = dil, ceid = "ÜLKE:dil". terms = konu terimlerinin dilleri.
// terms, konu anahtar kelimelerinin dile göre karşılıklarıdır (arama sorgusunda OR ile birleştirilir).
// GDELT "sourcecountry" filtresi ISO değil FIPS 10-4 kodu kullanır.
const FIPS = {
  TR: 'TU', US: 'US', GB: 'UK', DE: 'GM', FR: 'FR', ES: 'SP', IT: 'IT', NL: 'NL', BR: 'BR', RU: 'RS', JP: 'JA', IN: 'IN',
  CA: 'CA', AU: 'AS', SA: 'SA', EG: 'EG', AE: 'AE', GR: 'GR', RS: 'RI', MY: 'MY', AL: 'AL', XK: 'KV', MK: 'MK', ME: 'MJ',
  IR: 'IR', AF: 'AF', GM: 'GA', TN: 'TS',
};

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
  { code: 'GR', name: 'Yunanistan', nativeName: 'Ελλάδα', flag: '🇬🇷', hl: 'el', ceid: 'GR:el',
    cities: ['Αθήνα', 'Θεσσαλονίκη', 'Πάτρα', 'Ηράκλειο', 'Λάρισα'] },
  { code: 'RS', name: 'Sırbistan', nativeName: 'Srbija', flag: '🇷🇸', hl: 'sr', ceid: 'RS:sr',
    cities: ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica'] },
  { code: 'MY', name: 'Malezya', nativeName: 'Malaysia', flag: '🇲🇾', hl: 'en-MY', ceid: 'MY:en', terms: ['en', 'ms'],
    cities: ['Kuala Lumpur', 'George Town', 'Johor Bahru', 'Ipoh', 'Kota Kinabalu', 'Kuching'] },
  // approximate: Google Haberler'de bu ülke için ayrı bir sürüm olmayabilir; arama ülke adıyla da daraltılır.
  { code: 'AL', name: 'Arnavutluk', nativeName: 'Shqipëri', flag: '🇦🇱', hl: 'sq', ceid: 'AL:sq', approximate: true,
    cities: ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Elbasan'] },
  { code: 'XK', name: 'Kosova', nativeName: 'Kosovë', flag: '🇽🇰', hl: 'sq', ceid: 'XK:sq', approximate: true,
    cities: ['Prishtinë', 'Prizren', 'Pejë', 'Gjakovë', 'Mitrovicë'] },
  { code: 'MK', name: 'Kuzey Makedonya', nativeName: 'Северна Македонија', flag: '🇲🇰', hl: 'mk', ceid: 'MK:mk', approximate: true,
    cities: ['Скопје', 'Битола', 'Охрид', 'Куманово', 'Тетово'] },
  { code: 'ME', name: 'Karadağ', nativeName: 'Crna Gora', flag: '🇲🇪', hl: 'sr', ceid: 'ME:sr', terms: 'sr', approximate: true,
    cities: ['Podgorica', 'Budva', 'Nikšić', 'Bar', 'Kotor'] },
  { code: 'IR', name: 'İran', nativeName: 'ایران', flag: '🇮🇷', hl: 'fa', ceid: 'IR:fa', approximate: true,
    cities: ['تهران', 'اصفهان', 'مشهد', 'شیراز', 'تبریز'] },
  { code: 'AF', name: 'Afganistan', nativeName: 'افغانستان', flag: '🇦🇫', hl: 'fa', ceid: 'AF:fa', approximate: true,
    cities: ['کابل', 'هرات', 'مزار شریف', 'قندهار'] },
  { code: 'GM', name: 'Gambiya', nativeName: 'Gambia', flag: '🇬🇲', hl: 'en', ceid: 'GM:en', terms: 'en', approximate: true,
    cities: ['Banjul', 'Serekunda', 'Brikama', 'Bakau', 'Farafenni', 'Basse Santa Su'] },
  // "a / b" biçimindeki şehir, iki yazımı da arar (OR).
  { code: 'TN', name: 'Tunus', nativeName: 'تونس', flag: '🇹🇳', hl: 'ar', ceid: 'TN:ar', terms: ['ar', 'fr'], approximate: true,
    cities: ['Tunis / تونس', 'Sfax / صفاقس', 'Sousse / سوسة', 'Bizerte / بنزرت'] },
].map((c) => ({ ...c, terms: [].concat(c.terms || c.hl.split('-')[0]), fips: FIPS[c.code] }));

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
    sq: ['arsim', 'shkollë', 'universitet', 'mësues'],
    mk: ['образование', 'училиште', 'универзитет', 'наставници'],
    sr: ['obrazovanje', 'škola', 'univerzitet', 'образовање', 'школа', 'универзитет'],
    el: ['εκπαίδευση', 'σχολείο', 'πανεπιστήμιο', 'εκπαιδευτικοί'],
    fa: ['آموزش', 'مدرسه', 'دانشگاه', 'معلمان'],
    ms: ['pendidikan', 'sekolah', 'universiti', 'guru']
  },
  politics: {
    tr: ['siyaset', 'hükümet', 'seçim'], en: ['politics', 'government', 'election'],
    de: ['Politik', 'Regierung', 'Wahl'], fr: ['politique', 'gouvernement', 'élections'],
    es: ['política', 'gobierno', 'elecciones'], it: ['politica', 'governo', 'elezioni'],
    pt: ['política', 'governo', 'eleições'], ru: ['политика', 'правительство', 'выборы'],
    ar: ['سياسة', 'حكومة', 'انتخابات'], ja: ['政治', '政府', '選挙'],
    sq: ['politikë', 'qeveri', 'zgjedhje'],
    mk: ['политика', 'влада', 'избори'],
    sr: ['politika', 'vlada', 'izbori', 'политика', 'влада', 'избори'],
    el: ['πολιτική', 'κυβέρνηση', 'εκλογές'],
    fa: ['سیاست', 'دولت', 'انتخابات'],
    ms: ['politik', 'kerajaan', 'pilihan raya']
  },
  economy: {
    tr: ['ekonomi', 'enflasyon', 'borsa'], en: ['economy', 'inflation', 'business'],
    de: ['Wirtschaft', 'Inflation', 'Börse'], fr: ['économie', 'inflation', 'bourse'],
    es: ['economía', 'inflación', 'mercado'], it: ['economia', 'inflazione', 'borsa'],
    pt: ['economia', 'inflação', 'mercado'], ru: ['экономика', 'инфляция', 'рынок'],
    ar: ['اقتصاد', 'تضخم', 'بورصة'], ja: ['経済', 'インフレ', '株価'],
    sq: ['ekonomi', 'inflacion', 'bursë'],
    mk: ['економија', 'инфлација', 'берза'],
    sr: ['ekonomija', 'inflacija', 'berza', 'економија', 'инфлација', 'берза'],
    el: ['οικονομία', 'πληθωρισμός', 'χρηματιστήριο'],
    fa: ['اقتصاد', 'تورم', 'بورس'],
    ms: ['ekonomi', 'inflasi', 'bursa']
  },
  sports: {
    tr: ['spor', 'maç', 'futbol'], en: ['sports', 'match', 'football'],
    de: ['Sport', 'Spiel', 'Fußball'], fr: ['sport', 'match', 'football'],
    es: ['deportes', 'partido', 'fútbol'], it: ['sport', 'partita', 'calcio'],
    pt: ['esporte', 'jogo', 'futebol'], ru: ['спорт', 'матч', 'футбол'],
    ar: ['رياضة', 'مباراة', 'كرة القدم'], ja: ['スポーツ', '試合', 'サッカー'],
    sq: ['sport', 'ndeshje', 'futboll'],
    mk: ['спорт', 'натпревар', 'фудбал'],
    sr: ['sport', 'utakmica', 'fudbal', 'спорт', 'утакмица', 'фудбал'],
    el: ['αθλητικά', 'αγώνας', 'ποδόσφαιρο'],
    fa: ['ورزش', 'مسابقه', 'فوتبال'],
    ms: ['sukan', 'perlawanan', 'bola sepak']
  },
  technology: {
    tr: ['teknoloji', 'yapay zeka', 'yazılım'], en: ['technology', 'AI', 'software'],
    de: ['Technologie', 'KI', 'Software'], fr: ['technologie', 'IA', 'logiciel'],
    es: ['tecnología', 'IA', 'software'], it: ['tecnologia', 'IA', 'software'],
    pt: ['tecnologia', 'IA', 'software'], ru: ['технологии', 'ИИ', 'программное обеспечение'],
    ar: ['تكنولوجيا', 'ذكاء اصطناعي', 'برمجيات'], ja: ['テクノロジー', 'AI', 'ソフトウェア'],
    sq: ['teknologji', 'inteligjencë artificiale', 'softuer'],
    mk: ['технологија', 'вештачка интелигенција', 'софтвер'],
    sr: ['tehnologija', 'veštačka inteligencija', 'softver', 'технологија', 'вештачка интелигенција', 'софтвер'],
    el: ['τεχνολογία', 'τεχνητή νοημοσύνη', 'λογισμικό'],
    fa: ['فناوری', 'هوش مصنوعی', 'نرم\u200cافزار'],
    ms: ['teknologi', 'kecerdasan buatan', 'perisian']
  },
  health: {
    tr: ['sağlık', 'hastane', 'salgın'], en: ['health', 'hospital', 'disease'],
    de: ['Gesundheit', 'Krankenhaus', 'Krankheit'], fr: ['santé', 'hôpital', 'maladie'],
    es: ['salud', 'hospital', 'enfermedad'], it: ['salute', 'ospedale', 'malattia'],
    pt: ['saúde', 'hospital', 'doença'], ru: ['здоровье', 'больница', 'болезнь'],
    ar: ['صحة', 'مستشفى', 'مرض'], ja: ['健康', '病院', '病気'],
    sq: ['shëndetësi', 'spital', 'sëmundje'],
    mk: ['здравство', 'болница', 'болест'],
    sr: ['zdravlje', 'bolnica', 'bolest', 'здравље', 'болница', 'болест'],
    el: ['υγεία', 'νοσοκομείο', 'ασθένεια'],
    fa: ['سلامت', 'بیمارستان', 'بیماری'],
    ms: ['kesihatan', 'hospital', 'penyakit']
  },
  science: {
    tr: ['bilim', 'araştırma', 'uzay'], en: ['science', 'research', 'space'],
    de: ['Wissenschaft', 'Forschung', 'Weltraum'], fr: ['science', 'recherche', 'espace'],
    es: ['ciencia', 'investigación', 'espacio'], it: ['scienza', 'ricerca', 'spazio'],
    pt: ['ciência', 'pesquisa', 'espaço'], ru: ['наука', 'исследование', 'космос'],
    ar: ['علوم', 'بحث', 'فضاء'], ja: ['科学', '研究', '宇宙'],
    sq: ['shkencë', 'hulumtim', 'hapësirë'],
    mk: ['наука', 'истражување', 'вселена'],
    sr: ['nauka', 'istraživanje', 'svemir', 'наука', 'истраживање', 'свемир'],
    el: ['επιστήμη', 'έρευνα', 'διάστημα'],
    fa: ['علم', 'پژوهش', 'فضا'],
    ms: ['sains', 'penyelidikan', 'angkasa']
  },
  culture: {
    tr: ['kültür', 'sanat', 'sinema'], en: ['culture', 'arts', 'film'],
    de: ['Kultur', 'Kunst', 'Film'], fr: ['culture', 'art', 'cinéma'],
    es: ['cultura', 'arte', 'cine'], it: ['cultura', 'arte', 'cinema'],
    pt: ['cultura', 'arte', 'cinema'], ru: ['культура', 'искусство', 'кино'],
    ar: ['ثقافة', 'فن', 'سينما'], ja: ['文化', '芸術', '映画'],
    sq: ['kulturë', 'art', 'film'],
    mk: ['култура', 'уметност', 'филм'],
    sr: ['kultura', 'umetnost', 'film', 'култура', 'уметност', 'филм'],
    el: ['πολιτισμός', 'τέχνη', 'κινηματογράφος'],
    fa: ['فرهنگ', 'هنر', 'سینما'],
    ms: ['budaya', 'seni', 'filem']
  },
  environment: {
    tr: ['çevre', 'iklim', 'doğa'], en: ['environment', 'climate', 'nature'],
    de: ['Umwelt', 'Klima', 'Natur'], fr: ['environnement', 'climat', 'nature'],
    es: ['medio ambiente', 'clima', 'naturaleza'], it: ['ambiente', 'clima', 'natura'],
    pt: ['meio ambiente', 'clima', 'natureza'], ru: ['экология', 'климат', 'природа'],
    ar: ['بيئة', 'مناخ', 'طبيعة'], ja: ['環境', '気候', '自然'],
    sq: ['mjedis', 'klimë', 'natyrë'],
    mk: ['животна средина', 'клима', 'природа'],
    sr: ['životna sredina', 'klima', 'priroda', 'животна средина', 'клима', 'природа'],
    el: ['περιβάλλον', 'κλίμα', 'φύση'],
    fa: ['محیط زیست', 'اقلیم', 'طبیعت'],
    ms: ['alam sekitar', 'iklim', 'alam semula jadi']
  },
  security: {
    tr: ['güvenlik', 'polis', 'suç'], en: ['security', 'police', 'crime'],
    de: ['Sicherheit', 'Polizei', 'Kriminalität'], fr: ['sécurité', 'police', 'crime'],
    es: ['seguridad', 'policía', 'crimen'], it: ['sicurezza', 'polizia', 'crimine'],
    pt: ['segurança', 'polícia', 'crime'], ru: ['безопасность', 'полиция', 'преступность'],
    ar: ['أمن', 'شرطة', 'جريمة'], ja: ['治安', '警察', '犯罪'],
    sq: ['siguri', 'policia', 'krim'],
    mk: ['безбедност', 'полиција', 'криминал'],
    sr: ['bezbednost', 'bezbjednost', 'policija', 'kriminal', 'безбедност', 'полиција', 'криминал'],
    el: ['ασφάλεια', 'αστυνομία', 'έγκλημα'],
    fa: ['امنیت', 'پلیس', 'جرم'],
    ms: ['keselamatan', 'polis', 'jenayah']
  },
};

// "Tüm dünya" araması: ülke yerine bu yayın sürümlerinde (her biri kendi dilinde terimlerle) aranır.
const WORLD = { code: 'ALL', name: 'Tüm dünya (çok dilli)', flag: '🌍' };
const WORLD_EDITION_CODES = ['US', 'GB', 'TR', 'DE', 'FR', 'ES', 'BR', 'RU', 'SA', 'JP'];

const findCountry = (code) => COUNTRIES.find((c) => c.code === code);
const findTopic = (id) => TOPICS.find((t) => t.id === id);

// Konu seçilmediğinde ("Genel"): her konudan en fazla n terim. Ülke adını aramak yerine bu kullanılır,
// çünkü ülke adı aramak "o ülkede olan" değil "adı geçen" haberleri getirir.
function generalTerms(country, n = 2) {
  const out = [];
  for (const byLang of Object.values(TOPIC_TERMS)) {
    for (const lang of country.terms) out.push(...(byLang[lang] || []).slice(0, n));
  }
  return [...new Set(out)];
}

// Ülkenin tüm dillerindeki terimleri birleştirir; hiçbiri yoksa İngilizceye düşer.
function termsFor(topicId, country) {
  const byLang = TOPIC_TERMS[topicId];
  if (!byLang) return [];
  const terms = [...new Set(country.terms.flatMap((l) => byLang[l] || []))];
  return terms.length ? terms : byLang.en;
}

module.exports = { COUNTRIES, TOPICS, TOPIC_TERMS, WORLD, WORLD_EDITION_CODES, findCountry, findTopic, termsFor, generalTerms };
