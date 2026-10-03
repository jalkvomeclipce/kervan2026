/* ============================================================
   KERVAN YOLU — data.js
   Oyunun tüm içeriği: canavarlar, eşyalar, yetenekler, ticaret
   malları, kasaba yerleşimleri, görevler. Yeni içerik eklemek
   için çoğu zaman sadece bu dosyayı düzenlemek yeterli.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.DATA = (function () {
  const T = KY.Terrain;

  const monsters = {
    tilki: {
      name: 'Çayır Tilkisi', lv: 1, hp: 60, atk: 14, def: 2, speed: 4.2, aggro: 0, size: 0.95,
      atkRange: 1.5, atkInt: 1.5, gold: [2, 6], model: 'quad',
      look: { c1: 0xc96a2b, c2: 0xf1e3cf, len: 1.0, h: 0.46, w: 0.44, leg: 0.34, head: 0.36, ears: 'pointy', tail: 0.7, tailBushy: true },
      drops: [['hp1', 0.18], ['mp1', 0.1]]
    },
    domuz: {
      name: 'Yaban Domuzu', lv: 3, hp: 170, atk: 27, def: 7, speed: 4.4, aggro: 0, size: 1.15,
      atkRange: 1.8, atkInt: 1.6, gold: [5, 11], model: 'quad',
      look: { c1: 0x5b4636, c2: 0x3b2d23, len: 1.3, h: 0.7, w: 0.62, leg: 0.34, head: 0.5, ears: 'round', tail: 0.25, tusks: true, mane: 0x2a201a },
      drops: [['hp1', 0.18], ['mp1', 0.1], ['toz', 0.05], ['w2', 0.015], ['a2', 0.015], ['hd2', 0.012], ['gl2', 0.012], ['bt2', 0.012], ['kl1', 0.015], ['yz1', 0.01]]
    },
    kurt: {
      name: 'Boz Kurt', lv: 5, hp: 290, atk: 37, def: 11, speed: 5.8, aggro: 9, size: 1.15,
      atkRange: 1.8, atkInt: 1.5, gold: [8, 16], model: 'quad',
      look: { c1: 0x7d8087, c2: 0xc9c6bf, len: 1.35, h: 0.55, w: 0.46, leg: 0.52, head: 0.44, ears: 'pointy', tail: 0.8, tailBushy: true },
      drops: [['hp1', 0.18], ['mp1', 0.12], ['toz', 0.07], ['w2', 0.02], ['a2', 0.02], ['sd2', 0.014], ['lg2', 0.014], ['hd2', 0.012], ['kl2', 0.01], ['kp1', 0.01], ['ky1', 0.01]]
    },
    haydut: {
      name: 'Çalı Haydudu', lv: 7, hp: 380, atk: 46, def: 15, speed: 5.0, aggro: 10, size: 1.05,
      atkRange: 2.0, atkInt: 1.6, gold: [12, 24], model: 'human',
      look: { skin: 0xc28a62, cloth: 0x5e5a3a, trim: 0x8a3b2a, pants: 0x3b3526, hat: 'hood', weapon: 'blade' },
      drops: [['hp1', 0.22], ['mp1', 0.14], ['toz', 0.09], ['w3', 0.012], ['a3', 0.012], ['hd3', 0.01], ['sd3', 0.01], ['gl3', 0.01], ['yz2', 0.008], ['kp2', 0.006]]
    },
    kizilyele: {
      name: 'Kızıl Yele', lv: 10, hp: 3200, atk: 90, def: 30, speed: 6.2, aggro: 12, size: 1.9, unique: true, respawn: 180,
      atkRange: 3.0, atkInt: 1.8, gold: [300, 450], model: 'quad',
      look: { c1: 0x8e2f22, c2: 0xe0b48a, len: 1.4, h: 0.6, w: 0.5, leg: 0.55, head: 0.48, ears: 'pointy', tail: 0.9, tailBushy: true, mane: 0xd8471f, glowEyes: 0xffc24a },
      drops: [['a5', 1], ['w6', 0.35], ['hd5', 0.4], ['sd5', 0.4], ['gl5', 0.4], ['lg5', 0.4], ['bt5', 0.4], ['toz', 1, 4], ['hp2', 1, 3]]
    },
    akrep: {
      name: 'Kum Akrebi', lv: 9, hp: 480, atk: 60, def: 20, speed: 4.8, aggro: 8, size: 1.25,
      atkRange: 2.0, atkInt: 1.5, gold: [16, 30], model: 'scorpion',
      look: { c1: 0xb07a3a, c2: 0x6e4420 },
      drops: [['hp2', 0.08], ['hp1', 0.15], ['mp1', 0.16], ['toz', 0.11], ['w3', 0.015], ['a3', 0.015], ['lg3', 0.012], ['bt3', 0.012], ['kl3', 0.008], ['ky2', 0.006]]
    },
    kertenkele: {
      name: 'Taş Kertenkele', lv: 11, hp: 560, atk: 66, def: 24, speed: 5.2, aggro: 0, size: 1.3,
      atkRange: 2.0, atkInt: 1.6, gold: [20, 36], model: 'quad',
      look: { c1: 0x7f8a5a, c2: 0xc9b98a, len: 1.8, h: 0.4, w: 0.6, leg: 0.24, head: 0.42, ears: 'none', tail: 1.3, spikes: 0xa25b32 },
      drops: [['hp2', 0.1], ['mp2', 0.07], ['toz', 0.11], ['w4', 0.01], ['a4', 0.01], ['w7', 0.005], ['hd4', 0.008], ['gl4', 0.008], ['bt4', 0.008]]
    },
    yagmaci: {
      name: 'Kervan Yağmacısı', lv: 13, hp: 700, atk: 83, def: 29, speed: 5.4, aggro: 11, size: 1.08,
      atkRange: 2.1, atkInt: 1.5, gold: [26, 44], model: 'human',
      look: { skin: 0xa8734f, cloth: 0x2d2a33, trim: 0xb8862b, pants: 0x1f1d24, hat: 'wrap', weapon: 'blade' },
      drops: [['hp2', 0.15], ['mp2', 0.09], ['toz', 0.13], ['w4', 0.012], ['a4', 0.012], ['w7', 0.007], ['sd4', 0.008], ['lg4', 0.008], ['kl4', 0.006], ['yz3', 0.004], ['kp3', 0.004], ['ky3', 0.004]]
    },
    tasdev: {
      name: 'Taş Dev', lv: 16, hp: 9000, atk: 160, def: 60, speed: 4.0, aggro: 12, size: 2.4, unique: true, respawn: 240,
      atkRange: 3.6, atkInt: 2.2, gold: [1200, 1600], model: 'golem',
      look: { c1: 0x8b7a66, c2: 0x5e5246, glow: 0xff8a2a },
      drops: [['w5', 1], ['w8', 0.35], ['kl4', 0.5], ['yz3', 0.3], ['ky3', 0.3], ['toz', 1, 8], ['hp2', 1, 5]]
    }
  };
  for (const k in monsters) {
    const m = monsters[k];
    m.id = k;
    // denge çarpanları (bot simülasyonuyla ayarlandı)
    m.hp = Math.round(m.hp * (m.unique ? 4 : 3));
    m.atk = Math.round(m.atk * (m.unique ? 1.7 : 1.5));
    m.xp = Math.round((10 + Math.pow(m.lv, 1.6) * 8) * (m.unique ? 9 : 1));
  }

  const items = {
    hp1: { name: 'Küçük Can İksiri', type: 'potion', hp: 180, price: 12, stack: 50, icon: 'potR', desc: 'Anında 180 can yeniler.' },
    hp2: { name: 'Büyük Can İksiri', type: 'potion', hp: 520, price: 40, stack: 50, icon: 'potR2', desc: 'Anında 520 can yeniler.' },
    mp1: { name: 'Küçük Ruh İksiri', type: 'potion', mp: 120, price: 12, stack: 50, icon: 'potB', desc: 'Anında 120 ruh (MP) yeniler.' },
    mp2: { name: 'Büyük Ruh İksiri', type: 'potion', mp: 340, price: 40, stack: 50, icon: 'potB2', desc: 'Anında 340 ruh (MP) yeniler.' },
    toz: { name: 'Güçlendirme Tozu', type: 'material', price: 30, sell: 8, stack: 99, icon: 'toz', desc: 'Demircide silah ve zırhı güçlendirmek için kullanılır.' },

    w1: { name: 'Paslı Kılıç', type: 'weapon', atk: 10, lv: 1, price: 20, icon: 'sword', tier: 0, desc: 'Yolculuğun ilk yoldaşı. Pası bile hikâye anlatır.' },
    w2: { name: 'Demir Kılıç', type: 'weapon', atk: 22, lv: 4, price: 260, icon: 'sword', tier: 1, desc: 'Sarıkum demircisinin dövdüğü, oluklu sağlam kılıç.' },
    w3: { name: 'Çelik Pala', type: 'weapon', atk: 38, lv: 8, price: 900, icon: 'sword', tier: 2, desc: 'Ucuna doğru genişleyen kavisli pala. Hafif ve dengeli.' },
    w4: { name: 'Hilal Kılıç', type: 'weapon', atk: 56, lv: 12, price: 2400, icon: 'sword', tier: 3, desc: 'Taşkale ustalarının altın işlemeli, kanatlı balçaklı kılıcı.' },
    w6: { name: 'Ayaz Rünü', type: 'weapon', atk: 46, lv: 10, price: 1800, icon: 'sword', tier: 3, desc: 'Buz taşından dövülmüş. Rünleri soğuk bir mavi ışıkla yanar.' },
    w7: { name: 'Güneş Pençesi', type: 'weapon', atk: 64, lv: 13, price: 0, sell: 1100, icon: 'sword', tier: 3, desc: 'Çatallı ağzı hâlâ çöl güneşinin sıcaklığını taşır.' },
    w5: { name: 'Ejder Dişi', type: 'weapon', atk: 80, lv: 15, price: 0, sell: 1500, icon: 'sword', tier: 4, desc: 'Taş Dev\'in göğsünden sökülen kara çelik. Altın işlemeleri ve kan yakutu var.' },
    w8: { name: 'Hiçlik Yarığı', type: 'weapon', atk: 88, lv: 16, price: 0, sell: 2000, icon: 'sword', tier: 4, desc: 'Mor kristal damarlı dev satır. Halka balçağındaki taş fısıldar.' },

    pet_tavsan: { name: 'Pamuk Tavşan Mührü', type: 'pet', pet: 'tavsan', price: 300, icon: 'paw', desc: 'Toplayıcı hayvan. Yere düşen ganimeti toplar, 20 gözlük çanta taşır.' },
    pet_sincap: { name: 'Çevik Sincap Mührü', type: 'pet', pet: 'sincap', price: 450, icon: 'paw', desc: 'Toplayıcı hayvan. Hızlıdır, 20 gözlük çanta taşır.' },
    pet_fenek: { name: 'Kum Tilkisi Mührü', type: 'pet', pet: 'fenek', price: 650, icon: 'paw', desc: 'Toplayıcı hayvan. Geniş alandan toplar, 24 gözlük çanta taşır.' },
    pet_kurt: { name: 'Kurt Yavrusu Mührü', type: 'pet', pet: 'kurt', price: 800, icon: 'paw', desc: 'Savaş hayvanı. Seninle savaşır, büyür, 10. ve 20. seviyede dönüşür.' },
    pet_sahin: { name: 'Şahin Yavrusu Mührü', type: 'pet', pet: 'sahin', price: 1200, icon: 'paw', desc: 'Uçan savaş hayvanı. Canı az ama hızlı ve sert vurur. 10. ve 20. seviyede dönüşür.' },
    yem: { name: 'Kuru Et', type: 'petitem', price: 6, stack: 99, icon: 'meat', desc: 'Savaş hayvanının açlığını yarı yarıya giderir.' },
    merhem: { name: 'Hayvan Merhemi', type: 'petitem', price: 14, stack: 50, icon: 'salve', desc: 'Savaş hayvanının canının yarısını yeniler.' },
    hayatotu: { name: 'Hayat Otu', type: 'petitem', price: 150, stack: 20, icon: 'herb', desc: 'Ölen savaş hayvanını diriltir. Ölü hayvan bu ot olmadan çağrılamaz.' },
    muska: { name: 'Süre Muskası', type: 'petitem', price: 200, stack: 20, icon: 'amulet', desc: 'Toplayıcı hayvanın çağırma süresini 28 gün uzatır.' },

    a1: { name: 'Keten Cübbe', type: 'armor', def: 6, lv: 1, price: 20, icon: 'armor', tier: 0, desc: 'Hafif ve yolcu dostu.' },
    a2: { name: 'Deri Zırh', type: 'armor', def: 14, lv: 4, price: 240, icon: 'armor', tier: 1, desc: 'Sertleştirilmiş deri.' },
    a3: { name: 'Pullu Zırh', type: 'armor', def: 26, lv: 8, price: 850, icon: 'armor', tier: 2, desc: 'Üst üste binen demir pullar.' },
    a4: { name: 'Lamel Zırh', type: 'armor', def: 40, lv: 12, price: 2200, icon: 'armor', tier: 3, desc: 'Deri şeritlerle bağlanmış çelik levhalar.' },
    a5: { name: 'Kızıl Yele Postu', type: 'armor', def: 34, hpBonus: 150, lv: 10, price: 0, sell: 1200, icon: 'armor', tier: 4, desc: 'Kızıl Yele\'nin postu. +150 can.' }
  };
  // ---- Ekipman: Silkroad tarzı yuvalar, zırh takımları, kalkan ve takılar ----
  // Her zırh parçası karakterin üstünde ayrı bir 3D parça olarak görünür (avatar.js).
  const eqSlots = ['weapon', 'shield', 'head', 'shoulder', 'armor', 'hands', 'legs', 'feet', 'earring', 'necklace', 'ring1', 'ring2'];
  const slotName = { weapon: 'Silah', shield: 'Kalkan', head: 'Başlık', shoulder: 'Omuzluk', armor: 'Göğüslük', hands: 'Kolluk', legs: 'Etek', feet: 'Çizme', earring: 'Küpe', necklace: 'Kolye', ring1: 'Yüzük', ring2: 'Yüzük' };
  const equipTypes = { weapon: 1, shield: 1, head: 1, shoulder: 1, armor: 1, hands: 1, legs: 1, feet: 1, earring: 1, necklace: 1, ring: 1 };
  const armorParts = ['head', 'shoulder', 'armor', 'hands', 'legs', 'feet'];
  const SETS = [
    { key: 'keten', lv: 1, def: 6, price: 20, names: { head: 'Keten Alınlık', shoulder: 'Keten Omuz Sargısı', hands: 'Keten Kolluk', legs: 'Keten Etek', feet: 'Hasır Sandalet' },
      desc: 'Hafif keten. Yolcunun ilk takımı.' },
    { key: 'deri', lv: 4, def: 14, price: 240, names: { head: 'Deri Başlık', shoulder: 'Deri Omuzluk', hands: 'Deri Kolluk', legs: 'Deri Etek', feet: 'Deri Çizme' },
      desc: 'Yağda sertleştirilmiş deri, perçinli.' },
    { key: 'pullu', lv: 8, def: 26, price: 850, names: { head: 'Pullu Miğfer', shoulder: 'Pullu Omuzluk', hands: 'Pullu Kolluk', legs: 'Pullu Etek', feet: 'Pullu Çizme' },
      desc: 'Üst üste binen demir pullar, tunç kenarlıklar.' },
    { key: 'lamel', lv: 12, def: 40, price: 2200, names: { head: 'Lamel Miğfer', shoulder: 'Lamel Omuzluk', hands: 'Lamel Kolluk', legs: 'Lamel Etek', feet: 'Lamel Çizme' },
      desc: 'İpek kordonla bağlanmış laklı çelik levhalar, altın işleme.' },
    { key: 'kizil', lv: 10, def: 34, price: 0, unique: true, names: { head: 'Kızıl Yele Başlığı', shoulder: 'Kızıl Yele Omuzluğu', hands: 'Kızıl Yele Pençeleri', legs: 'Kızıl Yele Eteği', feet: 'Kızıl Yele Çizmesi' },
      desc: 'Kızıl Yele\'nin postundan. Her parça +30 can verir.' }
  ];
  const PART = { head: [0.45, 0.5, 'hd'], shoulder: [0.35, 0.45, 'sd'], hands: [0.25, 0.35, 'gl'], legs: [0.5, 0.6, 'lg'], feet: [0.3, 0.4, 'bt'] };
  SETS.forEach((S, t) => {
    items['a' + (t + 1)].set = S.key;
    for (const part in PART) {
      const [dm, pm, pre] = PART[part], id = pre + (t + 1);
      items[id] = { name: S.names[part], type: part, def: Math.max(1, Math.round(S.def * dm)), lv: S.lv, tier: t, set: S.key, icon: part,
        price: S.unique ? 0 : Math.round(S.price * pm / 5) * 5, desc: S.desc };
      if (S.unique) { items[id].hpBonus = 30; items[id].sell = 300; }
    }
  });
  Object.assign(items, {
    kl1: { name: 'Söğüt Kalkan', type: 'shield', def: 4, lv: 2, price: 60, tier: 0, icon: 'shield', desc: 'Örme söğüt dalları, deri kenarlık.' },
    kl2: { name: 'Demir Çemberli Kalkan', type: 'shield', def: 10, lv: 5, price: 320, tier: 1, icon: 'shield', desc: 'Meşe gövde, demir çember ve göbek.' },
    kl3: { name: 'Pullu Kalkan', type: 'shield', def: 18, lv: 9, price: 950, tier: 2, icon: 'shield', desc: 'Tunç pullarla kaplı yuvarlak kalkan.' },
    kl4: { name: 'Hilal Kalkan', type: 'shield', def: 28, lv: 12, price: 2300, tier: 3, icon: 'shield', desc: 'Taşkale işi, altın hilal kakmalı lake kalkan.' },
    kp1: { name: 'Bakır Küpe', type: 'earring', magBonus: 3, lv: 2, price: 80, tier: 0, icon: 'earring', desc: 'Büyü saldırısı +3.' },
    kp2: { name: 'Gümüş Küpe', type: 'earring', magBonus: 8, lv: 7, price: 600, tier: 1, icon: 'earring', desc: 'Büyü saldırısı +8.' },
    kp3: { name: 'Firuze Küpe', type: 'earring', magBonus: 16, critBonus: 0.02, lv: 12, price: 2000, tier: 3, icon: 'earring', desc: 'Büyü saldırısı +16, kritik +%2.' },
    ky1: { name: 'Kemik Kolye', type: 'necklace', hpBonus: 40, lv: 2, price: 90, tier: 0, icon: 'necklace', desc: '+40 can.' },
    ky2: { name: 'Gümüş Kolye', type: 'necklace', hpBonus: 120, lv: 7, price: 650, tier: 1, icon: 'necklace', desc: '+120 can.' },
    ky3: { name: 'Kehribar Kolye', type: 'necklace', hpBonus: 260, lv: 12, price: 2100, tier: 3, icon: 'necklace', desc: '+260 can.' },
    yz1: { name: 'Bakır Yüzük', type: 'ring', atkBonus: 3, lv: 2, price: 70, tier: 0, icon: 'ring', desc: 'Fiziksel saldırı +3.' },
    yz2: { name: 'Gümüş Yüzük', type: 'ring', atkBonus: 8, lv: 7, price: 600, tier: 1, icon: 'ring', desc: 'Fiziksel saldırı +8.' },
    yz3: { name: 'Yakut Yüzük', type: 'ring', atkBonus: 15, critBonus: 0.02, lv: 12, price: 2000, tier: 3, icon: 'ring', desc: 'Fiziksel saldırı +15, kritik +%2.' }
  });
  items.a1.name = 'Keten Gömlek'; items.a1.desc = 'Hafif keten. Yolcunun ilk takımı.';

  // Kılıç görünüşleri: swords.js bu tariflerden 3D model üretir.
  // prof: [bıçak boyu oranı, yarım genişlik], curve: eğrilik, teeth: [baş, son, adet, derinlik],
  // split: çatallı bıçak, slant: eğik uç, inlay: bıçak ortasındaki işleme (runes/gold/crystal/fuller)
  const SWORD = {
    w1: { len: 0.74, prof: [[0, 0.042], [0.78, 0.037], [1, 0]], thick: 0.017, edgeW: 0.011,
      grad: [[0, '#4a3a2c'], [0.45, '#6a5a4c'], [1, '#7d7368']], edge: 0x8d8478, rough: 0.82, metal: 0.45, rust: 1,
      guard: { type: 'bar', color: 0x4f463e, rough: 0.7, metal: 0.6 },
      grip: { len: 0.2, r: 0.021, color: '#3a271a', wrap: '#5a3d27', bands: 0x4f463e }, pommel: { type: 'cap', color: 0x4f463e } },
    w2: { len: 0.86, prof: [[0, 0.047], [0.76, 0.041], [1, 0]], thick: 0.018, edgeW: 0.011,
      grad: [[0, '#6d757e'], [1, '#aeb5bd']], edge: 0xdfe4e9, rough: 0.42, metal: 0.88,
      inlay: { from: 0.03, to: 0.74, frac: 0.24, style: 'fuller' },
      guard: { type: 'bardown', color: 0x6b727a, rough: 0.45 },
      grip: { len: 0.21, r: 0.021, color: '#271c16', wrap: '#4b3527', bands: 0x8c939b }, pommel: { type: 'cap', color: 0x8c939b } },
    w3: { len: 0.93, prof: [[0, 0.04], [0.5, 0.054], [0.8, 0.06], [0.93, 0.032], [1, 0]], curve: 0.17, thick: 0.016, edgeW: 0.01,
      grad: [[0, '#88929c'], [1, '#cdd4db']], edge: 0xf2f5f8, rough: 0.28, metal: 0.92,
      inlay: { from: 0.05, to: 0.55, frac: 0.12, style: 'gold', color: '#d9ad4e' },
      guard: { type: 'crescent', color: 0xb8923e, rough: 0.32 },
      grip: { len: 0.2, r: 0.02, color: '#5a1d17', wrap: '#8c2f25', bands: 0xb8923e }, pommel: { type: 'spike', color: 0xb8923e } },
    w4: { len: 1.0, prof: [[0, 0.056], [0.35, 0.07], [0.72, 0.074], [0.9, 0.045], [1, 0]], curve: 0.06, thick: 0.019, edgeW: 0.012,
      grad: [[0, '#939daa'], [1, '#d8dee5']], edge: 0xf6f8fa, rough: 0.26, metal: 0.92,
      inlay: { from: 0.04, to: 0.72, frac: 0.36, style: 'gold', color: '#e3b650' },
      guard: { type: 'wings', color: 0xd9b25c, rough: 0.28 }, gem: 0x27cbb8,
      grip: { len: 0.22, r: 0.022, color: '#1c3638', wrap: '#2f6f73', bands: 0xd9b25c }, pommel: { type: 'gem', color: 0xd9b25c, gem: 0x27cbb8 } },
    w6: { len: 1.0, prof: [[0, 0.07], [0.6, 0.079], [0.85, 0.08], [1, 0]], thick: 0.026, edgeW: 0.013,
      grad: [[0, '#274f5a'], [0.55, '#4f8492'], [1, '#7fb4c1']], edge: 0xc4eef5, rough: 0.42, metal: 0.35, cracks: 1,
      inlay: { from: 0.04, to: 0.8, frac: 0.44, style: 'runes', color: '#5ff4ff', base: '#0b3440', glow: 1.3 },
      guard: { type: 'wings', color: 0x383d46, rough: 0.5, metal: 0.8 }, gem: 0x4ff0ff, glow: 0x4fe8ff,
      grip: { len: 0.22, r: 0.022, color: '#171d22', wrap: '#28666c', bands: 0x383d46 }, pommel: { type: 'spike', color: 0x383d46 } },
    w7: { len: 1.05, prof: [[0, 0.076], [1, 0.07]], split: { t: 0.3, gap: 0.021, top: 0.92 }, teeth: [0.5, 0.95, 3, -0.018], thick: 0.022, edgeW: 0.008,
      grad: [[0, '#ffc03a'], [0.22, '#e2641b'], [0.48, '#4c2d24'], [1, '#231f1d']], edge: 0x5f5249, rough: 0.45, metal: 0.65, flame: 1,
      guard: { type: 'flame', color: 0xe3ab2f, rough: 0.24 }, gem: 0xff7a1a, glow: 0xff8a2a,
      grip: { len: 0.23, r: 0.022, color: '#181210', wrap: '#3a291f', bands: 0xe3ab2f }, pommel: { type: 'spike', color: 0xe3ab2f } },
    w5: { len: 1.1, prof: [[0, 0.06], [0.2, 0.066], [0.6, 0.056], [0.85, 0.04], [1, 0]], teeth: [0.12, 0.4, 5, 0.017], thick: 0.02, edgeW: 0.008,
      grad: [[0, '#26222c'], [0.6, '#38313f'], [1, '#554d5d']], edge: 0x8d8599, rough: 0.34, metal: 0.86,
      inlay: { from: 0.02, to: 0.8, frac: 0.44, style: 'gold', color: '#e6b85a', base: '#1f1a22' },
      guard: { type: 'ornate', color: 0xd1a24c, rough: 0.26 }, gem: 0xff2436, glow: 0xff4a3a,
      grip: { len: 0.23, r: 0.023, color: '#111724', wrap: '#23324c', bands: 0xd1a24c }, pommel: { type: 'gem', color: 0xd1a24c, gem: 0xff2436 } },
    w8: { len: 1.02, prof: [[0, 0.086], [0.5, 0.1], [1, 0.106]], slant: 0.22, thick: 0.032, edgeW: 0.012,
      grad: [[0, '#2c2432'], [1, '#4a3e52']], edge: 0x7c6c89, rough: 0.6, metal: 0.45, chips: 1,
      inlay: { from: 0.06, to: 0.8, frac: 0.62, style: 'crystal', color: '#b44bff', base: '#26093f', glow: 1.35 },
      guard: { type: 'ring', color: 0x9c6b3f, rough: 0.45, metal: 0.8, stone: 0x6b5d62 }, gem: 0xc05cff, glow: 0xb44bff,
      grip: { len: 0.24, r: 0.024, color: '#521313', wrap: '#8a1f1f', bands: 0x5a4a3e }, pommel: { type: 'cap', color: 0x9c6b3f } }
  };
  for (const k in SWORD) items[k].sword = SWORD[k];
  for (const k in items) { items[k].id = k; if (items[k].sell == null) items[k].sell = Math.floor(items[k].price * 0.3); }

  // Güçlendirme: +N'den +N+1'e çıkma şansı
  const enhance = {
    max: 9,
    chance: [0.95, 0.9, 0.8, 0.66, 0.52, 0.4, 0.3, 0.22, 0.15],
    cost: (plus) => 25 * (plus + 1) * (plus + 1),
    bonus: 0.12   // her + için temel statın %12'si
  };

  // Hayvanlar. Toplayıcılar ölümsüzdür ve süreyle çağrılır; savaş hayvanları büyür, acıkır, ölebilir.
  const pets = {
    tavsan: { type: 'grab', name: 'Pamuk Tavşan', bag: 20, days: 28, speed: 9.5, reach: 14, size: 0.85,
      look: { c1: 0xf1ede4, c2: 0xffc9cf, len: 0.56, h: 0.36, w: 0.36, leg: 0.12, head: 0.32, ears: 'long', earScale: 1.2, tail: 0.1, tailBushy: true },
      desc: 'Yumuşak tüylü, meraklı bir tavşan. Yere düşen ganimeti senin yerine toplar.' },
    sincap: { type: 'grab', name: 'Çevik Sincap', bag: 20, days: 28, speed: 11, reach: 15, size: 0.85,
      look: { c1: 0xb8642e, c2: 0xf1d6b0, len: 0.5, h: 0.3, w: 0.3, leg: 0.14, head: 0.3, ears: 'pointy', tail: 0.62, tailBushy: true, tailRot: 1.25 },
      desc: 'Ağaçtan ağaca sıçrayan çevik bir sincap. Kervanlardan düşen malları toplamayı sever.' },
    fenek: { type: 'grab', name: 'Kum Tilkisi', bag: 24, days: 28, speed: 10, reach: 20, size: 0.9,
      look: { c1: 0xe0bf86, c2: 0xfff1d8, len: 0.62, h: 0.3, w: 0.3, leg: 0.22, head: 0.3, ears: 'pointy', earScale: 2.3, tail: 0.5, tailBushy: true },
      desc: 'Kocaman kulaklı çöl tilkisi. Kumdaki en küçük altın parıltısını bile duyar.' },
    kurt: { type: 'fight', model: 'quad', hp: [220, 95], atk: [13, 5.3], def: [6, 3.2], range: 1.8, atkInt: 1.4, speed: 9,
      forms: [
        { lv: 1, name: 'Kurt Yavrusu', size: 0.55, look: { c1: 0x8a8d94, c2: 0xd6d2c8, len: 1.2, h: 0.55, w: 0.5, leg: 0.42, head: 0.52, ears: 'pointy', earScale: 1.2, tail: 0.6, tailBushy: true } },
        { lv: 10, name: 'Bozkır Kurdu', size: 0.85, look: { c1: 0x6f727a, c2: 0xcfcac0, len: 1.35, h: 0.55, w: 0.48, leg: 0.52, head: 0.46, ears: 'pointy', tail: 0.8, tailBushy: true, mane: 0x55585f } },
        { lv: 20, name: 'Gök Kurt', size: 1.1, look: { c1: 0xd8e2ec, c2: 0xffffff, len: 1.4, h: 0.58, w: 0.5, leg: 0.55, head: 0.48, ears: 'pointy', tail: 0.9, tailBushy: true, mane: 0x8fb8ff, glowEyes: 0x7fd8ff } }
      ],
      desc: 'Sadık ve dayanıklı. Düşmanın üstüne ilk o atılır, canavarların dikkatini üstüne çeker.' },
    sahin: { type: 'fight', model: 'bird', hp: [150, 62], atk: [16, 5.8], def: [4, 2.2], range: 2.2, atkInt: 1.15, speed: 11, fly: 2.3,
      forms: [
        { lv: 1, name: 'Şahin Yavrusu', size: 0.65, look: { c1: 0x7a5a3e, c2: 0xe8d7b8, beak: 0xe0a82e, wing: 0x5e4430, tip: 0x3a2a1e } },
        { lv: 10, name: 'Doğan', size: 0.9, look: { c1: 0x4a3a2e, c2: 0xd9c7a4, beak: 0xe0a82e, wing: 0x2e241c, tip: 0x1a1410 } },
        { lv: 20, name: 'Ak Tuğrul', size: 1.1, look: { c1: 0xf2efe6, c2: 0xffffff, beak: 0xffc040, wing: 0xe8e2d2, tip: 0xd9a441, glowEyes: 0xffd46b } }
      ],
      desc: 'Keskin gözlü ve hızlı. Canı az ama pençesi sert. Tuğrul, göklerin efsanevi kuşudur.' }
  };
  const petRules = {
    xpShare: 0.6,          // canavar TP'sinin hayvana giden payı
    xpNeed: (lv) => Math.floor(60 * Math.pow(lv, 1.8) + 40),
    hungerPerSec: 100 / 1500,   // tokluk 100'den 0'a ~25 dakikada iner
    starveDmg: 0.012,      // aç kalınca saniyede canın %1,2'si gider
    dayMs: 86400000
  };
  const trees = {
    kilic: { name: 'Kılıç Ustalığı', stat: 'GÜÇ', desc: 'Yakın dövüş. Güç (STR) ile güçlenir.' },
    ates: { name: 'Ateş Ustalığı', stat: 'ZEKÂ', desc: 'Ateş büyüleri ve şifa. Zekâ (INT) ile güçlenir.' }
  };

  const skills = {
    yarma: { name: 'Yarma Darbesi', tree: 'kilic', unlock: 1, mp: 8, cd: 3, range: 2.6, kind: 'phys', mult: [1.6, 0.05], icon: 'yarma', desc: 'Hedefe güçlü bir kılıç darbesi.' },
    kasirga: { name: 'Kasırga', tree: 'kilic', unlock: 5, mp: 22, cd: 9, aoe: 5, self: true, kind: 'phys', mult: [1.25, 0.04], icon: 'kasirga', desc: 'Kendi etrafında dönüp çevredeki tüm düşmanları biçer.' },
    demir: { name: 'Demir Beden', tree: 'kilic', unlock: 9, mp: 30, cd: 45, self: true, buff: { def: 0.45, dur: 25 }, icon: 'demir', desc: '25 saniye boyunca savunmayı %45 artırır.' },
    atesTopu: { name: 'Ateş Topu', tree: 'ates', unlock: 1, mp: 12, cd: 2.5, range: 20, kind: 'mag', mult: [1.7, 0.06], projectile: true, icon: 'atesTopu', desc: 'Uzaktaki hedefe alev topu fırlatır.' },
    alevHalka: { name: 'Alev Halkası', tree: 'ates', unlock: 6, mp: 30, cd: 12, range: 18, aoe: 5.5, kind: 'mag', mult: [1.3, 0.05], burn: [0.25, 3], icon: 'alevHalka', desc: 'Hedefin çevresini tutuşturur, 3 saniye yanma hasarı verir.' },
    sifa: { name: 'Şifa Işığı', tree: 'ates', unlock: 3, mp: 25, cd: 16, self: true, heal: [0.25, 0.01], icon: 'sifa', desc: 'Canının dörtte birini yeniler (ustalıkla artar).' }
  };
  for (const k in skills) skills[k].id = k;
  const skillBar = ['yarma', 'kasirga', 'demir', 'atesTopu', 'alevHalka', 'sifa'];

  const goods = {
    ipek: { name: 'İpek Top', from: 'sarikum', base: 40, icon: 'ipek', trade: 1 },
    cay: { name: 'Çay Sandığı', from: 'sarikum', base: 22, icon: 'cay', trade: 1 },
    porselen: { name: 'Porselen', from: 'sarikum', base: 66, icon: 'porselen', trade: 3 },
    baharat: { name: 'Baharat Çuvalı', from: 'taskale', base: 30, icon: 'baharat', trade: 1 },
    tuz: { name: 'Kaya Tuzu', from: 'taskale', base: 16, icon: 'tuz', trade: 1 },
    kilim: { name: 'Kilim', from: 'taskale', base: 72, icon: 'kilim', trade: 3 }
  };
  for (const k in goods) goods[k].id = k;
  const trade = {
    routeMult: 1.75,        // karşı kasabada satış çarpanı
    sameTownMult: 0.8,      // aynı kasabaya geri satış
    capacity: (lv) => 8 + 4 * (lv - 1),
    bonus: (lv) => 0.03 * (lv - 1),
    xpNeed: (lv) => Math.floor(220 * Math.pow(lv, 1.5)),
    maxLv: 10,
    camelHp: (lv) => 420 + 160 * lv,
    teleportCost: 40
  };

  // Canavar bölgeleri: merkez, yarıçap, tür, adet
  const spawns = [
    { type: 'tilki', x: -98, z: -30, r: 12, n: 6 },
    { type: 'tilki', x: -100, z: 28, r: 12, n: 5 },
    { type: 'tilki', x: -150, z: 30, r: 10, n: 4 },
    { type: 'domuz', x: -72, z: -42, r: 14, n: 5 },
    { type: 'domuz', x: -66, z: 38, r: 13, n: 5 },
    { type: 'kurt', x: -42, z: -58, r: 14, n: 5 },
    { type: 'kurt', x: -140, z: 62, r: 12, n: 5 },
    { type: 'haydut', x: -36, z: 30, r: 12, n: 4 },
    { type: 'haydut', x: -100, z: -72, r: 11, n: 4 },
    { type: 'kizilyele', x: -150, z: -80, r: 7, n: 1 },
    { type: 'akrep', x: 34, z: -32, r: 13, n: 6 },
    { type: 'akrep', x: 44, z: 40, r: 12, n: 5 },
    { type: 'kertenkele', x: 72, z: -58, r: 14, n: 5 },
    { type: 'kertenkele', x: 82, z: 48, r: 14, n: 5 },
    { type: 'yagmaci', x: 98, z: -30, r: 10, n: 4 },
    { type: 'yagmaci', x: 150, z: 58, r: 11, n: 4 },
    { type: 'tasdev', x: 152, z: -80, r: 8, n: 1 }
  ];

  // Kasaba NPC'leri (kasaba merkezine göre konum)
  const npcRoles = {
    tuccar: { title: 'Tüccar', shop: ['hp1', 'mp1', 'hp2', 'mp2', 'kp1', 'ky1', 'yz1', 'kp2', 'ky2', 'yz2', 'kp3', 'ky3', 'yz3'] },
    demirci: { title: 'Demirci' },
    kervan: { title: 'Kervan Ustası' },
    kapi: { title: 'Yol Kapısı' },
    hayvan: { title: 'Hayvan Terbiyecisi' }
  };
  const towns = {
    sarikum: {
      style: 'steppe',
      npcs: [
        { role: 'tuccar', name: 'Ayşe Hatun', g: 'f', dx: -5.5, dz: -6.5, look: { skin: 0xd9a47c, cloth: 0x2f6f73, trim: 0xe0b44a, pants: 0x274b4e, hat: 'cone' } },
        { role: 'demirci', name: 'Usta Demir', dx: 6.5, dz: -6.5, look: { skin: 0xb9805a, cloth: 0x4a3a2c, trim: 0x8c5a2b, pants: 0x2d2620, hat: 'band', weapon: 'hammer' }, shop: ['w2', 'w3', 'kl1', 'kl2', 'hd1', 'sd1', 'gl1', 'a2', 'hd2', 'sd2', 'gl2', 'lg2', 'bt2', 'a3', 'hd3', 'sd3', 'gl3', 'lg3', 'bt3', 'toz'] },
        { role: 'kervan', name: 'Kervanbaşı Yusuf', dx: 7, dz: 6.5, look: { skin: 0xc9926a, cloth: 0x8a2f2a, trim: 0xe7c46a, pants: 0x4a2622, hat: 'wrap', weapon: 'staff' } },
        { role: 'kapi', name: 'Yol Kapısı', dx: -8.5, dz: 6.5 },
        { role: 'hayvan', name: 'Çoban Kaya', dx: 2.5, dz: 7.2, look: { skin: 0xc68d62, cloth: 0x6b5a2e, trim: 0xd9b25c, pants: 0x3a3022, hat: 'band', weapon: 'staff' }, shop: ['pet_tavsan', 'pet_sincap', 'pet_kurt', 'yem', 'merhem', 'hayatotu', 'muska'] }
      ],
      spawn: { dx: 0, dz: 2.5 },
      buildings: [
        { k: 'yurt', dx: -10, dz: -12, s: 1.1 }, { k: 'yurt', dx: 1, dz: -14, s: 1.25 }, { k: 'yurt', dx: 12, dz: -12.5, s: 1.0 },
        { k: 'yurt', dx: -14, dz: 12, s: 1.15 }, { k: 'house', dx: -2, dz: 14, s: 1.0, r: 0.1 }, { k: 'house', dx: 14, dz: 13, s: 0.9, r: -0.3 },
        { k: 'tower', dx: -15, dz: -9, s: 1.0 }, { k: 'pen', dx: 11.5, dz: 7.5, s: 1 }, { k: 'forge', dx: 9.5, dz: -8.5, s: 1 },
        { k: 'stall', dx: -6, dz: -9.2, s: 1, c: 0xb3372e }, { k: 'stall', dx: -1.5, dz: -9.2, s: 1, c: 0x2e6fa8 }, { k: 'well', dx: 0, dz: -3.5, s: 1 }
      ],
      wall: 'palisade'
    },
    taskale: {
      style: 'desert',
      npcs: [
        { role: 'tuccar', name: 'Selim Efendi', dx: -5.5, dz: -6.5, look: { skin: 0xb07650, cloth: 0xd6c19a, trim: 0x2f6f73, pants: 0x8a7556, hat: 'wrap' } },
        { role: 'demirci', name: 'Kara Hasan', dx: 6.5, dz: -6.5, look: { skin: 0x9a6442, cloth: 0x3a2f28, trim: 0xc2572b, pants: 0x2a221e, hat: 'band', weapon: 'hammer' }, shop: ['w3', 'w6', 'w4', 'kl3', 'kl4', 'a3', 'lg3', 'bt3', 'a4', 'hd4', 'sd4', 'gl4', 'lg4', 'bt4', 'toz'] },
        { role: 'kervan', name: 'Kervanbaşı Leyla', g: 'f', dx: 7, dz: 6.5, look: { skin: 0xc48e66, cloth: 0x3c4f8a, trim: 0xe7c46a, pants: 0x28325a, hat: 'wrap', weapon: 'staff' } },
        { role: 'kapi', name: 'Yol Kapısı', dx: -8.5, dz: 6.5 },
        { role: 'hayvan', name: 'Bahar Hatun', g: 'f', dx: 2.5, dz: 7.2, look: { skin: 0xb98056, cloth: 0x7a2f5a, trim: 0xe7c46a, pants: 0x3a2030, hat: 'wrap', weapon: 'staff' }, shop: ['pet_fenek', 'pet_sahin', 'pet_kurt', 'yem', 'merhem', 'hayatotu', 'muska'] }
      ],
      spawn: { dx: 0, dz: 2.5 },
      buildings: [
        { k: 'flat', dx: -11, dz: -12.5, s: 1.1 }, { k: 'dome', dx: 1, dz: -14, s: 1.2 }, { k: 'flat', dx: 12.5, dz: -12.5, s: 1.0 },
        { k: 'flat', dx: -13, dz: 12.5, s: 1.0 }, { k: 'flat', dx: -2, dz: 14, s: 1.2 }, { k: 'dome', dx: 13, dz: 13, s: 0.9 },
        { k: 'minaret', dx: -15.5, dz: -9.5, s: 1.0 }, { k: 'pen', dx: 11.5, dz: 7.5, s: 1 }, { k: 'forge', dx: 9.5, dz: -8.5, s: 1 },
        { k: 'stall', dx: -6, dz: -9.2, s: 1, c: 0x2f6f73 }, { k: 'stall', dx: -1.5, dz: -9.2, s: 1, c: 0xc98a2b }, { k: 'well', dx: 0, dz: -3.5, s: 1 },
        { k: 'palm', dx: -3, dz: 5.5, s: 1 }, { k: 'palm', dx: 3.5, dz: 10, s: 0.9 }
      ],
      wall: 'stone'
    }
  };

  const quests = [
    { id: 'q1', name: 'İlk Av', text: 'Kasabanın dışındaki Çayır Tilkilerini avla.', goal: { kind: 'kill', type: 'tilki', n: 6 }, reward: { xp: 90, gold: 60, items: [['hp1', 5]] } },
    { id: 'q2', name: 'Ustalık Yolu', text: 'Yetenekler panelinden bir ustalığı 3. seviyeye çıkar.', goal: { kind: 'mastery', n: 3 }, reward: { gold: 80, items: [['mp1', 5]] } },
    { id: 'q3', name: 'Yaban Domuzları', text: 'Yaban Domuzlarından 6 tane avla.', goal: { kind: 'kill', type: 'domuz', n: 6 }, reward: { xp: 300, gold: 120, items: [['toz', 2]] } },
    { id: 'q4', name: 'Keskin Kılıç', text: 'Demirciden daha iyi bir silah al ya da silahını +2\'ye güçlendir.', goal: { kind: 'weapon', n: 2 }, reward: { gold: 150, items: [['toz', 2]] } },
    { id: 'q5', name: 'İlk Kervan', text: 'Kervan Ustası\'ndan mal al, Taşkale\'ye götürüp kârla sat.', goal: { kind: 'trade', town: 'taskale' }, reward: { xp: 600, gold: 250 } },
    { id: 'q6', name: 'Kurt Sürüsü', text: 'Boz Kurtlardan 8 tane avla.', goal: { kind: 'kill', type: 'kurt', n: 8 }, reward: { xp: 900, gold: 200, items: [['hp1', 10]] } },
    { id: 'q7', name: 'Kızıl Yele', text: 'Kızıl Koru\'daki efsanevi kurdu, Kızıl Yele\'yi yen.', goal: { kind: 'kill', type: 'kizilyele', n: 1 }, reward: { xp: 2500, gold: 500 } },
    { id: 'q8', name: 'Çöl Yolu', text: 'Taşkale Çölü\'nde Kum Akreplerinden 10 tane avla.', goal: { kind: 'kill', type: 'akrep', n: 10 }, reward: { xp: 2600, gold: 400, items: [['hp2', 10]] } },
    { id: 'q9', name: 'Işıldayan Çelik', text: 'Silahını +5\'e güçlendir.', goal: { kind: 'plus', n: 5 }, reward: { gold: 800, items: [['toz', 5]] } },
    { id: 'q10', name: 'Taş Dev', text: 'Dev Kayalıkları\'ndaki Taş Dev\'i yık.', goal: { kind: 'kill', type: 'tasdev', n: 1 }, reward: { xp: 12000, gold: 3000 } }
  ];

  const player = {
    xpNeed: (lv) => Math.floor(90 * Math.pow(lv, 1.85) + 60),
    maxLv: 30,
    speed: 7.2,
    speedCaravan: 6.0,
    atkInt: 1.0,
    atkRange: 2.2
  };

  // Kasaba duvarlarını ve binaları engel olarak kaydet
  function registerColliders() {
    T.colliders.length = 0;
    for (const id in towns) {
      const tw = T.TOWNS[id], L = towns[id];
      for (const b of L.buildings) {
        const r = { yurt: 3.0, house: 3.2, tower: 2.4, pen: 0, forge: 1.6, stall: 1.3, well: 1.1, flat: 3.3, dome: 3.3, minaret: 1.8, palm: 0.5 }[b.k] * (b.s || 1);
        if (r > 0) T.addCollider(tw.x + b.dx, tw.z + b.dz, r);
      }
      // surlar: doğu ve batıda yol için kapı açıklığı
      const R = 20;
      for (let a = 0; a < Math.PI * 2; a += 0.11) {
        const ca = Math.cos(a);
        if (Math.abs(ca) > 0.965) continue;
        T.addCollider(tw.x + Math.cos(a) * R, tw.z + Math.sin(a) * R, 1.25);
      }
    }
  }
  registerColliders();

  const isEquip = (it) => !!(it && equipTypes[it.type]);
  return { monsters, items, pets, petRules, enhance, trees, skills, skillBar, goods, trade, spawns, npcRoles, towns, quests, player, eqSlots, slotName, equipTypes, armorParts, isEquip };
})();
