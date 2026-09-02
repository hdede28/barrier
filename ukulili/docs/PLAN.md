# Ukulili — Ürün & Teknik Plan

> Marka kararları için → [`brand/BRAND.md`](brand/BRAND.md)

---

## 1. Bağlam

**İhtiyaç:** Ukuleleyi *"çok basit öğrenilebilir bir enstrüman"* olarak
konumlandıran, Türkçe ve İngilizce destekli bir Android uygulaması. İçinde
mikrofonlu akort aleti, akor kütüphanesi, tab/nota destekli şarkı kütüphanesi ve
Kolay / Orta / Zor seviyeli bir öğrenme yolu.

**Mevcut durum:** Bu depo (`hdede28/barrier`) aslında Barrier (C++ KVM
yazılımı) projesi — ukulele uygulamasıyla hiçbir ilgisi yok. Ukulili tamamen
sıfırdan (greenfield) bir proje olarak `ukulili/` alt klasöründe geliştirilir;
Barrier dosyalarına dokunulmaz.

**Kararlar:**

| Konu | Karar | Gerekçe |
|---|---|---|
| Teknoloji | Kotlin + Jetpack Compose | Sadece Android hedefi; gerçek zamanlı ses işleme native'de en sağlam |
| Konum | `ukulili/` alt klasörü | Barrier'dan izole |
| Şarkı içeriği | Kamu malı / anonim + özgün alıştırmalar | Telif riski sıfır |
| Maskot | **Uki** — ukulele gövdeli karakter | Logo ile aynı formdan türüyor |

**Kapsam dışı (v1):** backend / hesap sistemi, topluluk şarkı paylaşımı, iOS,
reklam / abonelik, video dersler.

---

## 2. Bilgi Mimarisi

Alt gezinme — Material 3 `NavigationBar`, 5 sekme:

| Sekme | TR / EN | İçerik |
|---|---|---|
| 🎓 | Öğren / Learn | Seviyeli öğrenme yolu, günlük hedef, seri |
| 🎵 | Şarkılar / Songs | Filtrelenebilir şarkı kütüphanesi + oynatıcı |
| 🎯 | Akort / Tune | Mikrofonlu akort aleti — görsel olarak öne çıkarılmış merkez sekme |
| 🎸 | Akorlar / Chords | Akor sözlüğü ve diyagramları |
| 👤 | Profil / Profile | İlerleme, ayarlar, dil, tema |

Metronom bağımsız sekme değil; şarkı oynatıcısının ve vuruş alıştırmasının
içinde yaşar.

---

## 3. Özellikler

### 3.1 Akort Aleti — en yüksek teknik risk, ilk yapılacak

**Sinyal zinciri:**

```
AudioRecord (44.1 kHz, mono, PCM16)
  -> high-pass filtre (60 Hz)
  -> Hann pencere (2048 ornek, %50 ortusme)
  -> YIN / MPM (McLeod) f0 kestirimi
  -> sent (cent) sapmasi
  -> medyan + EMA yumusatma
  -> UI state
```

> **Karar — NDK/Oboe yerine saf Kotlin `AudioRecord` + Kotlin YIN.**
> Akort *analiz* işidir, düşük gecikmeli *round-trip* değil; 40–60 ms fazlasıyla
> yeterli. NDK'sız kalmak derlemeyi ve bakımı ciddi sadeleştiriyor. Oboe, v2
> optimizasyonu olarak kalsın.

**Desteklenen akortlar:** Standart GCEA (re-entrant / yüksek G) · Low-G ·
Bariton DGBE · slack-key varyantları · kullanıcı tanımlı akort.

**Arayüz:** büyük dairesel kadran + yay hareketli ibre · sent değeri (`-12 ¢`) ·
4 burgu göstergesi · renk + **metin etiketi** geri bildirimi · Uki `uki-listen`
→ `uki-cheer`. Otomatik tel algılama + manuel seçim.

