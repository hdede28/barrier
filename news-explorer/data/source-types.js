'use strict';

// Kaynakların sahiplik/finansman türü. Bu bir GÜVENİLİRLİK PUANI DEĞİLDİR: yalnızca kaynağın kim tarafından işletildiğini
// söyleyen olgusal bir etikettir. Bilinmeyen kaynağa etiket verilmez. Yeni kaynak eklemek için SOURCES listesine satır ekle.
const TYPES = {
  agency: { label: 'Haber ajansı', note: 'Haberleri birçok yayına satan ya da dağıtan ajans: aynı metin pek çok kaynakta görünebilir.' },
  public: { label: 'Kamu yayıncısı', note: 'Kamu kaynaklarıyla (vergi, lisans bedeli) finanse edilen yayın kuruluşu.' },
  state: { label: 'Devlete ait/finansmanlı', note: 'Sahibi ya da ana finansörü bir devlet.' },
  official: { label: 'Resmî/uluslararası kurum', note: 'Kurumun kendi yayını ya da açıklaması.' },
  factcheck: { label: 'Doğrulama kuruluşu', note: 'Bilgi doğrulama (fact-check) yayını yapan kuruluş.' },
};

// match: kaynak adında (küçük harf, aksansız) aranan desen. brand: aynı yayıncı ailesini tek sayar (BBC News + BBC Türkçe = BBC).
// İlk eşleşen satır geçerli olduğundan daha özel satırlar (ör. doğrulama kuruluşları) üstte durur.
const SOURCES = [
  // Doğrulama kuruluşları
  { match: /teyit|dogruluk payi|malumatfurus|snopes|politifact|factcheck|fact check|full fact|africa check|lead stories|euvsdisinfo|maldita|newtral|decodeurs|correctiv/, types: ['factcheck'], brand: '' },
  // Haber ajansları
  { match: /^reuters|reuters$/, types: ['agency'], brand: 'Reuters' },
  { match: /^ap$|associated press|^ap news/, types: ['agency'], brand: 'AP' },
  { match: /^afp$|agence france|afp /, types: ['agency'], brand: 'AFP' },
  { match: /anadolu|^aa$|^aa /, types: ['agency', 'state'], brand: 'AA' },
  { match: /^ansa/, types: ['agency'], brand: 'ANSA' },
  { match: /^tass|^tacc|тасс/, types: ['agency', 'state'], brand: 'TASS' },
  { match: /xinhua|新华/, types: ['agency', 'state'], brand: 'Xinhua' },
  { match: /yonhap/, types: ['agency'], brand: 'Yonhap' },
  { match: /^antara/, types: ['agency', 'state'], brand: 'Antara' },
  { match: /^bernama/, types: ['agency', 'state'], brand: 'Bernama' },
  { match: /^kyodo/, types: ['agency'], brand: 'Kyodo' },
  { match: /^efe$|agencia efe/, types: ['agency'], brand: 'EFE' },
  { match: /^dpa$|deutsche presse/, types: ['agency'], brand: 'dpa' },
  { match: /haber ajans|news agency|nachrichtenagentur|agence de presse/, types: ['agency'], brand: '' },
  // Kamu yayıncıları
  { match: /^bbc/, types: ['public'], brand: 'BBC' },
  { match: /^dw|deutsche welle/, types: ['public'], brand: 'DW' },
  { match: /^npr/, types: ['public'], brand: 'NPR' },
  { match: /^pbs/, types: ['public'], brand: 'PBS' },
  { match: /^nhk/, types: ['public'], brand: 'NHK' },
  { match: /abc australia|abc \(australia\)|abc\.net\.au/, types: ['public'], brand: 'ABC Australia' },
  { match: /^cbc|radio-canada/, types: ['public'], brand: 'CBC' },
  { match: /^trt/, types: ['public', 'state'], brand: 'TRT' },
  { match: /tagesschau|^ard$|^zdf/, types: ['public'], brand: 'ARD' },
  { match: /franceinfo|france tv|france television|france 24/, types: ['public', 'state'], brand: 'France Médias' },
  { match: /^rtve/, types: ['public'], brand: 'RTVE' },
  { match: /^rai( |$)/, types: ['public'], brand: 'RAI' },
  // Devlete ait / finansmanlı
  { match: /^rt$|russia today/, types: ['state'], brand: 'RT' },
  { match: /sputnik/, types: ['state'], brand: 'Sputnik' },
  { match: /cgtn|china daily/, types: ['state'], brand: 'China Media' },
  { match: /press tv/, types: ['state'], brand: 'Press TV' },
  { match: /al jazeera|الجزيرة/, types: ['state'], brand: 'Al Jazeera' },
  { match: /voice of america|^voa/, types: ['state'], brand: 'VOA' },
  // Resmî / uluslararası kurumlar
  { match: /^un news|united nations|birlesmis milletler|^bm /, types: ['official'], brand: 'BM' },
  { match: /^who$|world health organization|dunya saglik orgutu/, types: ['official'], brand: 'WHO' },
  { match: /^nasa/, types: ['official'], brand: 'NASA' },
  { match: /unesco|^oecd|world bank|^unicef|european commission/, types: ['official'], brand: '' },
  { match: /milli egitim bakanligi|^meb$|^yok$|yuksekogretim kurulu/, types: ['official'], brand: 'MEB-YÖK' },
];

const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').trim();

// "BBC News Türkçe", "BBC UK", "BBC education" -> aynı marka; eşleşme yoksa adın ilk sözcüğü marka sayılır.
const NOISE = /\b(news|haber|haberleri|haberler|turkce|english|world|uk|us|deutsch|edition|tv|gazetesi|online|international|daily|times)\b/g;
function brandOf(name) {
  const f = fold(name || '');
  const hit = SOURCES.find((s) => s.match.test(f));
  if (hit?.brand) return hit.brand;
  const cleaned = f.replace(/\(.*?\)/g, '').replace(NOISE, ' ').replace(/[^a-z0-9Ѐ-ӿ؀-ۿ぀-鿿 ]+/g, ' ').trim();
  return cleaned.split(/\s+/)[0] || f;
}

// -> { types: [...], brand } ya da null (bilinmeyen kaynak: etiket verilmez)
function classifySource(name) {
  if (!name) return null;
  const f = fold(name);
  const hit = SOURCES.find((s) => s.match.test(f));
  return hit ? { types: hit.types, brand: brandOf(name) } : null;
}

module.exports = { TYPES, SOURCES, classifySource, brandOf };
