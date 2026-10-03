/* ============================================================
   KERVAN YOLU — scenery.js
   Statik dünya: dokulu arazi, su, gökyüzü, uzak dağlar, ağaçlar,
   çimen, kayalar, kasabalar, köprü. Binlerce parça bölge (tile)
   başına tek ağda birleştirilir; görüş dışındakiler çizilmez.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

// mini harita renkleri (2B tuval) — 3B arazi gölgelendiricisi kendi dokularını kullanır
KY.Palette = (function () {
  const T = KY.Terrain;
  const C = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const P = {
    grassA: C(0x6f9a47), grassB: C(0x8cae55), dry: C(0xb3a25e), sandA: C(0xd8b97c), sandB: C(0xc79d5f),
    rock: C(0x8a7d6c), rockE: C(0xa68562), snow: C(0xeeece6), road: C(0xa88659), roadE: C(0xc8a26a),
    bank: C(0xcdb88a), bed: C(0x6b7f6a), plaza: C(0xb4966a), plazaE: C(0xd2b88e)
  };
  function ground(x, z, h, slope) {
    const S = T.smoothstep;
    const e = S(-25, 45, x - T.riverX(z) * 0.5);
    const n = T.noise(x * 0.09, z * 0.09) * 0.5 + 0.5;
    const n2 = T.noise(x * 0.025 + 11, z * 0.025 - 4) * 0.5 + 0.5;
    let c = mix(P.grassA, P.grassB, n);
    c = mix(c, P.dry, S(0.55, 0.9, n2) * 0.6);
    const sand = mix(P.sandA, P.sandB, n * 0.8 + 0.1);
    c = mix(c, sand, e);
    const rz = Math.abs(z - T.roadZ(x));
    c = mix(c, mix(P.road, P.roadE, e), S(3.0, 1.6, rz) * 0.9);
    for (const k in T.TOWNS) {
      const t = T.TOWNS[k], d = Math.hypot(x - t.x, z - t.z);
      if (d < t.r + 4) c = mix(c, k === 'taskale' ? P.plazaE : P.plaza, S(t.r + 3, t.r - 3, d) * 0.75);
    }
    if (h < T.WATER + 1.1) c = mix(c, P.bank, S(T.WATER + 1.1, T.WATER + 0.3, h));
    if (h < T.WATER) c = mix(P.bank, P.bed, S(T.WATER, T.WATER - 1.5, h));
    c = mix(c, e > 0.5 ? P.rockE : P.rock, S(0.55, 1.1, slope));
    c = mix(c, e > 0.5 ? P.rockE : P.rock, S(8, 13, h));
    if (h > 17) c = mix(c, P.snow, S(17, 22, h + n * 2));
    return c;
  }
  return { ground, C, mix };
})();

KY.Scenery = (function () {
  const T = KY.Terrain, D = KY.DATA, Mo = KY.Models, G = KY.Gfx, MT = G.MT;
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const rand = (() => { let s = 1234567; return () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; })();
  const rr = (a, b) => a + rand() * (b - a);
  const sstep = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

  // renkler
  const SLATE = 0x56616d, SLATE_D = 0x3b424a, RED = 0x9a3324, PLASTER = 0xe2d8c3, STONE = 0x9b958a, WOOD_D = 0x5a3f2c, WOOD_L = 0x8a6442,
    GOLD = 0xd8b04a, FELT = 0xebe2cf, SANDST = 0xd6bb90, ADOBE = 0xd9c199, TURQ = 0x2f9a96, TURQ_D = 0x24707a, BARK = 0x5f4834;

  const TILE = 44;
  class Batch {
    constructor() { this.parts = []; this.count = 0; this.mt = 0; }
    use(name) { this.mt = typeof name === 'number' ? name : (MT[name] || 0); return this; }
    add(geo, color, x, y, z, ry, sx, sy, sz, rx, rz, jitter) {
      const tile = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx || 0, ry || 0, rz || 0);
      dummy.scale.set(sx || 1, sy || sx || 1, sz || sx || 1);
      dummy.updateMatrix();
      const g = (geo.index ? geo.toNonIndexed() : geo.clone());
      g.applyMatrix4(dummy.matrix);
      this.parts.push({ g, color, jitter: jitter == null ? 0.06 : jitter, tile, mt: this.mt });
      this.count += g.attributes.position.count;
    }
    box(w, h, d, color, x, y, z, ry, rx, rz) { this.add(Mo.boxG(w, h, d), color, x, y, z, ry, 1, 1, 1, rx, rz); }
    build(material, ao) {
      const byTile = new Map();
      for (const p of this.parts) { if (!byTile.has(p.tile)) byTile.set(p.tile, []); byTile.get(p.tile).push(p); }
      const group = new THREE.Group();
      const c = new THREE.Color();
      for (const parts of byTile.values()) {
        let count = 0;
        for (const p of parts) count += p.g.attributes.position.count;
        const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3), mts = new Float32Array(count);
        let o = 0;
        for (const p of parts) {
          const a = p.g.attributes.position.array, n = a.length / 3, na = p.g.attributes.normal;
          pos.set(a, o * 3);
          if (na) nor.set(na.array, o * 3);
          c.set(p.color);
          for (let f = 0; f < n; f += 3) {
            const j = 1 + (rand() * 2 - 1) * p.jitter;
            for (let k = 0; k < 3 && f + k < n; k++) {
              const i = (o + f + k) * 3;
              let s = j;
              if (ao) { const hy = pos[i + 1] - T.height(pos[i], pos[i + 2]); s *= 0.66 + 0.34 * sstep(-0.1, 1.5, hy); }
              col[i] = Math.min(1, c.r * s); col[i + 1] = Math.min(1, c.g * s); col[i + 2] = Math.min(1, c.b * s);
              mts[o + f + k] = p.mt;
            }
          }
          o += n;
          p.g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('mt', new THREE.BufferAttribute(mts, 1));
        geo.computeBoundingSphere();
        group.add(new THREE.Mesh(geo, material));
      }
      this.parts = [];
      return group;
    }
  }

  // ---------- yaprak / çimen kartları (uv'li, rüzgârlı) ----------
  class Foliage {
    constructor() { this.tiles = new Map(); }
    t(x, z) {
      const k = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
      let t = this.tiles.get(k);
      if (!t) { t = { p: [], n: [], u: [], c: [], h: [] }; this.tiles.set(k, t); }
      return t;
    }
    v(t, x, y, z, nx, ny, nz, u, v, c, h) { t.p.push(x, y, z); t.n.push(nx, ny, nz); t.u.push(u, v); t.c.push(c[0], c[1], c[2]); t.h.push(h); }
    build(material, cast) {
      const group = new THREE.Group();
      for (const t of this.tiles.values()) {
        if (!t.p.length) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(t.n, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(t.u, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(t.c, 3));
        geo.setAttribute('aHt', new THREE.Float32BufferAttribute(t.h, 1));
        geo.computeBoundingSphere();
        const m = new THREE.Mesh(geo, material);
        m.receiveShadow = true;
        if (cast && material.userData.depth) { m.castShadow = true; m.customDepthMaterial = material.userData.depth; }
        group.add(m);
      }
      this.tiles.clear();
      return group;
    }
  }
  // yaprak atlası çeyrekleri: u0, v0, u1, v1
  const UVQ = [[0.004, 0.504, 0.496, 0.996], [0.504, 0.504, 0.996, 0.996], [0.004, 0.004, 0.496, 0.496], [0.504, 0.004, 0.996, 0.496]];
  const V3 = THREE.Vector3, _n = new V3(), _r = new V3(), _u = new V3(), _up = new V3(0, 1, 0);

  // ağaç tacı: elipsoit yüzeyinde rastgele yönlü kartlar, küresel normaller
  function canopy(F, cx, cy, cz, rx, ry, rz, n, tint, q, baseY, size) {
    const t = F.t(cx, cz), Q = UVQ[q];
    for (let k = 0; k < n; k++) {
      const a = rand() * 6.283, uy = rand() * 1.75 - 0.75, s = Math.sqrt(1 - uy * uy);
      const dx = Math.cos(a) * s, dy = uy, dz = Math.sin(a) * s;
      const rad = k < n * 0.2 ? 0.2 + rand() * 0.3 : 0.55 + rand() * 0.4;
      const px = cx + dx * rx * rad, py = cy + dy * ry * rad, pz = cz + dz * rz * rad;
      _n.set(dx + (rand() - 0.5) * 1.1, dy * 0.6 + 0.3 + (rand() - 0.5) * 0.7, dz + (rand() - 0.5) * 1.1).normalize();
      _r.crossVectors(_up, _n); if (_r.lengthSq() < 1e-4) _r.set(1, 0, 0); _r.normalize();
      _u.crossVectors(_n, _r).normalize();
      const roll = rand() * 6.283, cr = Math.cos(roll), sr = Math.sin(roll);
      const rxv = _r.x * cr + _u.x * sr, ryv = _r.y * cr + _u.y * sr, rzv = _r.z * cr + _u.z * sr;
      const uxv = _u.x * cr - _r.x * sr, uyv = _u.y * cr - _r.y * sr, uzv = _u.z * cr - _r.z * sr;
      const hs = size * (0.8 + rand() * 0.4) * 0.5;
      const j = 0.85 + rand() * 0.28;
      const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a1, b1]) => {
        const x = px + (rxv * a1 + uxv * b1) * hs, y = py + (ryv * a1 + uyv * b1) * hs, z = pz + (rzv * a1 + uzv * b1) * hs;
        let nx = (x - cx) / rx, ny = (y - cy) / ry * 0.85 + 0.35, nz = (z - cz) / rz;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const ao = (0.58 + 0.42 * sstep(-1, 1, (y - cy) / ry)) * j * (k < n * 0.2 ? 0.75 : 1);
        return { x, y, z, nx, ny, nz, c: [tint[0] * ao, tint[1] * ao, tint[2] * ao] };
      });
      const fl = rand() < 0.5;
      const uv = [[fl ? Q[2] : Q[0], Q[1]], [fl ? Q[0] : Q[2], Q[1]], [fl ? Q[0] : Q[2], Q[3]], [fl ? Q[2] : Q[0], Q[3]]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const p = cs[i]; F.v(t, p.x, p.y, p.z, p.nx, p.ny, p.nz, uv[i][0], uv[i][1], p.c, p.y - baseY); }
    }
  }
  // çam katı: iğne dokulu koni yüzeyi (alt kenarı sivri saçaklı)
  function pineTier(F, x, y0, z, r, h, tint, baseY) {
    const t = F.t(x, z), Q = UVQ[2], M = 11, rot = rand() * 6.283;
    const ax = x, ay = y0 + h, az = z, um = (Q[0] + Q[2]) / 2;
    for (let i = 0; i < M; i++) {
      const a0 = rot + i / M * 6.283, a1 = rot + (i + 1) / M * 6.283;
      const b0 = [x + Math.cos(a0) * r, y0 - r * 0.12, z + Math.sin(a0) * r], b1 = [x + Math.cos(a1) * r, y0 - r * 0.12, z + Math.sin(a1) * r];
      const n0 = new V3(Math.cos(a0) * h, r * 1.1, Math.sin(a0) * h).normalize(), n1 = new V3(Math.cos(a1) * h, r * 1.1, Math.sin(a1) * h).normalize();
      const j = 0.88 + rand() * 0.22, dark = [tint[0] * 0.72 * j, tint[1] * 0.72 * j, tint[2] * 0.72 * j], lite = [tint[0] * 1.12, tint[1] * 1.12, tint[2] * 1.12];
      F.v(t, ax, ay, az, 0, 1, 0, um, Q[3], lite, ay - baseY);
      F.v(t, b1[0], b1[1], b1[2], n1.x, n1.y, n1.z, Q[2], Q[1], dark, b1[1] - baseY);
      F.v(t, b0[0], b0[1], b0[2], n0.x, n0.y, n0.z, Q[0], Q[1], dark, b0[1] - baseY);
    }
  }
  // hurma yaprağı: aşağı kıvrılan şerit
  function frond(F, x, y, z, a, L, tint, baseY) {
    const t = F.t(x, z), Q = UVQ[3], S = 4;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const pts = [];
    for (let k = 0; k <= S; k++) {
      const s = k / S, w = 0.62 * (1 - s * 0.55) * L / 2.2;
      const cx = x + dx * L * s, cz = z + dz * L * s, cy = y + L * (0.42 * s - 0.78 * s * s);
      pts.push({ cx, cy, cz, w, s });
    }
    for (let k = 0; k < S; k++) {
      const A = pts[k], B2 = pts[k + 1];
      const u0 = Q[0] + (Q[2] - Q[0]) * A.s, u1 = Q[0] + (Q[2] - Q[0]) * B2.s;
      const c = [tint[0], tint[1], tint[2]];
      const quad = [
        [A.cx - px * A.w, A.cy - 0.05, A.cz - pz * A.w, u0, Q[1]], [B2.cx - px * B2.w, B2.cy - 0.05, B2.cz - pz * B2.w, u1, Q[1]],
        [B2.cx + px * B2.w, B2.cy - 0.05, B2.cz + pz * B2.w, u1, Q[3]], [A.cx + px * A.w, A.cy - 0.05, A.cz + pz * A.w, u0, Q[3]]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const p = quad[i]; F.v(t, p[0], p[1], p[2], dx * 0.3, 0.95, dz * 0.3, p[3], p[4], c, p[1] - baseY); }
    }
  }
  // çimen öbeği: çapraz iki kart
  function grassClump(F, x, y, z, s, tint, flower) {
    const t = F.t(x, z), a0 = rand() * 3.14, h = 0.62 * s * (0.75 + rand() * 0.55), w = 0.95 * s;
    const u0 = flower ? 0.502 : 0.002, u1 = flower ? 0.998 : 0.498;
    const c = flower ? [1, 1, 1] : tint;
    const lean = (rand() - 0.5) * 0.25;
    for (let q = 0; q < 2; q++) {
      const a = a0 + q * 1.5708, dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
      const lx = Math.cos(a + 1.57) * lean * h, lz = Math.sin(a + 1.57) * lean * h;
      const P = [[x - dx, y - 0.04, z - dz, u0, 0], [x + dx, y - 0.04, z + dz, u1, 0], [x + dx + lx, y + h, z + dz + lz, u1, 1], [x - dx + lx, y + h, z - dz + lz, u0, 1]];
      for (const i of [0, 1, 2, 0, 2, 3]) { const p = P[i]; F.v(t, p[0], p[1], p[2], 0, 1, 0, p[3], p[4], c, p[1] - y + 0.04); }
    }
  }

  // ---------- geometri yardımcıları ----------
  const gcache = new Map();
  const cached = (k, f) => { let g = gcache.get(k); if (!g) { g = f(); gcache.set(k, g); } return g; };
  const cylS = (a, b, h, s) => cached('cs' + a + '|' + b + '|' + h + '|' + s, () => new THREE.CylinderGeometry(a, b, h, s || 10, 1));
  const coneS = (r, h, s) => cached('ks' + r + '|' + h + '|' + s, () => new THREE.ConeGeometry(r, h, s || 10, 1));
  const sphS = (r, ws, hs) => cached('ss' + r + '|' + ws + '|' + hs, () => new THREE.SphereGeometry(r, ws || 10, hs || 7));
  const latheG = (key, pts, seg) => cached('la' + key, () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 16));
  // kıvrık saçaklı kalçalı çatı (Silkroad / Uzak Doğu tarzı): içbükey yüzey, köşeleri kalkık, kalın kabuk
  function roofG(w, d, h, curl, th) {
    th = th || 0.16;
    return cached('roof' + [w, d, h, curl, th].join('|'), () => {
      const hw = w / 2, hd = d / 2, m = Math.min(hw, hd);
      const nz = 10, nx = Math.max(2, Math.round(w / (d / nz)));
      const Y = (x, z) => {
        const t = Math.max(0, Math.min(hw - Math.abs(x), hd - Math.abs(z)) / m);
        const c = Math.min(Math.abs(x) / hw, Math.abs(z) / hd);
        return h * Math.pow(t, 1.4) + curl * Math.pow(c, 3) * Math.pow(1 - t, 3);
      };
      const pos = [], idx = [];
      const grid = (yo, flip) => {
        const base = pos.length / 3;
        for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = -hw + w * i / nx, z = -hd + d * j / nz; pos.push(x, Y(x, z) + yo, z); }
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
          const a = base + j * (nx + 1) + i, b = a + nx + 1, c = a + 1, e = b + 1;
          const xc = -hw + w * (i + 0.5) / nx, zc = -hd + d * (j + 0.5) / nz;
          const tris = xc * zc > 0 ? [[a, b, e], [a, e, c]] : [[a, b, c], [c, b, e]];
          for (const tr of tris) flip ? idx.push(tr[0], tr[2], tr[1]) : idx.push(tr[0], tr[1], tr[2]);
        }
      };
      grid(0, false); grid(-th, true);
      const loop = [];
      for (let i = 0; i <= nx; i++) loop.push([i, 0]);
      for (let j = 1; j <= nz; j++) loop.push([nx, j]);
      for (let i = nx - 1; i >= 0; i--) loop.push([i, nz]);
      for (let j = nz - 1; j >= 0; j--) loop.push([0, j]);
      for (let k = 0; k < loop.length - 1; k++) {
        const P = loop[k], Q = loop[k + 1];
        const px = -hw + w * P[0] / nx, pz = -hd + d * P[1] / nz, qx = -hw + w * Q[0] / nx, qz = -hd + d * Q[1] / nz;
        const base = pos.length / 3, py = Y(px, pz), qy = Y(qx, qz);
        pos.push(px, py, pz, qx, qy, qz, qx, qy - th, qz, px, py - th, pz);
        idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    });
  }
  // soğan kubbe
  function domeProfile(R, H, tip) {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const f = k / 12 * Math.PI / 2; pts.push([Math.max(0.001, R * Math.pow(Math.cos(f), 0.85) * (1 + 0.14 * Math.sin(f * 2))), H * Math.sin(f)]); }
    pts.push([0.001, H * tip]);
    return pts;
  }
  const rockGs = [0, 1, 2].map(k => {
    // gürültüyle bozulmuş küre: yumuşak gövde, keskin olmayan yüzler
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, r2 = KY.Gfx.rng(500 + k);
    const ph = [r2() * 6, r2() * 6, r2() * 6, r2() * 6];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let f = 1 + 0.25 * Math.sin(x * 2.1 + ph[0]) * Math.sin(z * 1.7 + ph[1]) + 0.15 * Math.sin(y * 3.3 + ph[2]) + 0.12 * Math.sin((x + z) * 5.1 + ph[3]);
      if (y > 0.35) f *= 0.92;
      p.setXYZ(i, x * f, (y < -0.2 ? -0.2 + (y + 0.2) * 0.3 : y) * f * 0.8, z * f);
    }
    g.computeVertexNormals();
    // aynı konumdaki köşelerin normallerini ortala (yumuşak gölge)
    const nm = g.attributes.normal, acc = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4);
      const a = acc.get(key) || [0, 0, 0]; a[0] += nm.getX(i); a[1] += nm.getY(i); a[2] += nm.getZ(i); acc.set(key, a);
    }
    for (let i = 0; i < p.count; i++) {
      const a = acc.get(p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4)), l = Math.hypot(a[0], a[1], a[2]) || 1;
      nm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
    }
    return g;
  });

  // yönlü yerleştirme: bina yerel eksenleri (x sağ, z ön) → dünya
  function kit(B, x, y, z, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    return {
      rot,
      box(w, h, d, col, lx, ly, lz, mt, rx, rz, ry) { const p = P(lx, lz); B.use(mt || 0).add(Mo.boxG(w, h, d), col, p[0], y + ly, p[1], rot + (ry || 0), 1, 1, 1, rx, rz); },
      geo(g, col, lx, ly, lz, mt, ry, sx, sy, sz, rx, rz) { const p = P(lx, lz); B.use(mt || 0).add(g, col, p[0], y + ly, p[1], rot + (ry || 0), sx, sy, sz, rx, rz); },
      pt(lx, ly, lz) { const p = P(lx, lz); return { x: p[0], y: y + ly, z: p[1] }; }
    };
  }

  // ---------- arazi ----------
  function terrainMesh() {
    const H = T.cacheData(), GW = T.GW, GD = T.GD, S = T.STEP;
    const at = (i, j) => H[Math.min(GD - 1, Math.max(0, j)) * GW + Math.min(GW - 1, Math.max(0, i))];
    const mat = G.terrainMaterial();
    const group = new THREE.Group();
    const CH = 22;
    for (let cj = 0; cj < GD - 1; cj += CH) for (let ci = 0; ci < GW - 1; ci += CH) {
      const ni = Math.min(CH, GW - 1 - ci), nj = Math.min(CH, GD - 1 - cj);
      const pos = new Float32Array((ni + 1) * (nj + 1) * 3), nor = new Float32Array((ni + 1) * (nj + 1) * 3), idx = [];
      let o = 0;
      for (let j = cj; j <= cj + nj; j++) for (let i = ci; i <= ci + ni; i++) {
        const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * S), gz = (at(i, j + 1) - at(i, j - 1)) / (2 * S);
        const l = Math.hypot(gx, 1, gz);
        pos[o] = T.OX + i * S; pos[o + 1] = at(i, j); pos[o + 2] = T.OZ + j * S;
        nor[o] = -gx / l; nor[o + 1] = 1 / l; nor[o + 2] = -gz / l;
        o += 3;
      }
      const W1 = ni + 1;
      for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
        const a = j * W1 + i, b = a + W1, c = a + 1, d = b + 1;
        if (((ci + i + cj + j) & 1) === 0) idx.push(a, b, c, c, b, d); else idx.push(a, b, d, a, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }

  // su: sadece suyun olduğu hücreler, köşe başına derinlik
  function waterMesh() {
    const H = T.cacheData(), GW = T.GW, GD = T.GD, S = T.STEP, Wl = T.WATER;
    const pos = new Float32Array(GW * GD * 3), dep = new Float32Array(GW * GD), idx = [];
    for (let j = 0; j < GD; j++) for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      pos[k * 3] = T.OX + i * S; pos[k * 3 + 1] = Wl; pos[k * 3 + 2] = T.OZ + j * S;
      dep[k] = Wl - H[k];
    }
    for (let j = 0; j < GD - 1; j++) for (let i = 0; i < GW - 1; i++) {
      const a = j * GW + i, b = a + GW, c = a + 1, d = b + 1;
      if (Math.max(dep[a], dep[b], dep[c], dep[d]) > -0.2) idx.push(a, b, c, c, b, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('depth', new THREE.BufferAttribute(dep, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, G.bindWater(G.waterMaterial()));
    m.renderOrder = 2;
    return m;
  }

  // ---------- doğa ----------
  const TINT = {
    leaf: [[0.42, 0.6, 0.26], [0.48, 0.63, 0.25], [0.37, 0.54, 0.26], [0.54, 0.64, 0.28], [0.46, 0.56, 0.24]],
    autumn: [[0.92, 0.36, 0.16], [0.95, 0.56, 0.18], [0.82, 0.26, 0.14], [0.96, 0.7, 0.24]],
    pine: [[0.3, 0.5, 0.3], [0.27, 0.46, 0.3], [0.33, 0.52, 0.28]],
    poplar: [[0.48, 0.68, 0.26], [0.56, 0.7, 0.24]],
    palm: [[0.5, 0.66, 0.3], [0.56, 0.7, 0.32]],
    blossom: [[1.0, 0.72, 0.8], [0.98, 0.8, 0.86], [1.0, 0.66, 0.76]],
    dryShrub: [[0.95, 0.86, 0.5], [0.86, 0.8, 0.46]]
  };
  const pick = (a) => a[(rand() * a.length) | 0];
  const redGrove = (x, z) => x < -118 && z < -48;

  function broadTree(B, F, x, y, z, s, tint, q) {
    const th = 2.0 * s;
    B.use('bark').add(cylS(0.16, 0.27, 1, 7), BARK, x, y + th / 2 + 0.2, z, rand() * 6, s, th + 0.6, s);
    for (let k = 0; k < 3; k++) {
      const a = rand() * 6.283, L = rr(0.9, 1.4) * s;
      B.add(cylS(0.06, 0.11, 1, 5), BARK, x + Math.cos(a) * 0.35 * L, y + th + 0.2 + 0.3 * L, z + Math.sin(a) * 0.35 * L, -a, s, L, s, 0, 0.9);
    }
    const cy = y + th + 1.35 * s;
    canopy(F, x, cy, z, 2.0 * s, 1.55 * s, 2.0 * s, 30, tint, q, y, 1.65 * s);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rand(), d = rr(1.0, 1.5) * s;
      canopy(F, x + Math.cos(a) * d, cy + rr(-0.5, 0.5) * s, z + Math.sin(a) * d, 1.2 * s, 0.95 * s, 1.2 * s, 10, tint.map(v => v * rr(0.9, 1.08)), q, y, 1.3 * s);
    }
  }
  function poplar(B, F, x, y, z, s, tint) {
    B.use('bark').add(cylS(0.12, 0.2, 1, 6), BARK, x, y + 0.9 * s, z, 0, s, 1.8 * s, s);
    canopy(F, x, y + 3.3 * s, z, 0.95 * s, 2.5 * s, 0.95 * s, 24, tint, 1, y, 1.2 * s);
  }
  function pine(B, F, x, y, z, s, tint) {
    B.use('bark').add(cylS(0.1, 0.24, 1, 6), 0x4b3829, x, y + 1.6 * s, z, 0, s, 3.2 * s, s);
    for (let k = 0; k < 5; k++) pineTier(F, x, y + (1.1 + k * 0.88) * s, z, (1.95 - k * 0.34) * s, (1.55 - k * 0.1) * s, tint.map(v => v * (0.86 + k * 0.05)), y);
  }
  function shrub(F, x, y, z, s, tint) { canopy(F, x, y + 0.45 * s, z, 0.95 * s, 0.6 * s, 0.95 * s, 10, tint, 1, y, 0.95 * s); }
  function palm(B, F, x, y, z, s) {
    let cx = x, cy = y, cz = z;
    const lean = rr(-0.3, 0.3), la = rand() * 6.283, L = 0.8 * s;
    for (let k = 0; k < 6; k++) {
      const lk = lean * (0.4 + k * 0.16), dx = -Math.sin(lk) * Math.cos(la), dy = Math.cos(lk), dz = Math.sin(lk) * Math.sin(la);
      B.use('bark').add(cylS(0.15, 0.2, 0.8, 7), 0x86684a, cx + dx * L / 2, cy + dy * L / 2, cz + dz * L / 2, la, s, s, s, 0, lk);
      B.add(cylS(0.21, 0.21, 0.08, 7), 0x6e5438, cx, cy + 0.02, cz, la, s, s, s, 0, lk);
      cx += dx * L; cy += dy * L; cz += dz * L;
    }
    for (let k = 0; k < 3; k++) B.use('plain').add(sphS(0.13, 7, 5), 0x6b4a26, cx + Math.cos(k * 2.1) * 0.18, cy - 0.12, cz + Math.sin(k * 2.1) * 0.18);
    const tint = pick(TINT.palm);
    for (let k = 0; k < 9; k++) frond(F, cx, cy + 0.05, cz, k / 9 * 6.283 + rand() * 0.4, rr(2.1, 2.7) * s, tint.map(v => v * rr(0.88, 1.08)), y);
  }
  function deadTree(B, x, y, z, s) {
    B.use('bark').add(cylS(0.1, 0.2, 1, 6), 0x6d5a48, x, y + 1.0 * s, z, 0, s, 2 * s, s);
    for (let k = 0; k < 3; k++) {
      const a = rand() * 6.283;
      B.add(cylS(0.04, 0.08, 1, 5), 0x6d5a48, x + Math.cos(a) * 0.3 * s, y + (1.6 + k * 0.3) * s, z + Math.sin(a) * 0.3 * s, -a, s, rr(0.8, 1.2) * s, s, 0, 0.8);
    }
  }

  function scatter(B, F, FG, quality) {
    const spawnCenters = D.spawns;
    let trees = 0, rocks = 0, grass = 0;
    const ok = (x, z, clear, road) => {
      const h = T.height(x, z);
      if (h < T.WATER + 0.5 || h > 16) return false;
      if (Math.abs(z - T.roadZ(x)) < (road || 4.5)) return false;
      for (const k in T.TOWNS) { const t = T.TOWNS[k]; if (Math.hypot(x - t.x, z - t.z) < t.r + 4) return false; }
      if (Math.abs(x - T.BRIDGE.x) < 18 && Math.abs(z - T.BRIDGE.z) < 7) return false;
      if (clear) for (const s of spawnCenters) if (Math.hypot(x - s.x, z - s.z) < s.r * 0.5) return false;
      return true;
    };
    const step = 3.0;
    for (let x = -T.HALF_W - 20; x < T.HALF_W + 20; x += step) for (let z = -T.HALF_D - 20; z < T.HALF_D + 20; z += step) {
      const px = x + rr(-1.3, 1.3), pz = z + rr(-1.3, 1.3);
      const east = px > T.riverX(pz) + 10;
      const dens = T.noise(px * 0.035 + 40, pz * 0.035 - 13) * 0.5 + 0.5;
      const h = T.height(px, pz);
      const nearRiver = Math.abs(px - T.riverX(pz)) < 24;
      if (!ok(px, pz, true)) continue;
      const r = rand();
      if (!east) {
        const treeP = (dens > 0.6 ? 0.46 : 0.035) + (nearRiver ? 0.1 : 0) + (h > 9 ? 0.22 : 0);
        if (r < treeP) {
          const s = rr(0.85, 1.35), y = h - 0.05;
          const red = redGrove(px, pz);
          if (h > 8.5 && !red) pine(B, F, px, y, pz, s, pick(TINT.pine));
          else if (nearRiver && rand() < 0.55) poplar(B, F, px, y, pz, s, pick(TINT.poplar));
          else broadTree(B, F, px, y, pz, s, red ? pick(TINT.autumn) : pick(TINT.leaf), rand() < 0.65 ? 0 : 1);
          trees++;
          continue;
        }
        if (r < treeP + 0.08) { shrub(F, px, h, pz, rr(0.7, 1.2), redGrove(px, pz) ? pick(TINT.autumn) : pick(TINT.leaf).map(v => v * 0.9)); continue; }
      } else {
        const oasis = h < T.WATER + 2.2 && !nearRiver;
        if (oasis && r < 0.35) { palm(B, F, px, h - 0.05, pz, rr(0.9, 1.2)); trees++; continue; }
        if (r < 0.014) { deadTree(B, px, h, pz, rr(0.8, 1.2)); continue; }
        if (r < 0.045) { shrub(F, px, h, pz, rr(0.45, 0.8), pick(TINT.dryShrub)); continue; }
      }
      if (r > (east ? 0.97 : 0.95) || (h > 7 && !east && r > 0.86)) {
        const s = east ? rr(0.8, 2.2) : rr(0.45, 1.5);
        B.use('rock').add(rockGs[(rand() * 3) | 0], east ? 0x9a7d5c : 0x7e7a72, px, h + 0.1 * s, pz, rand() * 6, s * rr(0.9, 1.4), s * rr(0.6, 1.0), s * rr(0.9, 1.3), rr(-0.2, 0.2), rr(-0.2, 0.2), 0.04);
        rocks++;
      }
    }
    // çimen ve kır çiçekleri (batı bozkırı), seyrek kuru otlar (doğu)
    const GN = quality === 'low' ? 7000 : 24000;
    for (let k = 0; k < GN * 4 && grass < GN; k++) {
      const px = rr(-T.HALF_W + 6, T.riverX(0) + 2), pz = rr(-T.HALF_D + 6, T.HALF_D - 6);
      if (px > T.riverX(pz) - 3) continue;
      if (!ok(px, pz, false, 3.6)) continue;
      const h = T.height(px, pz);
      if (h > 12.5 || Math.abs(T.height(px + 1, pz) - h) + Math.abs(T.height(px, pz + 1) - h) > 1.1) continue;
      const n = T.noise(px * 0.06 - 7, pz * 0.06 + 3) * 0.5 + 0.5;
      if (rand() > 0.25 + n * 0.9) continue;
      const dry = T.noise(px * 0.025 + 11, pz * 0.025 - 4) * 0.5 + 0.5;
      const g = sstep(0.5, 0.85, dry) * 0.6, red = redGrove(px, pz);
      const tint = [0.5 + g * 0.3 + (red ? 0.18 : 0) + rr(-0.04, 0.04), 0.64 + g * 0.06 + rr(-0.05, 0.05), 0.3 - g * 0.06];
      grassClump(FG, px, h, pz, rr(0.8, 1.3), tint, rand() < 0.07);
      grass++;
    }
    for (let k = 0, n = 0; k < 9000 && n < 1500; k++) {
      const px = rr(T.riverX(0) + 14, T.HALF_W - 6), pz = rr(-T.HALF_D + 6, T.HALF_D - 6);
      if (!ok(px, pz, false, 3.6) || rand() < 0.4) continue;
      grassClump(FG, px, T.height(px, pz), pz, rr(0.55, 0.9), [0.92 + rr(-0.06, 0.06), 0.8, 0.46], false);
      n++;
    }
    return { trees, rocks, grass };
  }

  // ---------- kasabalar ----------
  function lantern(B, glows, p, post) {
    if (post) {
      B.use('wood').add(cylS(0.07, 0.09, 2.6, 6), WOOD_D, p.x, p.y + 1.3, p.z);
      B.box(0.7, 0.08, 0.08, WOOD_D, p.x + 0.3, p.y + 2.55, p.z);
    }
    glows.push({ x: p.x + (post ? 0.55 : 0), y: p.y + (post ? 2.15 : 0), z: p.z, c: 0xff8a3a, s: 1.5, kind: 'lantern' });
  }
  function banner(B, x, y, z, rot, col, h) {
    const K = kit(B, x, y, z, rot);
    K.geo(cylS(0.05, 0.06, h, 6), WOOD_D, 0, h / 2, 0, 'wood');
    K.geo(sphS(0.1, 6, 4), GOLD, 0, h + 0.05, 0, 'metal');
    K.box(0.05, 1.7, 0.9, col, 0, h - 1.05, 0.48, 'cloth');
    K.box(0.06, 0.18, 0.95, GOLD, 0, h - 0.18, 0.48, 'cloth');
    K.box(0.06, 0.12, 0.95, GOLD, 0, h - 1.86, 0.48, 'cloth');
  }

  function towns(B, F, glows, portals, extras) {
    for (const tid in D.towns) {
      const tw = T.TOWNS[tid], L = D.towns[tid];
      const desert = L.style === 'desert';
      const R = 20;
      // surlar
      if (desert) {
        for (let a = 0; a < Math.PI * 2; a += 0.11) {
          if (Math.abs(Math.cos(a)) > 0.965) continue;
          const x = tw.x + Math.cos(a) * R, z = tw.z + Math.sin(a) * R, gy = T.height(x, z), ry = -a + Math.PI / 2;
          B.use('stone').add(Mo.boxG(2.5, 0.8, 1.8), 0xb9a07a, x, gy + 0.2, z, ry);
          B.use('brick').add(Mo.boxG(2.35, 3.6, 1.4), SANDST, x, gy + 2.1, z, ry);
          B.use('plain').add(Mo.boxG(2.37, 0.22, 1.44), TURQ_D, x, gy + 3.25, z, ry);
          B.use('brick').add(Mo.boxG(0.85, 0.75, 1.4), 0xcdb084, x, gy + 4.25, z, ry);
          if (Math.round(a * 100) % 3 === 0) B.use('brick').add(cylS(1.0, 1.15, 5.2, 10), 0xcfb388, x + Math.cos(a) * 0.4, gy + 2.6, z + Math.sin(a) * 0.4);
        }
      } else {
        for (let a = 0; a < Math.PI * 2; a += 0.046) {
          if (Math.abs(Math.cos(a)) > 0.965) continue;
          const x = tw.x + Math.cos(a) * R, z = tw.z + Math.sin(a) * R, gy = T.height(x, z);
          const hh = rr(3.0, 3.6);
          B.use('bark').add(cylS(0.27, 0.3, 1, 7), [0x6e5238, 0x65492f, 0x76583c][(a * 100 | 0) % 3], x, gy + hh / 2 - 0.2, z, a, 1, hh, 1);
          B.use('wood').add(coneS(0.28, 0.6, 7), 0x8a6a48, x, gy + hh + 0.08, z, a);
        }
        for (let a = 0; a < Math.PI * 2; a += 0.1) {
          if (Math.abs(Math.cos(a + 0.05)) > 0.955) continue;
          const x = tw.x + Math.cos(a + 0.05) * (R - 0.15), z = tw.z + Math.sin(a + 0.05) * (R - 0.15), gy = T.height(x, z), ry = -(a + 0.05) + Math.PI / 2;
          B.use('stone').add(Mo.boxG(2.15, 1.0, 1.0), STONE, x, gy + 0.3, z, ry);
          B.use('wood').add(Mo.boxG(2.1, 0.16, 0.16), WOOD_D, x - Math.cos(a) * 0.35, gy + 1.9, z - Math.sin(a) * 0.35, ry);
          B.use('wood').add(Mo.boxG(2.1, 0.16, 0.16), WOOD_D, x - Math.cos(a) * 0.35, gy + 2.8, z - Math.sin(a) * 0.35, ry);
        }
      }
      // kapı kuleleri ve kapı kemeri
      for (const side of [-1, 1]) {
        const gx = tw.x + side * R * 0.99, ggy = T.height(gx, tw.z);
        for (const off of [-1, 1]) {
          const x = tw.x + side * R * 0.99, z = tw.z + off * 6.2, gy = T.height(x, z);
          const K = kit(B, x, gy, z, side > 0 ? Math.PI / 2 : -Math.PI / 2);
          if (desert) {
            K.geo(cylS(1.75, 2.0, 6.6, 16), SANDST, 0, 3.3, 0, 'brick');
            K.geo(cylS(2.05, 2.05, 0.35, 16), 0xc2a57c, 0, 6.6, 0, 'stone');
            K.geo(cylS(1.78, 1.78, 0.28, 16), TURQ_D, 0, 4.9, 0, 'glaze');
            for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; K.box(0.6, 0.65, 0.4, 0xcdb084, Math.cos(a) * 1.85, 7.05, Math.sin(a) * 1.85, 'brick', 0, 0, -a); }
            K.geo(latheG('gdome', domeProfile(1.45, 1.9, 1.25), 16), TURQ, 0, 6.75, 0, 'glaze');
            K.geo(coneS(0.08, 0.9, 6), GOLD, 0, 9.4, 0, 'metal');
            K.box(0.5, 1.0, 0.12, 0x2a221c, 0, 3.6, 2.0, 'plain', 0, 0, 0);
          } else {
            K.box(2.9, 4.3, 2.9, STONE, 0, 2.15, 0, 'stone');
            K.box(3.1, 0.3, 3.1, 0x7d776c, 0, 4.4, 0, 'stone');
            K.box(2.3, 1.7, 2.3, PLASTER, 0, 5.4, 0, 'plaster');
            for (const cx of [-1, 1]) for (const cz of [-1, 1]) K.geo(cylS(0.12, 0.13, 2.0, 8), RED, cx * 1.3, 5.5, cz * 1.3, 'wood');
            for (const cz of [-1, 1]) { K.box(2.8, 0.1, 0.1, RED, 0, 5.0, cz * 1.4, 'wood'); K.box(0.1, 0.1, 2.8, RED, cz * 1.4, 5.0, 0, 'wood'); }
            K.box(2.9, 0.22, 2.9, WOOD_D, 0, 6.45, 0, 'wood');
            K.geo(roofG(4.4, 4.4, 1.7, 0.55), SLATE, 0, 6.6, 0, 'tile');
            K.geo(coneS(0.12, 0.7, 6), GOLD, 0, 8.55, 0, 'metal');
            for (const cx of [-1, 1]) glows.push(Object.assign(K.pt(cx * 1.45, 5.8, 1.45), { c: 0xff8a3a, s: 1.3, kind: 'lantern' }));
          }
          glows.push({ x: x - side * 1.5, y: gy + 3.2, z, c: 0xffc46b, s: 1.4 });
        }
        // kemer: iki kiriş + uzun kıvrık çatı + levha
        const K = kit(B, gx, ggy, tw.z, 0);
        if (desert) {
          K.box(1.6, 1.4, 12.6, SANDST, 0, 5.4, 0, 'brick');
          K.box(1.65, 0.3, 12.7, TURQ_D, 0, 4.85, 0, 'glaze');
          for (let k = -5; k <= 5; k += 2) K.box(1.6, 0.6, 0.8, 0xcdb084, 0, 6.4, k * 1.05, 'brick');
          K.box(0.14, 1.0, 3.0, 0x2c6f86, side * 0.85, 5.4, 0, 'plain');
        } else {
          K.box(0.9, 0.5, 12.4, RED, 0, 4.7, 0, 'wood');
          K.box(0.8, 0.35, 12.8, WOOD_D, 0, 5.35, 0, 'wood');
          K.geo(roofG(13.6, 2.6, 1.0, 0.55), SLATE, 0, 5.6, 0, 'tile', Math.PI / 2);
          K.box(0.18, 0.95, 2.8, 0x2a1c16, side * 0.5, 4.75, 0, 'wood');
          K.box(0.2, 1.1, 3.0, GOLD, side * 0.47, 4.75, 0, 'metal');
          for (const off of [-1, 1]) glows.push(Object.assign(K.pt(side * 0.2, 4.0, off * 3.2), { c: 0xff7a3a, s: 1.4, kind: 'lantern' }));
        }
        for (const off of [-1, 1]) banner(B, gx - side * 0.2, ggy + (desert ? 7.2 : 7.5), tw.z + off * 6.2, side > 0 ? 0 : Math.PI, desert ? 0x2f6f73 : 0xa8322a, 2.6);
      }
      for (const b of L.buildings) building(B, F, tw.x + b.dx, tw.z + b.dz, b, desert, glows, extras);
      // sokak fenerleri (yol boyunca)
      for (const dx of [-15.5, -11.5, 11.5, 15.5]) for (const dz of [-3.6, 3.6]) {
        const x = tw.x + dx, z = tw.z + dz;
        lantern(B, glows, { x, y: T.height(x, z), z }, true);
      }
      // süs: kasaba ağaçları, saksılar, fıçılar
      if (!desert) {
        for (const p of [[6.5, 15.2], [-5.5, -15.8], [-16.5, 3.5]]) broadTree(B, F, tw.x + p[0], T.height(tw.x + p[0], tw.z + p[1]), tw.z + p[1], 0.85, pick(TINT.blossom), 1);
      }
      for (const p of [[-3.5, -6], [3.2, -6.2], [-9.5, 3.2], [9.5, 3.2]]) {
        const x = tw.x + p[0], z = tw.z + p[1], y = T.height(x, z);
        B.use('stone').add(latheG('pot', [[0.001, 0], [0.32, 0.02], [0.42, 0.25], [0.36, 0.55], [0.42, 0.62], [0.001, 0.62]], 10), desert ? 0xb46a3c : 0x8c8378, x, y, z);
        shrub(F, x, y + 0.45, z, 0.6, desert ? pick(TINT.palm) : pick(TINT.leaf));
      }
      // NPC tezgâhları / kapı
      for (const n of L.npcs) {
        const x = tw.x + n.dx, z = tw.z + n.dz, gy = T.height(x, z);
        if (n.role === 'kapi') {
          const face = Math.atan2(tw.x - x, tw.z - z);
          const K = kit(B, x, gy, z, face);
          const stone = desert ? 0xc8ab80 : 0x8f897e;
          for (const s2 of [-1, 1]) {
            K.box(0.95, 0.4, 0.95, Mo.shade(stone, 0.85), s2 * 1.55, 0.2, 0, 'stone');
            K.geo(cylS(0.32, 0.38, 3.8, 10), stone, s2 * 1.55, 2.3, 0, 'stone');
            K.box(0.8, 0.3, 0.8, Mo.shade(stone, 0.9), s2 * 1.55, 4.3, 0, 'stone');
          }
          K.box(4.2, 0.45, 0.9, Mo.shade(stone, 0.92), 0, 4.6, 0, 'stone');
          if (desert) K.geo(latheG('pdome', domeProfile(0.6, 0.7, 1.35), 12), TURQ, 0, 4.82, 0, 'glaze');
          else K.geo(roofG(5.0, 1.6, 0.6, 0.35), SLATE, 0, 4.85, 0, 'tile');
          K.box(1.2, 0.35, 0.95, GOLD, 0, 4.2, 0, 'metal');
          portals.push({ x, y: gy + 2.2, z, face });
        } else if (n.role === 'hayvan') {
          B.use('cloth').box(1.1, 0.7, 0.8, 0xd9b964, x + 1.7, gy + 0.35, z + 0.4, 0.2);
          B.use('cloth').box(1.0, 0.6, 0.75, 0xcfae5a, x + 1.5, gy + 1.0, z + 0.5, -0.25);
          B.use('wood').box(1.4, 0.35, 0.5, WOOD_D, x - 1.4, gy + 0.18, z + 0.9);
          B.use('plain').box(1.2, 0.1, 0.36, 0x9a7a4a, x - 1.4, gy + 0.36, z + 0.9);
          B.use('wood').box(0.12, 2.0, 0.12, WOOD_D, x - 0.9, gy + 1.0, z - 1.1);
          B.use('wood').box(0.9, 0.08, 0.08, WOOD_D, x - 0.9, gy + 1.95, z - 1.1);
        } else if (n.role === 'tuccar') {
          B.use('wood').box(2.4, 0.9, 0.9, WOOD_D, x + 0.2, gy + 0.45, z + 1.4);
          B.use('wood').box(2.6, 0.08, 1.0, WOOD_L, x + 0.2, gy + 0.94, z + 1.4);
          for (let k = 0; k < 4; k++) B.use('cloth').box(0.3, 0.3, 0.3, [0xd0453a, 0x3f7fd6, 0xd0453a, 0x3f7fd6][k], x - 0.6 + k * 0.55, gy + 1.13, z + 1.4);
          for (let k = 0; k < 2; k++) B.use('plain').add(latheG('jar', [[0.001, 0], [0.16, 0.02], [0.22, 0.2], [0.12, 0.42], [0.14, 0.48], [0.001, 0.48]], 10), k ? 0x3f6f9a : 0xb46a3c, x + 1.5 + k * 0.5, gy, z + 0.6);
        } else if (n.role === 'kervan') {
          // yük sandıkları ve çuvallar
          B.use('wood').box(0.9, 0.7, 0.7, WOOD_L, x - 1.6, gy + 0.35, z - 1.0, 0.3);
          B.use('wood').box(0.7, 0.55, 0.6, 0x7a5636, x - 1.5, gy + 0.98, z - 1.0, 0.1);
          B.use('cloth').add(sphS(0.4, 8, 6), 0xcdb48a, x - 2.4, gy + 0.3, z - 0.3, 0, 1, 0.75, 1);
          B.use('cloth').add(sphS(0.4, 8, 6), 0xc2a67a, x - 2.1, gy + 0.3, z + 0.5, 0, 1, 0.7, 1);
        }
      }
    }
    // köprü: taş ayaklar, tahta güverte, kırmızı korkuluk, fenerler
    const Bq = T.BRIDGE;
    for (let x = Bq.x - Bq.halfLen - 1; x <= Bq.x + Bq.halfLen + 1; x += 0.6) {
      const z = T.roadZ(x);
      B.use('wood').box(0.56, 0.2, Bq.halfWidth * 2 + 0.3, ((x * 10) | 0) % 2 ? 0x8a6440 : 0x7a5636, x, Bq.deck - 0.1, z, Math.atan(T.roadZ(x + 0.3) - T.roadZ(x - 0.3)) * -0.9);
    }
    for (let x = Bq.x - Bq.halfLen; x <= Bq.x + Bq.halfLen; x += 3.25) {
      const z = T.roadZ(x);
      for (const s of [-1, 1]) {
        B.use('wood').box(0.24, 1.25, 0.24, RED, x, Bq.deck + 0.55, z + s * (Bq.halfWidth + 0.1));
        B.use('metal').box(0.3, 0.12, 0.3, GOLD, x, Bq.deck + 1.22, z + s * (Bq.halfWidth + 0.1));
      }
      B.use('stone').box(1.4, 5.5, Bq.halfWidth * 2 + 0.8, STONE, x, Bq.deck - 3.0, z);
      B.use('stone').box(1.7, 0.4, Bq.halfWidth * 2 + 1.1, 0x837d72, x, Bq.deck - 0.35, z);
    }
    for (const s of [-1, 1]) {
      for (let x = Bq.x - Bq.halfLen; x < Bq.x + Bq.halfLen; x += 1) {
        const z = T.roadZ(x + 0.5);
        B.use('wood').box(1.05, 0.12, 0.14, RED, x + 0.5, Bq.deck + 1.05, z + s * (Bq.halfWidth + 0.1));
        B.use('wood').box(1.05, 0.08, 0.1, RED, x + 0.5, Bq.deck + 0.55, z + s * (Bq.halfWidth + 0.1));
      }
    }
    for (const ex of [-1, 1]) for (const s of [-1, 1]) {
      const x = Bq.x + ex * (Bq.halfLen + 0.4), z = T.roadZ(x) + s * (Bq.halfWidth + 0.35);
      B.use('stone').box(0.7, 1.9, 0.7, STONE, x, Bq.deck + 0.6, z);
      B.use('stone').add(roofG(1.1, 1.1, 0.45, 0.18, 0.1), SLATE_D, x, Bq.deck + 1.6, z, 0);
      glows.push({ x, y: Bq.deck + 1.25, z, c: 0xffa04a, s: 1.2, kind: 'lantern' });
    }
    // yol taşları
    for (let x = -100; x <= 100; x += 25) {
      if (Math.abs(x - Bq.x) < 20) continue;
      const z = T.roadZ(x) + 3.4, y = T.height(x, z);
      B.use('stone').box(0.55, 1.1, 0.4, x < Bq.x ? 0x9a9184 : 0xc4a77e, x, y + 0.45, z, 0.1);
      B.use('stone').add(coneS(0.36, 0.3, 4), x < Bq.x ? 0x8a8174 : 0xb4976e, x, y + 1.12, z, Math.PI / 4 + 0.1);
    }
  }

  function building(B, F, x, z, b, desert, glows, extras) {
    const s = b.s || 1, gy = T.height(x, z), r = b.r || 0;
    const front = z > T.roadZ(x) ? Math.PI : 0;   // yerel +z yola baksın
    const K = kit(B, x, gy, z, r + front);
    switch (b.k) {
      case 'yurt': {
        const R = 2.6 * s;
        K.geo(cylS(R + 0.15, R + 0.2, 0.25, 18), STONE, 0, 0.12, 0, 'stone');
        K.geo(cylS(R, R, 2.1 * s, 18), FELT, 0, 0.25 + 1.05 * s, 0, 'cloth');
        K.geo(cylS(R + 0.04, R + 0.04, 0.32 * s, 18), 0xa8322a, 0, 0.25 + 1.65 * s, 0, 'cloth');
        K.geo(cylS(R + 0.05, R + 0.05, 0.06 * s, 18), GOLD, 0, 0.25 + 1.84 * s, 0, 'cloth');
        K.geo(cylS(R + 0.05, R + 0.05, 0.06 * s, 18), GOLD, 0, 0.25 + 1.47 * s, 0, 'cloth');
        for (const yy of [0.55, 1.05]) K.geo(cylS(R + 0.03, R + 0.03, 0.05, 18), 0x6b5236, 0, yy * s + 0.25, 0, 'plain');
        K.geo(coneS(R + 0.35, 1.55 * s, 18), 0xe4d9c2, 0, 0.25 + 2.1 * s + 0.75 * s, 0, 'cloth');
        K.geo(cylS(0.42 * s, 0.52 * s, 0.32 * s, 10), WOOD_D, 0, 0.25 + 3.6 * s, 0, 'wood');
        K.box(1.0 * s, 1.55 * s, 0.25, 0xb0502a, 0, 0.25 + 0.78 * s, R - 0.02, 'wood');
        K.box(1.25 * s, 0.14, 0.3, GOLD, 0, 0.25 + 1.6 * s, R, 'metal');
        for (const sx of [-1, 1]) K.box(0.12, 1.6 * s, 0.3, WOOD_D, sx * 0.56 * s, 0.25 + 0.8 * s, R, 'wood');
        break;
      }
      case 'house': {
        const W = 4.6 * s, Dd = 3.6 * s, wh = 2.3 * s, y0 = 0.55;
        K.box(W + 0.5, y0, Dd + 0.5, STONE, 0, y0 / 2, 0, 'stone');
        K.box(W, wh, Dd, PLASTER, 0, y0 + wh / 2, 0, 'plaster');
        K.box(W + 0.02, 0.35, Dd + 0.02, 0xb9ae98, 0, y0 + 0.18, 0, 'plaster');
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) K.geo(cylS(0.13, 0.15, wh + 0.2, 8), RED, cx * W / 2, y0 + wh / 2, cz * Dd / 2, 'wood');
        for (const cx of [-1, 1]) K.geo(cylS(0.11, 0.13, wh, 8), RED, cx * 0.78 * s, y0 + wh / 2, Dd / 2 + 0.05, 'wood');
        for (const cz of [-1, 1]) K.box(W + 0.3, 0.24, 0.24, WOOD_D, 0, y0 + wh, cz * Dd / 2, 'wood');
        for (const cx of [-1, 1]) K.box(0.24, 0.24, Dd + 0.3, WOOD_D, cx * W / 2, y0 + wh, 0, 'wood');
        K.box(1.1 * s, 1.75 * s, 0.1, 0x4a2f22, 0, y0 + 0.88 * s, Dd / 2 + 0.03, 'wood');
        K.box(1.3 * s, 0.14, 0.14, RED, 0, y0 + 1.8 * s, Dd / 2 + 0.06, 'wood');
        for (const sx of [-1, 1]) {
          const wx = sx * 1.6 * s, wy = y0 + 1.3 * s;
          K.box(0.95, 0.8, 0.06, 0x2b241f, wx, wy, Dd / 2 + 0.02, 'plain');
          for (const q of [-0.22, 0, 0.22]) K.box(0.05, 0.8, 0.08, 0x6a4a32, wx + q, wy, Dd / 2 + 0.05, 'wood');
          K.box(0.95, 0.05, 0.08, 0x6a4a32, wx, wy, Dd / 2 + 0.05, 'wood');
          K.box(1.15, 0.1, 0.2, WOOD_D, wx, wy - 0.45, Dd / 2 + 0.08, 'wood');
          K.box(0.06, 0.7, 0.8, 0x2b241f, sx * (W / 2 + 0.01), wy, 0, 'plain');
        }
        const ry = y0 + wh + 0.12, rw = W + 1.7, rd = Dd + 1.5, rh = 1.55 * s;
        K.geo(roofG(rw, rd, rh, 0.45 * s), SLATE, 0, ry, 0, 'tile');
        K.box(rw - rd + 0.3, 0.24, 0.3, SLATE_D, 0, ry + rh + 0.06, 0, 'tile');
        for (const sx of [-1, 1]) K.geo(coneS(0.12, 0.55, 6), SLATE_D, sx * (rw - rd) / 2, ry + rh + 0.3, 0, 'plain', 0, 1, 1, 1, 0, -sx * 0.55);
        for (const sx of [-1, 1]) glows.push(Object.assign(K.pt(sx * 0.78 * s, y0 + 1.95 * s, Dd / 2 + 0.45), { c: 0xff7a3a, s: 1.1, kind: 'lantern' }));
        K.geo(cylS(0.32, 0.34, 0.8, 10), WOOD_L, W / 2 + 0.6, 0.4, Dd / 2 - 0.2, 'wood');
        K.geo(cylS(0.33, 0.33, 0.06, 10), 0x3b3d42, W / 2 + 0.6, 0.62, Dd / 2 - 0.2, 'metal');
        break;
      }
      case 'tower': {
        K.box(3.3, 4.2, 3.3, STONE, 0, 2.1, 0, 'stone');
        K.box(3.5, 0.3, 3.5, 0x7d776c, 0, 4.3, 0, 'stone');
        K.box(2.7, 2.6, 2.7, PLASTER, 0, 5.75, 0, 'plaster');
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) K.geo(cylS(0.13, 0.14, 2.8, 8), RED, cx * 1.45, 5.85, cz * 1.45, 'wood');
        for (const cz of [-1, 1]) { K.box(3.2, 0.12, 0.12, RED, 0, 5.0, cz * 1.6, 'wood'); K.box(0.12, 0.12, 3.2, RED, cz * 1.6, 5.0, 0, 'wood'); }
        for (const cz of [-1, 1]) { K.box(1.0, 0.8, 0.08, 0x2b241f, 0, 5.9, cz * 1.36, 'plain'); K.box(0.08, 0.8, 1.0, 0x2b241f, cz * 1.36, 5.9, 0, 'plain'); }
        K.box(3.3, 0.25, 3.3, WOOD_D, 0, 7.15, 0, 'wood');
        K.geo(roofG(4.8, 4.8, 2.0, 0.6), SLATE, 0, 7.3, 0, 'tile');
        K.geo(coneS(0.14, 0.9, 6), GOLD, 0, 9.6, 0, 'metal');
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) glows.push(Object.assign(K.pt(cx * 1.75, 6.7, cz * 1.75), { c: 0xff7a3a, s: 1.2, kind: 'lantern' }));
        break;
      }
      case 'flat': {
        const c = rand() < 0.5 ? ADOBE : 0xe0cba6, W = 5 * s, Dd = 4.2 * s, H = 3.2 * s;
        K.box(W + 0.2, 0.4, Dd + 0.2, 0xb59a74, 0, 0.2, 0, 'stone');
        K.box(W, H, Dd, c, 0, H / 2 + 0.1, 0, 'plaster');
        K.box(W + 0.3, 0.3, Dd + 0.3, Mo.shade(c, 0.9), 0, H + 0.15, 0, 'plaster');
        for (const sx of [-1, 1]) K.box(W + 0.3, 0.45, 0.25, Mo.shade(c, 0.95), 0, H + 0.5, sx * (Dd / 2 + 0.03), 'plaster');
        for (const sx of [-1, 1]) K.box(0.25, 0.45, Dd + 0.3, Mo.shade(c, 0.95), sx * (W / 2 + 0.03), H + 0.5, 0, 'plaster');
        for (let k = -2; k <= 2; k++) K.geo(cylS(0.09, 0.09, 0.6, 6), WOOD_D, k * W / 5.2, H - 0.25, Dd / 2 + 0.25, 'wood', 0, 1, 1, 1, Math.PI / 2);
        K.box(2.4 * s, 1.9 * s, 2.2 * s, c, -0.8 * s, H + 1.0 * s, -0.5 * s, 'plaster');
        K.box(2.6 * s, 0.22, 2.4 * s, Mo.shade(c, 0.9), -0.8 * s, H + 1.95 * s, -0.5 * s, 'plaster');
        K.box(1.1 * s, 1.9 * s, 0.1, 0x5a3e2a, 0.6, 0.1 + 0.95 * s, Dd / 2 + 0.04, 'wood');
        K.geo(cylS(0.55 * s, 0.55 * s, 0.1, 12, 1), Mo.shade(c, 0.82), 0.6, 0.1 + 1.9 * s, Dd / 2 + 0.03, 'plaster', 0, 1, 1, 1, Math.PI / 2);
        const awn = rand() < 0.5 ? 0x2f6f73 : 0xa8322a;
        K.box(2.5 * s, 0.06, 1.3, awn, 0.6, 0.1 + 2.35 * s, Dd / 2 + 0.6, 'cloth', 0.32);
        for (let k = 0; k < 4; k++) K.box(0.3 * s, 0.065, 1.32, 0xefe3c8, 0.6 - 0.95 * s + k * 0.62 * s, 0.1 + 2.36 * s, Dd / 2 + 0.6, 'cloth', 0.32);
        for (const sx of [-1, 1]) K.geo(cylS(0.04, 0.04, 2.3 * s, 5), WOOD_D, 0.6 + sx * 1.2 * s, 0.1 + 1.15 * s, Dd / 2 + 1.2, 'wood');
        for (const sx of [-1, 1]) { K.box(0.65, 0.75, 0.06, 0x2a2420, sx * 1.65 * s, 0.1 + 2.0 * s, Dd / 2 + 0.03, 'plain'); K.box(0.32, 0.8, 0.06, 0x3c6f86, sx * 1.65 * s - 0.48, 0.1 + 2.0 * s, Dd / 2 + 0.05, 'wood'); }
        K.geo(latheG('jar', [[0.001, 0], [0.16, 0.02], [0.22, 0.2], [0.12, 0.42], [0.14, 0.48], [0.001, 0.48]], 10), 0xb46a3c, -W / 2 + 0.5, H + 0.3, Dd / 2 - 0.4, 'plain', 0, 1.4, 1.4, 1.4);
        break;
      }
      case 'dome': {
        const W = 5 * s, H = 3.4 * s;
        K.box(W + 0.2, 0.4, W + 0.2, 0xb59a74, 0, 0.2, 0, 'stone');
        K.box(W, H, W, 0xe6d6b4, 0, H / 2 + 0.2, 0, 'plaster');
        K.box(W + 0.2, 0.3, W + 0.2, 0xcdb48c, 0, H + 0.3, 0, 'plaster');
        for (const sx of [-1, 1]) for (const k of [-1, 0, 1]) {
          const tall = k === 0;
          K.box(tall ? 1.3 * s : 0.8 * s, tall ? 2.2 * s : 1.5 * s, 0.08, 0x3a2e24, k * 1.6 * s, 0.2 + (tall ? 1.1 : 1.3) * s, sx * (W / 2 + 0.01), 'plain');
          K.geo(cylS((tall ? 0.65 : 0.4) * s, (tall ? 0.65 : 0.4) * s, 0.1, 12), 0x3a2e24, k * 1.6 * s, 0.2 + (tall ? 2.2 : 2.05) * s, sx * (W / 2 + 0.01), 'plain', 0, 1, 1, 1, Math.PI / 2);
          K.box((tall ? 1.55 : 1.0) * s, 0.16, 0.14, TURQ_D, k * 1.6 * s, 0.2 + (tall ? 2.95 : 2.6) * s, sx * (W / 2 + 0.03), 'glaze');
        }
        K.geo(cylS(2.2 * s, 2.35 * s, 0.9 * s, 18), 0xe0cfaa, 0, H + 0.45 + 0.45 * s, 0, 'brick');
        K.geo(cylS(2.22 * s, 2.22 * s, 0.22 * s, 18), TURQ_D, 0, H + 0.45 + 0.75 * s, 0, 'glaze');
        K.geo(latheG('dome', domeProfile(2.15, 2.4, 1.18), 20), TURQ, 0, H + 0.45 + 0.9 * s, 0, 'glaze', 0, s, s, s);
        K.geo(cylS(0.05, 0.05, 0.9 * s, 6), GOLD, 0, H + 0.45 + 0.9 * s + 2.85 * s + 0.4 * s, 0, 'metal');
        K.geo(sphS(0.16 * s, 8, 6), GOLD, 0, H + 0.45 + 0.9 * s + 2.85 * s + 0.2 * s, 0, 'metal');
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) { K.geo(cylS(0.3, 0.32, 0.9, 10), 0xe0cfaa, cx * (W / 2 - 0.2), H + 0.75, cz * (W / 2 - 0.2), 'brick'); K.geo(latheG('mdome', domeProfile(0.34, 0.45, 1.3), 10), TURQ, cx * (W / 2 - 0.2), H + 1.2, cz * (W / 2 - 0.2), 'glaze'); }
        break;
      }
      case 'minaret': {
        K.geo(cylS(1.35, 1.45, 1.2, 12), 0xc9ab80, 0, 0.6, 0, 'stone');
        K.geo(cylS(1.0, 1.2, 9, 14), 0xe2cfa9, 0, 5.6, 0, 'brick');
        for (const yy of [3.2, 6.0]) K.geo(cylS(1.12, 1.12, 0.3, 14), TURQ_D, 0, yy, 0, 'glaze');
        K.geo(cylS(1.65, 1.15, 0.6, 14), 0xc9ab80, 0, 10.4, 0, 'stone');
        for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; K.geo(cylS(0.05, 0.05, 0.6, 5), WOOD_D, Math.cos(a) * 1.55, 11.0, Math.sin(a) * 1.55, 'wood'); }
        K.geo(cylS(1.62, 1.62, 0.08, 14), WOOD_D, 0, 11.3, 0, 'wood');
        K.geo(cylS(0.78, 0.88, 2.2, 12), 0xe2cfa9, 0, 11.8, 0, 'brick');
        K.geo(cylS(0.82, 0.82, 0.25, 12), TURQ_D, 0, 12.6, 0, 'glaze');
        K.geo(latheG('mtop', domeProfile(0.9, 1.4, 1.4), 14), TURQ, 0, 12.9, 0, 'glaze');
        K.geo(coneS(0.07, 1.0, 6), GOLD, 0, 15.2, 0, 'metal');
        glows.push({ x, y: gy + 11.0, z, c: 0xffc46b, s: 2 });
        break;
      }
      case 'pen': {
        const w = 6.5, d = 5;
        for (let k = 0; k <= 6; k++) {
          const px = -w / 2 + k * w / 6;
          K.geo(cylS(0.09, 0.1, 1.25, 6), WOOD_D, px, 0.62, d / 2, 'wood');
          if (k === 0 || k === 6) for (let q = 1; q < 4; q++) K.geo(cylS(0.09, 0.1, 1.25, 6), WOOD_D, px, 0.62, d / 2 - q * d / 4, 'wood');
        }
        for (const yy of [0.5, 0.95]) {
          K.box(w, 0.1, 0.1, WOOD_L, 0, yy, d / 2, 'wood');
          K.box(0.1, 0.1, d, WOOD_L, -w / 2, yy, 0, 'wood');
          K.box(0.1, 0.1, d, WOOD_L, w / 2, yy, 0, 'wood');
        }
        K.box(1.1, 0.8, 0.8, 0xd9b964, 2.3, 0.4, -1.6, 'cloth', 0, 0, 0.3);
        K.box(1.1, 0.8, 0.8, 0xcfae5a, 2.0, 1.2, -1.4, 'cloth', 0, 0, -0.2);
        K.box(1.8, 0.4, 0.5, WOOD_D, -1.8, 0.3, -1.9, 'wood');
        K.box(1.6, 0.06, 0.36, 0x5f7f8f, -1.8, 0.48, -1.9, 'plain');
        const p = K.pt(0.6, 0, 0.3);
        extras.camels.push({ x: p.x, z: p.z, rot: rand() * 6 });
        break;
      }
      case 'forge': {
        K.box(2.4, 1.2, 1.7, 0x7a736b, 0, 0.6, 0, 'stone');
        K.box(1.0, 4.0, 1.0, 0x837b71, 0.65, 2.0, -0.35, 'stone');
        K.box(1.2, 0.3, 1.2, 0x6e675f, 0.65, 4.1, -0.35, 'stone');
        K.box(1.4, 0.2, 1.0, 0x1a1512, -0.2, 1.25, 0.1, 'plain');
        K.box(0.9, 0.45, 0.4, 0x3b3d42, -2.2, 0.75, 1.2, 'metal');
        K.box(0.5, 0.5, 0.32, WOOD_D, -2.2, 0.27, 1.2, 'wood');
        for (const cx of [-1, 1]) K.geo(cylS(0.1, 0.11, 2.8, 7), WOOD_D, cx * 1.5 - 0.4, 1.4, 1.5, 'wood');
        K.box(3.6, 0.1, 2.4, 0x6b4a2e, -0.4, 2.85, 0.6, 'wood', 0.22);
        K.geo(cylS(0.38, 0.38, 0.9, 10), WOOD_L, 1.8, 0.45, 1.3, 'wood');
        K.geo(cylS(0.33, 0.33, 0.04, 10), 0x2e5f7a, 1.8, 0.88, 1.3, 'plain');
        for (let k = 0; k < 3; k++) K.box(0.05, 1.1, 0.12, 0xb9bec6, -1.9 + k * 0.25, 0.75, -0.9, 'metal', 0, 0.15);
        glows.push(Object.assign(K.pt(-0.2, 1.45, 0.1), { c: 0xff7a2a, s: 2.4, flicker: true }));
        break;
      }
      case 'stall': {
        for (const c of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.geo(cylS(0.07, 0.08, 2.5, 6), WOOD_D, c[0] * 1.25, 1.25, c[1] * 0.85, 'wood');
        K.box(3.0, 0.07, 2.2, b.c, 0, 2.5, 0, 'cloth', 0.18);
        for (let k = 0; k < 5; k++) K.box(0.28, 0.075, 2.22, 0xefe3c8, -1.2 + k * 0.6, 2.505, 0, 'cloth', 0.18);
        K.box(3.05, 0.25, 0.05, b.c, 0, 2.25, 1.15, 'cloth');
        K.box(2.4, 0.8, 0.8, 0x7a5636, 0, 0.4, 0.4, 'wood');
        K.box(2.6, 0.06, 0.9, WOOD_L, 0, 0.83, 0.4, 'wood');
        for (let k = 0; k < 3; k++) K.box(0.5, 0.35, 0.5, [0xd9b964, 0xa8322a, 0x3f7fd6, 0x7da64a][(k + (b.c & 3)) % 4], -0.7 + k * 0.7, 1.04, 0.4, 'cloth');
        K.geo(cylS(0.12, 0.12, 0.9, 8), 0x7a2f5a, 1.05, 0.95, 0.65, 'cloth', 0, 1, 1, 1, Math.PI / 2);
        glows.push(Object.assign(K.pt(1.25, 2.2, 0.85), { c: 0xff8a3a, s: 1.0, kind: 'lantern' }));
        break;
      }
      case 'well': {
        K.geo(cylS(1.0, 1.1, 0.9, 16), 0x8f877c, 0, 0.45, 0, 'stone');
        K.geo(cylS(1.06, 1.06, 0.14, 16), 0x7a7369, 0, 0.92, 0, 'stone');
        K.geo(cylS(0.82, 0.82, 0.1, 16), 0x24506a, 0, 0.82, 0, 'plain');
        for (const s2 of [-1, 1]) K.geo(cylS(0.08, 0.09, 2.1, 7), desert ? WOOD_D : RED, s2 * 0.95, 1.4, 0, 'wood');
        K.geo(cylS(0.07, 0.07, 2.0, 7), WOOD_D, 0, 2.15, 0, 'wood', 0, 1, 1, 1, 0, Math.PI / 2);
        K.geo(cylS(0.16, 0.13, 0.25, 8), WOOD_L, 0.2, 1.5, 0, 'wood');
        if (desert) K.geo(latheG('wdome', domeProfile(1.3, 0.9, 1.3), 14), TURQ, 0, 2.4, 0, 'glaze');
        else K.geo(roofG(2.8, 2.8, 0.95, 0.35), SLATE, 0, 2.45, 0, 'tile');
        break;
      }
      case 'palm': palm(B, F, x, gy, z, s); break;
    }
  }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function portalTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,245,210,1)'); gr.addColorStop(0.35, 'rgba(120,220,200,0.9)'); gr.addColorStop(0.75, 'rgba(40,120,170,0.55)'); gr.addColorStop(1, 'rgba(40,120,170,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(64, 64, 14 + k * 10, k, k + 3.6); g.stroke(); }
    return new THREE.CanvasTexture(c);
  }

  function build(scene, quality) {
    G.textures();
    const out = { glowTex: glowTexture(), glows: [], portals: [], camels: [], signs: [] };
    out.sky = G.sky(); scene.add(out.sky);
    out.mountains = G.mountains(); scene.add(out.mountains);
    out.terrain = terrainMesh(); scene.add(out.terrain);
    out.water = waterMesh(); scene.add(out.water);
    const B = new Batch(), F = new Foliage(), FG = new Foliage();
    const glows = [], portals = [], extras = { camels: [] };
    out.counts = scatter(B, F, FG, quality);
    towns(B, F, glows, portals, extras);
    const mesh = B.build(G.staticMaterial(), true);
    mesh.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    scene.add(mesh);
    out.static = mesh;
    out.leaves = F.build(G.leafMaterial(), true);
    scene.add(out.leaves);
    out.grass = FG.build(G.grassMaterial(quality === 'low' ? 46 : 64), false);
    scene.add(out.grass);
    // parıltılar (fener, ocak)
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xff6a3a }), capMat = Mo.mat(0x2a1e18);
    lanternMat.color.setRGB(2.4, 0.85, 0.32);   // HDR hedefte 1'in üstü: ışıltı yalnızca fenerlerde
    for (const g of glows) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: out.glowTex, color: g.c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(g.x, g.y, g.z); sp.scale.setScalar(g.s * (g.kind === 'lantern' ? 1.6 : 1));
      scene.add(sp);
      if (g.kind === 'lantern') {
        const body = new THREE.Mesh(sphS(0.2, 10, 8), lanternMat); body.scale.set(1, 1.3, 1); body.position.set(g.x, g.y, g.z); scene.add(body);
        for (const dy of [-0.27, 0.27]) { const cap = new THREE.Mesh(cylS(0.1, 0.1, 0.06, 8), capMat); cap.position.set(g.x, g.y + dy, g.z); scene.add(cap); }
      } else {
        const core = new THREE.Mesh(Mo.boxG(0.22, 0.3, 0.22), Mo.mat(g.c, true));
        core.position.set(g.x, g.y, g.z);
        scene.add(core);
      }
      out.glows.push({ sp, base: g.s * (g.kind === 'lantern' ? 1.6 : 1), flicker: g.flicker, ph: rand() * 6 });
    }
    const pt = portalTexture();
    for (const p of portals) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), new THREE.MeshBasicMaterial({ map: pt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(p.x, p.y, p.z); m.rotation.y = p.face; m.scale.y = 1.35;
      scene.add(m);
      out.portals.push(m);
    }
    for (const c of extras.camels) {
      const cm = Mo.camel(false);
      cm.obj.position.set(c.x, T.height(c.x, c.z), c.z);
      cm.obj.rotation.y = c.rot;
      scene.add(cm.obj);
      out.camels.push(cm);
    }
    // yol tabelaları
    const Bq = T.BRIDGE;
    out.signs.push({ x: Bq.x - Bq.halfLen - 5, z: T.roadZ(Bq.x - Bq.halfLen - 5) + 3.2, text: '← Sarıkum · Taşkale →' });
    out.signs.push({ x: Bq.x + Bq.halfLen + 5, z: T.roadZ(Bq.x + Bq.halfLen + 5) - 3.2, text: '← Sarıkum · Taşkale →' });
    for (const s of out.signs) {
      const y = T.height(s.x, s.z);
      const post = new THREE.Mesh(cylS(0.08, 0.1, 2.2, 7), Mo.mat(0x5e4430)); post.position.set(s.x, y + 1.1, s.z); post.castShadow = true; scene.add(post);
      const board = new THREE.Mesh(Mo.boxG(1.8, 0.45, 0.08), Mo.mat(0x8a6440)); board.position.set(s.x, y + 1.9, s.z); board.castShadow = true; scene.add(board);
      s.y = y + 2.6;
    }
    return out;
  }

  return { build, Batch, glowTexture };
})();
