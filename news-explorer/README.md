# Haber Atlası

Ülke, şehir ve konu seçerek o alandaki **güncel ve geçmiş** haberleri gösteren küçük bir web uygulaması.
Bağımlılık yok: yalnızca Node.js 20+ gerekir.

```sh
cd news-explorer
npm start            # http://127.0.0.1:3000
npm test             # sahte haber kaynağıyla uçtan uca testler
```

`PORT` ve `HOST` ortam değişkenleriyle adres değiştirilebilir (varsayılan: `127.0.0.1:3000`).

## Nasıl çalışır?

- Haberler **Google Haberler RSS** akışından gelir (anahtar gerekmez). Tarayıcı doğrudan çağıramadığı için
  `server.js` isteği vekil olarak yapar, RSS'i JSON'a çevirir ve 10 dakika önbellekte tutar.
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
- Farklı bir kaynak (ör. GDELT, NewsAPI) için yalnızca `server.js` içindeki `fetchWindow` değiştirilir.

## Sınırlar

- Google Haberler resmi bir API değildir; biçimi veya erişim kuralları değişebilir.
- Eski haberlerin bağlantıları yayıncı tarafından kaldırılmış olabilir.
- Şehir, sorguda geçen bir kelimedir (konum filtresi değil): şehir adı geçen haberler gelir.
