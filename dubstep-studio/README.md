# Dubstep Studio

Tarayıcıda çalışan, bağımsız bir dubstep beat / step-sequencer uygulaması. Saf
HTML/CSS/JS ve Web Audio API ile yazılmıştır; kurulum veya derleme gerektirmez.

## Çalıştırma

**En kolay yol:** İşletim sisteminize uygun başlatma betiğine çift tıklayın —
Python varsa (çoğu Mac/Linux'ta hazır gelir, Windows'ta [python.org](https://www.python.org/downloads/)'dan kurulabilir) yerel bir sunucu başlatır ve tarayıcınızı otomatik açar.

- **Windows:** `start.bat`
- **macOS / Linux:** `start.sh` (Finder'da sağ tık → Aç, ya da terminalde `./start.sh`)

Uygulamayı kapatmak için açılan terminal/komut penceresini kapatmanız yeterli.

**Alternatif:** `index.html` dosyasını doğrudan bir tarayıcıda açmayı da
deneyebilirsiniz, ama bazı sistemlerde çift tıklama dosyayı bir tarayıcı yerine
başka bir programla açabilir — bu durumda yukarıdaki betikleri kullanın.

## Özellikler

- **Step sequencer**: 16 veya 32 adımlık desenler, çalınırken canlı playhead
  göstergesi.
- **Ses Kütüphanesi**: 40+ hazır ses ve enstrüman, üç kategoride — hepsi Web
  Audio API ile anlık üretilir (harici ses dosyası gerekmez). "🎵 Ses
  Kütüphanesi" panelinden önizleyip istediğiniz kadar parça olarak
  ekleyebilirsiniz:
  - **Davul** (16): Kick, Snare, Hi-Hat, Açık Hi-Hat, Clap, Rimshot, Snap,
    Shaker, Cowbell, Tom (Düşük/Orta/Yüksek), Conga, Timbale, Crash, Ride,
    Perc Blip.
  - **Bas & Efekt** (13): Sub Hit, Sub Drop, Stab, Riser, Downlifter, Laser
    Zap, Impact, Metal Hit, Reverse Swell, Vocal Chop, Glitch Blip, Siren,
    Air Horn, Alarm Blip.
  - **Enstrüman** (9): Lead Synth, Pluck, FM Bell, Pad / Choir, Brass Stab,
    Marimba, Org, 808 Bass ve Wobble Bass — her biri nota seçilebilen,
    melodi çalabileceğiniz synth parça türleri.
- **Sınırsız ses ekleme**: "+ Ses Ekle" ile bilgisayarınızdan istediğiniz kadar
  ses dosyası (wav/mp3/ogg vb.) seçip yeni parça olarak ekleyebilirsiniz.
- **Enstrüman parçaları**: Ses Kütüphanesi'nden eklenen her enstrüman
  parçasında nota (C2–C6 aralığında, kromatik) ve ses uzunluğu (release)
  ayarlanabilir, böylece adım deseniyle gerçek melodiler kurabilirsiniz.
- **Wobble Bass synth**: Dalga formu, nota, filtre kesim frekansı, LFO
  derinliği ve wobble hızı ayarlanabilen, klasik "wub wub" dubstep basını
  üreten bir synth parça türü. İstediğiniz kadar wobble parçası ekleyebilirsiniz.
- Her parça için ses seviyesi, sustur (M) ve solo (S) kontrolleri, parça
  ismini değiştirme ve parçayı silme.
- BPM ve ana ses seviyesi kontrolleri, tüm deseni tek tuşla temizleme.
