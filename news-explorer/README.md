# Haber Atlası

Ülke, şehir ve konu seçerek o alandaki **güncel ve geçmiş** haberleri gösteren küçük bir web uygulaması.
Bağımlılık yok: yalnızca Node.js 20+ gerekir.

```sh
cd news-explorer
npm start            # http://127.0.0.1:3000
npm test             # sahte haber kaynağıyla uçtan uca testler
```

`PORT` ve `HOST` ortam değişkenleriyle adres değiştirilebilir (varsayılan: `127.0.0.1:3000`).

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
  Sık hata görürsen `fetchWindow` içindeki kaynağı değiştir (bkz. Genişletme).

## Nasıl çalışır?

- Haberler **Google Haberler RSS** akışından gelir (anahtar gerekmez). Tarayıcı doğrudan çağıramadığı için
  `server.js` (Node) ya da `worker.mjs` (Cloudflare) isteği vekil olarak yapar, RSS'i JSON'a çevirir ve 10 dakika önbellekte tutar. Ortak mantık `lib/news.js` içindedir.
- **Ülke** seçimi Google Haberler'in ilgili ülke/dil sürümünü seçer (`data/meta.js`).
- **Şehir** sorguya tırnaklı eklenir; listede yoksa "Başka şehir…" ile serbest yazılır.
- **Konu**, o ülkenin diline çevrilmiş anahtar kelimelerle `OR` sorgusuna dönüşür
  (ör. Eğitim → `eğitim OR okul OR üniversite OR öğretmen`). Anahtar kelime alanı sorguyu daraltır.
- **Geçmiş haberler** için `after:`/`before:` tarih operatörleri kullanılır. Google tek sorguda en fazla ~100 sonuç
  verdiğinden, 62 günden uzun aralıklar en fazla 12 eşit döneme bölünür ve her dönemin öne çıkan haberleri
  paralel çekilir. Üstteki zaman çizelgesindeki çubuğa tıklayarak tek bir döneme odaklanılır.
- Seçimler adres çubuğuna yazılır; bağlantı paylaşılınca aynı arama otomatik açılır.

## Genişletme

- Yeni ülke: `data/meta.js` içindeki `COUNTRIES` listesine `hl`/`ceid` değerleriyle ekle.
- Yeni konu: `TOPICS` ve `TOPIC_TERMS` içine ekle (dili olmayan ülkeler İngilizce terimlere düşer).
- Farklı bir kaynak (ör. GDELT, NewsAPI) için yalnızca `lib/news.js` içindeki `fetchWindow` değiştirilir.

## Sınırlar

- Google Haberler resmi bir API değildir; biçimi veya erişim kuralları değişebilir.
- Eski haberlerin bağlantıları yayıncı tarafından kaldırılmış olabilir.
- Şehir, sorguda geçen bir kelimedir (konum filtresi değil): şehir adı geçen haberler gelir.
