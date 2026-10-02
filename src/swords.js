/* ============================================================
   KERVAN YOLU — swords.js
   Kılıç modelleri data.js'teki tariflerden kodla üretilir:
   bıçak profili (düz, eğri, tırtıklı, çatallı, eğik uçlu),
   keskin kenar pahı, el boyaması dokular, parlayan rün / altın
   işleme / kristal damar, balçak, kabza, topuz ve mücevher.
   Aynı modül çantadaki 3D önizlemeyi ve simgeleri de üretir.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Swords = (function () {
  const I = KY.DATA.items;
  const geoC = new Map(), matC = new Map(), texC = new Map(), icons = new Map();
  // kılıcın kendi ekseni (Y = bıçak yönü) → karakterin elindeki eksen (Z = ileri)
  const BASIS = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function rng(seed) { let s = (seed | 0) || 7; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; }
  function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function prof(P, t) {
    if (t <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const a = P[i - 1], b = P[i], k = (t - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * k; }
    return P[P.length - 1][1];
  }
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function once(map, key, make) { let v = map.get(key); if (!v) { v = make(); map.set(key, v); } return v; }

  // ---------------- ortak dokular ----------------
  let glowTex = null;
  function glow() {
    if (glowTex) return glowTex;
    const c = mk(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (glowTex = new THREE.CanvasTexture(c));
  }
  // metal yansımaları için küçük bir ortam haritası (her renderer'a ayrı)
  function envFor(renderer) {
    const c = mk(256, 128), g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 128);
    lg.addColorStop(0, '#d8dde4'); lg.addColorStop(0.3, '#6f8196'); lg.addColorStop(0.47, '#b9a98c');
    lg.addColorStop(0.53, '#4a3e32'); lg.addColorStop(0.75, '#1e1a16'); lg.addColorStop(1, '#0c0a08');
    g.fillStyle = lg; g.fillRect(0, 0, 256, 128);
    for (const [x, y, r, a] of [[64, 26, 22, 1], [196, 34, 16, 0.8], [128, 8, 26, 0.5], [22, 48, 10, 0.6]]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(255,255,250,${a})`); rg.addColorStop(1, 'rgba(255,255,250,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    return env;
  }

  // ---------------- bıçak dış hattı ----------------
  function outline(S, shrink) {
    const L = S.len, N = S.teeth ? 80 : 40, slant = S.slant || 0;
    const cx = t => (S.curve || 0) * t * t * L;
    const hw = t => Math.max(0.0015, prof(S.prof, t) - shrink);
    const tooth = t => {
      const T = S.teeth; if (!T || t < T[0] || t > T[1]) return 0;
      const f = ((t - T[0]) / (T[1] - T[0]) * T[2]) % 1;
      return T[3] * f;
    };
    const P = [];
    if (S.split) {
      const ts = S.split.t, g = S.split.gap + shrink, top = S.split.top || 0.92, M = 12;
      for (let i = 0; i <= N; i++) { const t = i / N; P.push([cx(t) + hw(t) + tooth(t), t * L]); }
      for (let i = 0; i <= M; i++) { const t = top - (top - ts) * i / M; P.push([cx(t) + g * (1 + 0.25 * (t - ts)), t * L]); }
      P.push([cx(ts) + g * 0.45, ts * L - 0.014], [cx(ts), ts * L - 0.022], [cx(ts) - g * 0.45, ts * L - 0.014]);
      for (let i = 0; i <= M; i++) { const t = ts + (top - ts) * i / M; P.push([cx(t) - g * (1 + 0.25 * (t - ts)), t * L]); }
      for (let i = N; i >= 0; i--) { const t = i / N; P.push([cx(t) - hw(t) - tooth(t), t * L]); }
    } else {
      for (let i = 0; i <= N; i++) { const t = i / N; P.push([cx(t) + hw(t) + tooth(t), t * L]); }
      for (let i = N; i >= 0; i--) { const t = i / N * (1 - slant); P.push([cx(t) - hw(t) - tooth(t), t * L]); }
    }
    const out = [];
    for (const p of P) { const q = out[out.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-5) out.push(p); }
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5) out.pop();
    return out;
  }
  function inlayOutline(S) {
    const L = S.len, In = S.inlay, N = 36;
    const cx = t => (S.curve || 0) * t * t * L;
    const w = t => {
      const e = Math.min(1, (t - In.from) / 0.05, (In.to - t) / 0.1);
      return Math.max(0.0008, (prof(S.prof, t) - S.edgeW) * In.frac * Math.sqrt(Math.max(0, e)));
    };
    const P = [];
    for (let i = 0; i <= N; i++) { const t = In.from + (In.to - In.from) * i / N; P.push([cx(t) + w(t), t * L]); }
    for (let i = N; i >= 0; i--) { const t = In.from + (In.to - In.from) * i / N; P.push([cx(t) - w(t), t * L]); }
    return P;
  }
  function bbox(pts, pad) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0: x0 - pad, y0: y0 - pad, dx: x1 - x0 + pad * 2, dy: y1 - y0 + pad * 2 };
  }
  function planarUV(geo, bb) {
    const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) - bb.x0) / bb.dx; uv[i * 2 + 1] = (p.getY(i) - bb.y0) / bb.dy; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const shapeOf = (pts) => new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));

  // ---------------- el boyaması dokular ----------------
  function painter(bb, W, H) {
    const c = mk(W, H), g = c.getContext('2d');
    const X = x => (x - bb.x0) / bb.dx * W, Y = y => (1 - (y - bb.y0) / bb.dy) * H;
    const path = (pts) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.closePath(); };
    return { c, g, X, Y, path, kx: (W / bb.dx) / (H / bb.dy) };
  }
  function paintBlade(id, S, pts, bb) {
    const R = rng(hashStr(id + 'b'));
    const { c, g, X, Y, path } = painter(bb, 128, 512);
    const W = 128, H = 512;
    g.fillStyle = S.grad[0][1]; g.fillRect(0, 0, W, H);
    path(pts); g.save(); g.clip();
    const lg = g.createLinearGradient(0, Y(0), 0, Y(S.len));
    S.grad.forEach(([t, col]) => lg.addColorStop(t, col));
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const cx = t => (S.curve || 0) * t * t * S.len;
    // orta sırt: bir tarafı koyu, bir tarafı açık (el boyaması ışık)
    if (!S.split) {
      g.lineCap = 'round';
      for (const [off, col, lw] of [[-0.5, 'rgba(0,0,0,.3)', 0.14], [0.5, 'rgba(255,255,255,.2)', 0.1]]) {
        g.beginPath();
        for (let i = 0; i <= 30; i++) { const t = i / 30 * 0.93; const x = X(cx(t) + off * 0.02), y = Y(t * S.len); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.strokeStyle = col; g.lineWidth = W * lw; g.stroke();
      }
    }
    // kenardan içe: önce koyu bant, sonra ince parlak kenar (el boyaması kenar vurgusu)
    path(pts); g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = W * 0.34; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = W * 0.16; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = W * 0.05; g.stroke();
    // üstten alta ışık düşüşü: uca doğru açık, balçağa doğru koyu
    const vg = g.createLinearGradient(0, Y(0), 0, Y(S.len));
    vg.addColorStop(0, 'rgba(0,0,0,.28)'); vg.addColorStop(0.35, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(255,255,255,.08)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    // çizikler
    for (let k = 0; k < 150; k++) {
      const x = R() * W, y = R() * H, l = 3 + R() * 16, a = (R() - 0.5) * 0.9 + Math.PI / 2;
      g.strokeStyle = R() < 0.55 ? `rgba(0,0,0,${0.06 + R() * 0.1})` : `rgba(255,255,255,${0.05 + R() * 0.09})`;
      g.lineWidth = 0.8 + R() * 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.3, y + Math.sin(a) * l); g.stroke();
    }
    if (S.rust) for (let k = 0; k < 70; k++) {
      const x = R() * W, y = R() * H, r = 2 + R() * 10;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${120 + R() * 40 | 0},${55 + R() * 20 | 0},20,${0.25 + R() * 0.25})`); rg.addColorStop(1, 'rgba(110,50,20,0)');
      g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (S.cracks) for (let k = 0; k < 16; k++) {
      let x = R() * W, y = R() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (R() - 0.5) * 22; y += (R() - 0.3) * 26; g.lineTo(x, y); }
      g.strokeStyle = 'rgba(20,50,62,.38)'; g.lineWidth = 1.4; g.stroke();
      g.translate(1.2, 0); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 0.8; g.stroke(); g.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (S.chips) for (let k = 0; k < 40; k++) {
      const x = R() * W, y = R() * H, r = 3 + R() * 7;
      g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x + r * 0.2, y + r); g.lineTo(x - r * 0.7, y + r * 0.2); g.closePath();
      g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.1)'; g.fill();
    }
    g.restore();
    const tex = new THREE.CanvasTexture(c);
    let emis = null;
    if (S.flame) {
      const e = painter(bb, 64, 256);
      e.g.fillStyle = '#000'; e.g.fillRect(0, 0, 64, 256);
      e.path(pts); e.g.save(); e.g.clip();
      const eg = e.g.createLinearGradient(0, e.Y(0), 0, e.Y(S.len));
      eg.addColorStop(0, 'rgb(255,190,70)'); eg.addColorStop(0.18, 'rgb(240,110,30)'); eg.addColorStop(0.4, 'rgb(90,30,10)'); eg.addColorStop(0.55, '#000');
      e.g.fillStyle = eg; e.g.fillRect(0, 0, 64, 256); e.g.restore();
      emis = new THREE.CanvasTexture(e.c);
    }
    return { tex, emis };
  }

  function glyph(g, x, y, s, R) {
    const n = 2 + (R() * 3 | 0);
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const x0 = x + (R() - 0.5) * s * 0.5, y0 = y + (R() - 0.5) * s * 0.6;
      switch (R() * 6 | 0) {
        case 0: g.moveTo(x, y - s * 0.42); g.lineTo(x + (R() - 0.5) * s * 0.3, y + s * 0.42); break;
        case 1: g.moveTo(x0 - s * 0.26, y0 - s * 0.2); g.lineTo(x0 + s * 0.26, y0 + s * 0.2); break;
        case 2: g.moveTo(x0 + s * 0.2, y0); g.arc(x0, y0, s * 0.2, 0, Math.PI * (0.8 + R())); break;
        case 3: g.moveTo(x0 - s * 0.28, y0); g.lineTo(x0 + s * 0.28, y0); break;
        case 4: g.moveTo(x0 - s * 0.1, y0 - s * 0.28); g.lineTo(x0 + s * 0.18, y0); g.lineTo(x0 - s * 0.1, y0 + s * 0.28); break;
        default: g.moveTo(x0 - s * 0.2, y0 + s * 0.25); g.lineTo(x0, y0 - s * 0.25); g.lineTo(x0 + s * 0.2, y0 + s * 0.25); break;
      }
    }
    g.stroke();
    if (R() < 0.45) { g.beginPath(); g.arc(x + (R() - 0.5) * s * 0.4, y + s * 0.4, s * 0.06, 0, 7); g.fill(); }
  }
  function paintInlay(id, S, pts, bb) {
    const In = S.inlay, R = rng(hashStr(id + 'i'));
    const W = 64, H = 512;
    const { c, g, X, Y, path, kx } = painter(bb, W, H);
    const cx = t => (S.curve || 0) * t * t * S.len;
    const mid = t => X(cx(t));
    const wpx = (prof(S.prof, (In.from + In.to) / 2) - S.edgeW) * In.frac * 2 * (W / bb.dx);
    if (In.style === 'gold' && !In.base) g.clearRect(0, 0, W, H);
    else { g.fillStyle = In.base || '#5d646c'; g.fillRect(0, 0, W, H); }
    path(pts); g.save(); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (In.style === 'fuller') {
      const lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, '#9aa2ab'); lg.addColorStop(0.35, '#4d545c'); lg.addColorStop(0.65, '#5d646c'); lg.addColorStop(1, '#b7bec6');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
    } else if (In.style === 'runes') {
      const lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, 'rgba(0,0,0,.5)'); lg.addColorStop(0.5, 'rgba(40,160,180,.25)'); lg.addColorStop(1, 'rgba(0,0,0,.5)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      const cell = Math.max(10, wpx * 1.05) / Math.max(1, kx) * 1.0;
      g.strokeStyle = '#e8ffff'; g.fillStyle = '#e8ffff'; g.shadowColor = In.color; g.shadowBlur = 10;
      g.lineWidth = Math.max(2, cell * 0.12);
      for (let y = Y(In.from * S.len) - cell * 0.9; y > Y(In.to * S.len) + cell * 0.9; y -= cell * 1.08) {
        const t = (1 - y / H) * bb.dy / S.len + bb.y0 / S.len;
        g.save(); g.translate(mid(t), y); g.scale(Math.min(1.6, kx), 1);
        glyph(g, 0, 0, cell * 0.86, R);
        g.restore();
      }
      g.shadowBlur = 0;
    } else if (In.style === 'crystal') {
      for (let k = 0; k < 90; k++) {
        const x = R() * W, y = R() * H, r = 6 + R() * 18;
        g.beginPath();
        const n = 3 + (R() * 3 | 0);
        for (let q = 0; q < n; q++) { const a = q / n * 6.28 + R() * 0.8; const px = x + Math.cos(a) * r * 0.6, py = y + Math.sin(a) * r; q ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.closePath();
        const v = R();
        g.fillStyle = v < 0.5 ? `rgba(90,20,150,${0.4 + R() * 0.4})` : v < 0.85 ? `rgba(180,80,255,${0.35 + R() * 0.4})` : `rgba(240,200,255,${0.5 + R() * 0.4})`;
        g.fill();
      }
      g.strokeStyle = 'rgba(255,230,255,.8)'; g.shadowColor = In.color; g.shadowBlur = 8; g.lineWidth = 2;
      for (let k = 0; k < 7; k++) {
        let x = W * (0.3 + R() * 0.4), y = R() * H;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (R() - 0.5) * 20; y += (R() - 0.5) * 50; g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
    } else if (In.style === 'gold') {
      g.strokeStyle = In.color; g.fillStyle = In.color;
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 2;
      const step = 26;
      g.lineWidth = 2.4;
      g.beginPath();
      for (let y = Y(In.from * S.len) - 8; y > Y(In.to * S.len) + 8; y -= 2) { const t = (1 - y / H) * bb.dy / S.len + bb.y0 / S.len; g.lineTo(mid(t), y); }
      g.stroke();
      let k = 0;
      for (let y = Y(In.from * S.len) - 20; y > Y(In.to * S.len) + 24; y -= step, k++) {
        const t = (1 - y / H) * bb.dy / S.len + bb.y0 / S.len, x = mid(t), s = Math.min(W * 0.34, wpx * 0.42);
        g.beginPath();
        if (k % 3 === 0) { g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s); g.lineTo(x - s * 0.7, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
        else if (k % 3 === 1) { g.moveTo(x - s, y + s * 0.4); g.lineTo(x, y - s * 0.4); g.lineTo(x + s, y + s * 0.4); g.stroke(); }
        else { g.arc(x - s * 0.55, y, s * 0.35, -1.6, 1.6); g.moveTo(x + s * 0.55 + s * 0.35 * Math.cos(1.6), y); g.arc(x + s * 0.55, y, s * 0.35, 1.6, 4.7); g.stroke(); }
      }
      path(pts); g.lineWidth = 3.5; g.stroke();
      g.shadowBlur = 0;
    }
    g.restore();
    if (In.style === 'runes' || In.style === 'crystal') {
      path(pts); g.strokeStyle = In.color; g.lineWidth = 3; g.shadowColor = In.color; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    }
    return new THREE.CanvasTexture(c);
  }
  function paintGrip(id, S) {
    const G = S.grip, c = mk(64, 128), g = c.getContext('2d');
    g.fillStyle = G.color; g.fillRect(0, 0, 64, 128);
    for (let y = -40; y < 170; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(64, y - 22); g.lineTo(64, y - 13); g.lineTo(0, y + 9); g.closePath();
      g.fillStyle = G.wrap; g.fill();
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y + 9); g.lineTo(64, y - 13); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + 1); g.lineTo(64, y - 21); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, G.len / 0.09);
    return t;
  }

  // ---------------- malzemeler ----------------
  const metalMat = (color, rough, metal) => once(matC, 'm' + color + '|' + rough + '|' + metal, () => new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.35 : rough, metalness: metal == null ? 0.9 : metal, envMapIntensity: 1.1 }));
  const gemMat = (color) => once(matC, 'g' + color, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.1 }));

  function bladeParts(id) {
    return once(geoC, 'blade' + id, () => {
      const S = I[id].sword, bs = S.edgeW;
      const pts = outline(S, bs), bb = bbox(pts, bs);
      const depth = 0.002, bt = S.thick / 2;
      const geo = new THREE.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bs, bevelSegments: 1, curveSegments: 1, steps: 1 });
      geo.translate(0, 0, -depth / 2);
      planarUV(geo, bb);
      geo.computeVertexNormals();
      const paint = paintBlade(id, S, pts, bb);
      const out = { geo, capZ: depth / 2 + bt, tex: paint.tex, emis: paint.emis };
      if (S.inlay) {
        const ip = inlayOutline(S), ib = bbox(ip, 0.002);
        const ig = new THREE.ShapeGeometry(shapeOf(ip), 1);
        planarUV(ig, ib);
        out.inlayGeo = ig; out.inlayTex = paintInlay(id, S, ip, ib);
      }
      return out;
    });
  }

  function guardShape(type) {
    const H = {
      bar: [[0, -0.035], [0.12, -0.035], [0.145, -0.022], [0.152, 0.0], [0.13, 0.013], [0, 0.013]],
      bardown: [[0, -0.035], [0.09, -0.03], [0.14, -0.056], [0.165, -0.046], [0.15, -0.02], [0.1, 0.006], [0, 0.013]],
      crescent: [[0, -0.035], [0.05, -0.03], [0.1, 0.0], [0.126, 0.05], [0.12, 0.078], [0.1, 0.056], [0.08, 0.016], [0.04, 0.006], [0, 0.013]],
      wings: [[0, -0.06], [0.035, -0.055], [0.06, -0.03], [0.09, -0.08], [0.12, -0.07], [0.11, -0.02], [0.2, 0.03], [0.245, 0.1], [0.17, 0.062], [0.12, 0.05], [0.09, 0.072], [0.07, 0.04], [0.04, 0.03], [0, 0.05]],
      flame: [[0, -0.07], [0.03, -0.065], [0.06, -0.04], [0.1, -0.03], [0.2, 0.01], [0.26, 0.05], [0.16, 0.035], [0.2, 0.08], [0.24, 0.12], [0.13, 0.07], [0.1, 0.1], [0.08, 0.16], [0.05, 0.1], [0.03, 0.2], [0, 0.24]],
      ornate: [[0, -0.05], [0.04, -0.05], [0.07, -0.03], [0.1, -0.075], [0.14, -0.062], [0.12, -0.02], [0.19, -0.005], [0.235, 0.02], [0.17, 0.026], [0.13, 0.03], [0.162, 0.092], [0.13, 0.086], [0.09, 0.04], [0.065, 0.05], [0.045, 0.13], [0.025, 0.06], [0, 0.05]]
    }[type];
    const full = H.concat(H.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
    return { pts: full, bottom: H[0][1] };
  }

  function buildGuard(id, S, grp) {
    const G = S.guard, M = metalMat(G.color, G.rough, G.metal);
    if (G.type === 'ring') {
      const R0 = 0.13, tube = 0.024;
      const ring = new THREE.Mesh(once(geoC, 'ring', () => new THREE.TorusGeometry(R0, tube, 6, 22)), M);
      ring.position.y = R0 + tube; grp.add(ring);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + 0.2;
        const b = new THREE.Mesh(once(geoC, 'rb', () => new THREE.BoxGeometry(0.05, 0.034, 0.07)), metalMat(0x4a4038, 0.5, 0.85));
        b.position.set(Math.cos(a) * R0, R0 + tube + Math.sin(a) * R0, 0); b.rotation.z = a; grp.add(b);
      }
      const stone = new THREE.Mesh(once(geoC, 'stone', () => { const g = new THREE.DodecahedronGeometry(0.058, 0); g.scale(1, 1.15, 0.55); return g; }), metalMat(G.stone, 0.8, 0.1));
      stone.position.y = R0 + tube; grp.add(stone);
      for (const z of [1, -1]) {
        const rune = new THREE.Mesh(once(geoC, 'runeS', () => new THREE.TorusGeometry(0.022, 0.006, 4, 12, 4.4)), gemMat(S.gem));
        rune.position.set(0, R0 + tube, z * 0.034); grp.add(rune);
      }
      const bar = new THREE.Mesh(once(geoC, 'rbar', () => new THREE.BoxGeometry(0.26, 0.03, 0.06)), M);
      bar.position.y = R0 * 2 + tube * 1.5; grp.add(bar);
      return { bottom: 0, seat: R0 * 2 + tube * 2 };
    }
    const sh = guardShape(G.type);
    const th = G.th || 0.046;
    const geo = once(geoC, 'guard' + G.type, () => {
      const g = new THREE.ExtrudeGeometry(shapeOf(sh.pts), { depth: th, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.005, bevelSegments: 1, curveSegments: 1 });
      g.translate(0, 0, -th / 2); g.computeVertexNormals(); return g;
    });
    const m = new THREE.Mesh(geo, M);
    m.position.y = -sh.bottom; grp.add(m);
    if (S.gem) {
      const gem = new THREE.Mesh(once(geoC, 'gem', () => { const g = new THREE.OctahedronGeometry(0.03, 0); g.scale(0.85, 1.15, 1.25); return g; }), gemMat(S.gem));
      gem.position.y = -sh.bottom - 0.004; grp.add(gem);
    }
    return { bottom: 0, seat: -sh.bottom };
  }

  // ---------------- tam kılıç ----------------
  function build(id, plus, opts) {
    opts = opts || {};
    plus = plus || 0;
    const it = I[id], S = it.sword;
    const grp = new THREE.Group();
    const Gp = S.grip, gl = Gp.len, r = Gp.r;
    const gripMat = once(matC, 'grip' + id, () => new THREE.MeshStandardMaterial({ map: paintGrip(id, S), roughness: 0.85, metalness: 0.05 }));
    const grip = new THREE.Mesh(once(geoC, 'grip' + gl + '|' + r, () => new THREE.CylinderGeometry(r, r * 1.08, gl, 10, 1)), gripMat);
    grp.add(grip);
    const band = metalMat(Gp.bands, 0.35, 0.9);
    for (const y of [gl / 2 - 0.008, -gl / 2 + 0.008]) {
      const b = new THREE.Mesh(once(geoC, 'band' + r, () => new THREE.CylinderGeometry(r * 1.3, r * 1.3, 0.02, 10)), band);
      b.position.y = y; grp.add(b);
    }
    // balçak
    const gGrp = new THREE.Group();
    const gd = buildGuard(id, S, gGrp);
    gGrp.position.y = gl / 2;
    grp.add(gGrp);
    const seatY = gl / 2 + gd.seat;
    // bıçak
    const B = bladeParts(id);
    const key = id + '+' + Math.min(plus, 9);
    const bladeMat = once(matC, 'bl' + id, () => new THREE.MeshStandardMaterial({
      map: B.tex, roughness: Math.min(0.9, S.rough + 0.12), metalness: S.metal * 0.62, envMapIntensity: 0.85,
      emissive: B.emis ? 0xffffff : 0x000000, emissiveMap: B.emis || null, emissiveIntensity: B.emis ? 0.9 : 0
    }));
    const edgeMat = metalMat(S.edge, Math.max(0.16, S.rough - 0.12), Math.min(0.95, S.metal * 0.8 + 0.1));
    const blade = new THREE.Mesh(B.geo, [bladeMat, edgeMat]);
    blade.position.y = seatY - 0.012;
    grp.add(blade);
    if (B.inlayGeo) {
      const In = S.inlay, glowing = In.style === 'runes' || In.style === 'crystal';
      const im = once(matC, 'in' + key, () => new THREE.MeshStandardMaterial({
        map: B.inlayTex, side: THREE.DoubleSide, transparent: false, alphaTest: In.style === 'gold' && !In.base ? 0.35 : 0,
        roughness: glowing ? 0.35 : In.style === 'gold' ? 0.28 : S.rough, metalness: In.style === 'gold' ? 0.95 : glowing ? 0.2 : S.metal,
        emissive: glowing ? 0xffffff : 0x000000, emissiveMap: glowing ? B.inlayTex : null, emissiveIntensity: glowing ? (In.glow || 1.2) * (1 + plus * 0.09) : 0,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
      }));
      for (const z of [1, -1]) {
        const m = new THREE.Mesh(B.inlayGeo, im);
        m.position.z = z * (B.capZ + 0.0009);
        blade.add(m);
      }
    }
    // topuz
    const P = S.pommel, pm = metalMat(P.color, 0.32, 0.9);
    let yMin = -gl / 2;
    if (P.type === 'cap') {
      const m = new THREE.Mesh(once(geoC, 'pcap' + r, () => { const g = new THREE.SphereGeometry(r * 1.7, 10, 6); g.scale(1, 0.8, 1); return g; }), pm);
      m.position.y = -gl / 2 - r * 1.1; grp.add(m); yMin = m.position.y - r * 1.4;
    } else if (P.type === 'spike') {
      const m = new THREE.Mesh(once(geoC, 'pspk' + r, () => new THREE.ConeGeometry(r * 1.5, 0.08, 6)), pm);
      m.rotation.x = Math.PI; m.position.y = -gl / 2 - 0.045; grp.add(m); yMin = -gl / 2 - 0.085;
    } else if (P.type === 'gem') {
      const cup = new THREE.Mesh(once(geoC, 'pcup' + r, () => new THREE.CylinderGeometry(r * 1.6, r * 0.8, 0.03, 8)), pm);
      cup.position.y = -gl / 2 - 0.018; grp.add(cup);
      const gm = new THREE.Mesh(once(geoC, 'pgem', () => { const g = new THREE.OctahedronGeometry(0.03, 0); g.scale(1, 1.35, 1); return g; }), gemMat(P.gem));
      gm.position.y = -gl / 2 - 0.066; grp.add(gm); yMin = -gl / 2 - 0.108;
    }
    grp.traverse(o => { if (o.isMesh) { o.castShadow = !opts.noShadow; } });
    // ışıltı
    const pg = plus >= 9 ? 0xc26bff : plus >= 7 ? 0xffc040 : plus >= 5 ? 0x4aa3ff : 0;
    const gcol = pg || S.glow || 0;
    const sprites = [];
    if (opts.sprites !== false && gcol) {
      const n = pg ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const t = 0.15 + k / (n - 1) * 0.72;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: gcol, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: pg ? 0.55 : 0.32 }));
        const w = prof(S.prof, t);
        sp.position.set((S.curve || 0) * t * t * S.len, blade.position.y + t * S.len, 0);
        sp.scale.setScalar(Math.max(0.22, w * (pg ? 7 : 5)));
        sp.userData.base = sp.material.opacity;
        grp.add(sp); sprites.push(sp);
      }
    }
    if (opts.sprites !== false && S.gem) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: S.gem, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
      sp.position.set(0, gl / 2 + gd.seat * 0.5, 0); sp.scale.setScalar(0.14); sp.userData.base = 0.5;
      grp.add(sp); sprites.push(sp);
    }
    const tipY = blade.position.y + S.len;
    return {
      group: grp, sprites, tipY, seatY: blade.position.y, len: S.len, yMin, yMax: tipY + 0.01,
      trailColor: gcol || 0xdfe8f4, trailI: gcol ? 1 : 0.55
    };
  }

  // karakterin eline takılacak hali
  function forHand(id, plus) {
    const b = build(id, plus, { sprites: true });
    const wrap = new THREE.Group();
    wrap.quaternion.setFromRotationMatrix(BASIS);
    wrap.scale.setScalar(1.15);
    wrap.add(b.group);
    b.wrap = wrap;
    return b;
  }

  // hayvan önizlemesi (aynı sahnede)
  function petView(species, form) {
    const md = KY.Models.pet(species, form || 0);
    const g = new THREE.Group(); g.add(md.obj);
    md.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(md.obj);
    return { group: g, sprites: [], yMin: box.min.y, yMax: box.max.y, w: Math.max(box.max.x - box.min.x, box.max.z - box.min.z), pet: true, md };
  }

  // ---------------- 3D önizleme (çanta, demirci, koleksiyon) ----------------
  const Preview = {
    r: null, failed: false, el: null, key: '', cur: null, t: 0, yaw: 0, drag: null, pulse: 0, pulseCol: 0xffd46b, w: 0, h: 0,
    init() {
      if (this.r) return true;
      if (this.failed) return false;
      try {
        const r = this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        r.setClearColor(0x000000, 0);
        r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        const sc = this.scene = new THREE.Scene();
        sc.environment = envFor(r);
        const hemi = new THREE.HemisphereLight(0xfff4e0, 0x2c2834, 0.75); sc.add(hemi);
        const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(1.6, 2.2, 3); sc.add(key);
        const rim = new THREE.DirectionalLight(0x9fc4ff, 0.9); rim.position.set(-2.2, 1, -2); sc.add(rim);
        const fill = new THREE.DirectionalLight(0xffd9a0, 0.35); fill.position.set(-2, -1, 2); sc.add(fill);
        this.lights = { hemi, key, rim, fill };
        this.cam = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
        this.holder = new THREE.Group(); sc.add(this.holder);
        this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffd46b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
        this.flash.scale.setScalar(1.6); this.flash.position.z = -0.2; sc.add(this.flash);
        const cv = r.domElement;
        cv.setAttribute('aria-hidden', 'true');
        cv.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); e.preventDefault(); });
        cv.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; });
        const end = () => { this.drag = null; };
        cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
        return true;
      } catch (e) { this.failed = true; this.r = null; return false; }
    },
    mount(el) {
      if (!this.init()) { el.classList.add('nogl'); return; }
      const id = el.dataset.item, plus = +el.dataset.plus || 0, form = +el.dataset.form || 0, key = id + '+' + plus + '/' + form;
      const cv = this.r.domElement;
      if (cv.parentNode !== el) el.appendChild(cv);
      this.el = el;
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h && (w !== this.w || h !== this.h)) {
        this.w = w; this.h = h;
        this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.r.setSize(w, h, false);
        this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
        this.fit();
      }
      if (key !== this.key) {
        if (this.cur) this.holder.remove(this.cur.group);
        this.cur = I[id].type === 'pet' ? petView(I[id].pet, form) : build(id, plus, { sprites: true, noShadow: true });
        this.holder.add(this.cur.group);
        this.key = key;
        // hayvanlar mat boyalı: kılıçlardan daha yumuşak ışık
        const Lt = this.lights, pet = !!this.cur.pet;
        Lt.hemi.intensity = pet ? 0.5 : 0.75; Lt.key.intensity = pet ? 0.72 : 1.25; Lt.rim.intensity = pet ? 0.45 : 0.9; Lt.fill.intensity = pet ? 0.2 : 0.35;
        this.fit();
      }
    },
    fit() {
      if (!this.cur) return;
      const b = this.cur, L = b.yMax - b.yMin;
      b.group.position.y = -(b.yMin + b.yMax) / 2;
      const tan = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
      const bird = b.pet && b.md.kind === 'bird';
      const byH = L * (bird ? 3.2 : b.pet ? 1.5 : 1.12) / (2 * tan), byW = (b.w || 0.62) * (bird ? 0.95 : b.pet ? 1.35 : 1) / (2 * tan * this.cam.aspect);
      this.dist = Math.max(byH, byW);
    },
    update(dt) {
      if (!this.r || !this.el) return;
      if (!this.el.isConnected) { this.el = null; return; }
      this.t += dt;
      const sway = this.drag ? 0 : Math.sin(this.t * 0.8) * 0.75;
      this.holder.rotation.y = this.yaw + sway + (this.cur && this.cur.pet ? 0.75 : 0);
      if (!(this.cur && this.cur.pet)) this.holder.rotation.x = 0;
      if (this.cur && this.cur.pet) {
        const md = this.cur.md;
        this.holder.rotation.x = md.kind === 'bird' ? 0.55 : 0;
        if (md.kind === 'bird') { const f = Math.sin(this.t * 7) * 0.5; md.wingL.rotation.z = f; md.wingR.rotation.z = -f; md.tipL.rotation.z = f * 0.6; md.tipR.rotation.z = -f * 0.6; }
        else if (md.tail) md.tail.rotation.y = Math.sin(this.t * 5) * 0.35;
      }
      this.holder.position.y = Math.sin(this.t * 1.3) * 0.012;
      this.cam.position.set(0, 0.02, this.dist); this.cam.lookAt(0, 0, 0);
      if (this.cur) for (const s of this.cur.sprites) s.material.opacity = s.userData.base * (0.8 + Math.sin(this.t * 3 + s.position.y * 6) * 0.2);
      if (this.pulse > 0) {
        this.pulse = Math.max(0, this.pulse - dt * 1.4);
        this.flash.material.color.setHex(this.pulseCol);
        this.flash.material.opacity = this.pulse * 0.9;
        this.flash.scale.setScalar(1.2 + (1 - this.pulse) * 1.2);
        this.holder.scale.setScalar(1 + this.pulse * 0.05);
      } else this.flash.material.opacity = 0;
      this.r.render(this.scene, this.cam);
    },
    burst(ok) { this.pulse = 1; this.pulseCol = ok ? 0xffd46b : 0xff4a3a; }
  };

  // ---------------- simgeler: 3D modelden çekilmiş resimler ----------------
  function makeIcons() {
    if (!Preview.init()) return 0;
    const r = Preview.r, sc = new THREE.Scene();
    sc.environment = Preview.scene.environment;
    sc.add(new THREE.HemisphereLight(0xfff4e0, 0x2c2834, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(1, 2, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.7); rim.position.set(-2, 1, -2); sc.add(rim);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    const pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(128, 128, false);
    let n = 0;
    for (const id in I) {
      const isPet = I[id].type === 'pet';
      if (!isPet && (I[id].type !== 'weapon' || !I[id].sword)) continue;
      try {
        const g = new THREE.Group();
        if (isPet) {
          const pv = petView(I[id].pet, 0);
          g.add(pv.group); g.rotation.y = 0.85; g.rotation.x = 0.18;
        } else {
          const b = build(id, 0, { sprites: false, noShadow: true });
          g.add(b.group);
          b.group.rotation.z = -Math.PI / 4;
          g.rotation.y = 0.32;
        }
        sc.add(g); g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        const half = Math.max(s.x, s.y) / 2 * 1.04;
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
        cam.position.set(c.x, c.y, 5); cam.lookAt(c.x, c.y, 0);
        r.render(sc, cam);
        icons.set(id, r.domElement.toDataURL('image/png'));
        sc.remove(g); n++;
      } catch (e) { /* simge üretilemezse SVG yedeği kullanılır */ }
    }
    r.setPixelRatio(pr);
    Preview.w = Preview.h = 0;
    return n;
  }

  return { build, forHand, envFor, Preview, makeIcons, iconURL: (id) => icons.get(id) || null, BASIS };
})();
