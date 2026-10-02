# Kervan Yolu — kaynak kod

Tarayıcıda çalışan 2.5D kervan RPG prototipi (Three.js r128).

## Yapı

Oyun mantığı ile çizim birbirinden ayrı. 3D'yi değiştirmek ya da ileride çok oyunculuya geçmek için mantığa dokunmak gerekmiyor.

| Dosya | Görev |
|---|---|
| `src/terrain.js` | Arazi yüksekliği, nehir, yol, köprü, kasaba kapıları, rota bulma |
| `src/data.js` | Tüm içerik: canavarlar, eşyalar, yetenekler, mallar, kasabalar, görevler |
| `src/logic.js` | `KY.World`: savaş, seviye, envanter, ticaret, kervan, pusu, kayıt |
| `src/pets.js` | Hayvan sistemi: toplayıcı ve savaş hayvanları, TP, dönüşüm, açlık, ölüm, hayvan çantası |
| `src/models.js` | Kodla üretilen düşük poligonlu karakter ve canavar modelleri |
| `src/swords.js` | Kılıç üreticisi: data.js tariflerinden 3D kılıç, 3D önizleme, simge üretimi |
| `src/scenery.js` | Arazi ağı, ağaçlar, kayalar, kasabalar, köprü (bölgelere ayrılmış tek ağlar) |
| `src/render.js` | `KY.View`: animasyon, efektler, kamera, dokunma/fare |
| `src/ui.js`, `icons.js`, `sfx.js` | HUD, paneller, dükkânlar, mini harita, simgeler, sentez sesler |
| `src/main.js` | Hepsini bağlar, kayıt ve ana döngü |
| `assets/guard.glb` | Oyuncu karakteri: dokulu, iskeletli 3D model ve 7 animasyon (derlemede HTML'e gömülür) |
| `char/` | Karakter hattı: konsept görselden 3D modele, Blender ile temizlik, iskelet ve animasyon |

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

## 3D karakter hattı (ücretsiz)

`assets/guard.glb` şu adımlarla üretildi, hepsi `char/` klasöründe:

1. `concept_crop.png`: konsept görsel (silahsız, zeminsiz, düz arka plan).
2. `run_trellis.py`: Hugging Face üzerindeki Microsoft TRELLIS.2 ile görselden dokulu 3D model. TRELLIS.2 MIT lisanslı, ticari kullanım serbest. Ücretsiz bir Hugging Face hesabının okuma token'ı gerekir, komut satırından verilir, dosyaya yazılmaz:
   `HF_TOKEN=hf_... python3 run_trellis.py`
3. `bl_prep.py`: Blender (pip ile `bpy` 4.2) ile dikiş kaynağı, 1.8 m ölçek, ayak hizası, 14 bin üçgene sadeleştirme.
4. `bl_rig.py`: 21 kemikli iskelet, otomatik ağırlık, Idle / Walk / Run / Attack / Cast / Hit / Die animasyonları, GLB çıktısı.
5. `bl_posecheck.py`: pozları tek görselde gösterir (`poses.png`).

Oyunda `render.js` içindeki `loadGuard` ve `buildSkinned` modeli yükler, kılıcı sağ ele (`hand_R`) takar, animasyonlar arasında yumuşak geçiş yapar. Yeni karakter ya da canavar için aynı hat kullanılır: yeni görsel, aynı betikler, `build.js` içinde `assets` listesine bir satır.
