# Elegant

Yazılım projelerini, bu projelere bağlı notları ve görevleri bu bilgisayarda tutan masaüstü uygulaması. Hesap yok, veriler yerelde durur.

Arayüz Türkçe ve İngilizce. Görünüm açık, koyu veya sistem ayarını izler.

## Kurulum

Hazır kurulum dosyası her sürümle birlikte [Releases](../../releases) sayfasında yayınlanır. Windows için `Elegant Setup x.y.z.exe` dosyasını indirip çalıştırın. Kurulum `C:\Program Files\Elegant` altına yapılır ve yönetici izni ister.

Kayıtlar `%APPDATA%\Elegant` klasöründedir. Uygulamayı silmek bu klasörü silmez.

## Geliştirme

Gerekenler: Node.js 22 ve npm.

```bash
git clone <bu-deponun-adresi>
cd elegant
npm install
npm test
npm start
```

Kaynak düzeni:

| Klasör | İçerik |
| --- | --- |
| `src/` | Electron ana süreç, arayüz ve veri katmanı |
| `assets/` | Uygulama ikonu ve logo |
| `tests/` | Veri katmanı testleri |

`npm start` geliştirme penceresini açar. `npm test` kayıt kurallarını çalıştırır. `npm run dist` Windows kurulum dosyasını `release/` içine üretir; bu klasör git ile izlenmez.

## Yeni sürüm yayınlama

1. `package.json` içindeki `version` değerini yükseltin.
2. Değişikliği commit edin.
3. Aynı sürümle bir etiket gönderin:

```bash
git tag v1.0.3
git push origin main
git push origin v1.0.3
```

Etiket GitHub Actions üzerinden testi çalıştırır, kurulumu derler ve bu sürümü Releases sayfasına ekler. İndirilen dosyanın adı sürüme göredir.

## Lisans

MIT. Ayrıntı için `LICENSE` dosyasına bakın.
