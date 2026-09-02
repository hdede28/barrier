# Ukulili — Marka Kiti

> Bu doküman markanın tek doğruluk kaynağıdır. Renk, tipografi ve form
> kararları burada tanımlanır; `core/designsystem` modülü bu değerlerden
> türetilir, tersi değil.

---

## 1. Marka Özü

**İsim:** Ukulili

**Konumlandırma:** *"Dünyanın en kolay enstrümanı, dünyanın en kolay yolundan."*

| | |
|---|---|
| **Marka vaadi (TR)** | 4 tel, 3 akor — ilk şarkın bugün. |
| **Marka vaadi (EN)** | 4 strings, 3 chords — your first song today. |

### Marka kişiliği

Her tasarım ve metin kararının hakemi bu beş sıfat:

1. **Cesaretlendirici** — asla utandırmaz, hep "neredeyse oldu!" der
2. **Canlı** — tropik, güneşli, doygun renkler
3. **Yalın** — bir ekranda tek bir iş
4. **Sıcak** — ahşap, el yapımı, yuvarlak formlar
5. **Oyuncu** — ama çocuk oyuncağı değil; yetişkin de rahat kullanır

### Ne DEĞİL

- Ciddi konservatuvar estetiği
- Koyu / teknik "prodüksiyon aracı" görünümü
- Gamification'ın agresif hali — **can/kalp sistemi ve ceza mekaniği yok**

---

## 2. Logo

### Konsept

Ukulele gövdesinin kendisi gülen bir yüz. Sekiz (8) formundaki gövde silueti;
ses deliği hem "göbek" hem gülümseme boşluğu; 4 tel dikey vurgu; burguluk
(headstock) küçük bir tutam gibi yukarı çıkıyor.

**Markanın en güçlü tarafı:** maskot ile logo *aynı formdan* türüyor.

### Yapı kuralları

- 24 × 24 birimlik ızgara üzerine kurulur
- Tüm köşeler yuvarlatılmış, min. 2 birim yarıçap
- Ses deliği, alt bout'un optik merkezinde
- 4 tel eşit aralıklı, kalınlık 0.5 birim
- **Zorunlu test:** tek renkte (düz siluet) okunabilir olmalı

### Varyantlar

| Varyant | Kullanım | Dosya |
|---|---|---|
| Yatay lockup | Web başlığı, sunum, Play Store feature graphic | `logo/logo-horizontal.svg` |
| Dikey (stacked) | Splash, poster, dar alan | `logo/logo-stacked.svg` |
| Sadece işaret | Uygulama ikonu, favicon, avatar | `logo/logo-mark.svg` |
| Sadece wordmark | Alt bilgi, sponsor şeridi | `logo/logo-wordmark.svg` |
| Tek renk (siyah/beyaz) | Baskı, damga, filigran | `logo/logo-mono.svg` |
| Ters (koyu zemin) | Dark tema, koyu kapak | `logo/logo-inverse.svg` |

### Uygulama ikonu (adaptive icon, API 26+)

| Katman | İçerik |
|---|---|
| `foreground` | Sadece işaret, 108dp tuvalde **66dp güvenli alan** içinde |
| `background` | Lagoon 500 → Mango 500 arası 135° yumuşak gradyan |
| `monochrome` | **Zorunlu** — Android 13+ temalı ikonlar için |

Maskeli hallerin hepsi test edilir: daire, squircle, yuvarlak kare.

### Boşluk & minimum boyut

- **Temiz alan:** ses deliğinin çapı kadar, dört yönde
- **Minimum:** işaret 24dp · wordmark 96px genişlik

### Yanlış kullanım

Döndürme · esnetme · palet dışı renklendirme · wordmark'a gradyan ·
gölge/dış çizgi ekleme · desenli fotoğraf üzerine doğrudan yerleştirme ·
ses deliğini kapatma.

---

## 3. Maskot — Uki

### Anatomi

