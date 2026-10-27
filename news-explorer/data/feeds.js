'use strict';

// Doğrudan RSS/Atom akışları. Sunucu yalnızca bu listedeki (ve EXTRA_FEEDS ile eklenen) adreslere gider;
// kullanıcıdan adres alınmaz.
//
//   name       Haberin kaynağı olarak gösterilen ad
//   url        RSS / RDF / Atom adresi
//   kind       'news' (yayıncı) ya da 'social' (herkese açık sosyal medya hesabı)
//   lang       İsteğe bağlı. Akışın dili (çeviri için); verilmezse ülkenin dili, '*' akışlarda İngilizce
//   countries  ['TR', ...] yalnızca o ülkelerde gösterilir; '*' tüm ülkelerde, ama başlıkta ülke/şehir adı geçmesi gerekir
//
// Sosyal medya hesabı eklemek için (hepsi herkese açık, anahtarsız RSS verir):
//   Mastodon  https://<sunucu>/@<hesap>.rss
//   Bluesky   https://bsky.app/profile/<hesap>/rss
//   YouTube   https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>
// Hangi hesaplara güveneceğine sen karar ver; resmî ve doğrulanmış hesapları tercih et.
const FEEDS = [
  { name: 'BBC News Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml', kind: 'news', countries: ['TR'] },
  { name: 'DW Türkçe', url: 'https://rss.dw.com/rdf/rss-tur-all', kind: 'news', countries: ['TR'] },
  { name: 'Anadolu Ajansı', url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel', kind: 'news', countries: ['TR'] },
  { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', kind: 'news', countries: ['US'] },
  { name: 'Tagesschau', url: 'https://www.tagesschau.de/index~rss2.xml', kind: 'news', countries: ['DE'] },
  { name: 'NHK', url: 'https://www3.nhk.or.jp/rss/news/cat0.xml', kind: 'news', countries: ['JP'] },
  { name: 'Balkan Insight', url: 'https://balkaninsight.com/feed/', kind: 'news', lang: 'en', countries: ['AL', 'XK', 'MK', 'RS', 'ME', 'GR'] },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', kind: 'news', countries: ['*'] },
  { name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml', kind: 'news', countries: ['*'] },
  { name: 'DW English', url: 'https://rss.dw.com/rdf/rss-en-all', kind: 'news', countries: ['*'] },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', kind: 'news', countries: ['*'] },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', kind: 'news', countries: ['*'] },
];

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
    Array.isArray(f.countries) && f.countries.length;
  return [...FEEDS, ...(Array.isArray(extra) ? extra : [])].filter(valid);
}

module.exports = { FEEDS, COUNTRY_ALIASES, OTHER_PLACES, loadFeeds };
