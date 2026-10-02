/* ============================================================
   KERVAN YOLU — models.js
   Düşük poligonlu karakter ve canavar modelleri. Hepsi kodla
   üretiliyor (harici dosya yok). Her model animasyon için
   adlandırılmış parçalar döndürür.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Models = (function () {
  const matCache = new Map(), geoCache = new Map();

  function mat(color, emissive) {
    const key = color + '|' + (emissive || 0);
    let m = matCache.get(key);
    if (!m) {
      m = emissive ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color });
      matCache.set(key, m);
    }
    return m;
  }
  // düz gölgeli görünüm için indekssiz geometri
  function flat(key, make) {
    let g = geoCache.get(key);
    if (!g) { g = make(); if (g.index) g = g.toNonIndexed(); g.computeVertexNormals(); geoCache.set(key, g); }
    return g;
  }
  const boxG = (w, h, d) => flat('b' + w + '|' + h + '|' + d, () => new THREE.BoxGeometry(w, h, d));
  const coneG = (r, h, s) => flat('c' + r + '|' + h + '|' + s, () => new THREE.ConeGeometry(r, h, s));
  const cylG = (a, b, h, s) => flat('y' + a + '|' + b + '|' + h + '|' + s, () => new THREE.CylinderGeometry(a, b, h, s));
  const icoG = (r, d) => flat('i' + r + '|' + (d || 0), () => new THREE.IcosahedronGeometry(r, d || 0));

  function part(geo, color, x, y, z, parent, opts) {
    const m = new THREE.Mesh(geo, (opts && opts.material) || mat(color, opts && opts.glow));
    m.position.set(x, y, z);
    m.castShadow = !(opts && opts.noShadow);
    if (opts && opts.rx) m.rotation.x = opts.rx;
    if (opts && opts.ry) m.rotation.y = opts.ry;
    if (opts && opts.rz) m.rotation.z = opts.rz;
    parent.add(m);
    return m;
  }
  const box = (w, h, d, c, x, y, z, p, o) => part(boxG(w, h, d), c, x, y, z, p, o);
  function shade(hex, f) {
    const c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
    return c.getHex();
  }
  function group(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; }

  // ---------------- insan ----------------
  function human(look, opts) {
    opts = opts || {};
    const obj = new THREE.Group(), root = group(obj);
    const hips = group(root, 0, 0.92, 0);
    const pants = look.pants || 0x3a2e2a, boot = 0x2a211c;
    const leg = (sx) => {
      const pv = group(hips, sx * 0.14, 0, 0);
      box(0.2, 0.5, 0.22, pants, 0, -0.25, 0, pv);
      box(0.18, 0.42, 0.2, shade(pants, 0.85), 0, -0.66, 0, pv);
      box(0.21, 0.12, 0.3, boot, 0, -0.86, 0.04, pv);
      return pv;
    };
    const legL = leg(-1), legR = leg(1);
    const torso = group(hips, 0, 0.04, 0);
    const clothParts = [];
    clothParts.push(box(0.56, 0.6, 0.32, look.cloth, 0, 0.34, 0, torso));
    const trimParts = [];
    trimParts.push(box(0.6, 0.1, 0.36, look.trim, 0, 0.05, 0, torso));
    clothParts.push(box(0.62, 0.36, 0.36, look.cloth, 0, -0.14, 0, torso));
    trimParts.push(box(0.6, 0.07, 0.35, look.trim, 0, 0.62, 0, torso));
    const head = group(torso, 0, 0.7, 0);
    box(0.32, 0.34, 0.32, look.skin, 0, 0.19, 0, head);
    box(0.06, 0.05, 0.02, 0x1d1712, -0.075, 0.22, 0.165, head, { noShadow: true });
    box(0.06, 0.05, 0.02, 0x1d1712, 0.075, 0.22, 0.165, head, { noShadow: true });
    const hair = look.hair || 0x2a1d16;
    box(0.34, 0.12, 0.34, hair, 0, 0.36, -0.01, head);
    box(0.34, 0.26, 0.08, hair, 0, 0.24, -0.15, head);
    if (look.beard) box(0.26, 0.12, 0.06, hair, 0, 0.06, 0.16, head);
    switch (look.hat) {
      case 'cone': part(coneG(0.46, 0.26, 8), 0xc8a868, 0, 0.5, 0, head); break;
      case 'band': box(0.35, 0.07, 0.35, look.trim, 0, 0.32, 0, head); break;
      case 'wrap':
        part(cylG(0.21, 0.19, 0.2, 7), look.trim, 0, 0.42, 0, head);
        part(icoG(0.1), look.trim, 0, 0.55, 0.04, head);
        break;
      case 'hood':
        box(0.38, 0.4, 0.38, look.cloth, 0, 0.23, -0.03, head);
        box(0.3, 0.14, 0.04, look.trim, 0, 0.1, 0.17, head);
        break;
      case 'helm':
        box(0.36, 0.18, 0.36, 0x7c858f, 0, 0.36, 0, head);
        part(coneG(0.06, 0.2, 4), look.trim, 0, 0.54, 0, head);
        break;
    }
    const arm = (sx) => {
      const pv = group(torso, sx * 0.36, 0.58, 0);
      clothParts.push(box(0.17, 0.34, 0.19, look.cloth, 0, -0.15, 0, pv));
      box(0.15, 0.3, 0.17, shade(look.cloth, 0.85), 0, -0.44, 0, pv);
      box(0.13, 0.13, 0.15, look.skin, 0, -0.64, 0, pv);
      return pv;
    };
    const armL = arm(-1), armR = arm(1);
    const hand = group(armR, 0, -0.64, 0.02);
    let weapon = null, blade = null;
    if (look.weapon) {
      weapon = group(hand, 0, 0, 0);
      weapon.rotation.x = 0.5;
      const w = look.weapon;
      if (w === 'sword' || w === 'blade') {
        const steel = look.bladeColor || 0xc9ced6;
        box(0.05, 0.05, 0.2, 0x3b2a20, 0, 0, -0.02, weapon);
        box(0.28, 0.05, 0.07, look.guard || 0xb8923e, 0, 0, 0.1, weapon);
        blade = box(0.045, w === 'blade' ? 0.13 : 0.1, look.bladeLen || 0.85, steel, 0, 0, 0.14 + (look.bladeLen || 0.85) / 2, weapon);
      } else if (w === 'hammer') {
        box(0.05, 0.05, 0.6, 0x5a3e28, 0, 0, 0.2, weapon);
        box(0.16, 0.16, 0.26, 0x55585c, 0, 0, 0.5, weapon, { ry: Math.PI / 2 });
      } else if (w === 'staff') {
        weapon.rotation.x = 0.2;
        box(0.06, 1.8, 0.06, 0x6b4a2e, 0, 0.4, 0, weapon);
        part(icoG(0.09), 0xe7c46a, 0, 1.32, 0, weapon);
      }
    }
    if (opts.scale) root.scale.setScalar(opts.scale);
    return { obj, root, hips, torso, head, armL, armR, legL, legR, hand, weapon, blade, clothParts, trimParts, kind: 'human', height: 1.85 * (opts.scale || 1) };
  }

  // ---------------- dört ayaklı ----------------
  function quad(L, size, extra) {
    extra = extra || {};
    const obj = new THREE.Group(), root = group(obj);
    root.scale.setScalar(size);
    const bodyY = L.leg + L.h / 2;
    const body = group(root, 0, bodyY, 0);
    box(L.w, L.h, L.len, L.c1, 0, 0, 0, body);
    box(L.w * 0.82, L.h * 0.3, L.len * 0.78, L.c2, 0, -L.h * 0.38, 0, body);
    if (L.mane) box(L.w * 0.7, L.h * 0.4, L.len * 0.45, L.mane, 0, L.h * 0.45, L.len * 0.2, body);
    if (L.spikes) for (let k = 0; k < 5; k++) part(coneG(0.06, 0.18, 4), L.spikes, 0, L.h * 0.55, L.len * (0.35 - k * 0.17), body);
    let neck = null;
    const headParent = (() => {
      if (!L.neck) return body;
      neck = group(body, 0, L.h * 0.2, L.len * 0.42);
      neck.rotation.x = 0.55;
      box(L.w * 0.42, L.neck, L.w * 0.42, L.c1, 0, L.neck / 2, 0, neck);
      return group(neck, 0, L.neck, 0);
    })();
    const head = group(headParent, 0, L.neck ? 0 : L.h * 0.22, L.neck ? 0 : L.len / 2 + L.head * 0.1);
    if (L.neck) head.rotation.x = -0.55;
    const hs = L.head;
    box(hs * 0.9, hs * 0.8, hs, L.c1, 0, 0, hs * 0.35, head);
    box(hs * 0.55, hs * 0.45, hs * 0.55, L.c2, 0, -hs * 0.12, hs * 0.95, head);
    box(hs * 0.2, hs * 0.14, hs * 0.08, 0x1a1512, 0, -hs * 0.02, hs * 1.22, head, { noShadow: true });
    const eyeC = L.glowEyes || 0x14100c;
    box(hs * 0.13, hs * 0.12, hs * 0.05, eyeC, -hs * 0.26, hs * 0.14, hs * 0.82, head, { noShadow: true, glow: !!L.glowEyes });
    box(hs * 0.13, hs * 0.12, hs * 0.05, eyeC, hs * 0.26, hs * 0.14, hs * 0.82, head, { noShadow: true, glow: !!L.glowEyes });
    const es = L.earScale || 1;
    if (L.ears === 'pointy') {
      const ear = coneG(hs * 0.16 * Math.sqrt(es), hs * 0.45 * es, 4);
      part(ear, L.c1, -hs * 0.28, hs * (0.33 + 0.22 * es), hs * 0.2, head, { rz: es > 1.5 ? 0.35 : 0 });
      part(ear, L.c1, hs * 0.28, hs * (0.33 + 0.22 * es), hs * 0.2, head, { rz: es > 1.5 ? -0.35 : 0 });
      if (es > 1.5) {
        const inner = coneG(hs * 0.09 * Math.sqrt(es), hs * 0.34 * es, 4);
        part(inner, L.c2, -hs * 0.29, hs * (0.33 + 0.2 * es), hs * 0.25, head, { rz: 0.35, noShadow: true });
        part(inner, L.c2, hs * 0.29, hs * (0.33 + 0.2 * es), hs * 0.25, head, { rz: -0.35, noShadow: true });
      }
    } else if (L.ears === 'long') {
      for (const sx of [-1, 1]) {
        box(hs * 0.2, hs * 0.95 * es, hs * 0.08, L.c1, sx * hs * 0.2, hs * (0.4 + 0.45 * es), 0, head, { rz: -sx * 0.18 });
        box(hs * 0.1, hs * 0.75 * es, hs * 0.04, L.c2, sx * hs * 0.21, hs * (0.4 + 0.45 * es), hs * 0.05, head, { rz: -sx * 0.18, noShadow: true });
      }
    } else if (L.ears === 'round') {
      box(hs * 0.2, hs * 0.22, hs * 0.08, L.c2, -hs * 0.36, hs * 0.42, hs * 0.1, head);
      box(hs * 0.2, hs * 0.22, hs * 0.08, L.c2, hs * 0.36, hs * 0.42, hs * 0.1, head);
    }
    if (L.tusks) {
      box(hs * 0.08, hs * 0.3, hs * 0.08, 0xefe7d4, -hs * 0.24, 0, hs * 1.08, head, { rx: -0.5 });
      box(hs * 0.08, hs * 0.3, hs * 0.08, 0xefe7d4, hs * 0.24, 0, hs * 1.08, head, { rx: -0.5 });
    }
    const legs = [];
    const lt = Math.max(0.1, L.w * 0.28);
    for (const sz of [1, -1]) for (const sx of [-1, 1]) {
      const pv = group(body, sx * L.w * 0.32, -L.h * 0.3, sz * L.len * 0.36);
      box(lt, L.leg + L.h * 0.2, lt, L.c1, 0, -(L.leg + L.h * 0.2) / 2, 0, pv);
      box(lt * 1.1, lt * 0.5, lt * 1.3, L.c2, 0, -(L.leg + L.h * 0.2) + lt * 0.2, lt * 0.1, pv);
      legs.push(pv);
    }
    let tail = null;
    if (L.tail) {
      tail = group(body, 0, L.h * 0.2, -L.len / 2);
      tail.rotation.x = L.tailRot != null ? L.tailRot : L.tailBushy ? 0.7 : 0.3;
      const tw = L.tailBushy ? 0.18 : 0.08;
      box(tw, tw, L.tail, L.c1, 0, 0, -L.tail / 2, tail);
      if (L.tailBushy) box(tw * 1.1, tw * 1.1, L.tail * 0.3, L.c2, 0, 0, -L.tail * 0.9, tail);
    }
    let packs = null;
    if (L.hump) {
      box(L.w * 0.6, L.h * 0.5, L.len * 0.35, L.c1, 0, L.h * 0.6, -L.len * 0.05, body);
      if (extra.packs) {
        packs = [];
        const saddle = box(L.w * 1.05, 0.08, L.len * 0.55, 0x8a2f2a, 0, L.h * 0.52, 0, body);
        packs.saddle = saddle;
        const spots = [[-1, 0.2], [1, 0.2], [-1, -0.25], [1, -0.25], [0, 0.2], [0, -0.3]];
        for (const [sx, sz] of spots) {
          const pk = sx === 0
            ? box(L.w * 0.5, 0.3, L.len * 0.28, 0xb3372e, 0, L.h * 1.05, sz * L.len, body)
            : box(0.3, 0.46, L.len * 0.3, 0xb3372e, sx * (L.w / 2 + 0.14), L.h * 0.15, sz * L.len, body);
          pk.visible = false;
          packs.push(pk);
        }
      }
    }
    return { obj, root, body, head, neck, legs, tail, packs, kind: 'quad', height: (bodyY + L.h) * size, size };
  }

  // ---------------- akrep ----------------
  function scorpion(L, size) {
    const obj = new THREE.Group(), root = group(obj);
    root.scale.setScalar(size);
    const body = group(root, 0, 0.38, 0);
    box(0.62, 0.26, 0.5, L.c1, 0, 0, 0.3, body);
    box(0.78, 0.3, 0.8, L.c1, 0, 0.02, -0.28, body);
    box(0.6, 0.12, 0.6, L.c2, 0, -0.14, -0.2, body);
    box(0.08, 0.06, 0.04, 0x0e0a08, -0.12, 0.12, 0.56, body, { noShadow: true });
    box(0.08, 0.06, 0.04, 0x0e0a08, 0.12, 0.12, 0.56, body, { noShadow: true });
    const claws = [];
    for (const sx of [-1, 1]) {
      const pv = group(body, sx * 0.3, 0, 0.5);
      pv.rotation.y = sx * -0.5;
      box(0.14, 0.12, 0.5, L.c1, 0, 0, 0.25, pv);
      const pin = group(pv, 0, 0, 0.5);
      box(0.24, 0.16, 0.3, L.c2, 0, 0, 0.12, pin);
      box(0.07, 0.08, 0.26, L.c2, sx * 0.08, 0, 0.36, pin, { ry: sx * 0.3 });
      box(0.07, 0.08, 0.22, L.c2, -sx * 0.08, 0, 0.34, pin, { ry: -sx * 0.3 });
      claws.push(pv);
    }
    const legs = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
      const pv = group(body, sx * 0.34, -0.02, 0.2 - k * 0.2);
      pv.rotation.z = sx * 0.9;
      box(0.06, 0.4, 0.06, L.c2, 0, -0.2, 0, pv);
      legs.push(pv);
    }
    const tail = group(body, 0, 0.1, -0.66);
    let seg = tail;
    const segs = [];
    for (let k = 0; k < 5; k++) {
      const s = group(seg, 0, 0, k === 0 ? 0 : -0.3);
      s.rotation.x = k === 0 ? 0.4 : 0.55;
      box(0.22 - k * 0.02, 0.2 - k * 0.015, 0.32, k % 2 ? L.c1 : shade(L.c1, 0.9), 0, 0, -0.15, s);
      segs.push(s); seg = s;
    }
    const sting = group(seg, 0, 0, -0.32);
    sting.rotation.x = 0.9;
    box(0.2, 0.2, 0.2, L.c2, 0, 0, -0.08, sting);
    part(coneG(0.07, 0.28, 4), 0x2a1a10, 0, 0, -0.26, sting, { rx: -Math.PI / 2 });
    return { obj, root, body, claws, legs, tail, segs, kind: 'scorpion', height: 1.4 * size, size };
  }

  // ---------------- taş dev ----------------
  function golem(L, size) {
    const obj = new THREE.Group(), root = group(obj);
    root.scale.setScalar(size * 0.75);
    const hips = group(root, 0, 1.05, 0);
    const leg = (sx) => {
      const pv = group(hips, sx * 0.42, 0, 0);
      box(0.5, 0.6, 0.55, L.c2, 0, -0.3, 0, pv);
      box(0.6, 0.5, 0.7, L.c1, 0, -0.8, 0.05, pv);
      return pv;
    };
    const legL = leg(-1), legR = leg(1);
    const torso = group(hips, 0, 0.1, 0);
    box(1.5, 1.1, 1.0, L.c1, 0, 0.6, 0, torso);
    box(1.1, 0.5, 0.8, L.c2, 0, 0.05, 0, torso);
    box(0.5, 0.12, 0.05, L.glow, -0.2, 0.7, 0.51, torso, { glow: true, noShadow: true });
    box(0.12, 0.5, 0.05, L.glow, 0.15, 0.55, 0.51, torso, { glow: true, noShadow: true });
    box(0.3, 0.1, 0.05, L.glow, 0.35, 0.35, 0.51, torso, { glow: true, noShadow: true });
    const head = group(torso, 0, 1.2, 0.15);
    box(0.55, 0.45, 0.55, L.c2, 0, 0.15, 0, head);
    box(0.12, 0.07, 0.04, L.glow, -0.13, 0.18, 0.28, head, { glow: true, noShadow: true });
    box(0.12, 0.07, 0.04, L.glow, 0.13, 0.18, 0.28, head, { glow: true, noShadow: true });
    const arm = (sx) => {
      const pv = group(torso, sx * 0.95, 0.95, 0);
      box(0.6, 0.45, 0.6, L.c2, 0, 0, 0, pv);
      box(0.45, 0.8, 0.5, L.c1, 0, -0.55, 0, pv);
      box(0.62, 0.55, 0.62, L.c2, 0, -1.15, 0.05, pv);
      return pv;
    };
    const armL = arm(-1), armR = arm(1);
    return { obj, root, hips, torso, head, armL, armR, legL, legR, kind: 'golem', height: 3.1 * size * 0.75, size };
  }

  // ---------------- kuş (şahin) ----------------
  function bird(L, size) {
    const obj = new THREE.Group(), root = group(obj);
    root.scale.setScalar(size);
    const body = group(root, 0, 0, 0);
    box(0.3, 0.28, 0.52, L.c1, 0, 0, 0, body);
    box(0.24, 0.12, 0.4, L.c2, 0, -0.12, 0.03, body);
    const head = group(body, 0, 0.13, 0.28);
    box(0.22, 0.2, 0.22, L.c1, 0, 0.02, 0.03, head);
    box(0.2, 0.08, 0.16, L.c2, 0, -0.06, 0.05, head);
    part(coneG(0.045, 0.14, 4), L.beak, 0, -0.01, 0.2, head, { rx: Math.PI / 2 });
    const eyeC = L.glowEyes || 0x15100a;
    box(0.035, 0.035, 0.02, eyeC, -0.07, 0.05, 0.14, head, { noShadow: true, glow: !!L.glowEyes });
    box(0.035, 0.035, 0.02, eyeC, 0.07, 0.05, 0.14, head, { noShadow: true, glow: !!L.glowEyes });
    const wing = (sx) => {
      const pv = group(body, sx * 0.14, 0.08, 0.02);
      box(0.34, 0.04, 0.32, L.wing, sx * 0.17, 0, 0, pv);
      const tip = group(pv, sx * 0.34, 0, 0);
      box(0.3, 0.03, 0.24, L.wing, sx * 0.15, 0, -0.03, tip);
      box(0.12, 0.025, 0.2, L.tip, sx * 0.34, 0, -0.06, tip);
      return { pv, tip };
    };
    const wl = wing(-1), wr = wing(1);
    const tail = group(body, 0, 0.02, -0.26);
    box(0.24, 0.03, 0.28, L.wing, 0, 0, -0.14, tail);
    box(0.28, 0.025, 0.08, L.tip, 0, 0, -0.29, tail);
    for (const sx of [-1, 1]) box(0.04, 0.12, 0.04, L.beak, sx * 0.06, -0.2, 0.02, body);
    return { obj, root, body, head, wingL: wl.pv, wingR: wr.pv, tipL: wl.tip, tipR: wr.tip, tail, kind: 'bird', height: 0.5 * size, size };
  }

  // hayvan modeli: tür + dönüşüm formu
  function pet(species, form) {
    const def = KY.DATA.pets[species];
    const f = def.forms ? def.forms[Math.min(form || 0, def.forms.length - 1)] : def;
    const md = def.model === 'bird' ? bird(f.look, f.size) : quad(f.look, f.size);
    md.fly = def.fly || 0;
    md.final = !!(def.forms && form >= 2);
    md.glowCol = f.look.glowEyes || 0;
    return md;
  }

  function build(def) {
    const L = def.look;
    if (def.model === 'human') return human(L, { scale: def.size });
    if (def.model === 'quad') return quad(L, def.size);
    if (def.model === 'scorpion') return scorpion(L, def.size);
    if (def.model === 'golem') return golem(L, def.size);
    return quad(L, 1);
  }

  const CAMEL = { c1: 0xc79a62, c2: 0xe2c79a, len: 1.5, h: 0.72, w: 0.62, leg: 1.0, head: 0.36, ears: 'round', tail: 0.4, neck: 0.85, hump: true };
  function camel(withPacks) { return quad(CAMEL, 1, { packs: withPacks }); }

  return { mat, flat, boxG, coneG, cylG, icoG, box, part, group, shade, human, quad, scorpion, golem, bird, pet, build, camel };
})();
