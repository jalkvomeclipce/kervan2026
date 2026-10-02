/* ============================================================
   KERVAN YOLU — terrain.js
   Arazi matematiği. Hem oyun mantığı hem de çizim bunu kullanır.
   Render'dan bağımsızdır (Three.js bilmez).
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Terrain = (function () {
  const HALF_W = 180, HALF_D = 110;   // oynanabilir alanın yarı boyutları
  const WATER = -1.2;                  // su seviyesi
  const BLOCK_H = 13;                  // bundan yüksek yerler dağ (geçilmez)

  function hash(i, j) {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // değer gürültüsü: önceden hesaplanmış 256×256 tablo (hızlı)
  const NT = new Float32Array(256 * 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) NT[j * 256 + i] = hash(i, j) * 2 - 1;
  function noise(x, z) {
    const fi = Math.floor(x), fj = Math.floor(z);
    const fx = x - fi, fz = z - fj;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const i = fi & 255, j = fj & 255, i1 = (i + 1) & 255, j1 = (j + 1) & 255;
    const a = NT[(j << 8) | i], b = NT[(j << 8) | i1], c = NT[(j1 << 8) | i], d = NT[(j1 << 8) | i1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, oct) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += amp * noise(x * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }
  function smoothstep(a, b, v) {
    let t = (v - a) / (b - a);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Nehir ve yol eğrileri
  function riverX(z) { return 6 * Math.sin(z * 0.035) + 3 * Math.sin(z * 0.011 + 1); }
  function roadZ(x) { return 8 * Math.sin(x * 0.02) + 4 * Math.sin(x * 0.047 + 1.3); }

  // Köprü: yol ile nehrin kesiştiği nokta
  let bx = 0;
  for (let k = 0; k < 8; k++) bx = riverX(roadZ(bx));
  const BRIDGE = { x: bx, z: roadZ(bx), halfLen: 13, halfWidth: 2.3, deck: 0.9 };

  const TOWNS = {
    sarikum: { id: 'sarikum', name: 'Sarıkum', dat: "Sarıkum'a", loc: "Sarıkum'da", x: -125, z: roadZ(-125), h: 2.2, r: 21 },
    taskale: { id: 'taskale', name: 'Taşkale', dat: "Taşkale'ye", loc: "Taşkale'de", x: 125, z: roadZ(125), h: 3.0, r: 21 }
  };

  function baseLow(x, z) { return fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 2) * 5 + 1.8; }

  function rawHeight(x, z) {
    let h = fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) * 6 + 2.7;
    h += fbm(x * 0.045 - 7, z * 0.045 + 2, 2) * 1.2;
    // doğu: kum tepeleri
    const e = smoothstep(-20, 60, x);
    if (e > 0) h += e * (Math.sin(x * 0.11 + fbm(x * 0.02, z * 0.02, 2) * 4) * 0.9 + 0.8);
    // harita kenarındaki dağlar
    const ex = Math.abs(x) / HALF_W, ez = Math.abs(z) / HALF_D;
    const edge = Math.max(ex, ez);
    if (edge > 0.8) h += smoothstep(0.8, 1.02, edge) * (24 + fbm(x * 0.05, z * 0.05, 3) * 10);
    // nehir yatağı
    const rd = Math.abs(x - riverX(z));
    const tr = smoothstep(19, 3, rd);
    h = lerp(h, -3.4, tr);
    // yol düzlemesi
    const rz = Math.abs(z - roadZ(x));
    const wr = smoothstep(6.5, 2.2, rz) * (1 - tr * 0.9);
    if (wr > 0) h = lerp(h, Math.max(baseLow(x, roadZ(x)), 0.4) + e * 0.8, wr * 0.9);
    // kasabalar düz
    for (const k in TOWNS) {
      const t = TOWNS[k];
      const d = Math.hypot(x - t.x, z - t.z);
      h = lerp(h, t.h, smoothstep(t.r + 12, t.r - 1, d));
    }
    return h;
  }

  // Yükseklik önbelleği (0.5 birimlik ızgara, çift doğrusal)
  const STEP = 2.0, GW = Math.ceil((HALF_W * 2 + 80) / STEP) + 1, GD = Math.ceil((HALF_D * 2 + 80) / STEP) + 1;
  const OX = -(HALF_W + 40), OZ = -(HALF_D + 40);
  let cache = null;
  function buildCache() {
    cache = new Float32Array(GW * GD);
    for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) cache[j * GW + i] = rawHeight(OX + i * STEP, OZ + j * STEP);
    return cache;
  }
  function height(x, z) {
    if (!cache) buildCache();
    let fx = (x - OX) / STEP, fz = (z - OZ) / STEP;
    if (fx < 0) fx = 0; if (fz < 0) fz = 0;
    if (fx > GW - 1.001) fx = GW - 1.001; if (fz > GD - 1.001) fz = GD - 1.001;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = cache[j * GW + i], b = cache[j * GW + i + 1], c = cache[(j + 1) * GW + i], d = cache[(j + 1) * GW + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function onBridge(x, z) {
    return Math.abs(x - BRIDGE.x) < BRIDGE.halfLen && Math.abs(z - roadZ(x)) < BRIDGE.halfWidth;
  }
  function groundY(x, z) {
    const h = height(x, z);
    return onBridge(x, z) ? Math.max(h, BRIDGE.deck) : h;
  }

  // Engeller (bina çemberleri) — data.js dolduruyor
  const colliders = [];
  function addCollider(x, z, r) { colliders.push({ x, z, r }); }
  function collides(x, z, rad) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = x - c.x, dz = z - c.z, rr = c.r + rad;
      if (dx * dx + dz * dz < rr * rr) return c;
    }
    return null;
  }

  function walkable(x, z) {
    if (Math.abs(x) > HALF_W - 6 || Math.abs(z) > HALF_D - 6) return false;
    if (onBridge(x, z)) return true;
    const h = height(x, z);
    return h > WATER + 0.15 && h < BLOCK_H;
  }

  function townAt(x, z, pad) {
    pad = pad || 0;
    for (const k in TOWNS) {
      const t = TOWNS[k];
      if (Math.hypot(x - t.x, z - t.z) < t.r + pad) return t;
    }
    return null;
  }
  function nearestTown(x, z) {
    let best = null, bd = 1e9;
    for (const k in TOWNS) { const t = TOWNS[k]; const d = Math.hypot(x - t.x, z - t.z); if (d < bd) { bd = d; best = t; } }
    return { town: best, dist: bd };
  }
  function region(x, z) { return x < riverX(z) ? 1 : 2; }
  function areaName(x, z) {
    const t = townAt(x, z, 2);
    if (t) return t.name;
    if (Math.abs(x - riverX(z)) < 14) return onBridge(x, z) ? 'Gökırmak Köprüsü' : 'Gökırmak Kıyısı';
    if (x < -128 && z < -55) return 'Kızıl Koru';
    if (x > 130 && z < -55) return 'Dev Kayalıkları';
    return region(x, z) === 1 ? 'Sarıkum Bozkırı' : 'Taşkale Çölü';
  }

  // Kasaba kapıları (doğu ve batı)
  for (const k in TOWNS) {
    const t = TOWNS[k];
    t.gates = [-1, 1].map(side => ({
      inner: { x: t.x + side * 14, z: roadZ(t.x + side * 14) },
      outer: { x: t.x + side * 25, z: roadZ(t.x + side * 25) }
    }));
  }
  function insideTown(x, z) {
    for (const k in TOWNS) { const t = TOWNS[k]; if (Math.hypot(x - t.x, z - t.z) < 19.5) return t; }
    return null;
  }

  // Düz çizgi yol kontrolü (suya, dağa ya da binaya çarpıyor mu)
  function segmentClear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 1.2));
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (!walkable(x, z) || collides(x, z, 0.25)) return false;
    }
    return true;
  }
  function nearestGate(t, x, z) {
    let best = t.gates[0], bd = 1e9;
    for (const g of t.gates) { const d = Math.hypot(g.outer.x - x, g.outer.z - z); if (d < bd) { bd = d; best = g; } }
    return best;
  }
  // Rota: kasaba kapıları ve köprü üzerinden ara noktalar
  function route(x0, z0, x1, z1) {
    if (segmentClear(x0, z0, x1, z1)) return [{ x: x1, z: z1 }];
    const pts = [];
    let cx = x0, cz = z0;
    const ta = insideTown(x0, z0), tb = insideTown(x1, z1);
    if (ta && ta !== tb) {
      const g = nearestGate(ta, x1, z1);
      // binalara takılmamak için önce meydana, sonra kapıya
      if (!segmentClear(x0, z0, g.inner.x, g.inner.z)) pts.push({ x: ta.x, z: ta.z + 2.5 });
      pts.push(g.inner, g.outer); cx = g.outer.x; cz = g.outer.z;
    }
    let entry = null;
    if (tb && tb !== ta) entry = nearestGate(tb, cx, cz);
    const ex = entry ? entry.outer.x : x1, ez = entry ? entry.outer.z : z1;
    const s0 = cx < riverX(cz), s1 = ex < riverX(ez);
    if (s0 !== s1) {
      const w = { x: BRIDGE.x - BRIDGE.halfLen - 3, z: roadZ(BRIDGE.x - BRIDGE.halfLen - 3) };
      const e = { x: BRIDGE.x + BRIDGE.halfLen + 3, z: roadZ(BRIDGE.x + BRIDGE.halfLen + 3) };
      pts.push(s0 ? w : e, { x: BRIDGE.x, z: BRIDGE.z }, s0 ? e : w);
    }
    if (entry) {
      pts.push(entry.outer, entry.inner);
      if (!segmentClear(entry.inner.x, entry.inner.z, x1, z1)) pts.push({ x: tb.x, z: tb.z + 2.5 });
    }
    pts.push({ x: x1, z: z1 });
    return pts;
  }

  return {
    HALF_W, HALF_D, WATER, BLOCK_H, BRIDGE, TOWNS, colliders,
    noise, fbm, smoothstep, lerp, hash, riverX, roadZ, rawHeight, height, groundY,
    STEP, OX, OZ, GW, GD, cacheData: () => (cache || buildCache(), cache),
    onBridge, walkable, townAt, insideTown, nearestTown, region, areaName, segmentClear, route,
    addCollider, collides, buildCache
  };
})();
