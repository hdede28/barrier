'use strict';

// Balkanlar bölümü: bölge ülkeleri ve "başlıklar" (konu mercekleri). Her merceğin terimleri, bölgedeki dillerde
// (en, tr, sq Arnavutça, sr Sırp-Hırvat-Boşnak, mk, bg, ro, el) yazılmıştır; Google Haberler sorgusunda ülkenin kendi dili + İngilizce kullanılır,
// sonuçlarda ve RSS akışlarında ise tüm dillerdeki terimlerle başlık sınıflandırılır. Terim eklemek/değiştirmek için LENSES listesini düzenle.

// Bölge ülkeleri (Arnavutluk başta). Kodlar data/meta.js'deki ülkelerdir.
const COUNTRY_CODES = ['AL', 'XK', 'MK', 'ME', 'RS', 'BA', 'HR', 'GR', 'BG', 'RO'];
const FOCUS = 'AL'; // varsayılan seçili ülke

// Ülkenin Google Haberler sürümündeki dil → terim dili
const LANG_OF = { AL: 'sq', XK: 'sq', MK: 'mk', ME: 'sr', RS: 'sr', BA: 'sr', HR: 'sr', GR: 'el', BG: 'bg', RO: 'ro' };

// Türkiye basınında bu ülkeyi ararken kullanılan Türkçe adlar (ilki ülke adı, ikincisi başkent)
const TR_NAMES = {
  AL: ['Arnavutluk', 'Tiran'], XK: ['Kosova', 'Priştine'], MK: ['Kuzey Makedonya', 'Üsküp'], ME: ['Karadağ', 'Podgorica'],
  RS: ['Sırbistan', 'Belgrad'], BA: ['Bosna-Hersek', 'Saraybosna'], HR: ['Hırvatistan', 'Zagreb'], GR: ['Yunanistan', 'Atina'],
  BG: ['Bulgaristan', 'Sofya'], RO: ['Romanya', 'Bükreş'],
};

