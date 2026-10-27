'use strict';

// Doğrudan RSS/Atom akışları. Sunucu yalnızca bu listedeki (ve EXTRA_FEEDS ile eklenen) adreslere gider;
// kullanıcıdan adres alınmaz.
//
//   name       Haberin kaynağı olarak gösterilen ad
//   url        RSS / RDF / Atom adresi
//   kind       'news' (yayıncı) ya da 'social' (herkese açık sosyal medya hesabı)
//   lang       İsteğe bağlı. Akışın dili (çeviri için); verilmezse ülkenin dili, '*' akışlarda İngilizce
//   topics     İsteğe bağlı. Konuya özel akış (ör. ['education']): yalnızca o konu seçiliyken ya da konu "Genel" iken kullanılır
//   countries  ['TR', ...] yalnızca o ülkelerde gösterilir; '*' tüm ülkelerde, ama başlıkta ülke/şehir adı geçmesi gerekir
//
// Sosyal medya hesabı eklemek için (hepsi herkese açık, anahtarsız RSS verir):
//   Mastodon  https://<sunucu>/@<hesap>.rss
//   Bluesky   https://bsky.app/profile/<hesap>/rss
//   YouTube   https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>
// Hangi hesaplara güveneceğine sen karar ver; resmî ve doğrulanmış hesapları tercih et.
// Küçük yardımcılar: haber akışı ve sosyal medya (YouTube) akışı.
const news = (name, url, countries, extra = {}) => ({ name, url, kind: 'news', countries, ...extra });
const yt = (name, id) => ({ name: `${name} (YouTube)`, url: `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, kind: 'social', countries: ['*'], lang: 'en' });

// NOT: Bu adresleri geliştirme ortamından doğrulayamadım; bazıları değişmiş ya da kapanmış olabilir. Bozuk olan akış
// diğerlerini etkilemez, sonuçların altında "N akıştan M tanesi alınamadı" olarak görünür. Hangilerinin bozuk olduğunu
// görmek için /api/diagnose?feeds=1 adresini aç. 403 (bot engeli) veren siteler listeden çıkarılır; engeli aşmaya çalışılmaz.
const FEEDS = [
  // --- Türkiye
  news('BBC News Türkçe', 'https://feeds.bbci.co.uk/turkce/rss.xml', ['TR']),
  news('DW Türkçe', 'https://rss.dw.com/rdf/rss-tur-all', ['TR']),
  news('Anadolu Ajansı', 'https://www.aa.com.tr/tr/rss/default?cat=guncel', ['TR']),
  news('Hürriyet', 'https://www.hurriyet.com.tr/rss/gundem', ['TR']),
  news('Milliyet', 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml', ['TR']),
  news('Sabah', 'https://www.sabah.com.tr/rss/gundem.xml', ['TR']),
  news('Cumhuriyet', 'https://www.cumhuriyet.com.tr/rss/son_dakika.xml', ['TR']),
  news('NTV', 'https://www.ntv.com.tr/gundem.rss', ['TR']),
  news('TRT Haber', 'https://www.trthaber.com/sondakika.rss', ['TR']),
  news('Habertürk', 'https://www.haberturk.com/rss', ['TR']),
  news('Sözcü', 'https://www.sozcu.com.tr/feeds-son-dakika', ['TR']),
  news('T24', 'https://t24.com.tr/rss', ['TR']),
  news('BirGün', 'https://www.birgun.net/rss/home', ['TR']),
  news('Hürriyet Daily News', 'https://www.hurriyetdailynews.com/rss', ['TR'], { lang: 'en' }),
  news('Daily Sabah', 'https://www.dailysabah.com/rssFeed/turkey', ['TR'], { lang: 'en' }),
  ...['education:egitim', 'sports:spor', 'economy:ekonomi', 'technology:teknoloji', 'health:saglik'].map((x) => {
    const [topic, slug] = x.split(':');
    return news(`Hürriyet ${slug}`, `https://www.hurriyet.com.tr/rss/${slug}`, ['TR'], { topics: [topic] });
  }),
  ...['education:egitim', 'economy:ekonomi', 'technology:teknoloji', 'health:saglik'].map((x) => {
    const [topic, slug] = x.split(':');
    return news(`NTV ${slug}`, `https://www.ntv.com.tr/${slug}.rss`, ['TR'], { topics: [topic] });
  }),
  // --- ABD
  news('NPR', 'https://feeds.npr.org/1001/rss.xml', ['US']),
  news('NYT', 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', ['US']),
  news('CNN', 'http://rss.cnn.com/rss/edition.rss', ['US']),
  news('ABC News', 'https://abcnews.go.com/abcnews/topstories', ['US']),
  news('CBS News', 'https://www.cbsnews.com/latest/rss/main', ['US']),
  ...[['education', 'Education'], ['technology', 'Technology'], ['science', 'Science'], ['health', 'Health'], ['sports', 'Sports'],
    ['economy', 'Business'], ['culture', 'Arts'], ['environment', 'Climate'], ['politics', 'Politics']].map(([topic, sec]) =>
    news(`NYT ${sec}`, `https://rss.nytimes.com/services/xml/rss/nyt/${sec}.xml`, ['US'], { topics: [topic] })),
  news('Hechinger Report', 'https://hechingerreport.org/feed/', ['US'], { topics: ['education'] }),
  news('Chalkbeat', 'https://www.chalkbeat.org/arc/outboundfeeds/rss/', ['US'], { topics: ['education'] }),
  news('EdSurge', 'https://www.edsurge.com/articles_rss', ['US'], { topics: ['education'] }),
  news('Education Week', 'https://www.edweek.org/feed', ['US'], { topics: ['education'] }),
  news('The 74', 'https://www.the74million.org/feed/', ['US'], { topics: ['education'] }),
  news('Inside Higher Ed', 'https://www.insidehighered.com/rss.xml', ['US'], { topics: ['education'] }),
  news('ESPN', 'https://www.espn.com/espn/rss/news', ['US'], { topics: ['sports'] }),
  // --- Birleşik Krallık
  news('BBC UK', 'https://feeds.bbci.co.uk/news/uk/rss.xml', ['GB']),
  news('Sky News UK', 'https://feeds.skynews.com/feeds/rss/uk.xml', ['GB']),
  news('The Guardian UK', 'https://www.theguardian.com/uk-news/rss', ['GB']),
  ...[['education', 'news/education'], ['technology', 'news/technology'], ['health', 'news/health'], ['economy', 'news/business'],
    ['politics', 'news/politics'], ['culture', 'news/entertainment_and_arts'], ['sports', 'sport']].map(([topic, path]) =>
    news(`BBC ${path.split('/').pop()}`, `https://feeds.bbci.co.uk/${path}/rss.xml`, ['GB'], { topics: [topic] })),
  news('BBC science & environment', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', ['GB'], { topics: ['science', 'environment'] }),
  ...[['education', 'education'], ['technology', 'technology'], ['science', 'science'], ['sports', 'sport'], ['economy', 'business'],
    ['culture', 'culture'], ['environment', 'environment'], ['politics', 'politics']].map(([topic, sec]) =>
    news(`Guardian ${sec}`, `https://www.theguardian.com/${sec}/rss`, ['GB'], { topics: [topic] })),
  news('Sky Sports', 'https://www.skysports.com/rss/12040', ['GB'], { topics: ['sports'] }),
  // --- Almanya, Fransa, İspanya, İtalya, Brezilya
  news('Tagesschau', 'https://www.tagesschau.de/index~rss2.xml', ['DE']),
  news('Spiegel', 'https://www.spiegel.de/schlagzeilen/index.rss', ['DE']),
  news('Zeit', 'https://newsfeed.zeit.de/index', ['DE']),
  news('FAZ', 'https://www.faz.net/rss/aktuell/', ['DE']),
  news('DW Deutsch', 'https://rss.dw.com/rdf/rss-de-all', ['DE']),
  news('Le Monde', 'https://www.lemonde.fr/rss/une.xml', ['FR']),
  news('Le Figaro', 'https://www.lefigaro.fr/rss/figaro_actualites.xml', ['FR']),
  news('franceinfo', 'https://www.francetvinfo.fr/titres.rss', ['FR']),
  news('France 24 FR', 'https://www.france24.com/fr/rss', ['FR']),
  news('El País', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', ['ES']),
  news('El Mundo', 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', ['ES']),
  news('20minutos', 'https://www.20minutos.es/rss/', ['ES']),
  news('La Repubblica', 'https://www.repubblica.it/rss/homepage/rss2.0.xml', ['IT']),
  news('ANSA', 'https://www.ansa.it/sito/ansait_rss.xml', ['IT']),
  news('Corriere della Sera', 'https://xml2.corriereobjects.it/rss/homepage.xml', ['IT']),
  news('Folha', 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', ['BR']),
  news('G1', 'https://g1.globo.com/rss/g1/', ['BR']),
  // --- Rusya, Japonya, Hindistan, Kanada, Avustralya
  news('Meduza', 'https://meduza.io/rss/all', ['RU']),
  news('Kommersant', 'https://www.kommersant.ru/RSS/news.xml', ['RU']),
  news('TASS', 'https://tass.com/rss/v2.xml', ['RU'], { lang: 'en' }),
  news('NHK', 'https://www3.nhk.or.jp/rss/news/cat0.xml', ['JP']),
  news('Japan Times', 'https://www.japantimes.co.jp/feed/', ['JP'], { lang: 'en' }),
  news('The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss', ['IN']),
  news('Times of India', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', ['IN']),
  news('NDTV', 'https://feeds.feedburner.com/ndtvnews-top-stories', ['IN']),
  news('CBC', 'https://www.cbc.ca/webfeed/rss/rss-topstories', ['CA']),
  news('ABC Australia', 'https://www.abc.net.au/news/feed/51120/rss.xml', ['AU']),
  news('Sydney Morning Herald', 'https://www.smh.com.au/rss/feed.xml', ['AU']),
  // --- Orta Doğu ve Kuzey Afrika
  news('Arab News', 'https://www.arabnews.com/rss.xml', ['SA'], { lang: 'en' }),
  news('Egypt Independent', 'https://egyptindependent.com/feed/', ['EG'], { lang: 'en' }),
  news('Mada Masr', 'https://www.madamasr.com/en/feed/', ['EG'], { lang: 'en' }),
  news('The National', 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml', ['AE'], { lang: 'en' }),
  news('BBC Persian', 'https://feeds.bbci.co.uk/persian/rss.xml', ['IR', 'AF'], { lang: 'fa' }),
  news('DW Persian', 'https://rss.dw.com/rdf/rss-fa-all', ['IR', 'AF'], { lang: 'fa' }),
  news('Tehran Times', 'https://www.tehrantimes.com/rss', ['IR'], { lang: 'en' }),
  news('Tolo News', 'https://tolonews.com/rss.xml', ['AF'], { lang: 'en' }),
  news('Khaama Press', 'https://www.khaama.com/feed/', ['AF'], { lang: 'en' }),
  news('Tunisie Numérique', 'https://www.tunisienumerique.com/feed/', ['TN'], { lang: 'fr' }),
  news('Kapitalis', 'https://kapitalis.com/tunisie/feed/', ['TN'], { lang: 'fr' }),
  news('La Presse TN', 'https://lapresse.tn/feed/', ['TN'], { lang: 'fr' }),
  // --- Balkanlar, Yunanistan, Malezya, Gambiya
  news('Balkan Insight', 'https://balkaninsight.com/feed/', ['AL', 'XK', 'MK', 'RS', 'ME', 'GR'], { lang: 'en' }),
  news('N1 Srbija', 'https://n1info.rs/feed/', ['RS'], { lang: 'sr' }),
  news('B92', 'https://www.b92.net/info/rss/vesti.xml', ['RS'], { lang: 'sr' }),
  news('Gazeta Express', 'https://www.gazetaexpress.com/feed/', ['XK'], { lang: 'sq' }),
  news('Telegrafi', 'https://telegrafi.com/feed/', ['XK'], { lang: 'sq' }),
  news('Balkanweb', 'https://www.balkanweb.com/feed/', ['AL'], { lang: 'sq' }),
  news('Malay Mail', 'https://www.malaymail.com/feed/rss/malaysia', ['MY'], { lang: 'en' }),
  news('Free Malaysia Today', 'https://www.freemalaysiatoday.com/feed/', ['MY'], { lang: 'en' }),
  news('Kerr Fatou', 'https://kerrfatou.com/feed/', ['GM'], { lang: 'en' }),
  // --- Küresel (İngilizce): ülke adı başlıkta geçerse ilgili ülkede de gösterilir
  news('BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', ['*']),
  news('Al Jazeera English', 'https://www.aljazeera.com/xml/rss/all.xml', ['*']),
  news('DW English', 'https://rss.dw.com/rdf/rss-en-all', ['*']),
  news('France 24', 'https://www.france24.com/en/rss', ['*']),
  news('The Guardian', 'https://www.theguardian.com/world/rss', ['*']),
  news('Euronews', 'https://www.euronews.com/rss', ['*']),
  news('Sky News World', 'https://feeds.skynews.com/feeds/rss/world.xml', ['*']),
  news('CNN World', 'http://rss.cnn.com/rss/edition_world.rss', ['*']),
  news('NYT World', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', ['*']),
  news('NPR World', 'https://feeds.npr.org/1004/rss.xml', ['*']),
  news('UN News', 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', ['*']),
  news('WHO', 'https://www.who.int/rss-feeds/news-english.xml', ['*'], { topics: ['health'] }),
  news('ScienceDaily', 'https://www.sciencedaily.com/rss/all.xml', ['*'], { topics: ['science'] }),
  news('Nature', 'https://www.nature.com/nature.rss', ['*'], { topics: ['science'] }),
  news('NASA', 'https://www.nasa.gov/rss/dyn/breaking_news.rss', ['*'], { topics: ['science'] }),
  news('Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', ['*'], { topics: ['technology'] }),
  news('The Verge', 'https://www.theverge.com/rss/index.xml', ['*'], { topics: ['technology'] }),
  news('Wired', 'https://www.wired.com/feed/rss', ['*'], { topics: ['technology'] }),
  news('TechCrunch', 'https://techcrunch.com/feed/', ['*'], { topics: ['technology'] }),
  // --- Resmî YouTube haber kanalları (herkese açık, anahtarsız)
  yt('BBC News', 'UC16niRr50-MSBwiO3YDb3RA'),
  yt('Al Jazeera English', 'UCNye-wNBqNL5ZzHSJj3l8Bg'),
  yt('DW News', 'UCknLrEdhRCp1aegoMqRaCZg'),
  yt('FRANCE 24 English', 'UCQfwfsi5VrQ8yKZ-UWmAEFg'),
  yt('Sky News', 'UCoMdktPbSTixAyNGwb-UYkQ'),
  yt('CNN', 'UCupvZG-5ko_eiXAupbDfxWw'),
  yt('euronews', 'UCSrZ3UV4jOidv8ppoVuvW9Q'),
  yt('TRT World', 'UC7fWeaHhqgM4Ry-RMpM2YYw'),
  yt('ABC News', 'UCBi2mrWuNuyYy4gbM6fU18Q'),
];

// Reddit ülke toplulukları (ülke seçiliyken o toplulukta aranır; dünya aramasında tüm Reddit'te).
const SUBREDDITS = {
  TR: 'turkey', US: 'news', GB: 'unitedkingdom', DE: 'germany', FR: 'france', ES: 'spain', IT: 'italy', NL: 'thenetherlands', BR: 'brasil',
  RU: 'russia', JP: 'japan', IN: 'india', CA: 'canada', AU: 'australia', SA: 'saudiarabia', EG: 'egypt', AE: 'dubai', GR: 'greece',
  RS: 'serbia', MY: 'malaysia', AL: 'albania', XK: 'kosovo', MK: 'macedonia', ME: 'montenegro', IR: 'iran', AF: 'afghanistan', GM: 'gambia', TN: 'tunisia',
};

// '*' akışlarında bir haberin hangi ülkeyle ilgili olduğunu başlık/özetteki bu adlardan anlarız.
const COUNTRY_ALIASES = {
  TR: ['Türkiye', 'Turkey', 'Turkiye', 'Turkish', 'Türk'],
  US: ['United States', 'U.S.', 'US', 'USA', 'Washington', 'American', 'Amerika', 'ABD'],
  GB: ['United Kingdom', 'Britain', 'British', 'England', 'Scotland', 'Wales', 'UK', 'London'],
  DE: ['Germany', 'German', 'Deutschland', 'Almanya'],
  FR: ['France', 'French', 'Fransa'],
  ES: ['Spain', 'Spanish', 'España', 'İspanya'],
  IT: ['Italy', 'Italian', 'Italia', 'İtalya'],
  NL: ['Netherlands', 'Dutch', 'Holland', 'Hollanda'],
  BR: ['Brazil', 'Brazilian', 'Brasil', 'Brezilya'],
  RU: ['Russia', 'Russian', 'Rusya', 'Moscow', 'Kremlin'],
  JP: ['Japan', 'Japanese', 'Japonya', 'Tokyo'],
  IN: ['India', 'Indian', 'Hindistan', 'Delhi', 'Mumbai'],
  CA: ['Canada', 'Canadian', 'Kanada'],
  AU: ['Australia', 'Australian', 'Avustralya'],
  SA: ['Saudi', 'Suudi Arabistan', 'Riyadh'],
  EG: ['Egypt', 'Egyptian', 'Mısır', 'Cairo'],
  AE: ['UAE', 'Emirates', 'Dubai', 'Abu Dhabi', 'Birleşik Arap Emirlikleri'],
  GR: ['Greece', 'Greek', 'Yunanistan', 'Athens'],
  RS: ['Serbia', 'Serbian', 'Sırbistan', 'Belgrade'],
  MY: ['Malaysia', 'Malaysian', 'Malezya', 'Kuala Lumpur'],
  AL: ['Albania', 'Albanian', 'Arnavutluk', 'Tirana'],
  XK: ['Kosovo', 'Kosova', 'Pristina', 'Prishtina'],
  MK: ['North Macedonia', 'Macedonia', 'Macedonian', 'Kuzey Makedonya', 'Skopje'],
  ME: ['Montenegro', 'Karadağ', 'Podgorica'],
  IR: ['Iran', 'Iranian', 'İran', 'Tehran'],
  AF: ['Afghanistan', 'Afghan', 'Afganistan', 'Kabul', 'Taliban'],
  GM: ['Gambia', 'Gambian', 'Gambiya', 'Banjul'],
  TN: ['Tunisia', 'Tunisian', 'Tunus', 'Tunis'],
};

// Başlıkta geçerse haberin "başka bir ülkeyi/bölgeyi konu aldığını" gösteren adlar. Ülke seçiliyken başlığı yalnızca
// bunlardan birini içeren ve seçilen ülkeyi hiç anmayan haberler gizlenir (listedeki 27 ülkenin takma adlarına ek olarak).
const OTHER_PLACES = [
  ['Ukrayna', 'Ukraine', 'Ukrainian', 'Kyiv', 'Kiev'], ['Gazze', 'Gaza', 'Hamas'], ['İsrail', 'Israel', 'Israeli'],
  ['Çin', 'China', 'Chinese', 'Beijing'], ['Suriye', 'Syria', 'Syrian', 'Damascus'], ['Irak', 'Iraq', 'Iraqi', 'Baghdad'],
  ['Pakistan', 'Pakistani', 'Islamabad'], ['Yemen', 'Yemeni'], ['Sudan', 'Sudanese', 'Khartoum'], ['Lübnan', 'Lebanon', 'Lebanese', 'Beirut'],
  ['Kuzey Kore', 'North Korea', 'Pyongyang'], ['Tayvan', 'Taiwan', 'Taipei'], ['Myanmar', 'Burma'], ['Venezuela', 'Caracas'],
  ['Küba', 'Cuba', 'Havana'], ['Meksika', 'Mexico', 'Mexican'], ['Nijerya', 'Nigeria'], ['Etiyopya', 'Ethiopia'], ['Somali', 'Somalia'],
  ['Libya', 'Libyan', 'Tripoli'], ['Ürdün', 'Jordan', 'Amman'], ['Katar', 'Qatar', 'Doha'], ['Azerbaycan', 'Azerbaijan', 'Baku'],
  ['Ermenistan', 'Armenia', 'Yerevan'], ['Gürcistan', 'Georgia', 'Tbilisi'], ['Kazakistan', 'Kazakhstan'], ['Bangladeş', 'Bangladesh'],
  ['Endonezya', 'Indonesia', 'Jakarta'], ['Filipinler', 'Philippines', 'Manila'], ['Vietnam'], ['Tayland', 'Thailand', 'Bangkok'],
  ['Güney Kore', 'South Korea', 'Seoul'], ['Polonya', 'Poland', 'Warsaw'], ['Romanya', 'Romania'], ['Bulgaristan', 'Bulgaria'],
  ['Hırvatistan', 'Croatia'], ['Bosna', 'Bosnia'], ['Kıbrıs', 'Cyprus'], ['Güney Afrika', 'South Africa'], ['Arjantin', 'Argentina'],
];

// Dağıtımda akış eklemek için: EXTRA_FEEDS='[{"name":"...","url":"https://...","kind":"social","countries":["TR"]}]'
function loadFeeds(env = process.env) {
  let extra = [];
  if (env.EXTRA_FEEDS) {
    try { extra = JSON.parse(env.EXTRA_FEEDS); } catch { console.error('EXTRA_FEEDS geçerli JSON değil, yok sayıldı.'); }
  }
  const valid = (f) => f && typeof f.name === 'string' && /^https?:\/\//i.test(f.url) && ['news', 'social'].includes(f.kind) &&
    Array.isArray(f.countries) && f.countries.length && (f.topics === undefined || Array.isArray(f.topics));
  return [...FEEDS, ...(Array.isArray(extra) ? extra : [])].filter(valid);
}

module.exports = { FEEDS, COUNTRY_ALIASES, OTHER_PLACES, SUBREDDITS, loadFeeds };
