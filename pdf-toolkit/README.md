# Velyo — Kişisel PDF Çalışma Alanı

> **Belgeler, akışında.**

Velyo, İLovePDF Premium benzeri araçların kişisel/yerel bir alternatifidir: PDF birleştirme,
bölme, sıkıştırma, dönüştürme ve düşük riskli elektronik imza — hepsi **kendi makinenizde**,
hesap, faturalandırma, telemetri veya bulut kontrol paneli olmadan çalışır. Hiçbir dosya bir
sağlayıcıya yüklenmez; her şey yerel Postgres veritabanınızda ve yerel dosya deponuzda kalır.

**Teknoloji yığını (sabit, alternatif sunulmaz):** Next.js 15 + TypeScript (frontend),
Python 3.12 + FastAPI (backend), pikepdf (PDF dönüşümleri), LibreOffice headless
(Office→PDF), PostgreSQL (meta veri).

## ⚠️ Önemli uyarı — düşük riskli kullanım içindir

Bu araç **kişisel veya düşük riskli kullanım** için tasarlanmıştır. Aşağıdakileri
**kasıtlı olarak sağlamaz**:

- Nitelikli veya resmi/düzenlenmiş elektronik imza (yalnızca yazılı-ad tabanlı, gayri resmi
  bir imza akışı vardır)
- Devlet kimlik doğrulaması
- Acrobat seviyesinde tam PDF düzenleme veya kurumsal belge yönetişimi

Yasal, tıbbi veya başka türlü yüksek riskli belgeler için kullanmayın. Bu uyarı, uygulamanın
her ekranında görünür şekilde gösterilir.

## İçindekiler

