# Haber Atlası

Ülke, şehir ve konu seçerek o alandaki **güncel ve geçmiş** haberleri gösteren küçük bir web uygulaması.
Tek bağımlılık `@anthropic-ai/sdk` (isteğe bağlı Claude çevirisi için); Node.js 20+ gerekir.

```sh
cd news-explorer
npm install
npm start            # http://127.0.0.1:3000
npm test             # sahte haber kaynağıyla uçtan uca testler
```

`PORT` ve `HOST` ortam değişkenleriyle adres değiştirilebilir (varsayılan: `127.0.0.1:3000`).

## Türkçe çeviri

Sonuçların üstündeki **Orijinal dil | Türkçe** düğmesi başlıkları Türkçeye çevirir; çeviri açıkken orijinal başlık
her haberin altında kalır. Türkiye seçiliyken düğme görünmez. Yalnızca başlıklar çevrilir, haber metinleri değil.

İki çeviri servisi vardır, sunucu hangisini kullanacağını kendisi seçer:

| | Ücretsiz (varsayılan) | Claude API |
|---|---|---|
| Ne zaman | `ANTHROPIC_API_KEY` yoksa | `ANTHROPIC_API_KEY` varsa |
| Servis | [MyMemory](https://mymemory.translated.net) | Anthropic Claude |
| Maliyet | Ücretsiz | Kullandıkça öder |
| Kota | Günde ~4.500 karakter (~60 başlık); `MYMEMORY_EMAIL` verilirse ~45.000 | `TRANSLATE_DAILY_LIMIT` (varsayılan 2000 başlık) |
| Kalite | Basit, bazen hatalı | Yüksek |

Ücretsiz serviste kota dolarsa çevrilebilen başlıklar çevrilir, kalanı orijinal dilinde kalır ve ekranda uyarı çıkar.
Kota sunucunun IP adresine bağlı olabilir; ortak IP kullanan barındırma servislerinde başkalarıyla paylaşılabilir.

| Değişken | Anlamı |
|---|---|
| `MYMEMORY_EMAIL` | İsteğe bağlı. Geçerli bir e-posta verilirse MyMemory günlük kotayı büyütür. |
| `MYMEMORY_DAILY_CHARS` | İsteğe bağlı. Günlük karakter sınırını elle ayarlar. |
| `ANTHROPIC_API_KEY` | İsteğe bağlı. [console.anthropic.com](https://console.anthropic.com) anahtarı; verilirse Claude kullanılır. |
| `TRANSLATE_MODEL` | İsteğe bağlı. Claude modeli, varsayılan `claude-opus-5-5`. Çok daha ucuz: `claude-haiku-5-5`. |
| `TRANSLATE_DAILY_LIMIT` | İsteğe bağlı. Claude için günlük en fazla benzersiz başlık sayısı. |

- Claude'da başlıklar 40'lık gruplar halinde çevrilir ve talimat değil, çevrilecek veri olarak JSON içinde gönderilir.
- Aynı başlık tekrar çevrilmez (bellekte önbelleklenir). Sayaç ve önbellek sunucu yeniden başlayınca sıfırlanır.
- Render'da değişken eklemek: servis → **Environment** → **Add Environment Variable**.
  Cloudflare'de: `npx wrangler secret put ANTHROPIC_API_KEY`.
- Tarayıcının yerleşik çeviri API'si (Chrome masaüstü) kullanılmıyor; telefonlarda çalışmadığı için.

## Hangi sürüm yayında?

Sayfanın en altında **Sürüm xxxxxxx** yazar (Render'da commit numarası). Yeni bir özelliği göremiyorsan bu numarayı GitHub'daki son
commit ile karşılaştır; farklıysa Render'da **Manual Deploy → Deploy latest commit** de. `/api/diagnose` raporunun başlığında da sürüm yazar.

## Yayına alma: en kolay yol (Render, terminal gerekmez)

1. [render.com](https://render.com) hesabı aç, **New → Web Service**, GitHub'ı bağla ve bu depoyu seç.
2. Ayarlar: **Branch** `claude/news-explorer` (ya da birleştirdiğin dal), **Root Directory** `news-explorer`,
   **Runtime** Node, **Build Command** `npm install`, **Start Command** `node server.js`, **Instance Type** Free.
3. **Deploy**'a bas. Birkaç dakika sonra `https://<ad>.onrender.com` adresi hazır olur.

Ücretsiz serviste 15 dakika kullanılmazsa uygulama uyur, ilk açılış yaklaşık bir dakika sürer.

## Yayına alma (Cloudflare Workers)

Aynı kod Cloudflare Workers üzerinde de çalışır: `public/` statik dosya olarak, `/api/*` ise `worker.mjs` ile sunulur.
Ücretsiz Cloudflare hesabı yeterlidir.

```sh
cd news-explorer
npx wrangler login      # tarayıcıda Cloudflare hesabına giriş
npx wrangler deploy     # https://haber-atlasi.<hesabınız>.workers.dev
```

Yerelde denemek için `npm run dev:worker` (http://127.0.0.1:8787).
Depoyu Cloudflare panelinden bağlamak istersen (Workers Builds) kök dizin olarak `news-explorer` seç;
deploy komutu `npx wrangler deploy` olur.

Notlar:

- Önbellek Cloudflare Cache API ile veri merkezi başına 10 dakika tutulur; sık aranan sorgular Google'a tekrar gitmez.
- Ücretsiz planda bir isteğin CPU süresi kısadır (10 ms). Uzun dönemli (12 parçalı) ilk aramalar bu sınıra yaklaşabilir;
  hata görürsen Workers Paid planına geç ya da en uzun dönemi "Son 1 yıl" ile sınırla.
- Google Haberler'e giden istekler Cloudflare'in IP'lerinden yapılır; Google bazen bu IP'lere kısıtlama uygulayabilir.
  Sık hata görürsen sonuçların altındaki kaynak özetine bak; hatalı kaynağı kapatabilir ya da başka bir kaynak ekleyebilirsin (bkz. Genişletme).

## Son dakika

Üstteki **🔴 Son dakika** sekmesi seçilen ülkenin ya da **tüm dünyanın** son 1 / 3 / 6 / 24 saatteki haberlerini gösterir.

- Google Haberler'de `when:` operatörüyle son N saat, ayrıca sürümün "öne çıkan haberleri" (konu/şehir/kelime yoksa); Bing son 1/24 saat;
  tüm yayıncı akışları. GDELT (hız sınırı), Mastodon, Reddit ve Hacker News bu sekmede kullanılmaz.
- **Otomatik yenileme** 90 saniyede bir (kutudan kapatılır); sekme gizliyken beklenir. Yenilemede ilk kez görünen haberler **YENİ** etiketi alır.
- Konu, şehir ve anahtar kelime burada da çalışır ("son dakika spor", "son dakika İstanbul").
- Sunucu son dakika yanıtını 1 dakika önbellekte tutur (`BREAKING_CACHE_SECONDS` ile değişir; `0` = önbellek yok).

## Haberleri aynı olay altında toplama

Son dakika ve Maarif sekmelerinde (ve Arama'da `cluster=1` ile) başlıkları birbirine çok benzeyen haberler **tek habere** toplanır.
Her haberde **"N kaynakta"** etiketi ve aynı haberi veren diğer kaynakların bağlantıları ("Aynı haber: Sabah, BBC Türkçe") görünür; sıralamada
**"En çok kaynakta yer alan"** seçilebilir. Bir haberin birbirinden bağımsız birden çok kaynakta çıkması, tek kaynağa göre daha güçlü bir işarettir
ama doğruluğun kanıtı değildir: kaynaklar aynı ajanstan (AA, Reuters…) beslenmiş olabilir ve sosyal medya ayrı sayılır.
Karşılaştırma yalnızca aynı dildeki başlıklar arasında yapılır. Bağlantılardaki izleme parametreleri (`utm_*`, `fbclid`…), `#` parçası ve
`www`/`m` farkı atılarak aynı haberin iki kez görünmesi engellenir.

## Türkiye Maarif Vakfı bölümü

**🎓 Maarif Vakfı** sekmesi, vakfın adını **30 dilde** (Türkçe, İngilizce, Arapça, Fransızca, Rusça, Arnavutça, Makedonca, Farsça, Azerice, Özbekçe,
Endonezce, Japonca, Çince… `data/maarif.js`) tüm dünyada arar. Dönem seçilir (varsayılan son 30 gün, 5 yıla kadar).

- Google Haberler'de 18 yayın sürümü (Türkiye, İngiltere, ABD, Fransa, Suudi Arabistan, Mısır, Rusya, Almanya, Pakistan, Nijerya, Endonezya,
  Fas, Arnavutluk, Kosova, Makedonya, Bosna-Hersek, Azerbaycan, Kazakistan) kendi dillerindeki adlarla ayrı sorgulanır.
- GDELT ve Bing farklı yazı sistemlerini kapsayan kısa bir ad listesiyle, Mastodon `#maarif` benzeri etiketlerle taranır.
- Yayıncı ve sosyal akışlarda yalnızca vakıftan söz eden haberler alınır. Tam ad ya da "maarif" + Türkiye işareti gerekir; böylece Endonezya'daki
  "Ma'arif NU" gibi ilgisiz kurumlar elenir.
- Aranan adlar sekmedeki "Aranan adlar" kutusunda görünür. Eksik bir yazım varsa `data/maarif.js` içindeki `NAMES` listesine ekle.
- Kendi hesaplarını (vakfın resmî sosyal medya/YouTube hesapları) izlemek için `EXTRA_FEEDS` ile RSS adresini ekleyebilirsin (aşağıya bak).
- Adların çevirileri benim yazdığım translitere edilmiş biçimlerdir; resmî yazımlardan farklı olabilirler.

## Ülkeler

Listede **65 ülke** var: Türkiye'nin komşuları ve yakın temasta olduğu ülkeler dahil (Azerbaycan, Gürcistan, Ermenistan, Irak, Suriye, Bulgaristan, Yunanistan,
Kıbrıs, İran, Ukrayna, Romanya, Bosna-Hersek, Hırvatistan, Kazakistan, Özbekistan, Türkmenistan, Kırgızistan, Tacikistan, Lübnan, Ürdün, İsrail, Filistin, Katar, Kuveyt,
Libya, Cezayir, Fas, Tunus, Sudan, Somali, Etiyopya, Kenya, Gana, Nijerya, Senegal, Gambiya, Pakistan, Afganistan, Bangladeş, Endonezya, Malezya, Güney Kore, Çin…),
Balkan ülkeleri ve büyük batı ülkeleri. Her ülke için şehir listesi, ülkenin dilinde konu terimleri (21 dil) ve mümkünse yerel yayıncı akışları vardır.
Google Haberler'de ayrı sürümü olmayan ülkelerde ("yaklaşık" uyarısı çıkan) arama yerel adla yapılır, sonuçlar daha az olabilir.
Yeni ülke eklemek için `data/meta.js` (ülke), `data/feeds.js` (takma adlar, akışlar) dosyalarına bak.

## Dünya geneli arama

Ülke listesinin başındaki **🌍 Tüm dünya** seçeneği tek bir ülkeye bağlı kalmadan arar. Bir **konu** seç (ör. Eğitim) ya da
**anahtar kelime / isim** yaz. İkisi de boşsa 10 ülkenin genel haberleri gelir.

- **Google Haberler:** 10 yayın sürümü (ABD, İngiltere, Türkiye, Almanya, Fransa, İspanya, Brezilya, Rusya, Suudi Arabistan, Japonya)
  ayrı ayrı sorgulanır; konu terimleri her sürümün kendi dilindedir. Çok uzun aralıklar bu modda en fazla 3 döneme bölünür.
- **GDELT / Bing:** ülke filtresi olmadan, konu terimleri İngilizce. GDELT'in İngilizce sorguyu başka dillerdeki haberlerle
  eşleştirdiği doğrulanmadı.
- **Yayıncı ve sosyal medya akışları:** hepsi taranır; her akış kendi dilindeki terimlerle aranır.
- **İsim aratırken** yazımı olduğu gibi aranır; farklı yazımları `OR` ile ekle: `Erdoğan OR Erdogan`. Başka alfabelerdeki yazımı
  (ör. `Путин`) da ekleyebilirsin.
- Sonuçlar ülkeye göre süzülebilir (rozet ve liste). Çeviri her haberi kendi dilinden Türkçeye çevirir.
- **Render önerilir.** Cloudflare Workers ücretsiz planında bir istekte en fazla 50 dış çağrı yapılabilir; yüzlerce akış ve dünya araması bu sınırı aşar (ücretli planda 1000).

## Konu süzgeci

Arama kaynakları kelimeleri haberin gövdesinde de arar; "eğitim" kelimesi spor ya da teknoloji haberlerinde de geçer
(antrenman eğitimi, yapay zeka eğitimi). Bu yüzden konu seçiliyken her başlık 9 dilde (`data/lexicon.js`, 1.600+ terim) tüm
konularla puanlanır ve **seçilen konuya, başka herhangi bir konudan daha az uyan başlık gizlenir**.
Örnek: "Üniversite takımı şampiyon oldu" Eğitim aramasında gizlenir, Spor aramasında kalır.

- Kutuyu kapatırsan (**Seçilen konuyla ilgisiz başlıkları gizle**) hepsi görünür; kaç haberin gizlendiği ve **Göster** düğmesi çıkar.
- Konuya özel akıştan (ör. BBC Education) gelen haber zaten o konuya aittir, süzülmez.
- Sözlüğü zayıf dillerde (Korece, Hollandaca…) karar verilemez, başlık elenmez.
- Süzgeç başlığa bakar; başlığında hiçbir konu sözcüğü geçmeyen alakalı bir haber de elenebilir. Sözlüğü `data/lexicon.js`'te genişletebilirsin.

## Ülke seçiliyken yalnızca o ülkeyle ilgili haberler

Bir ülke seçip konu, şehir ve kelime vermezsen uygulama artık ülke **adını** aramaz; ülkenin dilindeki genel terimleri arar.
(Eskiden "United States" aranıyordu ve bu, adı geçen her haberi getiriyordu: ABD'yi anan Afganistan haberleri dahil.)

Ayrıca varsayılan olarak açık bir süzgeç vardır: **Başka ülkeleri konu alan başlıkları gizle**. Başlığı başka bir ülkeyi ya da bölgeyi
(Afganistan, Ukrayna, Gazze…) konu alan ve seçilen ülkeyi ya da şehirlerini hiç anmayan haberler gizlenir; kaç haberin gizlendiği ve
**Göster** düğmesi sonuçların üstünde görünür. Süzgeç bir sezgidir: yalnızca başlığa bakar, "İran'a ihracat arttı" gibi yerel haberleri de
gizleyebilir. Gerekirse kutuyu kapat.

## Hız ve zaman sınırları

Bir arama onlarca kaynağa gider; yavaş bir kaynak diğerlerini bekletmesin diye:

- **Her kaynağın zaman sınırı var** (Google 15 sn, GDELT 12 sn, Bing 10 sn, akışlar 16 sn, Mastodon 12 sn, Reddit/HN 8 sn). Süresi dolan kaynak hata olarak
  işaretlenir, diğerlerinin sonuçları gösterilir.
- **Sonuçlar akış halinde gelir** (`/api/news?stream=1`, satır satır JSON): ilk biten kaynağın haberleri hemen görünür, bekleyen kaynaklar
  "Bing Haberler …" diye işaretlenir. Hiçbir şey gelmezse geçen süre yazılır; tarayıcı 60 sn sonra bekleyişi bırakır ve o ana kadar gelenleri korur.
- **GDELT hızlı pes eder:** aynı anda tek istek, 429'da (Retry-After vermiyorsa) yeniden denemez ve 2 dakika yeni istek göndermez
  (sınırlamayı uzatmamak için), aynı sorgu 20 dakika önbellekten gelir.
- **Akışlar bellekten gelir:** bir akış 5 dakikada bir arkada yenilenir; eski kayıt bile (3 saate kadar) anında sunulur. Bozuk akış 5 dakika
  yeniden denenmez. Sunucu açılırken akışlar arka planda ısıtılır (`WARM_FEEDS=0` ile kapatılır).
- Süzgeçler (ülke, konu) başlık başına ~0,08 ms'dir; regex'ler ve normalleştirmeler bir kez derlenip bellekte tutulur.
- Sonuçların altındaki kaynak özeti 6 saniyeden yavaş yanıt veren kaynakları yazar; `/api/diagnose` her kaynağın süresini gösterir.
- **Render ücretsiz planı** 15 dakika kullanılmayınca uyur; ilk açılış bir dakikaya kadar sürebilir. Çok sayıda akış ve işlemci yavaş olduğundan,
  gerekirse kaynak kutularından kullanmadıklarını kapat ya da ücretli bir plana geç.

## Haber kaynakları

Aynı arama birden çok kaynakta paralel çalışır; sonuçlar birleştirilir, tekrarlar tek satıra indirilir (`+2 kaynakta daha`).
Formdaki **Kaynaklar** kutularıyla istediğin kaynakları aç/kapat. Sonuçların altında her kaynağın kaç haber verdiği,
hangisinin hata verdiği görünür; biri bozulsa diğerleri çalışmaya devam eder.

| Kaynak | Kapsam | Not |
|---|---|---|
| **Google Haberler** | Geçmiş ve güncel. Uzun aralıklar 12 döneme bölünür | Resmî API değil. Bazı ülkelerde ayrı sürümü yok |
| **GDELT** | Son ~3 ay. Yayıncının ülkesine göre | **Varsayılan kapalı**: canlıda ~19 sn sürdü ve Türkçe sorguda 0 sonuç verdi. Sorgu artık hep İngilizce terimlerle (GDELT çeviri metnini arıyor gibi); elle açılır. Anahtarsız. Hız sınırı uygular: istekler tek sıradan en az 5 sn arayla gider, aynı sorgu 20 dk önbellekten gelir, 429'da bekleyip en fazla 3 kez dener. Paylaşılan barındırma adreslerinde yine de geçici olarak sınırlanabilir |
| **Bing Haberler** | Son 30 gün | Resmî olmayan RSS. Sorgu başına az sonuç verir |
| **Yayıncı akışları** | Güncel (son günler) | `data/feeds.js` içinde ~150 RSS: ülke yayıncıları, konu bölümleri (BBC Education, NYT Education, Hechinger…), küresel yayıncılar |
| **Sosyal medya hesapları** | Güncel | Varsayılan liste boş (YouTube akışları Render'dan 404 verdi); senin eklediğin Mastodon/Bluesky/YouTube hesapları. Hesap eklemeyince kutu görünmez |
| **Mastodon** | Güncel (son ~30 gün) | Konu, şehir ve kelimelerden türetilen etiketler (#eğitim, #istanbul) için herkese açık RSS; 5 büyük sunucu (`MASTODON_INSTANCES` ile değiştirilir) |
| **Reddit** | Son 7 gün – tüm zamanlar | **Varsayılan kapalı.** Reddit bulut sunucularını (Render dahil) 429 ile engeller; denemek için kutuyu işaretle |
| **Hacker News** | Geçmiş ve güncel | Resmî anahtarsız Algolia API'si; yalnızca teknoloji/bilim konularında ve kelime aramalarında |

Bir kaynağı tümden kapatmak (listeden de kaldırmak) için `DISABLED_SOURCES=reddit,hn` gibi bir ortam değişkeni ver.
Sitelerin bot engeli (403) koyduğu akışlar listeden çıkarıldı; engeli aşmaya çalışılmaz. YouTube akışları aynı anda çok istek gelince reddedebilir;
bu yüzden aynı sunucuya en fazla 3 eşzamanlı istek yapılır.

Varsayılan akış adreslerini geliştirme ortamından **doğrulayamadım**: bazıları değişmiş ya da kapanmış olabilir. Bozuk bir akış
diğerlerini etkilemez; sonuçların altında hangilerinin alınamadığı yazar. Hangileri bozuk, görmek için
**`/api/diagnose?feeds=1`** adresini aç (her kaynağı ve her akışı ayrı ayrı dener).

Sosyal medya doğrulanmamış içeriktir; bu yüzden ayrı etiketle gösterilir ve ayrı süzülebilir. Resmî ve doğrulanmış hesapları seç.
Facebook, Instagram, TikTok ve X için ücretsiz, herkese açık bir arama/akış yolu yoktur; bu yüzden desteklenmez.

### Akış / hesap eklemek

Hepsi RSS ya da Atom adresidir:

| Tür | Adres biçimi |
|---|---|
| Mastodon hesabı | `https://<sunucu>/@<hesap>.rss` |
| Bluesky hesabı | `https://bsky.app/profile/<hesap>/rss` |
| YouTube kanalı | `https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>` |
| Yayıncı | Sitenin RSS adresi |

`data/feeds.js` dosyasına ekle ya da kodu değiştirmeden `EXTRA_FEEDS` ortam değişkeniyle (JSON) ver:

```
EXTRA_FEEDS=[{"name":"Hesabın adı","url":"https://mastodon.social/@hesap.rss","kind":"social","countries":["TR"]}]
```

`kind`: `news` ya da `social`. `countries`: gösterileceği ülke kodları; `["*"]` her ülkede, ama başlıkta ülke ya da şehir adı geçmesi gerekir.
Sunucu yalnızca bu listedeki adreslere gider (kullanıcıdan adres alınmaz).

## Nasıl çalışır?

- `server.js` (Node) ya da `worker.mjs` (Cloudflare) kaynakları çağırır, sonuçları JSON'a çevirir ve 10 dakika önbellekte tutar.
  Ortak mantık `lib/news.js`, her kaynak `lib/providers/` altındadır.
- **Ülke** seçimi Google Haberler'in ilgili ülke/dil sürümünü, GDELT'te yayıncı ülkesini (FIPS kodu) seçer.
- **Şehir** sorguya tırnaklı eklenir; listede yoksa "Başka şehir…" ile serbest yazılır. `a / b` yazımı iki yazımı da arar.
- **Konu**, o ülkenin diline çevrilmiş anahtar kelimelerle `OR` sorgusuna dönüşür
  (ör. Eğitim → `eğitim OR okul OR üniversite OR öğretmen`). Anahtar kelime alanı sorguyu daraltır.
- **Geçmiş haberler** için Google'da `after:`/`before:` tarih operatörleri kullanılır. Google tek sorguda en fazla ~100 sonuç
  verdiğinden, 62 günden uzun aralıklar en fazla 12 eşit döneme bölünür. Üstteki zaman çizelgesinden bir döneme odaklanılır.
- Seçimler adres çubuğuna yazılır; bağlantı paylaşılınca aynı arama otomatik açılır.

## Genişletme

- Yeni ülke: `data/meta.js` içindeki `COUNTRIES` listesine `hl`/`ceid` değerleriyle ekle.
- Yeni konu: `TOPICS` ve `TOPIC_TERMS` içine ekle (dili olmayan ülkeler İngilizce terimlere düşer).
- Yeni bir kaynak (ör. NewsAPI): `lib/providers/` altına `id`, `label`, `kind`, `skip(ctx, deps)` ve `fetch(ctx, deps)` olan bir modül yaz, `lib/providers/index.js` listesine ekle.

## Sınırlar

- Google Haberler, Bing ve GDELT'in kullandığım uçları resmî/garantili API değildir; biçim ya da erişim kuralları değişebilir. Hiçbirini canlıda denemedim: ilk kullanımda hangi kaynağın çalıştığı sonuçların altındaki kaynak özetinde görünür.
- Eski haberlerin bağlantıları yayıncı tarafından kaldırılmış olabilir.
- Arnavutluk, Kosova, Kuzey Makedonya, Karadağ, İran, Afganistan, Tunus ve Gambiya için Google Haberler'de ayrı bir sürüm
  olmayabilir (`data/meta.js` içinde `approximate: true`). Bu ülkelerde arama yerel dildeki terimlerle ve ülke adıyla yapılır;
  sonuçlar az ya da eksik olabilir. Bu sürümleri canlıda denemedim.
- Şehir, sorguda geçen bir kelimedir (konum filtresi değil): şehir adı geçen haberler gelir.
