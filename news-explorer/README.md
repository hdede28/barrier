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

## Haber kaynakları

Aynı arama birden çok kaynakta paralel çalışır; sonuçlar birleştirilir, tekrarlar tek satıra indirilir (`+2 kaynakta daha`).
Formdaki **Kaynaklar** kutularıyla istediğin kaynakları aç/kapat. Sonuçların altında her kaynağın kaç haber verdiği,
hangisinin hata verdiği görünür; biri bozulsa diğerleri çalışmaya devam eder.

| Kaynak | Kapsam | Not |
|---|---|---|
| **Google Haberler** | Geçmiş ve güncel. Uzun aralıklar 12 döneme bölünür | Resmî API değil. Bazı ülkelerde ayrı sürümü yok |
| **GDELT** | Son ~3 ay. Yayıncının ülkesine göre, çok dilli | Anahtarsız. Hız sınırı uygular ("5 saniyede bir istek"); bir kez bekleyip yeniden dener |
| **Bing Haberler** | Son 30 gün | Resmî olmayan RSS. Sorgu başına az sonuç verir |
| **Yayıncı akışları** | Güncel (son günler) | `data/feeds.js` içinde ~140 RSS: ülke yayıncıları, konu bölümleri (BBC Education, NYT Education, Hechinger…), küresel yayıncılar |
| **Sosyal medya hesapları** | Güncel | Resmî YouTube haber kanalları (varsayılan) + senin eklediğin Mastodon/Bluesky/YouTube hesapları |
| **Mastodon** | Güncel (son ~30 gün) | Konu, şehir ve kelimelerden türetilen etiketler (#eğitim, #istanbul) için herkese açık RSS; mastodon.social ve journa.host |
| **Reddit** | Son 7 gün – tüm zamanlar | Ülkenin topluluğunda (r/turkey…) arar; dünya aramasında tüm Reddit'te. Bulut sunucularından engellenebilir |
| **Hacker News** | Geçmiş ve güncel | Resmî anahtarsız Algolia API'si; yalnızca teknoloji/bilim konularında ve kelime aramalarında |

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
