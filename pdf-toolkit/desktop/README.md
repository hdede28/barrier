# Velyo Desktop

Electron ile yazılmış ince bir masaüstü sarmalayıcı. Kod eklemez, yeni bir mimari
getirmez — yalnızca mevcut `../docker-compose.yml` yığınını (Postgres + FastAPI backend +
Next.js frontend) arka planda başlatıp, hazır olduğunda Velyo arayüzünü normal bir
masaüstü penceresinde gösterir. Terminal veya `docker compose up` komutu yazmaya gerek
kalmaz.

**Önkoşul:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) kurulu ve
açık olmalı. Uygulama, Docker bulunamazsa veya Docker Desktop kapalıysa bunu net bir
şekilde bildirir ve ne yapılması gerektiğini söyler.

## Nasıl çalışır

1. Uygulama açılır → Velyo markalı bir yükleniyor ekranı gösterilir.
2. Arka planda `docker compose up --build -d` çalıştırılır (proje kökündeki
   `docker-compose.yml` üzerinden — paketlenmiş sürümde bu dosyalar uygulamanın
   kaynaklarına gömülüdür, geliştirme modunda ise `../` dizinindeki asıl proje kullanılır).
   `.env` dosyası yoksa `.env.example`'dan otomatik oluşturulur.
3. Backend (`/api/health`) ve frontend (`/`) sağlık uçları hazır olana kadar yoklanır.
4. Hazır olduğunda pencere `http://localhost:3000` adresine yönlendirilir ve normal
   Velyo arayüzü kullanılmaya başlanır.
5. Uygulama kapatılırken konteynerler `docker compose stop` ile durdurulur (veriniz
   Postgres named volume'unda ve `../data/` altında kalıcı olarak durur — bir sonraki
   açılışta kaybolmaz).

Docker kuruluysa ama Docker Desktop açık değilse, uygulama bunu ayrı olarak tespit edip
("Docker Desktop çalışmıyor") özel bir mesaj gösterir — kurulum sırasında en sık
karşılaşılan durum budur.

## Geliştirme

```bash
cd desktop
npm install
npm test      # orchestrator.js için bağımsız (Docker/Electron gerektirmeyen) testler
npm start     # Electron uygulamasını geliştirme modunda başlatır
```

## Paketleme (kurulum dosyası üretme)

```bash
cd desktop
npm run dist
```

`electron-builder`, işletim sisteminize göre bir kurulum paketi üretir (macOS: `.dmg`,
Windows: `.exe`/NSIS, Linux: `.AppImage`) ve `../backend`, `../frontend`,
`docker-compose.yml`, `.env.example` dosyalarını paketin içine gömer (`node_modules`,
`.venv`, `.next`, `data/` gibi geliştirme-zamanı klasörleri hariç tutulur). Üretilen paket,
başka bir bilgisayara (Docker Desktop kurulu olması şartıyla) kopyalanıp doğrudan
çalıştırılabilir.

**Not:** Bu proje bir sandbox ortamında geliştirildiği için gerçek bir kurulum paketi
burada üretilip test edilemedi (GUI ve Docker daemon'a erişim yok). `main.js` ve
`orchestrator.js` mantığı, sanal ekran (Xvfb) üzerinde gerçek bir Electron süreciyle
çalıştırılıp Chrome DevTools Protocol üzerinden doğrulandı (Docker bulunamama, Docker
Desktop kapalı olma, ve compose hatası senaryoları dahil); ancak `npm run dist` ile
üretilen nihai kurulum paketini bir Windows/Mac/Linux makinesinde denemeniz önerilir.

## Bilinen sınırlamalar

- Docker Desktop şart; tamamen gömülü (Docker'sız) bir sürüm şu an desteklenmiyor.
- Uygulama simgesi (`build/icon.png`) Velyo marka renkleriyle üretilmiş basit bir "V"
  işaretidir; gerçek marka lansmanı öncesi profesyonel bir logo ile değiştirilmelidir.