| Durum | Aralık | Renk | Etiket TR / EN |
|---|---|---|---|
| Tamam | 0–5 ¢ | Leaf 500 `#3DBE6C` | Tamam / In tune |
| Yakın | 5–25 ¢ | Mango 500 `#FF7A2F` | Yakın / Close |
| Uzak | > 25 ¢ | `#E5484D` | Uzak / Off |
| Bekleme | sinyal yok | Slate 500 | Dinliyor / Listening |

**Ek:** A4 kalibrasyonu (415–466 Hz) · referans ton çalma (kulakla akort için) ·
**tamamen çevrimdışı; ses asla kaydedilmez veya gönderilmez** — Play Store veri
güvenliği formu için kritik.

### 3.2 Öğren — seviyeli öğrenme yolu

**Yapı:** Kurs → Ünite → Ders. Kilitli ilerleme, ders başına 1–3 yıldız.

**Ders tipleri:**

1. **Tanıtım** — tutuş, sağ el, sol el (animasyon + kısa metin)
2. **Akor öğrenme** — diyagram + parmak yerleşimi + animasyonlu el
3. **Vuruş alıştırması** — metronomla tempoya vurma, zamanlama puanı
4. **Akor geçişi drill'i** — *"60 saniyede kaç geçiş?"* (klasik uke egzersizi, çok motive edici)
5. **Şarkı uygulaması** — kayan akorlarla eşlik
6. **Kulak / quiz** — çoktan seçmeli

**Seviye tanımları** — ürünün "kolay–orta–zor" sözünün somut karşılığı:

| Seviye | Akorlar | Teknik | Hedef çıktı |
|---|---|---|---|
| **Kolay** | C, Am, F, G7 (1–3 akor) | Tek yönlü aşağı vuruş, bare yok | 15 dakikada ilk şarkı |
| **Orta** | + G, D, Em, A, Dm (4–5 akor) | Senkoplu vuruş, temel parmak tekniği | Türkü ve pop yapıları |
| **Zor** | + Bb, B, F#m (bare akorlar) | Fingerstyle, tab'den melodi, chord-melody | Solo enstrümantal |

**İlerleme:** XP · günlük seri (streak) · pratik dakikası · ünite rozeti.

