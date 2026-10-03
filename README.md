# Kervan Yolu — kaynak kod

Tarayıcıda çalışan 2.5D kervan RPG prototipi (Three.js r128).

## Yapı

Oyun mantığı ile çizim birbirinden ayrı. 3D'yi değiştirmek ya da ileride çok oyunculuya geçmek için mantığa dokunmak gerekmiyor.

| Dosya | Görev |
|---|---|
| `src/config.js` | Google ile giriş / bulut kaydı için Firebase ayarları (boşsa misafir modu) |
| `src/terrain.js` | Arazi yüksekliği, nehir, yol, köprü, kasaba kapıları, rota bulma |
| `src/data.js` | Tüm içerik: canavarlar, eşyalar, zırh takımları, takılar, yetenekler, mallar, kasabalar, görevler |
| `src/logic.js` | `KY.World`: savaş, seviye, envanter, 12 yuvalı ekipman, ticaret, kervan, pusu, kayıt |
| `src/pets.js` | Hayvan sistemi |
| `src/gfx.js` | Görsel çekirdek: kodla üretilen dokular, arazi/bina/bitki gölgelendiricileri, gökyüzü, su, uzak dağlar, HDR ışıltı ve renk düzenleme |
| `src/models.js` | Canavar ve hayvan modelleri (yuvarlatılmış parçalar) |
| `src/avatar.js` | Modüler kadın/erkek karakter: kuşanılan her eşya ayrı 3D parça, iskeletli tek ağ, kodla animasyon, envanter önizlemesi, eşya simgeleri |
| `src/swords.js` | Kılıç üreticisi |
| `src/scenery.js` | Dokulu arazi, su, ağaçlar, çimen, kayalar, Silkroad tarzı kasabalar, köprü |
| `src/render.js` | `KY.View`: kamera, bölge atmosferi, efektler, dokunma/fare |
| `src/ui.js`, `icons.js`, `sfx.js` | HUD, envanter (sürükle-bırak, ipuçları), paneller, dükkânlar, mini harita |
| `src/cloud.js` | Google girişi (Firebase Auth) ve bulut kaydı (Firestore) |
| `src/main.js` | Giriş ekranı, karakter seçimi/oluşturma, otomatik kayıt, ana döngü |

## Derleme

```
npm i three@0.128.0     # sadece testler için
node build.js           # dist/kervan-yolu.html (tek dosya)
```

## Testler

```
node test/bot.js 40     # 40 dakikalık savaş botu: seviye hızı, ölüm, iksir
node test/duel.js       # uniq canavar düelloları
node test/trade.js      # kervan rotası, köprü, yol kapısı, güçlendirme, kayıt
node test/admin.js      # yönetici paneli komutları
node test/pets.js kurt  # hayvan sistemi uçtan uca + 5 dk savaş dengesi (kurt ya da sahin)
python3 test/play.py mobile "fight,caravan,boss"   # tarayıcıda ekran görüntüsü
python3 test/swords_lineup.py 0.0 front             # tüm kılıçlar yan yana
```

## Yönetici paneli

Menüdeki taç düğmesi ya da Y tuşu. Altın, seviye, yetenek puanı, eşya, silah artısı, ölümsüzlük, hızlı koşu, ışınlanma ve tüccar seviyesi. Ayarlar'dan gizlenebilir. Komutlar `logic.js` içinde `admin…` fonksiyonları.

## Hayvanlar

İki kasabada Hayvan Terbiyecisi mühür, yem, merhem, Hayat Otu ve Süre Muskası satar. Toplayıcılar (Pamuk Tavşan, Çevik Sincap, Kum Tilkisi) ganimet toplar, ek çanta taşır, ölmez, 28 gün çağrılır. Savaş hayvanları (Kurt, Şahin) seninle savaşır, TP alır, 10. ve 20. seviyede dönüşür, acıkır, ölebilir. Panel: P tuşu ya da pati düğmesi. Yeni hayvan: `data.js` içinde `pets` ve bir `pet_…` mühür eşyası.

## Yeni içerik eklemek

Yeni kılıç: `data.js` içinde `items` listesine eşyayı, `SWORD` tablosuna görünüşünü ekle (profil, eğrilik, çatal, tırtık, işleme türü, balçak, kabza, topuz, mücevher, ışıltı).

Yeni canavar: `data.js` içinde `monsters` ve `spawns` listesine bir satır. Yeni eşya ya da mal: `items` / `goods`. Yeni görev: `quests`.

## Grafik

Silkroad Online havası hedeflendi: alçak üçüncü şahıs kamera, dokulu arazi (çimen, kum, kaya, toprak yol, arnavut kaldırımı) ve bulut gölgeleri, rüzgârda sallanan ağaç ve çimen kartları, derinliğe göre renk alan nehir, bulutlu gökyüzü ve uzak dağlar, bozkır/çöl atmosferi, kıvrık saçaklı kiremit çatılar, fenerler, HDR ışıltı. Ayarlar'daki "Performans" modu gölgeleri ve son işlemeyi kapatır.

## Karakter ve ekipman

Karakter oluşturmada cinsiyet, saç, saç rengi, ten ve ad seçilir. Ekipman yuvaları: silah, kalkan, başlık, omuzluk, göğüslük, kolluk, etek, çizme, küpe, kolye, 2 yüzük. Zırh takımları: Keten, Deri, Pullu, Lamel, Kızıl Yele. Her parça karakterin üstünde ayrı görünür; +5 ve üstü güçlendirilmiş parçaların süsleri parlar. Envanterde eşyayı sürükleyip yuvaya bırak, çift tıkla ya da sağ tıkla kuşan.

## Google ile giriş ve bulut kaydı

`src/config.js` boşken oyun misafir modunda çalışır (kayıt tarayıcıda). Google girişini açmak için:

1. https://console.firebase.google.com → proje oluştur (ücretsiz Spark planı yeter).
2. Authentication → Sign-in method → Google'ı etkinleştir.
3. Authentication → Settings → Authorized domains → oyunun yayınlandığı alan adını ekle.
4. Firestore Database → oluştur → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

5. Project settings → Web app ekle → `firebaseConfig` içindeki `apiKey`, `authDomain`, `projectId`, `appId` değerlerini `src/config.js`'e yaz, `node build.js`.

Giriş yapan oyuncunun ilerlemesi 15 saniyede bir yerele, 30 saniyede bir ve sekme kapanırken buluta yazılır; başka cihazda aynı hesapla açınca en yeni kayıt yüklenir. Misafir ilerlemesi Ayarlar → "Google ile bağlan" ile hesaba taşınır.

`char/` klasöründeki görselden-3D model betikleri artık oyunda kullanılmıyor (karakter kodla üretiliyor); ileride canavar modeli üretmek için duruyor.