const LENSES = [
  { id: 'politics', icon: '🏛️', label: 'Siyaset ve hükümet',
    en: ['government', 'parliament', 'prime minister', 'opposition', 'election'],
    tr: ['hükümet', 'meclis', 'başbakan', 'muhalefet', 'seçim', 'cumhurbaşkanı'],
    sq: ['qeveria', 'kuvendi', 'kryeministri', 'opozita', 'zgjedhjet', 'presidenti'],
    sr: ['vlada', 'skupština', 'premijer', 'opozicija', 'izbori', 'predsednik'],
    mk: ['влада', 'собрание', 'премиер', 'опозиција', 'избори'],
    bg: ['правителство', 'парламент', 'министър-председател', 'опозиция', 'избори'],
    ro: ['guvern', 'parlament', 'premier', 'opoziție', 'alegeri'],
    el: ['κυβέρνηση', 'βουλή', 'πρωθυπουργός', 'αντιπολίτευση', 'εκλογές'] },
  { id: 'eu', icon: '🇪🇺', label: 'AB yolu ve reformlar',
    en: ['EU accession', 'European Union', 'enlargement', 'membership talks', 'EU reforms'],
    tr: ['Avrupa Birliği', 'AB üyelik', 'müzakere', 'genişleme', 'AB reform'],
    sq: ['Bashkimi Evropian', 'anëtarësim', 'negociatat', 'integrimi evropian', 'BE-ja'],
    sr: ['Evropska unija', 'pristupanje', 'pregovori', 'evrointegracije', 'reforme'],
    mk: ['Европска унија', 'пристапување', 'преговори', 'евроинтеграции'],
    bg: ['Европейски съюз', 'присъединяване', 'преговори', 'еврозона'],
    ro: ['Uniunea Europeană', 'aderare', 'negocieri', 'Comisia Europeană'],
    el: ['Ευρωπαϊκή Ένωση', 'διεύρυνση', 'ένταξη', 'Κομισιόν'] },
  { id: 'regional', icon: '🤝', label: 'Bölgesel ilişkiler ve gerilimler',
    en: ['Western Balkans', 'Open Balkan', 'Belgrade Pristina', 'regional cooperation', 'border dispute'],
    tr: ['Balkanlar', 'Batı Balkanlar', 'Açık Balkan', 'bölgesel işbirliği', 'Kosova Sırbistan', 'sınır gerilimi'],
    sq: ['Ballkani Perëndimor', 'Ballkani i Hapur', 'Beogradi', 'bashkëpunim rajonal', 'dialogu'],
    sr: ['Zapadni Balkan', 'Otvoreni Balkan', 'Beograd Priština', 'regionalna saradnja', 'dijalog'],
    mk: ['Западен Балкан', 'Отворен Балкан', 'регионална соработка', 'Белград Приштина'],
    bg: ['Западни Балкани', 'регионално сътрудничество', 'Балканите'],
    ro: ['Balcanii de Vest', 'cooperare regională', 'Balcani'],
    el: ['Δυτικά Βαλκάνια', 'Βαλκάνια', 'περιφερειακή συνεργασία'] },
  { id: 'economy', icon: '💶', label: 'Ekonomi ve yatırım',
    en: ['economy', 'investment', 'inflation', 'budget', 'wages', 'foreign investors'],
    tr: ['ekonomi', 'yatırım', 'enflasyon', 'bütçe', 'maaş', 'ihracat'],
    sq: ['ekonomia', 'investime', 'inflacioni', 'buxheti', 'pagat', 'eksportet'],
    sr: ['ekonomija', 'investicije', 'inflacija', 'budžet', 'plate', 'izvoz'],
    mk: ['економија', 'инвестиции', 'инфлација', 'буџет', 'плати'],
    bg: ['икономика', 'инвестиции', 'инфлация', 'бюджет', 'заплати'],
    ro: ['economie', 'investiții', 'inflație', 'buget', 'salarii'],
    el: ['οικονομία', 'επενδύσεις', 'πληθωρισμός', 'προϋπολογισμός', 'μισθοί'] },
  { id: 'life', icon: '🏠', label: 'Yaşam: oturum, emlak, kira',
    en: ['residence permit', 'real estate', 'property prices', 'rental prices', 'driving licence', 'visa', 'foreigners'],
    tr: ['oturma izni', 'emlak', 'konut fiyatları', 'kira', 'ehliyet', 'vize', 'yabancılar'],
    sq: ['leje qëndrimi', 'pasuri të paluajtshme', 'çmimet e banesave', 'qiraja', 'patentë shoferi', 'viza', 'të huajt'],
    sr: ['boravišna dozvola', 'nekretnine', 'cene stanova', 'kirija', 'vozačka dozvola', 'viza', 'stranci'],
    mk: ['дозвола за престој', 'недвижности', 'цени на станови', 'кирија', 'виза'],
    bg: ['разрешително за пребиваване', 'недвижими имоти', 'цени на жилищата', 'наем', 'виза'],
    ro: ['permis de ședere', 'imobiliare', 'prețul locuințelor', 'chirii', 'viză'],
    el: ['άδεια παραμονής', 'ακίνητα', 'τιμές κατοικιών', 'ενοίκια', 'βίζα'] },
  { id: 'turkey', icon: '🇹🇷', label: 'Türkiye ilişkileri',
    en: ['Turkey', 'Türkiye', 'Turkish', 'Erdogan', 'Turkish investment'],
    tr: ['Türkiye', 'Erdoğan', 'Türk', 'Maarif', 'Yunus Emre', 'Türk şirketleri'],
    sq: ['Turqia', 'Turqisë', 'Erdogan', 'turk', 'Maarif', 'Yunus Emre'],
    sr: ['Turska', 'Turske', 'Erdogan', 'turski'],
    mk: ['Турција', 'Ердоган', 'турски'],
    bg: ['Турция', 'Ердоган', 'турски'],
    ro: ['Turcia', 'Erdogan', 'turcesc'],
    el: ['Τουρκία', 'Ερντογάν', 'τουρκικ'] },
  { id: 'justice', icon: '⚖️', label: 'Adalet, güvenlik ve yolsuzlukla mücadele',
    en: ['prosecutor', 'corruption', 'court', 'police', 'arrest', 'organized crime', 'SPAK'],
    tr: ['savcılık', 'yolsuzluk', 'mahkeme', 'polis', 'tutuklama', 'organize suç', 'SPAK'],
    sq: ['prokuroria', 'korrupsioni', 'gjykata', 'policia', 'arrestim', 'krimi i organizuar', 'SPAK'],
    sr: ['tužilaštvo', 'korupcija', 'sud', 'policija', 'hapšenje', 'organizovani kriminal'],
    mk: ['обвинителство', 'корупција', 'суд', 'полиција', 'апсење'],
    bg: ['прокуратура', 'корупция', 'съд', 'полиция', 'арест'],
    ro: ['parchet', 'corupție', 'tribunal', 'poliția', 'arestare'],
    el: ['εισαγγελέας', 'διαφθορά', 'δικαστήριο', 'αστυνομία', 'σύλληψη'] },
  { id: 'disaster', icon: '🌦️', label: 'Hava, deprem ve afet',
    en: ['earthquake', 'flood', 'wildfire', 'storm', 'weather warning', 'power outage', 'heatwave'],
    tr: ['deprem', 'sel', 'orman yangını', 'fırtına', 'hava durumu', 'elektrik kesintisi', 'sıcak hava'],
    sq: ['tërmet', 'përmbytje', 'zjarr', 'stuhi', 'parashikimi i motit', 'ndërprerje e energjisë', 'vapë'],
    sr: ['zemljotres', 'poplava', 'požar', 'nevreme', 'vremenska prognoza', 'nestanak struje', 'toplotni talas'],
    mk: ['земјотрес', 'поплава', 'пожар', 'невреме', 'прекин на струја'],
    bg: ['земетресение', 'наводнение', 'пожар', 'буря', 'прекъсване на тока'],
    ro: ['cutremur', 'inundații', 'incendiu', 'furtună', 'caniculă'],
    el: ['σεισμός', 'πλημμύρα', 'πυρκαγιά', 'καταιγίδα', 'καύσωνας'] },
  { id: 'tourism', icon: '🏖️', label: 'Turizm ve ulaşım',
    en: ['tourism', 'tourists', 'flights', 'airport', 'ferry', 'highway'],
    tr: ['turizm', 'turist', 'uçuş', 'havalimanı', 'feribot', 'otoyol'],
    sq: ['turizmi', 'turistë', 'fluturime', 'aeroporti', 'trageti', 'autostrada'],
    sr: ['turizam', 'turisti', 'letovi', 'aerodrom', 'trajekt', 'autoput'],
    mk: ['туризам', 'туристи', 'летови', 'аеродром', 'автопат'],
    bg: ['туризъм', 'туристи', 'полети', 'летище', 'магистрала'],
    ro: ['turism', 'turiști', 'zboruri', 'aeroport', 'autostradă'],
    el: ['τουρισμός', 'τουρίστες', 'πτήσεις', 'αεροδρόμιο', 'πλοίο'] },
  { id: 'education', icon: '🎓', label: 'Eğitim ve burs',
    en: ['school', 'university', 'teachers', 'education reform', 'scholarship', 'students'],
    tr: ['okul', 'üniversite', 'öğretmen', 'eğitim', 'burs', 'öğrenci'],
    sq: ['shkolla', 'universiteti', 'mësues', 'arsimi', 'bursa', 'nxënës', 'studentë'],
    sr: ['škola', 'univerzitet', 'nastavnici', 'obrazovanje', 'stipendija', 'učenici'],
    mk: ['училиште', 'универзитет', 'наставници', 'образование', 'стипендија'],
    bg: ['училище', 'университет', 'учители', 'образование', 'стипендия'],
    ro: ['școală', 'universitate', 'profesori', 'educație', 'bursă'],
    el: ['σχολείο', 'πανεπιστήμιο', 'εκπαιδευτικοί', 'εκπαίδευση', 'υποτροφία'] },
  { id: 'sports', icon: '⚽', label: 'Spor',
    en: ['football', 'national team', 'match', 'championship', 'Olympic'],
    tr: ['futbol', 'milli takım', 'maç', 'şampiyona', 'olimpiyat'],
    sq: ['futboll', 'kombëtarja', 'ndeshja', 'kampionati', 'olimpike'],
    sr: ['fudbal', 'reprezentacija', 'utakmica', 'prvenstvo', 'olimpijske'],
    mk: ['фудбал', 'репрезентација', 'натпревар', 'првенство'],
    bg: ['футбол', 'национален отбор', 'мач', 'първенство'],
    ro: ['fotbal', 'echipa națională', 'meci', 'campionat'],
    el: ['ποδόσφαιρο', 'εθνική ομάδα', 'αγώνας', 'πρωτάθλημα'] },
];