| Parça | Tanım |
|---|---|
| **Baş** | Ukulelenin üst bout'u; iki nokta göz + yanak allığı (Mango 200) |
| **Saç / tutam** | Burgular (tuning pegs), 4 küçük yuvarlak çıkıntı |
| **Gövde** | Alt bout; ses deliği göbek/ağız işlevinde, ifadeye göre değişir |
| **Teller** | Gövde üzerinde 4 çizgi (Sunbeam 400) — **kimliğin işareti, hiçbir pozda kaybolmaz** |
| **Kollar** | Kısa, çubuk, yuvarlak uçlu (eldiven eli yok, sade top) |
| **Bacaklar** | Kısa, iki damla form |

**Çizim kuralı:** çizgi kalınlığı 2 birim, tüm çizimde sabit. Gölge yok;
düz renk + tek katman tonlama.

### İfade seti — üretilecek 7 poz

| Poz | Nerede kullanılır |
|---|---|
| `uki-hello` — el sallıyor | Onboarding, ilk açılış |
| `uki-listen` — kulak kabartmış | Akort ekranı bekleme durumu |
| `uki-cheer` — zıplıyor, kollar havada | Ders / şarkı tamamlandı |
| `uki-think` — çene kaşıyor | Quiz, ipucu |
| `uki-strum` — çalıyor | Vuruş alıştırması |
| `uki-sleepy` — esniyor | Seri (streak) kırıldı, boş durum |
| `uki-point` — işaret ediyor | Akor diyagramı anlatımı |

### Kullanım kuralları

- Ekranda **tek** Uki; asla metnin veya butonun üstünü kapatmaz
- Hata anlarında Uki üzgün değil, **cesaretlendirici** olur — kaşlar düşmez
- Uki konuşuyorsa balon içinde, en fazla 2 satır
- Yeniden renklendirme / aksesuar (şapka vb.) sadece ödül sistemi için — **v2**

---

## 4. Renk Paleti

Palet üç katmanlı: **marka**, **anlam (semantic)**, **nötr**. Zorluk seviyeleri
için ayrı bir üçlü ayrıldı ki *"zor = tehlike/hata"* çağrışımı olmasın — bu
yüzden Zor **mor**, kırmızı değil.

Makine tarafından okunabilir hali: [`tokens/colors.json`](tokens/colors.json)

### 4.1 Marka renkleri

**Mango** — birincil: butonlar, marka, vurgu

| Ton | Hex | Ton | Hex |
|---|---|---|---|
| 50 | `#FFF3EA` | 500 ★ | **`#FF7A2F`** |
| 100 | `#FFE0CC` | 600 | `#E85F14` |
| 200 | `#FFC199` | 700 | `#C24E12` |
| 300 | `#FFA366` | 800 | `#8F390D` |
| 400 | `#FF8C47` | 900 | `#5C2408` |

**Lagoon** — ikincil: ilerleme, sakinlik, "öğrenme" hissi

| Ton | Hex | Ton | Hex |
|---|---|---|---|
| 50 | `#E6FAF8` | 500 ★ | **`#0FB5AE`** |
| 100 | `#C0F2EE` | 600 | `#0C948F` |
| 200 | `#7FE3DB` | 700 | `#0A7570` |
| 300 | `#4FD1C7` | 800 | `#075754` |
| 400 | `#22C1B5` | 900 | `#043836` |

**Sunbeam** — aksan: XP, yıldız, seri (streak)

| Ton | Hex | Ton | Hex |
|---|---|---|---|
| 100 | `#FFF0BF` | 500 ★ | **`#F5B31A`** |
| 200 | `#FFE180` | 600 | `#D19312` |
| 300 | `#FFD35C` | 700 | `#A3720C` |
| 400 | `#FFC53D` | 900 | `#4A3305` |

**Koa** `#8A5A3B` — ahşap tonu. Yalnızca dekoratif doku ve illüstrasyon detayı.