- [Hızlı başlangıç (tek komut)](#hızlı-başlangıç-tek-komut)
- [Masaüstü uygulaması](desktop/README.md)
- [Mimari](#mimari)
- [Veri konumu ve yerellik](#veri-konumu-ve-yerellik)
- [İzinler ve güvenlik](#i̇zinler-ve-güvenlik)
- [Yedekleme ve geri yükleme](#yedekleme-ve-geri-yükleme)
- [Desteklenen işlemler ve bilinen sınırlamalar](#desteklenen-i̇şlemler-ve-bilinen-sınırlamalar)
- [Testler](#testler)
- [Geliştirme (Docker olmadan)](#geliştirme-docker-olmadan)

## Hızlı başlangıç (tek komut)

Gereksinimler: [Docker](https://docs.docker.com/get-docker/) ve Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

Bu tek komut şunları başlatır:

- **PostgreSQL 16** — meta veri (belgeler, sürümler, olaylar, imza istekleri)
- **Backend (FastAPI)** — `http://localhost:8000` — LibreOffice ve OCR araçlarıyla birlikte
- **Frontend (Next.js)** — `http://localhost:3000` — uygulamanın kendisi

### Alternatif: Masaüstü uygulaması

Terminale hiç dokunmadan çift-tıkla çalıştırmak isterseniz `desktop/` altındaki Electron
sarmalayıcıyı kullanabilirsiniz — aynı docker-compose yığınını arka planda başlatıp Velyo
arayüzünü bir masaüstü penceresinde açar (Docker Desktop kurulu olmalıdır). Ayrıntılar için
[`desktop/README.md`](desktop/README.md) dosyasına bakın.

Tarayıcınızda `http://localhost:3000` adresini açın. İlk çalıştırmada veritabanı şeması
otomatik olarak oluşturulur (backend başlangıcında `Base.metadata.create_all` çalışır — ayrı
bir migrasyon adımı gerekmez).

Durdurmak için: `docker compose down` (veriniz `./data` ve Postgres named volume'unda kalır).

## Mimari

```
pdf-toolkit/
├── backend/            FastAPI uygulaması
│   ├── app/
│   │   ├── main.py             uygulama girişi, CORS, süresi dolan belgeleri temizleme döngüsü
│   │   ├── models.py           SQLAlchemy tabloları (Document, DocumentVersion, Event, ...)
│   │   ├── storage.py          yerel dosya deposu (sha256, değiştirilemez sürüm dosyaları)
│   │   ├── events.py           ekleme-yalnızca denetim günlüğü yardımcı fonksiyonu
│   │   ├── pdf_ops/            pikepdf/LibreOffice/ocrmypdf tabanlı asıl dönüşümler
│   │   └── routers/            documents, operations, signatures, events, backup
│   └── tests/           pytest: temel dönüşümler + tek uçtan uca mutlu yol
├── frontend/            Next.js 15 (App Router, TypeScript, Tailwind v4)
│   ├── app/                    sayfalar (belgeler, belge detayı, imza akışı, olay günlüğü)
│   ├── components/              yeniden kullanılabilir UI parçaları
│   └── brand/                   Velyo marka kiti (tasarım tokenları, kaynak referans)
├── desktop/             Electron masaüstü sarmalayıcı (docker-compose'u başlatıp pencerede gösterir)
├── docker-compose.yml
└── .env.example
```

**Veri akışı:** Bir dosya yüklendiğinde `documents` tablosunda bir kayıt ve ilk
`document_versions` satırı (`operation_type = original`) oluşturulur; asıl bayt dizisi
`data/store/<document_id>/v1_original.<uzantı>` konumuna **değiştirilemez** (salt okunur)
olarak yazılır. Her sonraki işlem (birleştir, böl, döndür, sıkıştır, filigranla, sansürle,
OCR, dönüştür, imza mühürleme) her zaman **yeni bir sürüm dosyası** üretir; hiçbir mevcut
dosya asla üzerine yazılmaz. Her sürümün SHA-256 özeti veritabanında saklanır ve
`events` tablosuna (ekleme-yalnızca) bir denetim kaydı düşülür.

## Veri konumu ve yerellik

- Tüm belge içeriği: `./data/store/` (Docker Compose ile ana makinede bind-mount)
- Yedekler: `./data/backups/`
- Meta veri: Postgres named volume `pdftoolkit_pgdata` (Docker tarafından yönetilir;
  `docker volume inspect pdf-toolkit_pdftoolkit_pgdata` ile ana makinedeki yolunu bulabilirsiniz)

Hiçbir bileşen dış bir API'ye dosya yüklemez. Backend'in tek dış bağımlılığı isteğe bağlı
SMTP'dir (imza davetleri için) — yapılandırılmazsa uygulama sessizce başarısız olmaz; davet
bağlantısı yine oluşturulur ve teslim sonucu (`smtp_not_configured` gibi) olay günlüğüne
yazılır.

## İzinler ve güvenlik

- **Yükleme doğrulama:** yalnızca izin verilen uzantılar (`pdf, doc(x), odt, rtf, xls(x),
  ods, ppt(x), odp, txt`), boyut sınırı (`MAX_UPLOAD_MB`, varsayılan 200 MB), MIME tipi
  kontrolü.
- **Güvenli dosya adları:** yüklenen dosya adları, dizin geçişini veya özel karakterleri
  önlemek için normalleştirilip kısıtlı bir karakter kümesine indirgenir; diskteki gerçek
  yollar her zaman belge UUID'sine dayanır.
- **Değiştirilemezlik:** sürüm dosyaları diskte `0o444` (salt okunur) olarak işaretlenir;
  uygulama kodu hiçbir zaman mevcut bir sürüm dosyasının üzerine yazmaz.
- **İmza bağlantıları:** her imzacıya `secrets.token_urlsafe(32)` ile üretilen benzersiz,
  tahmin edilemez bir bağlantı verilir. Bir imzacının oturum uç noktası (`/api/signatures/
  sign/{token}`) yalnızca o imzacının kendi alanlarını döndürür — diğer imzacıların
  token'ları, e-postaları veya alan değerleri asla sızdırılmaz.
- **CORS:** yalnızca `.env` içindeki `CORS_ORIGINS` listelenen kaynaklara izin verir
  (varsayılan: `http://localhost:3000`).
- **Sırlar:** tüm sırlar (Postgres parolası, SMTP kimlik bilgileri) yalnızca `.env`
  içinde tutulur; `.env` `.gitignore` ile hariç tutulmuştur, yalnızca `.env.example` commit
  edilir.

## Yedekleme ve geri yükleme

```bash
./scripts/backup.sh            # ./backups/pdf-toolkit-backup-<tarih>/ altına yazar
```

Bu betik iki şey üretir:

1. `database.sql` — tam Postgres dökümü (belgeler/sürümler/olaylar/imza meta verisi)
2. `data.tar.gz` — dosya deposundaki her orijinal ve her sürüm çıktısı

Ayrıca uygulama içinden tek tıkla dışa aktarma da mevcuttur: **Tümünü Dışa Aktar**
(üst menü) tüm dosya deposunu bir `.zip` olarak indirir; her belge detay sayfasındaki
**Dışa aktar (.zip)** yalnızca o belgeyi indirir.

**Geri yükleme:**

```bash
cat backups/.../database.sql | docker compose exec -T postgres psql -U pdftoolkit pdftoolkit
tar -xzf backups/.../data.tar.gz -C ./data
```

**Süre sonu ve silme:** Belgeler yüklenirken isteğe bağlı bir saklama süresi (gün)
belirlenebilir; backend her saat (`PURGE_INTERVAL_SECONDS`) süresi dolan belgeleri kalıcı
olarak temizleyen bir arka plan döngüsü çalıştırır. Bir belge, detay sayfasındaki
**Kalıcı olarak sil** ile de her an elle silinebilir (yanlışlıkla tıklamayı önlemek için
iki adımlı onay gerekir).

## Desteklenen işlemler ve bilinen sınırlamalar

| İşlem | Durum | Not |
| --- | --- | --- |
| Birleştir | ✅ | pikepdf ile sayfa kopyalama |
| Böl | ✅ | Her aralık ayrı, yeni bir belge olur |
| Yeniden sırala | ✅ | Tam permütasyon gerektirir |
| Döndür | ✅ | 90/180/270°, tüm sayfalar veya seçili sayfalar |
| Sıkıştır | ✅ | Görselleri yeniden kodlar/küçültür (düşük/orta/yüksek) |
| Filigran | ✅ | pikepdf `add_overlay` + reportlab metin katmanı |
| Sansürle | ⚠️ best-effort | Opak kutu çizer ve tespit edilen metni content stream'den siler; karmaşık/döndürülmüş metin veya vektör grafikler için garanti değildir — paylaşmadan önce elle doğrulayın |
| OCR | ✅ (Tesseract gerekir) | `ocrmypdf`, yalnızca metin katmanı olmayan sayfaları işler |
| Office→PDF | ✅ (LibreOffice gerekir) | `soffice --headless --convert-to pdf` |
| Önizleme | ✅ | `pypdfium2` ile sayfa başına PNG küçük resim |
| Uyarılar | ✅ | Şifreleme, form alanı, imza alanı, gömülü olmayan font tespiti |
| E-imza (yazılı ad) | ✅ sınırlı | Alan yerleştirme, davet, onam kaydı, SHA-256 mühür — **nitelikli imza değildir** |

Diğer bilinen sınırlamalar:

- Sansür ve imza alanı koordinatları, arayüzde sayısal (0–1 oranlı) girilir; sürükle-bırak
  dikdörtgen çizim aracı yoktur — sayfa önizlemesine bakarak tahmini koordinat girilir.
- Filigran, her hedef sayfa için o sayfanın gerçek boyutuna göre ayrı bir katman
  oluşturduğundan farklı sayfa boyutlarına sahip belgelerde de doğru hizalanır.
- OCR ve Office dönüştürme, ilgili sistem araçları (tesseract, LibreOffice) kurulu değilse
  net bir `503` hatası döner ("kullanılamıyor") — sunucu çökmez.

## Testler

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# Yerel bir Postgres örneği ve test veritabanı gerekir:
createuser pdftoolkit --pwprompt   # veya mevcut kullanıcıyı kullanın
createdb pdftoolkit_test -O pdftoolkit

DATABASE_URL="postgresql+psycopg://pdftoolkit:pdftoolkit@localhost:5432/pdftoolkit_test" \
  python -m pytest tests/ -v
```

Masaüstü sarmalayıcının başlatma/hata mantığı (`desktop/orchestrator.js`) için Docker veya
Electron gerektirmeyen bağımsız testler:

```bash
cd desktop
npm install
npm test
```

Kapsam: her temel dönüşüm (birleştir, böl, yeniden sırala, döndür, sıkıştır) için odaklı
birim testleri, artı gerçek HTTP API üzerinden çalışan tek bir uçtan uca "mutlu yol" testi
(yükle → birleştir → indir → SHA-256'nın olay günlüğüyle eşleştiğini doğrula).

## Geliştirme (Docker olmadan)

**Backend:**

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL="postgresql+psycopg://pdftoolkit:pdftoolkit@localhost:5432/pdftoolkit"
export DATA_DIR="./data"
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Sistem bağımlılıkları (yerel/Docker-dışı çalıştırma için): PostgreSQL 16, LibreOffice
(`soffice`), Tesseract OCR (`tesseract-ocr`, dil paketiyle birlikte), Ghostscript.

## Marka

Arayüz, `frontend/brand/VELYO_BRAND_KIT.md` ve `velyo_design_tokens.json` içinde
tanımlanan Velyo tasarım sistemini (koyu lacivert zemin, mor–mavi degrade vurgu,
Manrope/Inter tipografi) kullanır. "Velyo" bir çalışma markasıdır; ürün gerçek bir
markaya bağlanmadan önce marka tescili ve alan adı uygunluğu ayrıca doğrulanmalıdır.
