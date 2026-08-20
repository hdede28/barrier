# Dubstep Studio

Tarayıcıda çalışan, bağımsız bir dubstep beat / step-sequencer uygulaması. Saf
HTML/CSS/JS ve Web Audio API ile yazılmıştır; kurulum veya derleme gerektirmez.

## Çalıştırma

`index.html` dosyasını doğrudan bir tarayıcıda açmanız yeterlidir. İsterseniz
basit bir yerel sunucu ile de açabilirsiniz:

```sh
cd dubstep-studio
python3 -m http.server 8000
# ardından http://localhost:8000 adresine gidin
```

## Özellikler

- **Step sequencer**: 16 veya 32 adımlık desenler, çalınırken canlı playhead
  göstergesi.
- **Hazır sesler**: Kick, Snare, Hi-Hat, Clap, Sub Hit, Stab — hepsi Web Audio
  API ile anlık üretilir (harici ses dosyası gerekmez).
- **Sınırsız ses ekleme**: "+ Ses Ekle" ile bilgisayarınızdan istediğiniz kadar
  ses dosyası (wav/mp3/ogg vb.) seçip yeni parça olarak ekleyebilirsiniz.
- **Wobble Bass synth**: Dalga formu, nota, filtre kesim frekansı, LFO
  derinliği ve wobble hızı ayarlanabilen, klasik "wub wub" dubstep basını
  üreten bir synth parça türü. İstediğiniz kadar wobble parçası ekleyebilirsiniz.
- Her parça için ses seviyesi, sustur (M) ve solo (S) kontrolleri, parça
  ismini değiştirme ve parçayı silme.
- BPM ve ana ses seviyesi kontrolleri, tüm deseni tek tuşla temizleme.