### 4.2 Zorluk seviyeleri — ürünün belkemiği

| Seviye | TR / EN | Kimlik rengi | Dolgu + metin | Kapsayıcı + metin | İkon |
|---|---|---|---|---|---|
| 1 | Kolay / Easy | Leaf 500 `#3DBE6C` | Leaf 500 + Ink 900 | Leaf 100 `#DFF7E7` + Leaf 800 `#1C6635` | tek nota |
| 2 | Orta / Medium | Sunbeam 400 `#FFC53D` | Sunbeam 400 + Ink 900 | Sunbeam 100 `#FFF0BF` + Sunbeam 800 `#755108` | çift nota |
| 3 | Zor / Hard | Grape 500 `#8B5CF6` | Grape **600** `#7C3AED` + Beyaz | Grape 100 `#EDE9FE` + Grape 700 `#6D28D9` | üçlü nota |

> Zor seviyesinde dolgu **Grape 600**'dır, Grape 500 değil: Grape 500 üzerinde ne
> beyaz (4.23:1) ne de Ink 900 (4.05:1) AA'yı geçiyor. Grape 500 yalnızca kimlik
> rengi olarak kalır — nokta, kenarlık, ikon.

> ⚠️ **Erişilebilirlik kuralı:** zorluk hiçbir zaman *yalnızca* renkle
> anlatılmaz. Her zaman **ikon + etiket** eşlik eder (renk körlüğü).

### 4.3 Anlam renkleri

| Rol | Dolgu | Dolgu üstü metin | Beyaz zeminde metin |
|---|---|---|---|
| Success | `#3DBE6C` | Ink 900 (7.18:1) | `#1C6635` (7.00:1) |
| Warning | `#FFB020` | Ink 900 (9.39:1) | `#755108` (7.15:1) |
| Error | `#C4282D` | Beyaz (5.69:1) | `#C4282D` (5.69:1) |
| Info | `#0A7570` | Beyaz (5.54:1) | `#0A7570` (5.54:1) |

> `#E5484D` parlak kırmızısı yalnızca **ikon ve kenarlık** olarak kullanılır;
> üzerinde metin taşıyamaz (beyaz 3.91:1, Ink 900 4.39:1 — ikisi de AA altı).

> **Error kuralı:** Error rengi sadece **sistem hataları** içindir (mikrofon
> izni, dosya okunamadı). Kullanıcının çalışı için **asla** kullanılmaz.

### 4.4 Nötrler

| Ad | Hex | Ad | Hex |
|---|---|---|---|
| Ink 900 | `#1B1B1F` | Mist 200 | `#E4E4EA` |
| Ink 700 | `#3A3A42` | Cloud 100 | `#F5F5F8` |
| Slate 500 | `#6E6E7A` | White | `#FFFFFF` |

### 4.5 Tema eşlemesi

| | Açık tema | Koyu tema |
|---|---|---|
| Zemin | Cloud 100 `#F5F5F8` | `#121216` |
| Yüzey | White `#FFFFFF` | `#1D1D23` |
| Yüzey üstü metin | Ink 900 (15.78:1) | Cloud 100 (15.41:1) |
| Birincil dolgu | Mango 500 `#FF7A2F` | Mango 300 `#FFA366` |
| **Birincil üstü metin** | **Ink 900** (6.60:1) | **Ink 900** (8.73:1) |
| İkincil dolgu | Lagoon 500 `#0FB5AE` | Lagoon 300 `#4FD1C7` |
| **İkincil üstü metin** | **Ink 900** (6.74:1) | **Ink 900** |
| Zeminde marka metni | **Mango 800** `#8F390D` (6.44:1) | Mango 300 `#FFA366` (9.51:1) |

### 4.6 Kontrast kuralları — ölçülmüş, varsayılmış değil

