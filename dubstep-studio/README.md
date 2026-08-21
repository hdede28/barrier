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
- **Ses Kütüphanesi**: 19 hazır ses (Kick, Snare, Hi-Hat, Açık Hi-Hat, Clap,
  Rimshot, Shaker, Tom'lar, Crash, Perc Blip, Sub Hit, Sub Drop, Stab, Riser,
  Laser Zap, Impact, Reverse Swell, Vocal Chop) — hepsi Web Audio API ile
  anlık üretilir (harici ses dosyası gerekmez). "🎵 Ses Kütüphanesi"
  panelinden önizleyip istediğiniz kadar parça olarak ekleyebilirsiniz.
- **Sınırsız ses ekleme**: "+ Ses Ekle" ile bilgisayarınızdan istediğiniz kadar
  ses dosyası (wav/mp3/ogg vb.) seçip yeni parça olarak ekleyebilirsiniz.
- **Wobble Bass synth**: Dalga formu, nota, filtre kesim frekansı, LFO
  derinliği ve wobble hızı ayarlanabilen, klasik "wub wub" dubstep basını
  üreten bir synth parça türü. İstediğiniz kadar wobble parçası ekleyebilirsiniz.
- Her parça için ses seviyesi, sustur (M) ve solo (S) kontrolleri, parça
  ismini değiştirme ve parçayı silme.
- BPM ve ana ses seviyesi kontrolleri, tüm deseni tek tuşla temizleme.
