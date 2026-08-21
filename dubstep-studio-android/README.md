# Dubstep Studio — Android Projesi

Bu klasör, `dubstep-studio/` içindeki web uygulamasını [Capacitor](https://capacitorjs.com/)
ile saran, gerçek bir Android uygulaması (APK) üretmeye hazır bir projedir.
Uygulamanın tüm mantığı (`www/` klasörü) saf HTML/CSS/JS'dir — Android
tarafı sadece onu tam ekran bir WebView içinde native bir uygulama olarak
paketler.

> **Not:** Bu proje bu oturumda derlenemedi çünkü Android SDK'yı indirmek
> için gereken `dl.google.com` adresi, bu oturumun ağ erişim politikası
> tarafından engellendi. Kendi bilgisayarında (SDK indirme kısıtı olmadan)
> derlemen gerekiyor — aşağıdaki adımlar bunun için yeterli.

## Gereksinim

- **Android Studio** (ücretsiz): https://developer.android.com/studio
  İlk açılışta gereken Android SDK bileşenlerini (SDK 36, build tools vb.)
  otomatik indirir, ayrıca kurulum gerekmez.

## APK'yı derleme (Android Studio ile — önerilen)

1. Android Studio'yu aç.
2. **File → Open** ve bu projedeki **`android`** klasörünü seç (üst klasörü
   değil, doğrudan `dubstep-studio-android/android`).
3. Açılışta "Gradle Sync" otomatik başlar; ilk seferde SDK bileşenlerini
   indirdiği için birkaç dakika sürebilir. İnternet bağlantısı gerekir.
4. Sync bitince üst çubuktaki **▶ Run** düğmesine bas. Bağlı bir Android
   telefon (USB hata ayıklama açık) ya da bir emulator seçmen istenecek —
   emulator yoksa **Device Manager**'dan yeni bir sanal cihaz oluşturabilirsin.
5. Uygulama derlenip cihaza/emulatöre kurulur ve otomatik açılır.

### Paylaşılabilir bir .apk dosyası üretmek

Test cihazına kurmak yerine elinde bir `.apk` dosyası olsun istiyorsan:

- **Build → Build App Bundle(s) / APK(s) → Build APK(s)** — imzasız, test
  amaçlı bir `app-debug.apk` üretir (`android/app/build/outputs/apk/debug/`).
- Google Play'e yüklemek veya başkalarıyla paylaşmak için **imzalı** bir APK
  gerekir: **Build → Generate Signed Bundle / APK**, sihirbazı takip ederek
  bir imzalama anahtarı (keystore) oluştur/seç.

## Komut satırından derleme (alternatif)

Android SDK'yı zaten kurulu bir makinede:

```sh
cd android
export ANDROID_HOME=/path/to/Android/Sdk   # sdk.dir'i gösteren local.properties de oluşturulabilir
./gradlew assembleDebug
# Çıktı: android/app/build/outputs/apk/debug/app-debug.apk
```

## Web uygulamasını güncelledikten sonra

`dubstep-studio/` içindeki `index.html`, `style.css` veya `app.js`
dosyalarında değişiklik yaparsan, bu projeye yansıtmak için:

```sh
cp ../dubstep-studio/index.html ../dubstep-studio/style.css ../dubstep-studio/app.js www/
npx cap sync android
```

(`npx cap sync` için önce bu klasörde `npm install` çalıştırman gerekir.)

## Uygulama kimliği

- **App ID:** `com.dubstepstudio.app`
- **App adı:** Dubstep Studio

`capacitor.config.json` içinden değiştirilebilir; App ID'yi değiştirirsen
`npx cap sync android` çalıştırmadan önce Android tarafında da güncellenmesi
gerekebilir (bkz. [Capacitor dokümantasyonu](https://capacitorjs.com/docs/cli/commands/init)).

## İkon / açılış ekranı

Şu an Capacitor'ın varsayılan yer tutucu ikonu kullanılıyor. Kendi ikonunu
koymak istersen [Capacitor Assets](https://capacitorjs.com/docs/guides/splash-screens-and-icons)
aracına bakabilirsin, ya da `android/app/src/main/res/mipmap-*` klasörlerindeki
`ic_launcher` dosyalarını doğrudan değiştirebilirsin.