> **Can / kalp sistemi yok.** Marka kişiliğiyle ("cesaretlendirici, asla
> utandırmaz") çelişir.

### 3.3 Şarkılar

**Kütüphane filtreleri:** zorluk · dil (TR/EN) · akor sayısı · tür (çocuk,
geleneksel, klasik).

**Şarkı ekranı — 3 görünüm:**

- **Akor görünümü** — sözlerin üstünde akorlar, BPM'e göre otomatik kaydırma
- **Tab görünümü** — 4 satırlık tablatura (monospace hizalı), yatay kaydırma
- **Nota görünümü** — basit porte; v1'de yalnızca Kolay şarkılar için

**Oynatıcı:** metronom · hız 0.5× – 1.0× · transpoze / capo · gereken akorların
çipleri (tıkla → akor kartı) · bölüm döngüsü (loop).

**İçerik — 40–60 parça, tamamı kamu malı / anonim:**

- **TR:** Dandini Dandini Dastana · Ali Baba'nın Çiftliği · Portakalı Soydum ·
  Mini Mini Bir Kuş · Çık Çıkalım Çayıra · Kâtibim (Üsküdar'a Gider İken) ·
  anonim türküler
- **EN:** Twinkle Twinkle · Ode to Joy · Amazing Grace · Oh Susanna ·
  Row Row Row Your Boat · Auld Lang Syne · Scarborough Fair · Greensleeves ·
  When the Saints Go Marching In · Frère Jacques · This Old Man · Clementine
- **Özgün:** akor geçişi ve vuruş alıştırmaları — telifi bizde

> ⚠️ **Telif disiplini.** Her şarkı kaydında zorunlu `license` ve `sourceNote`
> alanı. *"Geleneksel görünüyor"* yeterli değil — her parça tek tek doğrulanıp
> `docs/content/song-provenance.md` tablosuna işlenir. Şüpheli hiçbir şey
> sürüme girmez.
>
> Örnek tuzak: **"You Are My Sunshine"** halk şarkısı sanılır ama 1940 tarihli
> ve hâlâ telifli (Jimmie Davis) — **listeye alınmayacak.**

### 3.4 Akorlar

Diyagram ızgarası (zorluk / tür filtreli: majör, minör, 7'li, sus, bare) →
akor detayı: diyagram · parmak numaraları · alternatif basımlar · ses çalma ·
*"bu akor hangi şarkılarda geçiyor"*.

> Akor diyagramı `Canvas` tabanlı **tek bir yeniden kullanılabilir Composable**
> olacak: `ChordDiagram`. Ders, şarkı ve sözlük ekranlarının hepsi bunu kullanır
> — üç ayrı çizim kodu yazılmaz.

### 3.5 Profil & Ayarlar

İstatistikler (seri, XP, tamamlanan ders, pratik dakikası) ·
**Dil: Türkçe / English / Sistem** · **Nota adları: Do-Re-Mi / A-B-C** ·
Tema: açık / koyu / sistem · **Solak modu** (diyagramları aynalar) ·
varsayılan akort + A4 kalibrasyonu · günlük pratik hatırlatması.

---

## 4. Mimari

**Yaklaşım:** tek Activity + Compose · MVVM / UDF (ViewModel + `StateFlow` +
değişmez `UiState`) · Hilt (DI) · Navigation Compose (tip güvenli rotalar).

### Modüller

```
ukulili/
├── app/                      # Activity, navigation, DI koku
├── core/
│   ├── designsystem/         # Color.kt, Type.kt, Shape.kt, UkuliliTheme, ChordDiagram
│   ├── model/                # Song, Chord, Lesson, Tuning, Difficulty
│   ├── data/                 # repository'ler, asset seeding
│   ├── database/             # Room: progress, favorites, streak, custom tunings
│   └── audio/                # YIN pitch detection, AudioRecord kaynagi, metronom, SoundPool
├── feature/
│   ├── tuner/  learn/  songs/  chords/  profile/
└── docs/
    ├── brand/                # marka kiti
    └── content/              # sarki/ders JSON kaynaklari + telif tablosu
```

### Veri

İçerik `assets/` içinde JSON (kotlinx.serialization) → ilk açılışta **sürümlü
seeding** ile Room'a yazılır. Kullanıcı verisi Room, ayarlar DataStore.
**v1'de backend yok — tamamen çevrimdışı.**

**Şarkı şeması** (ChordPro türevi):

```json
{
  "id": "katibim",
  "title": { "tr": "Kâtibim", "en": "Katibim (Üsküdar)" },
  "artist": "Anonim / Traditional",
  "license": "public-domain",
  "sourceNote": "Anadolu türküsü, anonim",
  "difficulty": "medium",
  "bpm": 92, "timeSignature": "4/4", "key": "Am", "tuning": "gCEA",
  "chords": ["Am", "Dm", "E7"],
  "strumPattern": "D-DU-UDU",
  "sections": [{
    "type": "verse",
    "lines": [{
      "lyrics": { "tr": "Üsküdar'a gider iken", "en": "…" },
      "chords": [{ "pos": 0, "name": "Am" }, { "pos": 12, "name": "E7" }]
    }]
  }],
  "tab": { "strings": ["A|---0---2---|", "E|---3-------|", "C|-----------|", "G|-----------|"] }
}
```

**Akor şeması:** `frets` dizisi **GCEA sırasında** (`C` → `[0,0,0,3]`),
ayrıca `fingers`, `barre`, `difficulty`, `variants`, `displayName: {tr, en}`.

### Ses

| İş | Çözüm | Neden |
|---|---|---|
| Akort girişi | `AudioRecord` + Kotlin YIN | NDK'sız, arka plan thread'de |
| Kısa sesler (akor, tık) | `SoundPool` | Düşük gecikme |
| Şarkı referansı | Media3 / ExoPlayer | Standart oynatma |
| **Metronom** | Önceden render edilmiş tık buffer'ı + `AudioTrack` | `Handler.postDelayed` **sapıyor** — ritim aracında kabul edilemez |

### Build

Gradle KTS + version catalog (`libs.versions.toml`) · Kotlin 2.x · Compose BOM ·
**minSdk 26** (adaptive icon'un gerektirdiği API; ~%97 cihaz kapsamı) ·
targetSdk / compileSdk 36.

**Paket adı:** `com.ukulili.app`

> ⚠️ Play Store isim müsaitliği ve `ukulili.com` domaini **üretim öncesi
> kontrol edilmeli** — henüz doğrulanmadı.

---

## 5. Çok Dillilik (TR / EN)

- `res/values/strings.xml` (EN, varsayılan) + `res/values-tr/strings.xml`
- **Android 13+ uygulama içi dil:** `localeConfig` + `res/xml/locales_config.xml`
  + `AppCompatDelegate.setApplicationLocales()`; 13 altı için manuel
  `Configuration` yolu
- Çoğul (`plurals`), tarih / sayı biçimi ICU üzerinden
- İçerik dili: şarkı ve ders JSON'larında `{ "tr": …, "en": … }` haritaları
- Lint: `MissingTranslation` ve `HardcodedText` **error** seviyesine çekilir

> ⚠️ **Türkçe locale tuzağı.** `toLowerCase()` / `toUpperCase()` noktalı–noktasız
> `i` sorunu yaratır (`"I".lowercase()` Türkçe locale'de `ı` verir). Tüm ID,
> anahtar ve karşılaştırma işlemlerinde **`Locale.ROOT`** zorunlu; bu bir detekt
> kuralı olarak yazılacak.

---

## 6. Test & CI

- Birim: JUnit + Turbine (Flow), Robolectric
- Compose UI testleri + design system için ekran görüntüsü (screenshot) testi
- CI: GitHub Actions → `assembleDebug` + unit test + ktlint / detekt
- **Marka:** `docs/brand/tools/check-contrast.py` CI'da koşar, başarısızlıkta build kırılır

> **Pitch detection testi — kritik.** Sentetik sinüs dalgalarıyla (A4 440 Hz,
> G4 392 Hz, C4 261.63 Hz ve ±20 sent detune) YIN çıktısının **< 1 sent** hata
> ile eşleşmesi doğrulanır. Gürültü eklenmiş varyantlar da dahil. Akort aleti bu
> testler olmadan doğru sayılmaz.

---

## 7. Yol Haritası

| Faz | İş | Durum |
|---|---|---|
| 0 | Plan + marka kiti | ✅ **tamam** |
| 1 | Marka varlıkları: logo SVG, adaptive icon, Uki 7 poz, brand board | sıradaki |
| 2 | Proje iskeleti: Gradle, modüller, Hilt, Compose, navigation, design system, i18n | |
| 3 | **Akort aleti** — en yüksek risk, bu yüzden erken | |
| 4 | Akor kütüphanesi + `ChordDiagram` komponenti | |
| 5 | Şarkı kütüphanesi + oynatıcı (akor / tab / nota görünümleri) | |
| 6 | Öğrenme yolu + ilerleme / seri sistemi | |
| 7 | İçerik üretimi: 40–60 şarkı, ders metinleri TR + EN, telif tablosu | |
| 8 | Cila: animasyon, ses, erişilebilirlik (TalkBack), Play Store hazırlığı | |

---

## 8. Doğrulama

```bash
cd ukulili
./gradlew :app:assembleDebug
./gradlew test                              # YIN sentetik sinus testleri dahil
./gradlew lint detekt
python3 docs/brand/tools/check-contrast.py  # marka paleti WCAG AA
```

**Manuel:**

- **Akort aleti** — cihazda gerçek ukulele veya ton üretici ile: 4 telin de doğru
  algılanması, ±5 sent eşiğinde renk geçişi, izin reddedildiğinde makul davranış
- **Dil** — cihazı `tr-TR` ve `en-US` ile çalıştır; uygulama içi dil
  değiştiricinin yeniden başlatmadan çalıştığını, sabit kodlanmış metin
  kalmadığını doğrula
- **Erişilebilirlik** — TalkBack ile akort ve akor ekranlarının okunması;
  zorluk seviyelerinin renk olmadan (etiket + ikon) ayırt edilebilmesi