Aşağıdakiler hesaplanarak doğrulandı; **tahmine dayalı değil**. Palet
değişirse CI'daki kontrast betiği tekrar çalıştırılmalı.

**Marka renklerinin hiçbiri beyaz metin taşıyamaz:**

| Kombinasyon | Oran | Sonuç |
|---|---|---|
| Beyaz metin / Mango 500 | 2.60:1 | ❌ **Kullanma** |
| Beyaz metin / Lagoon 500 | 2.55:1 | ❌ **Kullanma** |
| **Ink 900 metin / Mango 500** | **6.60:1** | ✅ Doğrusu bu |
| **Ink 900 metin / Lagoon 500** | **6.74:1** | ✅ Doğrusu bu |

> Bu markanın en kolay yapılacak hatası: canlı turuncu butona beyaz yazı
> koymak. **Ukulili butonlarının yazısı koyudur.** Bu bir stil tercihi değil,
> erişilebilirlik zorunluluğu — ve markaya da yakışıyor: sıcak turuncu üstünde
> koyu mürekkep, tabela estetiği.

**Beyaz/açık zeminde renkli metin için kullanılacak tonlar:**

| Renk | Metin tonu | Beyaz üstünde | Kendi 50/100 kapsayıcısı üstünde |
|---|---|---|---|
| Mango | **800** `#8F390D` | 6.98:1 ✅ | Mango 50'de 6.98:1 ✅ |
| Lagoon | **700** `#0A7570` | 5.54:1 ✅ | Lagoon 50'de 5.12:1 ✅ |
| Sunbeam | **800** `#755108` | 7.15:1 ✅ | Sunbeam 100'de 6.29:1 ✅ |

> **İki tuzak, ikisi de ölçümle yakalandı:**
> - Sunbeam metin tonu **700 değil 800** — Sunbeam 700 `#A3720C` beyazda 4.23:1.
> - Mango metin tonu **700 değil 800** — Mango 700 beyazda 4.78:1 ile geçiyor ama
>   uygulamanın gerçek zemini beyaz değil **Cloud 100** `#F5F5F8`; orada 4.39:1'e
>   düşüp AA'nın altında kalıyor. Kontrastı her zaman *gerçek* zemine karşı ölç.

**Kural özeti:**

1. Mango / Lagoon / Sunbeam **500** tonları yalnızca **dolgu**dur — üstlerine daima Ink 900
2. Açık zeminde renkli **metin** gerekiyorsa → Mango **800** · Lagoon 700 · Sunbeam 800
3. Renkli kapsayıcı (50/100) üstünde metin → bir ton daha koyu git
4. Tüm çiftler **WCAG AA 4.5:1** sağlamalı; CI'da otomatik doğrulanır

### 4.7 Doğrulama betiği

```bash
python3 docs/brand/tools/check-contrast.py          # insan okunur tablo
python3 docs/brand/tools/check-contrast.py --json    # CI icin
```

`tokens/colors.json` içinde bildirilen **49 metin/zemin çiftinin tamamı**
WCAG 2.1 AA'yı (4.5:1) geçiyor. Palete her dokunuşta bu betik çalıştırılır;
başarısızlıkta çıkış kodu 1 döner, böylece CI kırılır.

---

## 5. Tipografi

| Rol | Yazı tipi | Neden |
|---|---|---|
| Başlık / Display | **Baloo 2** | Yuvarlak, sıcak, oyuncu ama okunur |
| Gövde / UI | **Nunito Sans** | Yumuşak terminalli, uzun metinde yormaz, Baloo ile uyumlu |
| Tab & akor ızgarası | **Roboto Mono** | Tablatura hizası için sabit genişlik **zorunlu** |

> ⚠️ **Üretim öncesi doğrulama:** Baloo 2 ve Nunito Sans'ın
> `ğ ı İ ş ö ü ç Ğ İ Ş Ö Ü Ç` kapsamı tek tek render edilip kontrol edilecek.
> Eksik varsa başlıkta **Fredoka** alternatifine geçilir.

