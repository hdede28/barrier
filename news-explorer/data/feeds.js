'use strict';

// Doğrudan RSS/Atom akışları. Sunucu yalnızca bu listedeki (ve EXTRA_FEEDS ile eklenen) adreslere gider;
// kullanıcıdan adres alınmaz.
//
//   name       Haberin kaynağı olarak gösterilen ad
//   url        RSS / RDF / Atom adresi
//   kind       'news' (yayıncı) ya da 'social' (herkese açık sosyal medya hesabı)
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
  { name: 'Balkan Insight', url: 'https://balkaninsight.com/feed/', kind: 'news', countries: ['AL', 'XK', 'MK', 'RS', 'ME', 'GR'] },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', kind: 'news', countries: ['*'] },
  { name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml', kind: 'news', countries: ['*'] },
  { name: 'DW English', url: 'https://rss.dw.com/rdf/rss-en-all', kind: 'news', countries: ['*'] },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', kind: 'news', countries: ['*'] },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', kind: 'news', countries: ['*'] },
];

// '*' akışlarında bir haberin hangi ülkeyle ilgili olduğunu başlık/özetteki bu adlardan anlarız.
const COUNTRY_ALIASES = {
  TR: ['Türkiye', 'Turkey', 'Turkiye', 'Turkish', 'Türk'],
  US: ['United States', 'U.S.', 'Washington', 'American', 'Amerika'],
  GB: ['United Kingdom', 'Britain', 'British', 'England', 'Scotland', 'Wales', 'UK'],
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

module.exports = { FEEDS, COUNTRY_ALIASES, loadFeeds };
