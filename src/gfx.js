/* ============================================================
   KERVAN YOLU — gfx.js
   Görsel çekirdek: kodla üretilen dokular (çimen, kum, kaya,
   toprak yol, arnavut kaldırımı, ahşap, taş, kiremit, yaprak),
   arazi / bina / bitki gölgelendiricileri, gökyüzü, su, uzak
   dağlar ve ışıltı (bloom) + renk düzenleme son işlemesi.
   Dışarıdan dosya yok: her şey açılışta tuvale çizilir.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Gfx = (function () {
  const T = KY.Terrain;

  // ---------------- gürültü ----------------
  function rng(seed) { let s = (seed | 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; }
  // döşenebilir değer gürültüsü: N×N alan, P kafes hücresi, oct oktav → 0..1
  function field(N, P, oct, seed, gain) {
    gain = gain || 0.5;
    const out = new Float32Array(N * N), r = rng(seed);
    let amp = 1;
    for (let o = 0; o < oct; o++) {
      const p = Math.min(N, P << o), L = new Float32Array(p * p);
      for (let i = 0; i < L.length; i++) L[i] = r();
      const sc = p / N;
      for (let y = 0; y < N; y++) {
        const fy = y * sc, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % p) * p, r1 = ((y0 + 1) % p) * p;
        for (let x = 0; x < N; x++) {
          const fx = x * sc, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
          const c0 = x0 % p, c1 = (x0 + 1) % p;
          const a = L[r0 + c0], b = L[r0 + c1], c = L[r1 + c0], d = L[r1 + c1];
          out[y * N + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
        }
      }
      amp *= gain;
    }
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < out.length; i++) { const v = out[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const k = 1 / (mx - mn || 1);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * k;
    return out;
  }
  // döşenebilir Voronoi: F1, F2 (doku birimi), hücre kimliği
  function voronoi(N, G, seed, jit) {
    const r = rng(seed), px = new Float32Array(G * G), py = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { px[j * G + i] = (i + 0.5 + (r() - 0.5) * jit) / G; py[j * G + i] = (j + 0.5 + (r() - 0.5) * jit) / G; }
    const F1 = new Float32Array(N * N), F2 = new Float32Array(N * N), ID = new Int32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N, ci = Math.floor(u * G), cj = Math.floor(v * G);
      let f1 = 9, f2 = 9, id = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = ci + di, j = cj + dj, ii = (i + G) % G, jj = (j + G) % G, k = jj * G + ii;
        const qx = px[k] + (i < 0 ? -1 : i >= G ? 1 : 0), qy = py[k] + (j < 0 ? -1 : j >= G ? 1 : 0);
        const d = Math.hypot(u - qx, v - qy);
        if (d < f1) { f2 = f1; f1 = d; id = k; } else if (d < f2) f2 = d;
      }
      const o = y * N + x; F1[o] = f1; F2[o] = f2; ID[o] = id;
    }
    return { F1, F2, ID };
  }
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function fillPixels(c, fn) {
    const g = c.getContext('2d'), im = g.createImageData(c.width, c.height), d = im.data, N = c.width * c.height;
    const px = [0, 0, 0, 255];
    for (let i = 0; i < N; i++) { fn(i, px); d[i * 4] = px[0] * 255; d[i * 4 + 1] = px[1] * 255; d[i * 4 + 2] = px[2] * 255; d[i * 4 + 3] = px[3]; }
    g.putImageData(im, 0, 0);
    return g;
  }
  // kenara taşan çizimi karşı kenara da çiz (döşenebilir fırça)
  function wrapDraw(N, x, y, pad, fn) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx * N, Y = y + dy * N;
      if (X < -pad || X > N + pad || Y < -pad || Y > N + pad) continue;
      fn(X, Y);
    }
  }
  let ANISO = 4;
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    if (repeat !== false) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = ANISO;
    return t;
  }

  // ---------------- arazi dokuları ----------------
  function grassTex() {
    const N = 512, f1 = field(N, 4, 6, 11), f2 = field(N, 3, 4, 12), f3 = field(N, 48, 2, 13), r = rng(14);
    const c = canvas(N);
    const g = fillPixels(c, (i, p) => {
      const v = f1[i] * 0.8 + f3[i] * 0.35 - 0.08, h = sstep(0.5, 0.85, f2[i]) * 0.55, gr = 0.88 + r() * 0.24;
      p[0] = (0.16 + 0.19 * v + 0.2 * h) * gr; p[1] = (0.27 + 0.2 * v + 0.06 * h) * gr; p[2] = (0.1 + 0.08 * v + 0.02 * h) * gr;
    });
    // çimen sapları (yukarıdan bakış: her yöne kısa çizgiler)
    g.lineCap = 'round';
    for (let k = 0; k < 9000; k++) {
      const x = r() * N, y = r() * N, a = r() * Math.PI * 2, L = 3 + r() * 7;
      const hue = 72 + r() * 34, li = 18 + r() * 30, sat = 38 + r() * 30;
      g.strokeStyle = `hsla(${hue},${sat}%,${li}%,${0.35 + r() * 0.4})`; g.lineWidth = 0.8 + r() * 1.2;
      wrapDraw(N, x, y, 12, (X, Y) => { g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L); g.stroke(); });
    }
    // küçük çiçek benekleri
    for (let k = 0; k < 160; k++) {
      const x = r() * N, y = r() * N, col = ['#f3eedb', '#f1d65a', '#e9a2c0', '#c9b6f0'][k % 4];
      g.fillStyle = col; g.globalAlpha = 0.55;
      wrapDraw(N, x, y, 3, (X, Y) => { g.beginPath(); g.arc(X, Y, 1 + r() * 0.8, 0, 6.3); g.fill(); });
    }
    g.globalAlpha = 1;
    return tex(c);
  }
  function sandTex() {
    const N = 512, f1 = field(N, 4, 5, 21), f2 = field(N, 8, 3, 22), fine = field(N, 128, 2, 23), r = rng(24);
    const c = canvas(N);
    const g = fillPixels(c, (i, p) => {
      const x = i % N, y = (i / N) | 0;
      const rip = Math.sin((x / N * 14 + y / N * 4 + f2[i] * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      const v = 0.86 + f1[i] * 0.14 + (rip - 0.5) * 0.07 + (fine[i] - 0.5) * 0.08 + (r() - 0.5) * 0.05;
      p[0] = 0.74 * v; p[1] = 0.6 * v; p[2] = 0.41 * v;
    });
    for (let k = 0; k < 500; k++) {
      const x = r() * N, y = r() * N, s = 0.6 + r() * 1.4, l = 0.45 + r() * 0.35;
      g.fillStyle = `rgba(${l * 200 | 0},${l * 170 | 0},${l * 130 | 0},0.6)`;
      wrapDraw(N, x, y, 4, (X, Y) => { g.beginPath(); g.arc(X, Y, s, 0, 6.3); g.fill(); });
    }
    return tex(c);
  }
  function rockTex() {
    const N = 512, f1 = field(N, 4, 6, 31), f2 = field(N, 16, 3, 32), vo = voronoi(N, 7, 33, 0.9), r = rng(34);
    const c = canvas(N);
    fillPixels(c, (i, p) => {
      const y = (i / N) | 0;
      const crack = 1 - sstep(0.0, 0.007, vo.F2[i] - vo.F1[i]);
      const strata = Math.sin((y / N * 6 + f1[i] * 2.4 + f2[i] * 0.8) * Math.PI * 2) * 0.5 + 0.5;
      const cell = ((vo.ID[i] * 2654435761) >>> 0) / 4294967296;
      let v = 0.6 + f1[i] * 0.34 + (f2[i] - 0.5) * 0.22 + strata * 0.1 + (cell - 0.5) * 0.06 + (r() - 0.5) * 0.06;
      v *= 1 - crack * 0.3;
      p[0] = 0.5 * v; p[1] = 0.47 * v; p[2] = 0.42 * v;
    });
    return tex(c);
  }
  function dirtTex() {
    const N = 512, f1 = field(N, 4, 6, 41), f2 = field(N, 32, 2, 42), r = rng(43);
    const c = canvas(N);
    const g = fillPixels(c, (i, p) => {
      const v = 0.8 + f1[i] * 0.25 + (f2[i] - 0.5) * 0.15 + (r() - 0.5) * 0.06;
      p[0] = 0.56 * v; p[1] = 0.45 * v; p[2] = 0.32 * v;
    });
    for (let k = 0; k < 900; k++) {
      const x = r() * N, y = r() * N, s = 1 + r() * 3.2, l = 0.5 + r() * 0.4, a = r() * 3;
      wrapDraw(N, x, y, 8, (X, Y) => {
        g.fillStyle = 'rgba(40,30,20,0.35)'; g.beginPath(); g.ellipse(X + 0.8, Y + 1.0, s, s * 0.7, a, 0, 6.3); g.fill();
        g.fillStyle = `rgb(${l * 190 | 0},${l * 170 | 0},${l * 140 | 0})`; g.beginPath(); g.ellipse(X, Y, s, s * 0.7, a, 0, 6.3); g.fill();
        g.fillStyle = 'rgba(255,250,235,0.25)'; g.beginPath(); g.ellipse(X - s * 0.25, Y - s * 0.25, s * 0.45, s * 0.3, a, 0, 6.3); g.fill();
      });
    }
    return tex(c);
  }
  function cobbleTex() {
    const N = 512, vo = voronoi(N, 11, 51, 0.75), f1 = field(N, 8, 4, 52), r = rng(53);
    const c = canvas(N);
    fillPixels(c, (i, p) => {
      const e = vo.F2[i] - vo.F1[i];
      const cell = ((vo.ID[i] * 2654435761) >>> 0) / 4294967296;
      const stone = sstep(0.004, 0.03, e);
      const dome = Math.sqrt(clamp01(e / 0.06));
      let v = (0.76 + cell * 0.22) * (0.84 + dome * 0.2) + (f1[i] - 0.5) * 0.12 + (r() - 0.5) * 0.04;
      const warm = cell > 0.7 ? 1.06 : 1;
      const mort = 0.36 + f1[i] * 0.1;
      p[0] = (0.7 * v * warm) * stone + mort * 0.7 * (1 - stone);
      p[1] = (0.64 * v) * stone + mort * 0.6 * (1 - stone);
      p[2] = (0.55 * v / warm) * stone + mort * 0.46 * (1 - stone);
    });
    return tex(c);
  }
  // R: gürültü (bulut, büyük ölçek), G: orta, B: ince
  function noiseTex() {
    const N = 256, a = field(N, 4, 6, 61), b = field(N, 8, 4, 62), c2 = field(N, 32, 3, 63);
    const c = canvas(N);
    fillPixels(c, (i, p) => { p[0] = a[i]; p[1] = b[i]; p[2] = c2[i]; });
    return tex(c);
  }
  function waterNormalTex() {
    const N = 256, h = field(N, 8, 5, 71, 0.55);
    const c = canvas(N);
    fillPixels(c, (i, p) => {
      const x = i % N, y = (i / N) | 0;
      const hx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N];
      const hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -hx * 6, ny = -hy * 6, nz = 1, l = Math.hypot(nx, ny, nz);
      p[0] = nx / l * 0.5 + 0.5; p[1] = ny / l * 0.5 + 0.5; p[2] = nz / l * 0.5 + 0.5;
    });
    return tex(c);
  }

  // ---------------- yapı ayrıntı dokusu (RGBA) ----------------
  // R: tahta, G: taş blok, B: kiremit, A: sıva/kumaş gürültüsü (gri, 0.5 civarı)
  function detailTex() {
    const N = 512, grain = field(N, 4, 5, 81), f2 = field(N, 16, 3, 82), fine = field(N, 64, 2, 83), r = rng(84);
    // taş bloklar: 8 sıra, her sıra 512'ye tam bölünen rastgele genişlikler
    const rows = 8, rh = N / rows, edges = [];
    for (let k = 0; k < rows; k++) {
      const ws = []; let s = 0;
      while (s < N - 70) { const w = 70 + r() * 70; ws.push(w); s += w; }
      const sc = N / s, off = r() * N, e = [];
      let acc = 0; for (const w of ws) { acc += w * sc; e.push((acc + off) % N); }
      e.sort((a, b) => a - b); edges.push(e);
    }
    const bshade = new Float32Array(rows * 16).map(() => 0.85 + r() * 0.25);
    const c = canvas(N);
    fillPixels(c, (i, p) => {
      const x = i % N, y = (i / N) | 0;
      // tahta: yatay kalaslar
      const ph = 64, py = y % ph, plank = (y / ph) | 0;
      const g1 = Math.sin((y / N * 60 + grain[(y * N + ((x * 0.15) | 0) % N)] * 7 + plank * 1.7) * Math.PI) * 0.5 + 0.5;
      let wood = 0.62 + g1 * 0.16 + (f2[i] - 0.5) * 0.18 + (((plank * 7919) % 13) / 13 - 0.5) * 0.14;
      if (py < 2 || py > ph - 2) wood *= 0.45;
      const endx = (x + plank * 173) % 256; if (endx < 2) wood *= 0.5;
      // taş blok
      const row = (y / rh) | 0, ry = y % rh, e = edges[row];
      let dx = 1e9, idx = 0;
      for (let k = 0; k < e.length; k++) { const d = Math.abs(x - e[k]); const dd = Math.min(d, N - d); if (dd < dx) dx = dd; if (x > e[k]) idx = k + 1; }
      const dy = Math.min(ry, rh - ry);
      const m = Math.min(dx, dy);
      let stone = (0.6 + grain[i] * 0.25 + (fine[i] - 0.5) * 0.14) * bshade[row * 16 + (idx % 16)];
      stone *= m < 3 ? 0.38 : m < 6 ? 0.8 + (m - 3) * 0.06 : 1;
      if (dy > 3 && dy < 7 && ry < rh / 2) stone *= 1.08;
      // kiremit: sütunlar (yokuş boyunca) + sıra bindirmeleri
      const cx = (x % 32) / 32, cy = (y % 48) / 48, col = ((x / 32) | 0) + ((y / 48) | 0) * 3;
      let tile = 0.45 + 0.42 * Math.pow(Math.sin(cx * Math.PI), 0.7);
      tile *= 0.72 + 0.32 * cy;
      if (cy > 0.92) tile *= 0.55;
      tile *= 0.9 + (((col * 2654435761) >>> 0) / 4294967296) * 0.2;
      tile += (fine[i] - 0.5) * 0.08;
      // sıva
      const pl = 0.62 + grain[i] * 0.14 + (f2[i] - 0.5) * 0.18 + (fine[i] - 0.5) * 0.12 + (r() - 0.5) * 0.04;
      p[0] = clamp01(wood); p[1] = clamp01(stone); p[2] = clamp01(tile); p[3] = clamp01(pl) * 255;
    });
    const t = tex(c);
    t.premultiplyAlpha = false;
    return t;
  }

  // ---------------- bitki dokuları ----------------
  // 2×2 atlas: [0] geniş yaprak öbeği, [1] sık yaprak, [2] çam iğnesi (koni), [3] hurma yaprağı
  function leafTex() {
    const N = 512, H = 256, c = canvas(N), g = c.getContext('2d'), r = rng(91);
    const leaf = (x, y, rx, ry, a, l) => { g.fillStyle = `rgb(${l * 0.86 * 255 | 0},${l * 255 | 0},${l * 0.78 * 255 | 0})`; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 6.3); g.fill(); };
    const cluster = (ox, oy, n, sz, rad) => {
      // ince dallar
      g.strokeStyle = 'rgb(70,58,44)'; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const a = r() * 6.283; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(ox + H / 2, oy + H / 2 + 30); g.quadraticCurveTo(ox + H / 2 + Math.cos(a) * rad * 0.4, oy + H / 2 + Math.sin(a) * rad * 0.3, ox + H / 2 + Math.cos(a) * rad * 0.85, oy + H / 2 + Math.sin(a) * rad * 0.8); g.stroke(); }
      for (let k = 0; k < n; k++) {
        const a = r() * 6.283, d = Math.pow(r(), 0.72) * rad, x = ox + H / 2 + Math.cos(a) * d, y = oy + H / 2 + Math.sin(a) * d * 0.9;
        const t = k / n, rim = d / rad;
        const l = 0.26 + t * 0.46 + rim * 0.1 - (y - oy) / H * 0.2 + r() * 0.14;
        leaf(x, y, sz * (0.75 + r() * 0.55), sz * (0.34 + r() * 0.18), r() * 3.14, Math.min(1, l));
      }
      // ince damar parıltısı
      g.globalAlpha = 0.25;
      for (let k = 0; k < n * 0.3; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad * 0.9; leaf(ox + H / 2 + Math.cos(a) * d - 2, oy + H / 2 + Math.sin(a) * d - 2, sz * 0.4, sz * 0.15, r() * 3, 1); }
      g.globalAlpha = 1;
    };
    cluster(0, 0, 300, 13, 112);
    cluster(H, 0, 520, 9, 114);
    // çam: üstte koni ucu, altta sivri saçaklar
    {
      const ox = 0, oy = H;
      for (let x = 0; x < H; x += 1) {
        const jag = 196 + Math.abs(Math.sin(x * 0.19)) * 44 + r() * 10;
        const grd = g.createLinearGradient(0, oy, 0, oy + jag);
        grd.addColorStop(0, 'rgb(150,170,140)'); grd.addColorStop(1, 'rgb(78,96,74)');
        g.fillStyle = grd; g.fillRect(ox + x, oy, 1, jag);
      }
      g.lineCap = 'round';
      for (let k = 0; k < 1700; k++) {
        const x = r() * H, y = r() * 220, L = 6 + r() * 12, a = Math.PI / 2 + (r() - 0.5) * 0.9, l = 0.4 + r() * 0.55;
        g.strokeStyle = `rgba(${l * 200 | 0},${l * 235 | 0},${l * 190 | 0},0.8)`; g.lineWidth = 1 + r();
        g.beginPath(); g.moveTo(ox + x, oy + y); g.lineTo(ox + x + Math.cos(a) * L, oy + y + Math.sin(a) * L); g.stroke();
      }
    }
    // hurma yaprağı: yatay orta damar, çapraz yaprakçıklar
    {
      const ox = H, oy = H, mid = oy + H / 2;
      g.lineCap = 'round';
      for (let x = 4; x < H - 6; x += 3) {
        const t = x / H, len = (1 - t * 0.75) * 104 * (0.8 + r() * 0.3), l = 0.5 + r() * 0.35;
        g.strokeStyle = `rgb(${l * 215 | 0},${l * 245 | 0},${l * 190 | 0})`; g.lineWidth = 3.2 * (1 - t * 0.6);
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(ox + x, mid); g.quadraticCurveTo(ox + x + len * 0.35, mid + s * len * 0.5, ox + x + len * 0.55, mid + s * len * 0.95); g.stroke(); }
      }
      g.strokeStyle = 'rgb(170,160,110)'; g.lineWidth = 4; g.beginPath(); g.moveTo(ox, mid); g.lineTo(ox + H - 4, mid); g.stroke();
    }
    const t = tex(c, false);
    return t;
  }
  // 2×1 atlas: [0] çimen öbeği (gri, köke doğru koyu), [1] kır çiçekleri (renkli)
  function grassCardTex() {
    const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d'), r = rng(101);
    const blade = (x, h, bend, w, l0, l1, col) => {
      const grd = g.createLinearGradient(0, H, 0, H - h);
      grd.addColorStop(0, col ? col(l0) : `rgb(${l0 * 255 | 0},${l0 * 255 | 0},${l0 * 255 | 0})`);
      grd.addColorStop(1, col ? col(l1) : `rgb(${l1 * 255 | 0},${l1 * 255 | 0},${l1 * 255 | 0})`);
      g.fillStyle = grd; g.beginPath();
      g.moveTo(x - w, H); g.quadraticCurveTo(x - w * 0.5 + bend * 0.4, H - h * 0.55, x + bend, H - h);
      g.quadraticCurveTo(x + w * 0.5 + bend * 0.4, H - h * 0.55, x + w, H); g.closePath(); g.fill();
    };
    for (let k = 0; k < 46; k++) blade(24 + r() * 208, 100 + r() * 150, (r() - 0.5) * 90, 3 + r() * 4, 0.28 + r() * 0.1, 0.78 + r() * 0.22);
    const green = l => `rgb(${l * 120 | 0},${l * 175 | 0},${l * 70 | 0})`;
    for (let k = 0; k < 22; k++) blade(256 + 24 + r() * 208, 70 + r() * 110, (r() - 0.5) * 60, 2.5 + r() * 3, 0.3, 0.9, green);
    const pet = ['#fbf6e8', '#f6d24a', '#e8505a', '#b48ae8', '#f49ac2'];
    for (let k = 0; k < 9; k++) {
      const x = 256 + 30 + r() * 196, h = 100 + r() * 120, bend = (r() - 0.5) * 40;
      g.strokeStyle = 'rgb(70,110,45)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + bend * 0.3, H - h * 0.5, x + bend, H - h); g.stroke();
      const col = pet[k % pet.length], cx = x + bend, cy = H - h;
      g.fillStyle = col;
      for (let q = 0; q < 6; q++) { const a = q / 6 * 6.283; g.beginPath(); g.ellipse(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6.5, 4, a, 0, 6.3); g.fill(); }
      g.fillStyle = '#f2c43a'; g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill();
    }
    return tex(c, false);
  }

  // ---------------- uzak dağlar (R: gölge, G: pus, B: kar, A: örtü) ----------------
  function mountainTex() {
    const W = 1024, H = 256, c = canvas(W, H), g = c.getContext('2d'), r = rng(111);
    const im = g.createImageData(W, H), d = im.data;
    const layers = [
      { base: 0.27, amp: 0.34, haze: 0.78, ks: [2, 3, 5, 9, 17, 31], snow: 0.52 },
      { base: 0.22, amp: 0.26, haze: 0.48, ks: [3, 4, 7, 13, 23, 41], snow: 2 },
      { base: 0.1, amp: 0.15, haze: 0.2, ks: [4, 6, 11, 19, 37, 53], snow: 2 }
    ];
    for (const L of layers) {
      L.ph = L.ks.map(() => r() * 6.283);
      L.h = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        let h = 0, a = 1, n = 0;
        L.ks.forEach((k, q) => { const sn = Math.sin(Math.PI * k * x / W + L.ph[q]); h += a * (k < 5 ? sn * sn : 1 - Math.abs(sn)); n += a; a *= 0.6; });
        L.h[x] = L.base + L.amp * h / n;
      }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const yy = 1 - y / H; let set = false;
      for (let li = layers.length - 1; li >= 0 && !set; li--) {
        const L = layers[li], top = L.h[x];
        if (yy > top) continue;
        const slope = (L.h[(x + 2) % W] - L.h[(x + W - 2) % W]) * 40;
        const o = (y * W + x) * 4;
        const shade = clamp01(0.55 + slope * 0.6 + (r() - 0.5) * 0.06);
        const vh = clamp01(L.haze + (1 - yy / top) * 0.25 * (1 - L.haze));
        const snow = li === 0 ? sstep(top - 0.1, top - 0.03, yy) * sstep(0.5, 0.58, top) : 0;
        d[o] = shade * 255; d[o + 1] = vh * 255; d[o + 2] = snow * 255; d[o + 3] = 255;
        set = true;
      }
    }
    g.putImageData(im, 0, 0);
    const t = tex(c, false); t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  // ---------------- paylaşılan uniformlar ----------------
  const U = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(-0.55, 0.74, 0.45).normalize() },
    uSunCol: { value: new THREE.Color(0xfff1d6) },
    uSkyTop: { value: new THREE.Color(0x3f7cc8) },
    uHorizon: { value: new THREE.Color(0xd3e0ea) },
    tNoise: { value: null },
    uFocus: { value: new THREE.Vector3() }
  };
  const SH = {
    rs: 'float rs(float a, float b, float v){ float t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }\n',
    cloud: 'float cloudShade(vec3 wp){ float c = texture2D(tNoise, wp.xz * 0.0032 + vec2(uTime * 0.0055, uTime * 0.0021)).r; return 1.0 - 0.38 * rs(0.48, 0.74, c); }\n'
  };

  let TX = null;
  function textures() {
    if (TX) return TX;
    TX = { grass: grassTex(), sand: sandTex(), rock: rockTex(), dirt: dirtTex(), cobble: cobbleTex(), noise: noiseTex(), water: waterNormalTex(), detail: detailTex(), leaf: leafTex(), grassCard: grassCardTex(), mountains: mountainTex() };
    U.tNoise.value = TX.noise;
    return TX;
  }
  function setAniso(R) { ANISO = Math.min(8, R.capabilities.getMaxAnisotropy()); if (TX) for (const k in TX) TX[k].anisotropy = ANISO; }

  // ---------------- arazi malzemesi ----------------
  function terrainMaterial() {
    const X = textures();
    const m = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x000000, shininess: 1 });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { tGrass: { value: X.grass }, tSand: { value: X.sand }, tRock: { value: X.rock }, tDirt: { value: X.dirt }, tCobble: { value: X.cobble }, tNoise: U.tNoise, uTime: U.uTime,
        uTownA: { value: new THREE.Vector3(T.TOWNS.sarikum.x, T.TOWNS.sarikum.z, T.TOWNS.sarikum.r) }, uTownB: { value: new THREE.Vector3(T.TOWNS.taskale.x, T.TOWNS.taskale.z, T.TOWNS.taskale.r) } });
      s.vertexShader = 'varying vec3 vWP;\nvarying vec3 vWN;\n' + s.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normal;');
      s.fragmentShader = `uniform sampler2D tGrass, tSand, tRock, tDirt, tCobble, tNoise; uniform float uTime; uniform vec3 uTownA, uTownB;
varying vec3 vWP; varying vec3 vWN;
${SH.rs}${SH.cloud}` + s.fragmentShader.replace('#include <map_fragment>', `
  vec2 p = vWP.xz; float h = vWP.y; vec3 Nw = normalize(vWN);
  float nBig = texture2D(tNoise, p * 0.0042).r, nMid = texture2D(tNoise, p * 0.021).g, nFine = texture2D(tNoise, p * 0.09).b;
  float rx = 6.0 * sin(p.y * 0.035) + 3.0 * sin(p.y * 0.011 + 1.0);
  float e = rs(-25.0, 45.0, p.x - rx * 0.5 + (nMid - 0.5) * 18.0);
  vec3 grass = mix(texture2D(tGrass, p * 0.15).rgb, texture2D(tGrass, p * 0.043 + 0.37).rgb, 0.42);
  grass = mix(grass, grass * vec3(1.38, 1.12, 0.6), rs(0.5, 0.82, nBig) * 0.7);
  grass = mix(grass, grass * vec3(0.86, 1.06, 0.92), rs(26.0, 6.0, abs(p.x - rx)) * 0.6);
  float grove = rs(-108.0, -124.0, p.x + (nMid - 0.5) * 10.0) * rs(-42.0, -56.0, p.y + (nMid - 0.5) * 10.0);
  grass = mix(grass, grass * vec3(1.55, 0.92, 0.62), grove * (0.3 + 0.3 * nFine));
  vec3 sand = mix(texture2D(tSand, p * 0.085).rgb, texture2D(tSand, p * 0.029 + 0.5).rgb, 0.4);
  vec3 col = mix(grass, sand, e);
  float rz = abs(p.y - (8.0 * sin(p.x * 0.02) + 4.0 * sin(p.x * 0.047 + 1.3)));
  float rw = rs(3.25 + (nMid - 0.5) * 1.4 + (nFine - 0.5) * 0.6, 1.75, rz);
  vec3 dirt = texture2D(tDirt, p * 0.14).rgb;
  dirt = mix(dirt, dirt * vec3(1.14, 1.06, 0.92), e);
  col = mix(col, dirt, rw * 0.96);
  float pa = rs(uTownA.z + 3.0, uTownA.z - 2.0, length(p - uTownA.xy) + (nMid - 0.5) * 3.0);
  float pb = rs(uTownB.z + 3.0, uTownB.z - 2.0, length(p - uTownB.xy) + (nMid - 0.5) * 3.0);
  vec3 cob = mix(texture2D(tCobble, p * 0.36).rgb, texture2D(tCobble, p * 0.11 + 0.3).rgb, 0.2);
  col = mix(col, cob, pa * 0.94);
  col = mix(col, cob * vec3(1.16, 1.02, 0.8), pb * 0.94);
  col = mix(col, sand * vec3(0.94, 0.92, 0.86), rs(-0.1, -0.9, h + (nFine - 0.5) * 0.3) * 0.85);
  col = mix(col, sand * vec3(0.5, 0.54, 0.46), rs(-1.2, -2.7, h));
  float slope = sqrt(max(1.0 - Nw.y * Nw.y, 0.0)) / max(Nw.y, 0.05);
  float rk = max(rs(mix(0.5, 0.62, e), mix(1.05, 1.2, e), slope + (nMid - 0.5) * 0.35), rs(mix(8.0, 12.5, e), mix(13.0, 17.0, e), h + (nMid - 0.5) * 4.0));
  if (rk > 0.002) {
    vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
    vec3 rc = texture2D(tRock, vWP.zy * 0.085).rgb * bw.x + texture2D(tRock, p * 0.085).rgb * bw.y + texture2D(tRock, vWP.xy * 0.085).rgb * bw.z;
    rc *= mix(vec3(1.0, 0.98, 0.95), vec3(1.22, 1.02, 0.78), e);
    col = mix(col, rc, rk);
  }
  float sn = rs(17.0, 22.0, h + nMid * 3.0) * (1.0 - rs(1.0, 1.8, slope) * 0.7);
  col = mix(col, vec3(0.9, 0.93, 0.97) * (0.86 + 0.14 * nFine), sn);
  col *= 0.88 + 0.24 * nBig;
  diffuseColor.rgb *= col;
`).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse *= cloudShade(vWP);');
    };
    m.customProgramCacheKey = () => 'terrain';
    return m;
  }

  // ---------------- yapı malzemesi (köşe rengi × ayrıntı dokusu) ----------------
  // mt: 0 düz, 1 tahta, 2 taş blok, 3 kiremit, 4 sıva, 5 kumaş, 6 kabuk, 7 kaya, 8 metal, 9 kerpiç tuğla, 10 sırlı çini (kubbe)
  const MT = { plain: 0, wood: 1, stone: 2, tile: 3, plaster: 4, cloth: 5, bark: 6, rock: 7, metal: 8, brick: 9, glaze: 10 };
  function staticMaterial() {
    const X = textures();
    const m = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x111111, shininess: 6 });
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { tDetail: { value: X.detail }, tRock: { value: X.rock }, tNoise: U.tNoise, uTime: U.uTime });
      s.vertexShader = 'attribute float mt;\nvarying float vMt;\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + s.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vMt = mt; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normal;');
      s.fragmentShader = `uniform sampler2D tDetail, tRock, tNoise; uniform float uTime; varying float vMt; varying vec3 vWP; varying vec3 vWN;
${SH.rs}${SH.cloud}` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    float m = floor(vMt + 0.5);
    vec3 Nw = normalize(vWN), aN = abs(Nw);
    vec2 uvp = aN.y > 0.72 ? vWP.xz : (aN.x > aN.z ? vWP.zy : vWP.xy);
    float k = 1.0;
    if (m < 0.5) { k = 0.94 + 0.12 * texture2D(tDetail, uvp * 0.6).a; }
    else if (m < 1.5) { k = 0.42 + 0.95 * texture2D(tDetail, uvp * vec2(0.3, 0.62)).r; }
    else if (m < 2.5) { k = 0.4 + 0.95 * texture2D(tDetail, uvp * vec2(0.36, 0.46)).g; }
    else if (m < 3.5) {
      vec2 sd = Nw.xz / max(length(Nw.xz), 0.001); vec2 ac = vec2(-sd.y, sd.x);
      k = 0.34 + 1.05 * texture2D(tDetail, vec2(dot(vWP.xz, ac) * 0.95, dot(vWP.xz, sd) * 0.62)).b;
    }
    else if (m < 4.5) { k = 0.62 + 0.55 * texture2D(tDetail, uvp * 0.22).a * (0.85 + 0.3 * texture2D(tDetail, uvp * 0.9).a); }
    else if (m < 5.5) { k = 0.74 + 0.4 * texture2D(tDetail, uvp * 1.1).a; }
    else if (m < 6.5) { k = 0.45 + 0.9 * texture2D(tDetail, uvp.yx * vec2(0.22, 1.5)).r; }
    else if (m < 7.5) {
      vec3 bw = pow(aN, vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
      vec3 rc = texture2D(tRock, vWP.zy * 0.16).rgb * bw.x + texture2D(tRock, vWP.xz * 0.16).rgb * bw.y + texture2D(tRock, vWP.xy * 0.16).rgb * bw.z;
      float rxs = 6.0 * sin(vWP.z * 0.035) + 3.0 * sin(vWP.z * 0.011 + 1.0);
      float west = 1.0 - rs(-25.0, 45.0, vWP.x - rxs * 0.5);
      rc = mix(rc, vec3(0.2, 0.27, 0.1) * (0.8 + 0.5 * texture2D(tDetail, uvp * 0.8).a), rs(0.72, 0.95, Nw.y + (texture2D(tNoise, vWP.xz * 0.4).b - 0.5) * 0.3) * west * 0.6);
      diffuseColor.rgb *= rc * 2.05;
    }
    else if (m < 8.5) { k = 0.8 + 0.4 * texture2D(tDetail, uvp * 2.0).a; }
    else if (m < 9.5) { k = 0.45 + 0.9 * texture2D(tDetail, uvp * vec2(0.85, 1.25)).g; }
    else { float f = fract(vWP.y * 3.4); k = (0.7 + 0.36 * smoothstep(0.0, 0.16, f) * (1.0 - smoothstep(0.84, 1.0, f))) * (0.9 + 0.2 * texture2D(tDetail, uvp * 1.3).a); }
    diffuseColor.rgb *= k;
  }`).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.directDiffuse *= cloudShade(vWP);');
    };
    m.customProgramCacheKey = () => 'static';
    return m;
  }

  // ---------------- bitki malzemeleri ----------------
  function foliagePatch(m, opts) {
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uTime: U.uTime, tNoise: U.tNoise });
      s.vertexShader = `attribute float aHt;\nuniform float uTime;\nvarying vec3 vWP;\n` + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
  float sway = sin(uTime * 1.5 + wp0.x * 0.31 + wp0.z * 0.23) + 0.45 * sin(uTime * 2.9 + wp0.x * 0.83 + wp0.z * 0.5);
  ${opts.grass ? `
  float gust = sin(uTime * 0.7 + wp0.x * 0.05 + wp0.z * 0.03) * 0.5 + 0.5;
  transformed.xz += vec2(0.55, 0.32) * (sway * 0.11 + gust * 0.14) * aHt;
  float dc = length(wp0.xz - cameraPosition.xz);
  transformed.y -= aHt * smoothstep(${(opts.far * 0.62).toFixed(1)}, ${opts.far.toFixed(1)}, dc);` : `
  transformed.xz += vec2(0.6, 0.35) * sway * aHt * 0.022;
  transformed.y += sin(uTime * 2.2 + wp0.z * 0.7) * aHt * 0.006;`}
  vWP = wp0.xyz;`);
      s.uniforms.uFocus = U.uFocus;
      s.fragmentShader = `uniform float uTime;\nuniform sampler2D tNoise;\nuniform vec3 uFocus;\nvarying vec3 vWP;\n${SH.rs}${SH.cloud}` + s.fragmentShader
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
  ${opts.grass ? '' : `{
    vec3 cf = uFocus - cameraPosition; float L = length(cf); vec3 dir = cf / max(L, 0.001);
    float t = clamp(dot(vWP - cameraPosition, dir), 0.0, L);
    float dl = length(vWP - (cameraPosition + dir * t));
    float see = max(1.0 - smoothstep(1.6, 3.4, dl) * step(t, L - 1.0), 1.0 - smoothstep(4.0, 7.0, distance(vWP, cameraPosition)));
    float dith = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
    if (see > 0.0 && dith < see * 0.85) discard;
  }`}`)
        .replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront')
        .replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront')
        .replace('reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();', 'reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask() * cloudShade(vWP);');
    };
    m.customProgramCacheKey = () => opts.grass ? 'grass' + opts.far : 'leaf';
  }
  function leafMaterial() {
    const X = textures();
    const m = new THREE.MeshLambertMaterial({ map: X.leaf, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide });
    foliagePatch(m, {});
    m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: X.leaf, alphaTest: 0.42, side: THREE.DoubleSide });
    return m;
  }
  function grassMaterial(far) {
    const X = textures();
    const m = new THREE.MeshLambertMaterial({ map: X.grassCard, vertexColors: true, alphaTest: 0.38, side: THREE.DoubleSide });
    foliagePatch(m, { grass: true, far: far || 62 });
    return m;
  }

  // ---------------- karakter malzemesi: kenar ışığı ----------------
  function rimPatch(m, strength) {
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => {
      if (prev) prev(s, r);
      s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  { float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += vec3(0.62, 0.7, 0.85) * rimF * ${strength.toFixed(2)} * (0.4 + 0.6 * diffuseColor.rgb); }`);
    };
    m.customProgramCacheKey = () => 'rim' + strength;
    return m;
  }
  // kodla yapılan canavar/insan modelleri: nesne uzayında ince kürk/kumaş dokusu
  function creatureMaterial(color, kind) {
    const X = textures();
    const m = new THREE.MeshPhongMaterial({ color, specular: kind === 'shell' ? 0x3a3530 : 0x161412, shininess: kind === 'shell' ? 30 : 10 });
    m.onBeforeCompile = (s) => {
      s.uniforms.tDetail = { value: X.detail };
      s.vertexShader = 'varying vec3 vLP;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLP = position;');
      s.fragmentShader = 'uniform sampler2D tDetail;\nvarying vec3 vLP;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 q = vLP * 9.0; float d = texture2D(tDetail, q.xy).a * 0.34 + texture2D(tDetail, q.zy).a * 0.33 + texture2D(tDetail, q.xz).a * 0.33;
    diffuseColor.rgb *= 0.78 + 0.42 * d; }`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  { float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += vec3(0.62, 0.7, 0.85) * rimF * 0.28 * (0.4 + 0.6 * diffuseColor.rgb); }`);
    };
    m.customProgramCacheKey = () => 'creature';
    return m;
  }

  // ---------------- gökyüzü ----------------
  function sky() {
    textures();
    const g = new THREE.SphereGeometry(1000, 32, 20);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uSkyTop: U.uSkyTop, uHorizon: U.uHorizon, tNoise: U.tNoise },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform float uTime; uniform vec3 uSunDir, uSunCol, uSkyTop, uHorizon; uniform sampler2D tNoise; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uHorizon * 0.96, clamp(-h * 5.0, 0.0, 1.0));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 1600.0) * 2.5 + pow(sd, 90.0) * 0.32 + pow(sd, 8.0) * 0.14);
  if (h > 0.0) {
    vec2 q = d.xz / (h + 0.16);
    float n = texture2D(tNoise, q * 0.16 + vec2(uTime * 0.0035, uTime * 0.001)).r * 0.62 + texture2D(tNoise, q * 0.55 + vec2(uTime * 0.008, -uTime * 0.002)).g * 0.38;
    float c = smoothstep(0.56, 0.8, n) * smoothstep(0.0, 0.22, h);
    vec3 cc = mix(vec3(0.84, 0.87, 0.92), vec3(1.04, 1.03, 1.0), smoothstep(0.58, 0.88, n));
    cc += uSunCol * pow(sd, 6.0) * 0.25;
    col = mix(col, mix(cc, uHorizon, 0.25 * (1.0 - smoothstep(0.0, 0.4, h))), c * 0.88);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -10; mesh.frustumCulled = false;
    return mesh;
  }
  function mountains() {
    const X = textures();
    const g = new THREE.CylinderGeometry(900, 900, 260, 64, 1, true);
    g.translate(0, 95, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3);
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: X.mountains }, uHorizon: U.uHorizon, uSkyTop: U.uSkyTop },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform sampler2D map; uniform vec3 uHorizon, uSkyTop; varying vec2 vUv;
void main(){
  vec4 t = texture2D(map, vUv); if (t.a < 0.5) discard;
  vec3 rock = mix(uHorizon * vec3(0.52, 0.6, 0.7), uSkyTop * 0.5 + uHorizon * 0.42, 0.25);
  rock *= 0.75 + 0.5 * t.r;
  rock = mix(rock, vec3(0.96, 0.97, 1.0), t.b * 0.85);
  rock = mix(rock, uHorizon, t.g * 0.92);
  gl_FragColor = vec4(rock, 1.0);
}`,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = -9; mesh.frustumCulled = false;
    return mesh;
  }

  // ---------------- su ----------------
  function waterMaterial() {
    const X = textures();
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        tNormal: { value: X.water }, uDeep: { value: new THREE.Color(0x1d5f78) }, uShallow: { value: new THREE.Color(0x4fb3b0) }
      }]),
      vertexShader: `attribute float depth; varying float vDepth; varying vec3 vWP;
#include <fog_pars_vertex>
void main(){ vDepth = depth; vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform sampler2D tNormal, tNoise; uniform float uTime; uniform vec3 uDeep, uShallow, uSunDir, uSunCol, uSkyTop, uHorizon; varying float vDepth; varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main(){
  vec2 p = vWP.xz;
  vec3 a = texture2D(tNormal, p * 0.07 + vec2(0.01, uTime * 0.03)).rgb * 2.0 - 1.0;
  vec3 b = texture2D(tNormal, p * 0.16 + vec2(uTime * 0.018, -uTime * 0.045)).rgb * 2.0 - 1.0;
  vec3 n = normalize(vec3(a.x + b.x, 2.6, a.y + b.y));
  vec3 V = normalize(cameraPosition - vWP);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  float dd = clamp(vDepth / 2.2, 0.0, 1.0);
  vec3 base = mix(uShallow, uDeep, dd);
  vec3 R = reflect(-V, n);
  vec3 skyc = mix(uHorizon, uSkyTop, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 col = mix(base, skyc, clamp(fres * 0.85 + 0.12, 0.0, 1.0));
  vec3 H = normalize(normalize(uSunDir) + V);
  col += uSunCol * (pow(max(dot(n, H), 0.0), 260.0) * 3.0 + pow(max(dot(n, H), 0.0), 30.0) * 0.08);
  float fn = texture2D(tNoise, p * 0.22 + vec2(0.0, uTime * 0.04)).b;
  float foam = (1.0 - smoothstep(0.0, 0.42, vDepth)) * smoothstep(0.32, 0.62, fn + (0.42 - vDepth) * 0.9);
  col = mix(col, vec3(0.93, 0.96, 0.95), foam * 0.85);
  float al = mix(0.5, 0.9, smoothstep(0.0, 1.4, vDepth));
  al = max(al, foam * 0.9) * smoothstep(-0.02, 0.1, vDepth);
  gl_FragColor = vec4(col, al);
  #include <fog_fragment>
}`,
      transparent: true, depthWrite: false, fog: true
    });
  }
  function bindWater(m) { Object.assign(m.uniforms, { tNoise: U.tNoise, uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uSkyTop: U.uSkyTop, uHorizon: U.uHorizon }); return m; }

  // ---------------- son işleme: ışıltı + renk düzenleme ----------------
  class Post {
    constructor(R) {
      this.R = R;
      // HDR: yarım kayan noktalı hedef destekleniyorsa ışıklar 1'in üstüne çıkabilir, ışıltı sadece onlarda olur
      const gl2 = R.capabilities.isWebGL2;
      this.hdr = gl2 && !!(R.extensions.get('EXT_color_buffer_float') || R.extensions.get('EXT_color_buffer_half_float'));
      const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
      const pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type, depthBuffer: true, stencilBuffer: false };
      const MS = gl2 && THREE.WebGLMultisampleRenderTarget;
      this.main = MS ? new THREE.WebGLMultisampleRenderTarget(4, 4, pars) : new THREE.WebGLRenderTarget(4, 4, pars);
      if (MS) this.main.samples = 4;
      const sp = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type, depthBuffer: false, stencilBuffer: false };
      this.lv = [0, 1, 2].map(() => [new THREE.WebGLRenderTarget(4, 4, sp), new THREE.WebGLRenderTarget(4, 4, sp)]);
      this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
      this.quad = new THREE.Mesh(geo); this.quad.frustumCulled = false;
      this.sc = new THREE.Scene(); this.sc.add(this.quad);
      const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
      const mk = (u, fs) => new THREE.ShaderMaterial({ uniforms: u, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false });
      this.mBright = mk({ t: { value: null }, uTh: { value: this.hdr ? 1.45 : 0.95 }, uK: { value: this.hdr ? 0.8 : 0.05 } }, `uniform sampler2D t; uniform float uTh, uK; varying vec2 vUv;
void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + uK, l), 1.0); }`);
      this.mBlur = mk({ t: { value: null }, uD: { value: new THREE.Vector2() } }, `uniform sampler2D t; uniform vec2 uD; varying vec2 vUv;
void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227027;
  c += (texture2D(t, vUv + uD * 1.3846).rgb + texture2D(t, vUv - uD * 1.3846).rgb) * 0.3162162;
  c += (texture2D(t, vUv + uD * 3.2308).rgb + texture2D(t, vUv - uD * 3.2308).rgb) * 0.0702703;
  gl_FragColor = vec4(c, 1.0); }`);
      this.mComp = mk({ tS: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, uBloom: { value: 0.85 }, uWarm: { value: 0 } }, `uniform sampler2D tS, tB0, tB1, tB2; uniform float uBloom, uWarm; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tS, vUv).rgb;
  vec3 b = texture2D(tB0, vUv).rgb * 0.5 + texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 0.95;
  c += b * uBloom;
  // yumuşak omuz: 0.8 üstü parlaklıklar 1'e doğru sıkıştırılır
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + 0.2 * (1.0 - exp(-over * 5.0));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.07);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
  c *= mix(vec3(1.025, 1.0, 0.97), vec3(1.05, 1.0, 0.92), uWarm);
  vec2 q = vUv - 0.5; c *= 1.0 - smoothstep(0.35, 1.0, dot(q, q) * 2.2) * 0.26;
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`);
    }
    setSize(w, h) {
      const pr = this.R.getPixelRatio(), W = Math.max(4, Math.round(w * pr)), H = Math.max(4, Math.round(h * pr));
      this.main.setSize(W, H);
      this.lv.forEach((L, k) => { const s = 2 << k; L[0].setSize(Math.max(2, W / s | 0), Math.max(2, H / s | 0)); L[1].setSize(Math.max(2, W / s | 0), Math.max(2, H / s | 0)); });
    }
    pass(m, target) { this.quad.material = m; this.R.setRenderTarget(target); this.R.render(this.sc, this.cam); }
    render(scene, camera) {
      const R = this.R;
      R.setRenderTarget(this.main); R.render(scene, camera);
      this.mBright.uniforms.t.value = this.main.texture;
      this.pass(this.mBright, this.lv[0][0]);
      for (let k = 0; k < 3; k++) {
        const L = this.lv[k];
        if (k > 0) { this.mBlur.uniforms.t.value = this.lv[k - 1][0].texture; this.mBlur.uniforms.uD.value.set(0, 0); this.pass(this.mBlur, L[0]); }
        const w = L[0].width, h = L[0].height;
        this.mBlur.uniforms.t.value = L[0].texture; this.mBlur.uniforms.uD.value.set(1 / w, 0); this.pass(this.mBlur, L[1]);
        this.mBlur.uniforms.t.value = L[1].texture; this.mBlur.uniforms.uD.value.set(0, 1 / h); this.pass(this.mBlur, L[0]);
      }
      const u = this.mComp.uniforms;
      u.tS.value = this.main.texture; u.tB0.value = this.lv[0][0].texture; u.tB1.value = this.lv[1][0].texture; u.tB2.value = this.lv[2][0].texture;
      this.pass(this.mComp, null);
    }
  }

  return { U, MT, textures, setAniso, terrainMaterial, staticMaterial, leafMaterial, grassMaterial, creatureMaterial, rimPatch, sky, mountains, waterMaterial, bindWater, Post, field, rng };
})();