const LANGS = ['en', 'tr', 'sq', 'sr', 'mk', 'bg', 'ro', 'el'];
const byId = new Map(LENSES.map((l) => [l.id, l]));
const validIds = (ids) => [...new Set(ids)].filter((id) => byId.has(id));
const validCodes = (codes) => [...new Set(codes.map((c) => String(c).trim().toUpperCase()))].filter((c) => COUNTRY_CODES.includes(c));

const quote = (t) => (/\s/.test(t) ? `"${t}"` : t);

// Google Haberler sorgusu için: yayın sürümünün dilindeki terimler + İngilizce (her mercekten en fazla 4'er terim; URL kısa kalsın).
function clause(ids, lang, perLens = 4) {
  const terms = [...new Set(ids.flatMap((id) => {
    const l = byId.get(id);
    return l ? [...(l[lang] || []).slice(0, perLens), ...(lang === 'en' ? [] : l.en.slice(0, 2))] : [];
  }))];
  return terms.length ? `(${terms.map(quote).join(' OR ')})` : '';
}

// Tüm dillerdeki terimler (RSS akışları ve sonuç süzgeci için)
const allTerms = (ids) => [...new Set(ids.flatMap((id) => LANGS.flatMap((lang) => byId.get(id)?.[lang] || [])))];

module.exports = { COUNTRY_CODES, FOCUS, LANG_OF, TR_NAMES, LENSES, LANGS, validIds, validCodes, clause, allTerms, lens: (id) => byId.get(id) };
