/* ============================================================
   KERVAN YOLU — scenery.js
   Statik dünya: arazi, su, gökyüzü, ağaçlar, kayalar, kasabalar,
   köprü. Binlerce parça tek bir "batch" ağında birleştirilir,
   böylece telefonda da akıcı çalışır.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

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
    // yol
    const rz = Math.abs(z - T.roadZ(x));
    c = mix(c, mix(P.road, P.roadE, e), S(3.0, 1.6, rz) * 0.9);
    // kasaba meydanı
    for (const k in T.TOWNS) {
      const t = T.TOWNS[k], d = Math.hypot(x - t.x, z - t.z);
      if (d < t.r + 4) c = mix(c, k === 'taskale' ? P.plazaE : P.plaza, S(t.r + 3, t.r - 3, d) * 0.75);
    }
    // su kenarı ve yatağı
    if (h < T.WATER + 1.1) c = mix(c, P.bank, S(T.WATER + 1.1, T.WATER + 0.3, h));
    if (h < T.WATER) c = mix(P.bank, P.bed, S(T.WATER, T.WATER - 1.5, h));
    // dik yamaç ve dağ
    c = mix(c, e > 0.5 ? P.rockE : P.rock, S(0.55, 1.1, slope));
    c = mix(c, e > 0.5 ? P.rockE : P.rock, S(8, 13, h));
    if (h > 17) c = mix(c, P.snow, S(17, 22, h + n * 2));
    return c;
  }
  return { ground, C, mix };
})();

KY.Scenery = (function () {
  const T = KY.Terrain, D = KY.DATA, Mo = KY.Models;
  const dummy = new THREE.Object3D();
  const rand = (() => { let s = 1234567; return () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; })();
  const rr = (a, b) => a + rand() * (b - a);

  const TILE = 44;
  class Batch {
    constructor() { this.parts = []; this.count = 0; }
    add(geo, color, x, y, z, ry, sx, sy, sz, rx, rz, jitter) {
      const tile = Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx || 0, ry || 0, rz || 0);
      dummy.scale.set(sx || 1, sy || sx || 1, sz || sx || 1);
      dummy.updateMatrix();
      const g = (geo.index ? geo.toNonIndexed() : geo.clone());
      g.applyMatrix4(dummy.matrix);
      this.parts.push({ g, color, jitter: jitter == null ? 0.07 : jitter, tile });
      this.count += g.attributes.position.count;
    }
    box(w, h, d, color, x, y, z, ry, rx, rz) { this.add(Mo.boxG(w, h, d), color, x, y, z, ry, 1, 1, 1, rx, rz); }
    // parçaları bölgelere (tile) göre ayrı ağlarda birleştir: görüş dışındakiler hiç çizilmez
    build(material) {
      const byTile = new Map();
      for (const p of this.parts) { if (!byTile.has(p.tile)) byTile.set(p.tile, []); byTile.get(p.tile).push(p); }
      const group = new THREE.Group();
      const c = new THREE.Color();
      for (const parts of byTile.values()) {
        let count = 0;
        for (const p of parts) count += p.g.attributes.position.count;
        const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
        let o = 0;
        for (const p of parts) {
          const a = p.g.attributes.position.array, n = a.length / 3;
          pos.set(a, o * 3);
          c.set(p.color);
          for (let f = 0; f < n; f += 3) {
            const j = 1 + (rand() * 2 - 1) * p.jitter;
            for (let k = 0; k < 3 && f + k < n; k++) {
              const i = (o + f + k) * 3;
              col[i] = Math.min(1, c.r * j); col[i + 1] = Math.min(1, c.g * j); col[i + 2] = Math.min(1, c.b * j);
            }
          }
          o += n;
          p.g.dispose();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        group.add(new THREE.Mesh(geo, material));
      }
      this.parts = [];
      return group;
    }
  }

  // ---------- arazi ----------
  function terrainMesh() {
    const H = T.cacheData(), GW = T.GW, GD = T.GD, S = T.STEP;
    const at = (i, j) => H[j * GW + i];
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const group = new THREE.Group();
    const CH = 22;  // her parça 22×22 hücre (44×44 birim)
    for (let cj = 0; cj < GD - 1; cj += CH) for (let ci = 0; ci < GW - 1; ci += CH) {
      const ni = Math.min(CH, GW - 1 - ci), nj = Math.min(CH, GD - 1 - cj);
      const tris = ni * nj * 2;
      const pos = new Float32Array(tris * 9), col = new Float32Array(tris * 9);
      let o = 0, co = 0;
      const put = (i, j) => { pos[o++] = T.OX + i * S; pos[o++] = at(i, j); pos[o++] = T.OZ + j * S; };
      for (let j = cj; j < cj + nj; j++) for (let i = ci; i < ci + ni; i++) {
        const alt = ((i + j) & 1) === 0;
        const quads = alt ? [[i, j, i, j + 1, i + 1, j], [i + 1, j, i, j + 1, i + 1, j + 1]] : [[i, j, i, j + 1, i + 1, j + 1], [i, j, i + 1, j + 1, i + 1, j]];
        for (const q of quads) {
          put(q[0], q[1]); put(q[2], q[3]); put(q[4], q[5]);
          const cx = T.OX + (q[0] + q[2] + q[4]) / 3 * S, cz = T.OZ + (q[1] + q[3] + q[5]) / 3 * S;
          const hs = [at(q[0], q[1]), at(q[2], q[3]), at(q[4], q[5])];
          const ch = (hs[0] + hs[1] + hs[2]) / 3;
          const slope = (Math.max(hs[0], hs[1], hs[2]) - Math.min(hs[0], hs[1], hs[2])) / S;
          const c = KY.Palette.ground(cx, cz, ch, slope);
          const j2 = 0.975 + rand() * 0.05;
          for (let k = 0; k < 3; k++) { col[co++] = c[0] * j2; col[co++] = c[1] * j2; col[co++] = c[2] * j2; }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
    }
    return group;
  }

  function water() {
    const g = new THREE.PlaneGeometry(T.HALF_W * 2 + 80, T.HALF_D * 2 + 80, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: 0x3f8fae, specular: 0xbfe3f2, shininess: 70, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.y = T.WATER;
    m.receiveShadow = true;
    return m;
  }

  function sky() {
    const g = new THREE.SphereGeometry(300, 24, 16);
    const cols = [], p = g.attributes.position;
    const top = new THREE.Color(0x3f74b5), mid = new THREE.Color(0x8fbad9), hor = new THREE.Color(0xeadbb8), low = new THREE.Color(0xd8c7a2);
    const c = new THREE.Color();
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) / 300;
      if (y > 0.35) c.copy(mid).lerp(top, Math.min(1, (y - 0.35) / 0.65));
      else if (y > 0.02) c.copy(hor).lerp(mid, (y - 0.02) / 0.33);
      else c.copy(hor).lerp(low, Math.min(1, -y * 4));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -10;
    return m;
  }

  // ---------- doğa ----------
  function scatter(B, quality, BG) {
    const G = {
      trunk: Mo.cylG(0.12, 0.18, 1, 5), round: Mo.icoG(1, 0), cone: Mo.coneG(1, 1, 6), rock: Mo.flat('rock', () => new THREE.DodecahedronGeometry(1, 0)),
      blade: Mo.flat('blade', () => { const g = new THREE.ConeGeometry(0.09, 0.55, 3, 1, true); g.translate(0, 0.27, 0); return g; }),
      shrub: Mo.icoG(0.5, 0)
    };
    const spawnCenters = D.spawns.map(s => s);
    let trees = 0, rocks = 0, grass = 0;
    const ok = (x, z, clear) => {
      const h = T.height(x, z);
      if (h < T.WATER + 0.5 || h > 16) return false;
      if (Math.abs(z - T.roadZ(x)) < 4.5) return false;
      for (const k in T.TOWNS) { const t = T.TOWNS[k]; if (Math.hypot(x - t.x, z - t.z) < t.r + 4) return false; }
      if (Math.abs(x - T.BRIDGE.x) < 18 && Math.abs(z - T.BRIDGE.z) < 7) return false;
      if (clear) for (const s of spawnCenters) if (Math.hypot(x - s.x, z - s.z) < s.r * 0.5) return false;
      return true;
    };
    const step = 3.2;
    for (let x = -T.HALF_W - 20; x < T.HALF_W + 20; x += step) for (let z = -T.HALF_D - 20; z < T.HALF_D + 20; z += step) {
      const px = x + rr(-1.4, 1.4), pz = z + rr(-1.4, 1.4);
      const east = px > T.riverX(pz) + 10;
      const dens = T.noise(px * 0.035 + 40, pz * 0.035 - 13) * 0.5 + 0.5;
      const h = T.height(px, pz);
      const nearRiver = Math.abs(px - T.riverX(pz)) < 24;
      if (!ok(px, pz, true)) continue;
      const r = rand();
      if (!east) {
        const treeP = (dens > 0.62 ? 0.5 : 0.04) + (nearRiver ? 0.12 : 0) + (h > 9 ? 0.25 : 0);
        if (r < treeP) {
          const s = rr(0.8, 1.35), y = T.height(px, pz);
          const kind = h > 8.5 ? 'pine' : (nearRiver && rand() < 0.6) ? 'poplar' : 'round';
          if (kind === 'pine') {
            B.add(G.trunk, 0x5a4330, px, y + 0.6 * s, pz, 0, s, 1.2 * s, s);
            for (let k = 0; k < 3; k++) B.add(G.cone, 0x3e6a3c, px, y + (1.5 + k * 0.85) * s, pz, rand() * 6, (1.3 - k * 0.3) * s, 1.4 * s, (1.3 - k * 0.3) * s);
          } else if (kind === 'poplar') {
            B.add(G.trunk, 0x6a5038, px, y + 0.7 * s, pz, 0, s, 1.4 * s, s);
            B.add(G.round, 0x5e8c3c, px, y + 3.0 * s, pz, rand() * 6, 0.75 * s, 2.3 * s, 0.75 * s);
          } else {
            B.add(G.trunk, 0x6a5038, px, y + 0.8 * s, pz, 0, 1.2 * s, 1.6 * s, 1.2 * s);
            const g2 = rand() < 0.5 ? 0x5a8a3a : 0x6f9a40;
            B.add(G.round, g2, px, y + 2.4 * s, pz, rand() * 6, 1.4 * s, 1.15 * s, 1.4 * s);
            B.add(G.round, Mo.shade(g2, 1.1), px + 0.5 * s, y + 2.9 * s, pz - 0.3 * s, rand() * 6, 0.9 * s, 0.8 * s, 0.9 * s);
          }
          trees++;
          continue;
        }
        if (r < treeP + 0.07) { const s = rr(0.6, 1.1); B.add(G.shrub, 0x557f37, px, T.height(px, pz) + 0.3 * s, pz, rand() * 6, s * 1.3, s * 0.8, s * 1.3); continue; }
      } else {
        const oasis = h < T.WATER + 2.2 && !nearRiver;
        if (oasis && r < 0.35) {
          const s = rr(0.9, 1.2), y = T.height(px, pz);
          palm(B, px, y, pz, s); trees++; continue;
        }
        if (r < 0.05) {
          // kuru ağaç
          const s = rr(0.8, 1.2), y = T.height(px, pz);
          B.add(G.trunk, 0x6d5a48, px, y + 1.0 * s, pz, 0, s, 2 * s, s);
          B.box(0.12, 1.1 * s, 0.12, 0x6d5a48, px + 0.35 * s, y + 2.0 * s, pz, 0, 0, -0.7);
          B.box(0.1, 0.9 * s, 0.1, 0x6d5a48, px - 0.3 * s, y + 1.8 * s, pz + 0.1, 0, 0.2, 0.8);
          continue;
        }
        if (r < 0.12) { const s = rr(0.4, 0.8); B.add(G.shrub, 0x8f8a4c, px, T.height(px, pz) + 0.2 * s, pz, rand() * 6, s * 1.3, s * 0.7, s * 1.3); continue; }
      }
      if (r > 0.93 || (h > 7 && r > 0.8)) {
        const s = rr(0.5, 1.6), y = T.height(px, pz);
        B.add(G.rock, east ? 0xb08c62 : 0x8b847a, px, y + 0.2 * s, pz, rand() * 6, s * rr(0.9, 1.4), s * rr(0.5, 0.9), s * rr(0.9, 1.3), rand(), rand());
        rocks++;
      }
    }
    // çimen öbekleri (batı)
    const GN = quality === 'low' ? 1200 : 2600;
    for (let k = 0; k < GN * 3; k++) {
      if (grass >= GN) break;
      const px = rr(-T.HALF_W + 8, T.riverX(0) - 6), pz = rr(-T.HALF_D + 8, T.HALF_D - 8);
      if (!ok(px, pz, false)) continue;
      const h = T.height(px, pz);
      if (h > 9) continue;
      const y = h - 0.02, s = rr(0.55, 1.0), c = rand() < 0.5 ? 0x86ad50 : 0x9cbc5c;
      for (let b = 0; b < 3; b++) BG.add(G.blade, c, px + rr(-0.2, 0.2), y, pz + rr(-0.2, 0.2), rand() * 6, s, s * rr(0.8, 1.3), s, rr(-0.35, 0.35), rr(-0.35, 0.35), 0.05);
      grass++;
    }
    // küçük taşlar çöl yolunda
    return { trees, rocks, grass };
  }

  function palm(B, x, y, z, s) {
    let cx = x, cy = y, lean = rr(-0.25, 0.25);
    for (let k = 0; k < 5; k++) {
      B.add(Mo.cylG(0.16, 0.2, 0.8, 5), 0x8a6a45, cx, cy + 0.4 * s, z, 0, s, s, s, 0, lean);
      cx += Math.sin(-lean) * 0.8 * s * 0.5; cy += 0.78 * s;
    }
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2;
      B.box(0.35 * s, 0.06, 1.8 * s, 0x4f8a3a, cx + Math.sin(a) * 0.8 * s, cy + 0.1, z + Math.cos(a) * 0.8 * s, a, 0.45, 0);
    }
  }

  // ---------- kasabalar ----------
  function towns(B, glows, portals, extras) {
    for (const tid in D.towns) {
      const tw = T.TOWNS[tid], L = D.towns[tid], y0 = tw.h;
      const desert = L.style === 'desert';
      // surlar
      const R = 20;
      for (let a = 0; a < Math.PI * 2; a += desert ? 0.12 : 0.055) {
        const ca = Math.cos(a);
        if (Math.abs(ca) > 0.965) continue;
        const x = tw.x + Math.cos(a) * R, z = tw.z + Math.sin(a) * R;
        const gy = T.height(x, z);
        if (desert) {
          B.box(2.6, 3.4, 1.3, 0xcdb28a, x, gy + 1.5, z, -a + Math.PI / 2);
          if (Math.round(a * 100) % 2 === 0) B.box(0.8, 0.6, 1.3, 0xc2a57c, x, gy + 3.5, z, -a + Math.PI / 2);
        } else {
          const hh = rr(2.8, 3.4);
          B.add(Mo.cylG(0.22, 0.26, hh, 6), 0x7a5a3a, x, gy + hh / 2 - 0.2, z, a);
          B.add(Mo.coneG(0.24, 0.5, 6), 0x6a4c30, x, gy + hh + 0.02, z, a);
        }
      }
      if (!desert) {
        for (let a = 0; a < Math.PI * 2; a += 0.28) {
          if (Math.abs(Math.cos(a + 0.14)) > 0.95) continue;
          const x = tw.x + Math.cos(a + 0.14) * R, z = tw.z + Math.sin(a + 0.14) * R;
          B.box(0.2, 0.25, 5.8, 0x6a4c30, x, T.height(x, z) + 1.9, z, -(a + 0.14));
        }
      }
      // kapı kuleleri
      for (const side of [-1, 1]) {
        for (const off of [-1, 1]) {
          const x = tw.x + side * R * 0.99, z = tw.z + off * 6.2;
          const gy = T.height(x, z);
          if (desert) {
            B.add(Mo.cylG(1.6, 1.8, 6, 8), 0xc9ab80, x, gy + 3, z, 0);
            B.add(Mo.cylG(1.9, 1.9, 0.6, 8), 0xbf9f72, x, gy + 6.2, z, 0);
            B.add(Mo.coneG(1.5, 1.6, 8), 0x3f8f8a, x, gy + 7.3, z, 0);
          } else {
            B.box(2.2, 5.5, 2.2, 0x7a5a3a, x, gy + 2.75, z);
            B.box(2.8, 0.4, 2.8, 0x5e4430, x, gy + 5.6, z);
            B.add(Mo.coneG(2.2, 1.8, 4), 0x9c3b2c, x, gy + 6.7, z, Math.PI / 4);
          }
          glows.push({ x: x - side * 1.3, y: gy + 3.2, z, c: 0xffc46b, s: 1.4 });
        }
        // kapı kemeri/üst kiriş
        const x = tw.x + side * R * 0.99, gy = T.height(x, tw.z);
        B.box(1.2, 0.7, 12, desert ? 0xbf9f72 : 0x5e4430, x, gy + 5.2, tw.z);
        // sancaklar
        for (const off of [-1, 1]) {
          const bz = tw.z + off * 6.2, bx = x - side * 0.2;
          B.box(0.1, 3, 0.1, 0x3a2a20, bx, gy + 8.5, bz);
          B.box(0.06, 1.8, 1.1, desert ? 0x2f6f73 : 0xa8322a, bx, gy + 8.9, bz + 0.6);
          B.box(0.07, 0.3, 1.12, 0xe0b44a, bx, gy + 8.1, bz + 0.6);
        }
      }
      for (const b of L.buildings) building(B, tw.x + b.dx, tw.z + b.dz, b, desert, glows, extras);
      // NPC tezgâhları / kapı
      for (const n of L.npcs) {
        const x = tw.x + n.dx, z = tw.z + n.dz, gy = T.height(x, z);
        if (n.role === 'kapi') {
          const face = Math.atan2(tw.x - x, tw.z - z);
          const cx = Math.cos(face), sz = -Math.sin(face);
          const stone = desert ? 0xc2a47a : 0x8f877c;
          for (const s2 of [-1, 1]) {
            B.box(0.7, 4.2, 0.7, stone, x + cx * s2 * 1.5, gy + 2.1, z + sz * s2 * 1.5, face);
            B.box(0.95, 0.4, 0.95, Mo.shade(stone, 0.85), x + cx * s2 * 1.5, gy + 0.2, z + sz * s2 * 1.5, face);
          }
          B.box(4.1, 0.6, 0.9, Mo.shade(stone, 0.9), x, gy + 4.4, z, face);
          B.box(1.2, 0.35, 0.95, 0xc8a45a, x, gy + 4.85, z, face);
          portals.push({ x, y: gy + 2.1, z, face });
        } else if (n.role === 'hayvan') {
          // saman balyası, yemlik, şahin tüneği
          B.box(1.1, 0.7, 0.8, 0xd9b964, x + 1.7, gy + 0.35, z + 0.4, 0.2);
          B.box(1.0, 0.6, 0.75, 0xcfae5a, x + 1.5, gy + 1.0, z + 0.5, -0.25);
          B.box(1.4, 0.35, 0.5, 0x6b4a2e, x - 1.4, gy + 0.18, z + 0.9);
          B.box(1.2, 0.1, 0.36, 0x9a7a4a, x - 1.4, gy + 0.36, z + 0.9);
          B.box(0.12, 2.0, 0.12, 0x5e4430, x - 0.9, gy + 1.0, z - 1.1);
          B.box(0.9, 0.08, 0.08, 0x5e4430, x - 0.9, gy + 1.95, z - 1.1);
        } else if (n.role === 'tuccar') {
          B.box(2.4, 0.9, 0.9, 0x6b4a2e, x + 0.2, gy + 0.45, z + 1.4);
          B.box(2.6, 0.08, 1.0, 0x8a6440, x + 0.2, gy + 0.94, z + 1.4);
          for (let k = 0; k < 4; k++) B.box(0.3, 0.3, 0.3, [0xd0453a, 0x3f7fd6, 0xd0453a, 0x3f7fd6][k], x - 0.6 + k * 0.55, gy + 1.13, z + 1.4);
        }
      }
    }
    // köprü
    const Bq = T.BRIDGE;
    for (let x = Bq.x - Bq.halfLen - 1; x <= Bq.x + Bq.halfLen + 1; x += 0.6) {
      const z = T.roadZ(x);
      B.box(0.56, 0.18, Bq.halfWidth * 2 + 0.3, ((x * 10) | 0) % 2 ? 0x8a6440 : 0x7a5636, x, Bq.deck - 0.09, z, Math.atan(T.roadZ(x + 0.3) - T.roadZ(x - 0.3)) * -0.9);
    }
    for (let x = Bq.x - Bq.halfLen; x <= Bq.x + Bq.halfLen; x += 3.25) {
      const z = T.roadZ(x);
      for (const s of [-1, 1]) {
        B.box(0.3, 1.2, 0.3, 0x5e4430, x, Bq.deck + 0.5, z + s * (Bq.halfWidth + 0.1));
        B.box(0.45, 4, 0.45, 0x4e3a2a, x, Bq.deck - 2.3, z + s * (Bq.halfWidth - 0.3));
      }
    }
    for (const s of [-1, 1]) {
      for (let x = Bq.x - Bq.halfLen; x < Bq.x + Bq.halfLen; x += 1) {
        const z = T.roadZ(x + 0.5);
        B.box(1.05, 0.12, 0.14, 0x6b4a2e, x + 0.5, Bq.deck + 1.05, z + s * (Bq.halfWidth + 0.1));
      }
    }
    // yol taşları
    for (let x = -100; x <= 100; x += 25) {
      if (Math.abs(x - Bq.x) < 20) continue;
      const z = T.roadZ(x) + 3.4;
      B.box(0.5, 1.0, 0.35, x < Bq.x ? 0x9a9184 : 0xbfa27a, x, T.height(x, z) + 0.4, z, 0.1);
    }
  }

  function building(B, x, z, b, desert, glows, extras) {
    const s = b.s || 1, gy = T.height(x, z), r = b.r || 0;
    switch (b.k) {
      case 'yurt': {
        B.add(Mo.cylG(2.6 * s, 2.6 * s, 2.1 * s, 12), 0xe9e0cc, x, gy + 1.05 * s, z, 0);
        B.add(Mo.cylG(2.65 * s, 2.65 * s, 0.25 * s, 12), 0xa8322a, x, gy + 1.7 * s, z, 0);
        B.add(Mo.coneG(2.95 * s, 1.5 * s, 12), 0xd9cdb2, x, gy + 2.85 * s, z, 0);
        B.add(Mo.cylG(0.4 * s, 0.5 * s, 0.3 * s, 8), 0x7a5a3a, x, gy + 3.6 * s, z, 0);
        const dz = z > T.roadZ(x) ? -1 : 1;
        B.box(1.0 * s, 1.5 * s, 0.2, 0x8a3b2a, x, gy + 0.75 * s, z + dz * 2.55 * s);
        B.box(1.2 * s, 0.12, 0.25, 0xe0b44a, x, gy + 1.55 * s, z + dz * 2.55 * s);
        break;
      }
      case 'house': {
        B.box(4.6 * s, 2.8 * s, 3.6 * s, 0xcdb896, x, gy + 1.4 * s, z, r);
        B.box(4.8 * s, 0.25, 3.8 * s, 0x5e4430, x, gy + 2.85 * s, z, r);
        for (const cx of [-1, 1]) for (const cz of [-1, 1]) B.box(0.25, 2.8 * s, 0.25, 0x5e4430, x + cx * 2.3 * s * Math.cos(r) + cz * 1.8 * s * Math.sin(r), gy + 1.4 * s, z - cx * 2.3 * s * Math.sin(r) + cz * 1.8 * s * Math.cos(r), r);
        B.add(Mo.coneG(3.9 * s, 2.0 * s, 4), 0x9c3b2c, x, gy + 3.9 * s, z, Math.PI / 4 + r, 1, 1, 0.8);
        const dz = z > T.roadZ(x) ? -1 : 1;
        B.box(0.9 * s, 1.6 * s, 0.1, 0x4a3426, x, gy + 0.8 * s, z + dz * 1.82 * s, r);
        B.box(0.7, 0.6, 0.1, 0x2a2420, x + 1.3 * s, gy + 1.7 * s, z + dz * 1.82 * s, r);
        break;
      }
      case 'tower': {
        B.box(3, 7.5, 3, 0x7a5a3a, x, gy + 3.75, z);
        B.box(3.6, 0.4, 3.6, 0x5e4430, x, gy + 7.6, z);
        for (const c of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.25, 1.5, 0.25, 0x5e4430, x + c[0] * 1.6, gy + 8.5, z + c[1] * 1.6);
        B.add(Mo.coneG(2.8, 2.2, 4), 0x9c3b2c, x, gy + 10.3, z, Math.PI / 4);
        glows.push({ x, y: gy + 8.4, z, c: 0xffc46b, s: 1.8 });
        break;
      }
      case 'flat': {
        const c = rand() < 0.5 ? 0xd9c29a : 0xe2cfa9;
        B.box(5 * s, 3.2 * s, 4.2 * s, c, x, gy + 1.6 * s, z);
        B.box(5.3 * s, 0.35, 4.5 * s, Mo.shade(c, 0.9), x, gy + 3.3 * s, z);
        B.box(2.4 * s, 1.8 * s, 2.2 * s, c, x - 0.8 * s, gy + 4.2 * s, z - 0.5 * s);
        const dz = z > T.roadZ(x) ? -1 : 1;
        B.box(1.0 * s, 1.8 * s, 0.1, 0x5a3e2a, x + 0.6, gy + 0.9 * s, z + dz * 2.12 * s);
        B.box(2.2 * s, 0.08, 1.2, rand() < 0.5 ? 0x2f6f73 : 0xa8322a, x + 0.6, gy + 2.2 * s, z + dz * 2.6 * s, 0, dz * 0.3);
        B.box(0.6, 0.6, 0.1, 0x2a2420, x - 1.4 * s, gy + 2.2 * s, z + dz * 2.12 * s);
        break;
      }
      case 'dome': {
        B.box(5 * s, 3.4 * s, 5 * s, 0xe4d3b0, x, gy + 1.7 * s, z);
        B.add(Mo.cylG(2.3 * s, 2.4 * s, 0.6 * s, 12), 0xd2bd96, x, gy + 3.7 * s, z, 0);
        B.add(Mo.flat('dome', () => new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)), 0x3f8f8a, x, gy + 4.0 * s, z, 0, 2.2 * s, 2.1 * s, 2.2 * s);
        B.add(Mo.coneG(0.15, 0.9, 4), 0xe0b44a, x, gy + 6.5 * s, z, 0);
        break;
      }
      case 'minaret': {
        B.add(Mo.cylG(1.0, 1.2, 10, 8), 0xe2cfa9, x, gy + 5, z, 0);
        B.add(Mo.cylG(1.5, 1.5, 0.5, 8), 0xc9ab80, x, gy + 7.6, z, 0);
        B.add(Mo.cylG(0.8, 0.9, 2, 8), 0xe2cfa9, x, gy + 11, z, 0);
        B.add(Mo.coneG(1.0, 2.2, 8), 0x3f8f8a, x, gy + 13.1, z, 0);
        glows.push({ x, y: gy + 7.9, z, c: 0xffc46b, s: 2 });
        break;
      }
      case 'pen': {
        const w = 6.5, d = 5;
        for (let k = 0; k <= 6; k++) {
          const px = x - w / 2 + k * w / 6;
          B.box(0.18, 1.2, 0.18, 0x6b4a2e, px, gy + 0.6, z + d / 2);
          if (k === 0 || k === 6) for (let q = 1; q < 4; q++) B.box(0.18, 1.2, 0.18, 0x6b4a2e, px, gy + 0.6, z + d / 2 - q * d / 4);
        }
        B.box(w, 0.12, 0.12, 0x7a5636, x, gy + 0.9, z + d / 2);
        B.box(0.12, 0.12, d, 0x7a5636, x - w / 2, gy + 0.9, z);
        B.box(0.12, 0.12, d, 0x7a5636, x + w / 2, gy + 0.9, z);
        B.box(1.1, 0.8, 0.8, 0xd9b964, x + 2.3, gy + 0.4, z - 1.6, 0.3);
        B.box(1.1, 0.8, 0.8, 0xcfae5a, x + 2.0, gy + 1.2, z - 1.4, -0.2);
        B.box(1.8, 0.4, 0.5, 0x6b4a2e, x - 1.8, gy + 0.3, z - 1.9);
        extras.camels.push({ x: x + 0.6, z: z + 0.3, rot: rand() * 6 });
        break;
      }
      case 'forge': {
        B.box(2.2, 1.2, 1.6, 0x6e6660, x, gy + 0.6, z);
        B.box(0.9, 3.8, 0.9, 0x7c746b, x + 0.6, gy + 1.9, z - 0.3);
        B.box(1.4, 0.2, 1.0, 0x1a1512, x - 0.2, gy + 1.25, z + 0.1);
        B.box(0.9, 0.45, 0.4, 0x3b3d42, x - 2.2, gy + 0.55, z + 1.2);
        B.box(0.5, 0.35, 0.3, 0x5a3e2a, x - 2.2, gy + 0.18, z + 1.2);
        glows.push({ x: x - 0.2, y: gy + 1.45, z: z + 0.1, c: 0xff7a2a, s: 2.2, flicker: true });
        break;
      }
      case 'stall': {
        for (const c of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.14, 2.4, 0.14, 0x6b4a2e, x + c[0] * 1.2, gy + 1.2, z + c[1] * 0.8);
        B.box(2.8, 0.08, 2.0, b.c, x, gy + 2.45, z, 0, 0.18);
        B.box(2.4, 0.8, 0.8, 0x7a5636, x, gy + 0.4, z + 0.4);
        for (let k = 0; k < 3; k++) B.box(0.5, 0.35, 0.5, [0xd9b964, 0xa8322a, 0x3f7fd6, 0x7da64a][(k + (b.c & 3)) % 4], x - 0.7 + k * 0.7, gy + 0.98, z + 0.4);
        break;
      }
      case 'well': {
        B.add(Mo.cylG(1.0, 1.1, 0.9, 10), 0x8f877c, x, gy + 0.45, z, 0);
        B.add(Mo.cylG(0.8, 0.8, 0.1, 10), 0x2e5f7a, x, gy + 0.8, z, 0);
        for (const s2 of [-1, 1]) B.box(0.16, 2.0, 0.16, 0x6b4a2e, x + s2 * 0.95, gy + 1.4, z);
        B.add(Mo.coneG(1.5, 0.8, 4), desert ? 0x3f8f8a : 0x9c3b2c, x, gy + 2.7, z, Math.PI / 4);
        break;
      }
      case 'palm': palm(B, x, gy, z, s); break;
    }
  }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
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
    const out = { glowTex: glowTexture(), glows: [], portals: [], camels: [], signs: [] };
    const skyM = sky();
    scene.add(skyM);
    out.sky = skyM;
    const terr = terrainMesh();
    scene.add(terr);
    out.terrain = terr;
    scene.add(water());
    const B = new Batch(), BG = new Batch();
    const glows = [], portals = [], extras = { camels: [] };
    out.counts = scatter(B, quality, BG);
    towns(B, glows, portals, extras);
    const statMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = B.build(statMat);
    mesh.children.forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    scene.add(mesh);
    out.static = mesh;
    const grass = BG.build(statMat);
    grass.children.forEach(m => { m.receiveShadow = true; });
    scene.add(grass);
    // parıltılar (fener, ocak)
    for (const g of glows) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: out.glowTex, color: g.c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(g.x, g.y, g.z); sp.scale.setScalar(g.s);
      scene.add(sp);
      const core = new THREE.Mesh(Mo.boxG(0.22, 0.3, 0.22), Mo.mat(g.c, true));
      core.position.set(g.x, g.y, g.z);
      scene.add(core);
      out.glows.push({ sp, base: g.s, flicker: g.flicker, ph: rand() * 6 });
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
      const post = new THREE.Mesh(Mo.boxG(0.16, 2.2, 0.16), Mo.mat(0x5e4430)); post.position.set(s.x, y + 1.1, s.z); post.castShadow = true; scene.add(post);
      const board = new THREE.Mesh(Mo.boxG(1.8, 0.45, 0.08), Mo.mat(0x8a6440)); board.position.set(s.x, y + 1.9, s.z); board.castShadow = true; scene.add(board);
      s.y = y + 2.6;
    }
    return out;
  }

  return { build, Batch, glowTexture };
})();
