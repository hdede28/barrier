# 🎸 Ukulili

> **Dünyanın en kolay enstrümanı, dünyanın en kolay yolundan.**
> *The world's easiest instrument, the easiest way.*

Ukuleleyi sıfırdan öğreten Android uygulaması. Mikrofonlu akort aleti, akor
kütüphanesi, tab & nota destekli şarkı kütüphanesi ve Kolay / Orta / Zor
seviyeli bir öğrenme yolu. Türkçe ve İngilizce.

## Durum

🟡 **Faz 0 — Planlama.** Henüz kod yok; bu klasörde şu an sadece plan ve
marka kiti dokümanları var.

| Doküman | İçerik |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Ürün kapsamı, mimari, veri şemaları, yol haritası, doğrulama |
| [`docs/brand/BRAND.md`](docs/brand/BRAND.md) | Marka kiti: logo, maskot Uki, renk paleti, tipografi, dil |
| [`docs/brand/tokens/colors.json`](docs/brand/tokens/colors.json) | Renk token'ları — tek doğruluk kaynağı |

## Özet

- **Teknoloji:** Kotlin + Jetpack Compose (native Android), minSdk 26
- **Çevrimdışı:** v1'de backend yok, tüm içerik uygulamayla birlikte gelir
- **Mikrofon:** yalnızca akort için, cihazda işlenir — **kayıt yok, gönderim yok**
- **İçerik:** kamu malı / anonim eserler + özgün alıştırmalar (telif riski yok)

## Neden bu repoda?

Bu depo (`hdede28/barrier`) aslında Barrier (C++ KVM yazılımı) projesi.
Ukulili onunla ilgisi olmayan, sıfırdan bir proje olarak `ukulili/` alt
klasöründe geliştiriliyor; Barrier dosyalarına dokunulmuyor.