### Ölçek (Material 3 tabanlı, sp)

```
Display L   45 / 52      Body L      16 / 24
Headline M  28 / 36      Body M      14 / 20
Title L     22 / 28      Label L     14 / 20
Title M     16 / 24      Label S     11 / 16
```

---

## 6. Form, Hareket, İkonografi

### Köşe yarıçapları (dp)

`XS 8` · `S 12` · `M 16` · `L 24` · `XL 28` · `Full 999`

### Butonlar

Birincil yükseklik **56dp**, altında 4dp'lik koyu "kaide" — basınca 4dp aşağı
iner. Dokunsal, oyuncu his.

### Gölge

Yumuşak ve **renk tonlu**: Mango butonun gölgesi Mango 900 %12 opaklık.
Gri gölge kullanılmaz.

### İkonografi

Material Symbols **Rounded**, 24dp ızgara, 2dp kontur.
Özel çizilecekler: akor diyagramı · akort çatalı · vuruş oku (↓↑) ·
metronom · burgu · tel.

### Hareket

| Tip | Süre |
|---|---|
| Mikro | 150 ms |
| Standart | 250 ms |
| Vurgulu | 400 ms (Material emphasized easing) |

**Marka hareketleri:** doğru cevapta **vuruş dalgası** (soldan sağa 4 telde
ripple) · Uki'nin **zıplaması** · akort iğnesinin **yay (spring)** ile oturması.

### Ses & dokunuş

- Başarı sesi: kısa **C6 akor tırmığı** — kendi kaydımız
- Akort tuttuğunda tek `HapticFeedbackConstants.CONFIRM`
- Tüm sesler ayarlardan kapatılabilir

---

## 7. Marka Dili (Tone of Voice)

| | Türkçe | English |
|---|---|---|
| Hitap | **"sen"** dili, samimi | second person, casual |
| Başarı | "Harika! İlk akorun tamam." | "Nice! First chord down." |
| Hata | "Neredeyse! Bir daha dene." | "So close — try again." |
| **Asla** | "Yanlış", "Başarısız", "Hata yaptın" | "Wrong", "Failed" |
| Uzunluk | Buton ≤ 3 kelime · kart başlığı ≤ 6 kelime | aynı |

### Not adı ikiliği — önemli TR detayı

Türkiye'de hem `Do Re Mi Fa Sol La Si` hem `C D E F G A B` kullanılır.

- Ayarlarda **"Nota adları: Do-Re-Mi / A-B-C"** seçeneği olacak
- Akor kartlarında ikisi birden gösterilecek: **`C · Do Majör`**

---

## 8. Çıktı Listesi (Faz 1)

```
ukulili/docs/brand/
├── BRAND.md                          # bu doküman
├── logo/                             # 6 varyant, SVG + PNG @1x/@2x/@3x
├── mascot/                           # Uki 7 poz, SVG
├── icon/                             # adaptive icon katmanları + Play Store 512×512
├── tokens/
│   ├── colors.json                   # tek doğruluk kaynağı  ✅
│   └── Color.kt · Type.kt · Shape.kt # buradan türetilir
├── tools/
│   └── check-contrast.py             # WCAG denetleyicisi  ✅
└── brand-board.html                  # görsel önizleme (Artifact olarak yayınlanır)
```

## 9. Doğrulama

- [ ] Logo 24dp / 48dp / 192dp'de render — okunabilirlik
- [ ] Tek renk siluet testi
- [ ] Adaptive icon: daire / squircle / yuvarlak kare maskeleri launcher'da
- [ ] Android 13 temalı ikon (`monochrome` katmanı) kontrolü
- [x] `colors.json` üzerinden kontrast betiği — **49/49 çift WCAG AA (4.5:1) geçiyor**
- [ ] Baloo 2 + Nunito Sans ile `ğıİşöüçĞİŞÖÜÇ` render testi
