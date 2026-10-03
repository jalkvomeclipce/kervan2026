/* ============================================================
   KERVAN YOLU — avatar.js
   Modüler karakter: kadın / erkek gövde, saç, yüz ve kuşanılan her
   eşya ayrı bir 3D parça. Eşya değişince giysi anında değişir.
   Tüm parçalar tek bir iskeletli ağda birleşir (karakter başına
   2-3 çizim çağrısı). Animasyon kodla yapılır (yürüme, koşma,
   saldırı, büyü, ölüm).
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.Avatar = (function () {
  const D = KY.DATA, I = D.items;
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------- desen atlası (4×4 hücre) ----------------
  const CELL = { skin: 0, hair: 1, linen: 2, leather: 3, scale: 4, lamellar: 5, fur: 6, silk: 7, metal: 8, gold: 9, wood: 10, felt: 11, chain: 12, plain: 13, straw: 14, cloth: 15 };
  let ATLAS = null;
  function atlas() {
    if (ATLAS) return ATLAS;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N * 4;
    const g = c.getContext('2d'), r = KY.Gfx.rng(777);
    const cell = (k, fn) => { const x = (k % 4) * N, y = ((k / 4) | 0) * N; g.save(); g.beginPath(); g.rect(x, y, N, N); g.clip(); g.translate(x, y); fn(); g.restore(); };
    const fill = (col) => { g.fillStyle = col; g.fillRect(0, 0, N, N); };
    const specks = (n, a, s) => { for (let i = 0; i < n; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(r() * N, r() * N, s, s); } };
    const blot = (n, a, rad) => { for (let i = 0; i < n; i++) { const x = r() * N, y = r() * N, rr = rad * (0.5 + r()), gr = g.createRadialGradient(x, y, 0, x, y, rr); const v = r() < 0.5 ? '0,0,0' : '255,255,255'; gr.addColorStop(0, `rgba(${v},${a})`); gr.addColorStop(1, `rgba(${v},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } };
    cell(CELL.skin, () => { fill('#f3efea'); blot(30, 0.035, 40); specks(1500, 0.025, 1.5); });
    cell(CELL.hair, () => {
      fill('#cfc8c2');
      for (let i = 0; i < 380; i++) {
        const x = r() * N, w = 0.6 + r() * 1.6, dark = r() < 0.6;
        g.strokeStyle = dark ? `rgba(0,0,0,${0.12 + r() * 0.2})` : `rgba(255,255,255,${0.1 + r() * 0.18})`; g.lineWidth = w;
        g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 14, N * 0.33, x + (r() - 0.5) * 14, N * 0.66, x + (r() - 0.5) * 8, N); g.stroke();
      }
    });
    cell(CELL.linen, () => {
      fill('#e9e3d8');
      g.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < N; y += 3) g.fillRect(0, y, N, 1);
      g.fillStyle = 'rgba(0,0,0,0.035)'; for (let x = 0; x < N; x += 3) g.fillRect(x, 0, 1, N);
      blot(14, 0.04, 50); specks(900, 0.04, 1);
    });
    cell(CELL.leather, () => {
      fill('#ddd3c8'); blot(60, 0.06, 28); specks(2500, 0.05, 1.5);
      g.strokeStyle = 'rgba(40,25,15,0.55)'; g.lineWidth = 2; g.setLineDash([6, 5]);
      for (const y of [8, N - 8]) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
      g.setLineDash([]);
    });
    cell(CELL.scale, () => {
      fill('#3a3a3a');
      const cols = 9, rows = 11, w = N / cols, h = N / rows;
      for (let j = rows; j >= -1; j--) for (let i = -1; i <= cols; i++) {
        const x = i * w + (j % 2 ? w / 2 : 0), y = j * h;
        const gr = g.createLinearGradient(0, y - h * 0.2, 0, y + h * 1.2);
        gr.addColorStop(0, '#f4f4f4'); gr.addColorStop(0.65, '#bdbdbd'); gr.addColorStop(1, '#6a6a6a');
        g.fillStyle = gr; g.beginPath();
        g.moveTo(x, y - h * 0.15); g.lineTo(x + w, y - h * 0.15); g.lineTo(x + w, y + h * 0.5);
        g.quadraticCurveTo(x + w, y + h * 1.3, x + w / 2, y + h * 1.32); g.quadraticCurveTo(x, y + h * 1.3, x, y + h * 0.5); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
      }
    });
    cell(CELL.lamellar, () => {
      fill('#1e1e1e');
      const cols = 12, rows = 8, w = N / cols, h = N / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * w + (j % 2 ? w / 2 : 0) - w / 2, y = j * h;
        const gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#f2f2f2'); gr.addColorStop(1, '#a8a8a8');
        g.fillStyle = gr; g.beginPath(); g.roundRect ? g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 3) : g.rect(x + 1.5, y + 1.5, w - 3, h - 3); g.fill();
        g.fillStyle = '#5a1414'; g.fillRect(x + w / 2 - 1.5, y + h * 0.18, 3, 3); g.fillRect(x + w / 2 - 1.5, y + h * 0.7, 3, 3);
      }
    });
    cell(CELL.fur, () => {
      fill('#bdbdbd');
      for (let i = 0; i < 2600; i++) {
        const x = r() * N, y = r() * N, L = 5 + r() * 9, v = r() < 0.5 ? 0 : 255;
        g.strokeStyle = `rgba(${v},${v},${v},${0.12 + r() * 0.22})`; g.lineWidth = 1 + r();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + L); g.stroke();
      }
    });
    cell(CELL.silk, () => {
      const gr = g.createLinearGradient(0, 0, N, N); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#e6e6e6');
      g.fillStyle = gr; g.fillRect(0, 0, N, N);
      g.strokeStyle = 'rgba(0,0,0,0.09)'; g.lineWidth = 2;
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = i * 64 + (j % 2 ? 32 : 0) + 16, y = j * 64 + 24;
        g.beginPath(); g.arc(x, y, 10, Math.PI, 0); g.arc(x + 14, y, 6, Math.PI, 0); g.stroke();
        g.beginPath(); g.arc(x + 7, y + 2, 16, 0.2, Math.PI - 0.2); g.stroke();
      }
    });
    cell(CELL.metal, () => {
      fill('#d4d4d4');
      for (let y = 0; y < N; y++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${0.03 + r() * 0.05})`; g.fillRect(0, y, N, 1); }
      blot(10, 0.05, 60);
    });
    cell(CELL.gold, () => {
      fill('#ece4d0');
      g.strokeStyle = 'rgba(80,50,10,0.3)'; g.lineWidth = 2;
      for (let y = 16; y < N; y += 32) { g.beginPath(); for (let x = 0; x <= N; x += 16) g.lineTo(x, y + ((x / 16) % 2 ? 6 : -6)); g.stroke(); }
      specks(800, 0.06, 1);
    });
    cell(CELL.wood, () => {
      fill('#cdb79e');
      for (let i = 0; i < 70; i++) { const y = r() * N; g.strokeStyle = `rgba(60,35,15,${0.08 + r() * 0.14})`; g.lineWidth = 1 + r() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(N * 0.3, y + (r() - 0.5) * 16, N * 0.7, y + (r() - 0.5) * 16, N, y); g.stroke(); }
      g.fillStyle = 'rgba(40,20,10,0.35)'; for (let x = 0; x < N; x += 42) g.fillRect(x, 0, 2, N);
    });
    cell(CELL.felt, () => { fill('#ededed'); blot(40, 0.04, 30); specks(1500, 0.04, 1.5); });
    cell(CELL.chain, () => {
      fill('#202020'); g.strokeStyle = '#cfcfcf'; g.lineWidth = 2;
      for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(i * 14.2 + (j % 2 ? 7 : 0), j * 14.2, 5.5, 0, TAU); g.stroke(); }
    });
    cell(CELL.plain, () => fill('#ffffff'));
    cell(CELL.straw, () => {
      fill('#e3d3a0');
      for (let y = 0; y < N; y += 8) { g.fillStyle = 'rgba(90,60,20,0.25)'; g.fillRect(0, y, N, 2); }
      for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(255,250,220,${0.2 + r() * 0.2})`; g.lineWidth = 1; const x = r() * N, y = r() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + (r() - 0.5) * 2); g.stroke(); }
    });
    cell(CELL.cloth, () => {
      fill('#ececec');
      g.fillStyle = 'rgba(0,0,0,0.04)'; for (let y = 0; y < N; y += 2) g.fillRect(0, y, N, 1);
      blot(20, 0.035, 40); specks(800, 0.03, 1);
    });
    ATLAS = new THREE.CanvasTexture(c);
    ATLAS.anisotropy = 4;
    return ATLAS;
  }
  const INSET = 4 / 256;
  const uvIn = (k, u, v) => { const cx = k % 4, cy = (k / 4) | 0; return [(cx + INSET + u * (1 - 2 * INSET)) / 4, (1 - (cy + 1) / 4) + (INSET + v * (1 - 2 * INSET)) / 4]; };

  // ---------------- geometri yardımcıları ----------------
  // tüp: rows = [[r, y], ...] artan y; sx/sz eliptik kesit; arc: [a0, a1] kısmi halka; ripple: [adet, genlik] (pli)
  function tube(rows, o) {
    o = o || {};
    const seg = o.seg || 16, sx = o.sx || 1, sz = o.sz || 1, a0 = o.arc ? o.arc[0] : Math.PI, a1 = o.arc ? o.arc[1] : Math.PI + TAU;
    const pos = [], uv = [], idx = [];
    const n = rows.length;
    for (let i = 0; i < n; i++) {
      const [rad, y, xo, zo] = rows[i];
      for (let j = 0; j <= seg; j++) {
        const th = a0 + (a1 - a0) * j / seg;
        const rr = rad * (1 + (o.ripple ? o.ripple[1] * Math.sin(o.ripple[0] * th) * (o.rippleFade ? i / (n - 1) : 1) : 0));
        pos.push((xo || 0) + Math.sin(th) * rr * sx, y, (zo || 0) + Math.cos(th) * rr * sz);
        uv.push(j / seg, i / (n - 1));
      }
    }
    const W = seg + 1;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      if (o.inside) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    if (o.capTop || o.capBot) {
      const add = (i, up) => {
        const base = pos.length / 3, [, y, xo, zo] = rows[i];
        pos.push(xo || 0, y, zo || 0); uv.push(0.5, up ? 1 : 0);
        for (let j = 0; j < seg; j++) { const a = i * W + j; up ? idx.push(base, a, a + 1) : idx.push(base, a + 1, a); }
      };
      if (o.capTop) add(n - 1, true);
      if (o.capBot) add(0, false);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const gc = new Map();
  const cache = (k, f) => { let g = gc.get(k); if (!g) { g = f(); gc.set(k, g); } return g; };
  const sph = (ws, hs, t0, tl) => cache('sp' + ws + '|' + hs + '|' + (t0 || 0) + '|' + (tl || Math.PI), () => new THREE.SphereGeometry(1, ws || 14, hs || 10, 0, TAU, t0 || 0, tl || Math.PI));
  const rbox = (w, h, d) => KY.Models.rboxG(w, h, d);
  const cone = (r, h, s) => cache('co' + r + '|' + h + '|' + s, () => new THREE.ConeGeometry(r, h, s || 8, 1));
  const cyl = (a, b, h, s) => cache('cy' + a + '|' + b + '|' + h + '|' + s, () => new THREE.CylinderGeometry(a, b, h, s || 10, 1));
  const tor = (R, r, s, arc) => cache('to' + R + '|' + r + '|' + s + '|' + (arc || 0), () => new THREE.TorusGeometry(R, r, 6, s || 20, arc || TAU));
  const oct = (r) => cache('oc' + r, () => new THREE.OctahedronGeometry(r, 0));
  // profil enterpolasyonu
  const prof = (P, y) => { if (y <= P[0][1]) return P[0][0]; for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const t = (y - P[i - 1][1]) / (P[i][1] - P[i - 1][1]); return lerp(P[i - 1][0], P[i][0], t); } return P[P.length - 1][0]; };

  // ---------------- gövde ölçüleri ----------------
  const BODY = {
    f: {
      hipY: 0.93, hipW: 0.085, thigh: 0.43, shin: 0.41, waist: 0.07, spine: 0.41, sX: 0.168, sY: 0.37, upper: 0.27, fore: 0.235, neck: 0.062, head: 1.08,
      pelvis: [[0.065, -0.12], [0.118, -0.09], [0.142, -0.04], [0.14, 0.01], [0.118, 0.06], [0.104, 0.09]], pelvisZ: 0.76,
      torso: [[0.108, -0.02], [0.096, 0.06], [0.093, 0.1], [0.103, 0.17], [0.116, 0.23], [0.12, 0.28], [0.118, 0.32], [0.104, 0.36], [0.07, 0.395], [0.036, 0.41]], torsoX: 1.12, torsoZ: 0.72,
      thighP: [[0.05, -0.43], [0.057, -0.38], [0.071, -0.24], [0.083, -0.1], [0.084, 0.02]],
      shinP: [[0.033, -0.4], [0.036, -0.33], [0.051, -0.15], [0.05, -0.06], [0.047, 0.02]],
      upperP: [[0.034, -0.28], [0.037, -0.2], [0.043, -0.08], [0.049, 0.0], [0.046, 0.03]],
      foreP: [[0.025, -0.245], [0.028, -0.2], [0.036, -0.09], [0.038, -0.03], [0.035, 0.015]],
      headP: [[0.001, -0.03], [0.034, -0.025], [0.058, 0.0], [0.072, 0.04], [0.08, 0.085], [0.082, 0.12], [0.075, 0.155], [0.058, 0.183], [0.03, 0.2], [0.001, 0.205]], headX: 0.9, headZ: 1.02,
      neckR: 0.037, skin: [0xeab996, 0xd9a07a, 0xb57b55], hair: [0x2a1912, 0x5a3420, 0x14100e], lip: 0xc26a62
    },
    m: {
      hipY: 0.98, hipW: 0.095, thigh: 0.45, shin: 0.43, waist: 0.075, spine: 0.44, sX: 0.215, sY: 0.395, upper: 0.29, fore: 0.255, neck: 0.08, head: 1.06,
      pelvis: [[0.07, -0.12], [0.118, -0.09], [0.138, -0.04], [0.138, 0.01], [0.13, 0.06], [0.125, 0.09]], pelvisZ: 0.72,
      torso: [[0.126, -0.02], [0.122, 0.07], [0.132, 0.16], [0.152, 0.26], [0.162, 0.32], [0.155, 0.38], [0.1, 0.43], [0.045, 0.445]], torsoX: 1.12, torsoZ: 0.66,
      thighP: [[0.054, -0.45], [0.06, -0.4], [0.074, -0.24], [0.082, -0.1], [0.08, 0.02]],
      shinP: [[0.036, -0.43], [0.04, -0.35], [0.055, -0.15], [0.054, -0.06], [0.05, 0.02]],
      upperP: [[0.04, -0.3], [0.044, -0.22], [0.052, -0.1], [0.056, 0.0], [0.05, 0.04]],
      foreP: [[0.028, -0.265], [0.031, -0.22], [0.042, -0.1], [0.044, -0.03], [0.04, 0.015]],
      headP: [[0.001, -0.035], [0.042, -0.03], [0.066, -0.005], [0.078, 0.04], [0.084, 0.085], [0.085, 0.12], [0.078, 0.155], [0.06, 0.185], [0.03, 0.203], [0.001, 0.207]], headX: 0.95, headZ: 1.04,
      neckR: 0.047, skin: [0xd8a27c, 0xc08660, 0x9c6846], hair: [0x1c1511, 0x3e2a1c, 0x5a5550], lip: 0xa86a58
    }
  };
  const BONES = ['hips', 'torso', 'head', 'armL', 'elbowL', 'handL', 'armR', 'elbowR', 'handR', 'legL', 'kneeL', 'footL', 'legR', 'kneeR', 'footR'];
  const BI = {}; BONES.forEach((n, i) => BI[n] = i);
  function restOffsets(B) {
    return {
      hips: [null, 0, B.hipY, 0], torso: ['hips', 0, B.waist, 0], head: ['torso', 0, B.spine + B.neck, 0],
      armL: ['torso', -B.sX, B.sY, 0], elbowL: ['armL', 0, -B.upper, 0], handL: ['elbowL', 0, -B.fore, 0],
      armR: ['torso', B.sX, B.sY, 0], elbowR: ['armR', 0, -B.upper, 0], handR: ['elbowR', 0, -B.fore, 0],
      legL: ['hips', -B.hipW, -0.04, 0], kneeL: ['legL', 0, -B.thigh, 0], footL: ['kneeL', 0, -B.shin, 0],
      legR: ['hips', B.hipW, -0.04, 0], kneeR: ['legR', 0, -B.thigh, 0], footR: ['kneeR', 0, -B.shin, 0]
    };
  }

  // ---------------- parça toplayıcı ----------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _nm = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
  class Acc {
    constructor(rest) { this.rest = rest; this.pos = []; this.nor = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.idx = [[], [], []]; }
    // g: geometri, bone: kemik adı, col: renk, cell: desen, grp: 0 kumaş/ten, 1 metal, 2 parıltı
    add(g, bone, col, cell, grp, t) {
      t = t || {};
      _p.set(t.x || 0, t.y || 0, t.z || 0);
      _e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ'); _q.setFromEuler(_e);
      const s0 = t.s != null ? t.s : 1;
      _s.set(t.sx != null ? t.sx : s0, t.sy != null ? t.sy : s0, t.sz != null ? t.sz : s0);
      _m.compose(_p, _q, _s);
      _nm.getNormalMatrix(_m);
      if (this.side && /L$/.test(bone)) return;
      const R = this.rest[bone], bi = BI[bone];
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      const base = this.pos.length / 3;
      _c.set(col);
      const k = CELL[cell || 'plain'];
      for (let i = 0; i < P.count; i++) {
        _v.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(_m);
        this.pos.push(_v.x + R.x, _v.y + R.y, _v.z + R.z);
        if (N) { _v.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(_nm).normalize(); this.nor.push(_v.x, _v.y, _v.z); } else this.nor.push(0, 1, 0);
        const uv = U ? uvIn(k, U.getX(i), U.getY(i)) : uvIn(k, 0.5, 0.5);
        this.uv.push(uv[0], uv[1]);
        this.col.push(_c.r, _c.g, _c.b);
        this.si.push(bi, 0, 0, 0); this.sw.push(1, 0, 0, 0);
      }
      const L = this.idx[grp || 0];
      if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) L.push(base + a[i]); }
      else for (let i = 0; i < P.count; i++) L.push(base + i);
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
      const all = []; let off = 0;
      this.idx.forEach((L, k) => { if (L.length) { g.addGroup(off, L.length, k); for (const v of L) all.push(v); off += L.length; } });
      g.setIndex(all);
      g.computeBoundingSphere();
      if (g.boundingSphere) g.boundingSphere.radius += 0.6;
      return g;
    }
  }

  // ---------------- gövde ----------------
  function body(A, B, g, look, opt) {
    const skin = B.skin[look.skin || 0] || B.skin[0], hairC = B.hair[look.hair2 || 0] || B.hair[0];
    const S = 'skin';
    A.add(tube(B.pelvis, { seg: 18, sz: B.pelvisZ, capBot: true }), 'hips', skin, S);
    A.add(tube(B.torso, { seg: 18, sx: B.torsoX, sz: B.torsoZ, capTop: true }), 'torso', skin, S);
    if (g === 'f') for (const sx of [-1, 1]) A.add(sph(12, 9), 'torso', skin, S, 0, { x: sx * 0.054, y: 0.255, z: 0.052, sx: 0.06, sy: 0.054, sz: 0.05 });
    for (const sx of [-1, 1]) A.add(sph(12, 9), 'torso', skin, S, 0, { x: sx * B.sX * 0.55, y: B.sY + 0.01, z: -0.005, sx: g === 'f' ? 0.085 : 0.11, sy: g === 'f' ? 0.035 : 0.05, sz: g === 'f' ? 0.05 : 0.065, rz: sx * -0.25 });
    A.add(tube([[B.neckR * 1.35, B.spine - 0.04], [B.neckR * 1.05, B.spine + 0.0], [B.neckR, B.spine + B.neck * 0.6], [B.neckR * 0.95, B.spine + B.neck + 0.03]], { seg: 12, sz: 0.95 }), 'torso', skin, S);
    for (const side of ['L', 'R']) {
      A.add(tube(B.upperP, { seg: 12, capTop: true }), 'arm' + side, skin, S);
      A.add(sph(12, 9), 'arm' + side, skin, S, 0, { x: (side === 'L' ? -1 : 1) * 0.004, y: 0.004, sx: B.upperP[3][0] * 1.12, sy: B.upperP[3][0] * 1.15, sz: B.upperP[3][0] * 1.08 });
      A.add(tube(B.foreP, { seg: 12 }), 'elbow' + side, skin, S);
      A.add(sph(10, 8), 'elbow' + side, skin, S, 0, { s: B.foreP[4][0] * 1.05 });
      A.add(rbox(0.05 * (g === 'm' ? 1.15 : 1), 0.085, 0.028), 'hand' + side, skin, S, 0, { y: -0.045, z: 0.004 });
      A.add(sph(8, 6), 'hand' + side, skin, S, 0, { x: (side === 'L' ? 1 : -1) * 0.024, y: -0.03, z: 0.02, sx: 0.012, sy: 0.026, sz: 0.012, rz: side === 'L' ? -0.4 : 0.4 });
      A.add(tube(B.thighP, { seg: 14, sz: 0.95 }), 'leg' + side, skin, S);
      A.add(tube(B.shinP, { seg: 12, sz: 0.95 }), 'knee' + side, skin, S);
      A.add(sph(10, 8), 'knee' + side, skin, S, 0, { s: B.shinP[4][0] * 1.05 });
      A.add(rbox(0.07, 0.055, 0.19), 'foot' + side, skin, S, 0, { y: -0.025, z: 0.045 });
    }
    // baş ve yüz
    const H = B.head;
    A.add(tube(B.headP, { seg: 18, sx: B.headX, sz: B.headZ }), 'head', skin, S, 0, { s: H, z: 0.005 });
    for (const sx of [-1, 1]) {
      A.add(sph(8, 6), 'head', skin, S, 0, { x: sx * 0.077 * H, y: 0.085 * H, z: -0.008, sx: 0.012, sy: 0.024, sz: 0.018 });
      A.add(sph(10, 8), 'head', 0xf4f0ea, 'plain', 0, { x: sx * 0.03 * H, y: 0.098 * H, z: 0.074 * H, sx: 0.017, sy: g === 'f' ? 0.011 : 0.009, sz: 0.008 });
      A.add(sph(8, 6), 'head', g === 'f' ? 0x3a2416 : 0x241a14, 'plain', 0, { x: sx * 0.03 * H, y: 0.097 * H, z: 0.077 * H, s: g === 'f' ? 0.0085 : 0.0075 });
      A.add(sph(6, 5), 'head', 0x0c0806, 'plain', 0, { x: sx * 0.03 * H, y: 0.097 * H, z: 0.0835 * H, s: 0.004 });
      A.add(rbox(0.032, 0.006, 0.008), 'head', hairC, 'plain', 0, { x: sx * 0.031 * H, y: (g === 'f' ? 0.119 : 0.115) * H, z: 0.079 * H, rz: sx * (g === 'f' ? -0.16 : -0.06) });
      if (g === 'f') A.add(rbox(0.022, 0.003, 0.004), 'head', 0x1a100a, 'plain', 0, { x: sx * 0.032 * H, y: 0.106 * H, z: 0.079 * H, rz: sx * -0.12 });
    }
    A.add(sph(8, 6), 'head', skin, S, 0, { y: 0.07 * H, z: 0.082 * H, sx: 0.0085, sy: 0.017, sz: 0.01, rx: -0.35 });
    A.add(sph(10, 6), 'head', B.lip, 'plain', 0, { y: 0.036 * H, z: 0.076 * H, sx: g === 'f' ? 0.014 : 0.016, sy: g === 'f' ? 0.0055 : 0.0045, sz: 0.006 });
    if (!opt.noHair) hair(A, B, g, look, hairC, opt);
  }
  function hair(A, B, g, look, col, opt) {
    const H = B.head, style = look.hair || 0, helm = opt.helm;
    // kafatası örtüsü (yüzü açık bırakan küre kesiti, arkaya eğik)
    if (!helm) A.add(sph(18, 12, 0, 1.68), 'head', col, 'hair', 0, { y: 0.104 * H, z: -0.006, sx: 0.092 * H, sy: 0.114 * H, sz: 0.096 * H, rx: -0.42 });
    if (g === 'f') {
      if (!helm) {
        // perçem ve yan tutamlar
        for (const [x, rz, w] of [[-0.04, 0.5, 1], [0.0, 0.0, 1.1], [0.042, -0.55, 1]]) A.add(sph(8, 6), 'head', col, 'hair', 0, { x: x * H, y: 0.158 * H, z: 0.066 * H, sx: 0.034 * w, sy: 0.026, sz: 0.016, rz, rx: 0.3 });
      }
      for (const sx of [-1, 1]) A.add(sph(8, 8), 'head', col, 'hair', 0, { x: sx * 0.072 * H, y: 0.075 * H, z: 0.032 * H, sx: 0.016, sy: 0.07, sz: 0.022, rz: sx * 0.08 });
      if (style === 0) {
        // yüksek topuz + at kuyruğu (Silkroad kadın klasiği)
        A.add(sph(12, 8), 'head', col, 'hair', 0, { y: 0.185 * H, z: -0.055 * H, s: 0.04 });
        A.add(tor(0.034, 0.008, 14), 'head', look.ribbon || 0xb3372e, 'silk', 0, { y: 0.172 * H, z: -0.062 * H, rx: 1.0 });
        A.add(tube([[0.006, -0.36], [0.022, -0.26], [0.036, -0.12], [0.034, -0.02], [0.026, 0.02]], { seg: 10, capTop: true }), 'head', col, 'hair', 0, { y: 0.17 * H, z: -0.085 * H, rx: 0.32 });
      } else if (style === 1) {
        for (const sx of [-1, 1]) {
          A.add(sph(12, 8), 'head', col, 'hair', 0, { x: sx * 0.062 * H, y: 0.172 * H, z: -0.02, s: 0.036 });
          A.add(tube([[0.005, -0.22], [0.02, -0.12], [0.022, -0.02], [0.016, 0.01]], { seg: 8, capTop: true }), 'head', col, 'hair', 0, { x: sx * 0.07 * H, y: 0.15 * H, z: -0.035, rz: sx * 0.15, rx: 0.15 });
        }
      } else {
        A.add(tube([[0.05, -0.3], [0.075, -0.18], [0.085, -0.05], [0.09, 0.05], [0.08, 0.1]], { seg: 14, arc: [Math.PI * 0.55, Math.PI * 1.45], sz: 0.7 }), 'head', col, 'hair', 0, { y: 0.1 * H, z: -0.01 });
      }
    } else {
      if (style === 0) {
        A.add(sph(10, 8), 'head', col, 'hair', 0, { y: 0.205 * H, z: -0.02, s: 0.034 });
        A.add(tor(0.026, 0.007, 12), 'head', look.ribbon || 0x8a2f2a, 'silk', 0, { y: 0.19 * H, z: -0.018, rx: Math.PI / 2 });
      }
      if (look.beard) A.add(sph(10, 8, 1.4, 1.6), 'head', col, 'hair', 0, { y: 0.06 * H, z: 0.035, sx: 0.07, sy: 0.07, sz: 0.06, rx: 0.2 });
    }
  }

  // ---------------- eşya görünüşleri ----------------
  const FAM = {
    keten: { a: 0xd2bb92, b: 0x7a5a3c, trim: 0xa03a2c, cell: 'linen', cell2: 'cloth', metal: 0 },
    deri: { a: 0x9a6038, b: 0x6a4026, trim: 0x2e2018, cell: 'leather', cell2: 'leather', metal: 0, studs: 0xb8bcc2 },
    pullu: { a: 0xa6aeb6, b: 0x2f5378, trim: 0xc89a44, cell: 'scale', cell2: 'cloth', metal: 1 },
    lamel: { a: 0x3a4862, b: 0xa2302a, trim: 0xe0b85e, cell: 'lamellar', cell2: 'silk', metal: 1 },
    kizil: { a: 0xae3424, b: 0xe8743a, trim: 0xe6bb52, cell: 'leather', cell2: 'fur', metal: 0, fur: 1 }
  };
  // NPC kıyafeti: düz renkler + kumaş deseni
  function npcFam(look) { return { a: look.cloth, b: look.pants || 0x3a2e2a, trim: look.trim || 0x8a5a3a, cell: 'silk', cell2: 'cloth', metal: 0, npc: 1 }; }
  function plusGlow(plus) { return plus >= 9 ? 0xc26bff : plus >= 7 ? 0xffc040 : plus >= 5 ? 0x4aa3ff : 0; }

  // gövde kabuğu: torso profili + kalınlık, [y0, y1] aralığında
  function shell(P, y0, y1, th, n) {
    const rows = [];
    n = n || 6;
    for (let i = 0; i <= n; i++) { const y = lerp(y0, y1, i / n); rows.push([prof(P, y) + th, y]); }
    return rows;
  }
  function trimRing(A, P, bone, y, th, col, o) {
    o = o || {};
    A.add(tube([[prof(P, y - 0.008) + th + 0.004, y - 0.008], [prof(P, y + 0.008) + th + 0.004, y + 0.008]], { seg: 18, sx: o.sx || 1, sz: o.sz || 1 }), bone, col, 'gold', o.grp != null ? o.grp : 1);
  }

  function chest(A, B, g, F, it, glow) {
    const tg = glow ? 2 : 1, P = B.torso, X = B.torsoX, Z = B.torsoZ, tier = it ? it.tier : -1;
    if (g === 'f') {
      const y0 = [0.19, 0.12, 0.07, 0.0, 0.16][tier] != null ? [0.19, 0.12, 0.07, 0.0, 0.16][tier] : 0.19;
      const y1 = F.npc ? 0.4 : 0.36;
      const yy0 = F.npc ? -0.02 : y0;
      A.add(tube(shell(P, yy0, y1, 0.009, 8), { seg: 20, sx: X, sz: Z }), 'torso', F.a, F.cell, F.metal);
      for (const sx of [-1, 1]) A.add(sph(12, 9), 'torso', F.a, F.cell, F.metal, { x: sx * 0.054, y: 0.255, z: 0.055, sx: 0.067, sy: 0.06, sz: 0.056 });
      // omuz askıları
      for (const sx of [-1, 1]) A.add(rbox(0.03, 0.12, 0.012), 'torso', F.metal ? F.trim : F.a, F.metal ? 'gold' : F.cell, F.metal, { x: sx * 0.07, y: 0.385, z: 0.05, rx: -0.5, rz: sx * 0.1 });
      for (const sx of [-1, 1]) A.add(rbox(0.03, 0.12, 0.012), 'torso', F.metal ? F.trim : F.a, F.metal ? 'gold' : F.cell, F.metal, { x: sx * 0.07, y: 0.385, z: -0.05, rx: 0.5, rz: sx * 0.1 });
      if (!F.npc) { trimRing(A, P, 'torso', yy0 + 0.006, 0.01, F.trim, { sx: X, sz: Z, grp: tg }); trimRing(A, P, 'torso', y1 - 0.006, 0.01, F.trim, { sx: X, sz: Z, grp: tg }); }
      if (tier === 1) for (let k = 0; k < 4; k++) A.add(sph(6, 4), 'torso', F.trim === 0x2e2018 ? 0xd9b25c : F.trim, 'gold', 1, { y: 0.15 + k * 0.045, z: prof(P, 0.15 + k * 0.045) * Z + 0.012, s: 0.007 });
      if (tier === 3) { A.add(cyl(0.05, 0.05, 0.012, 18), 'torso', 0xd8dde3, 'metal', 1, { y: 0.21, z: prof(P, 0.21) * Z + 0.012, rx: Math.PI / 2 - 0.12 }); A.add(tor(0.05, 0.006, 18), 'torso', F.trim, 'gold', tg, { y: 0.21, z: prof(P, 0.21) * Z + 0.016, rx: -0.12 }); }
      if (tier === 4) A.add(tor(0.075, 0.03, 18), 'torso', F.b, 'fur', 0, { y: 0.405, sx: 1.3, sz: 0.95, rx: Math.PI / 2 });
    } else {
      A.add(tube(shell(P, -0.03, B.spine - 0.01, 0.012, 9), { seg: 20, sx: X, sz: Z }), 'torso', F.a, F.cell, F.metal);
      A.add(tube([[B.neckR + 0.022, B.spine - 0.03], [B.neckR + 0.012, B.spine + 0.02]], { seg: 14 }), 'torso', F.trim, F.metal ? 'gold' : F.cell2, F.metal ? tg : 0);
      if (!F.npc) trimRing(A, P, 'torso', -0.02, 0.012, F.trim, { sx: X, sz: Z, grp: tg });
      for (const side of ['L', 'R']) A.add(tube(shell(B.upperP, -0.13, 0.04, 0.012, 4), { seg: 12, capTop: true }), 'arm' + side, F.metal ? F.b : F.a, F.metal ? F.cell2 : F.cell, 0);
      if (tier === 3) { A.add(cyl(0.065, 0.065, 0.014, 18), 'torso', 0xd8dde3, 'metal', 1, { y: 0.25, z: prof(P, 0.25) * Z + 0.014, rx: Math.PI / 2 - 0.1 }); A.add(tor(0.065, 0.007, 18), 'torso', F.trim, 'gold', tg, { y: 0.25, z: prof(P, 0.25) * Z + 0.018, rx: -0.1 }); }
      if (tier === 1) for (let k = 0; k < 5; k++) A.add(sph(6, 4), 'torso', 0xb8bcc2, 'metal', 1, { y: 0.06 + k * 0.07, z: prof(P, 0.06 + k * 0.07) * Z + 0.014, s: 0.008 });
      if (tier === 4) A.add(tor(0.095, 0.035, 18), 'torso', F.b, 'fur', 0, { y: B.spine - 0.01, sx: 1.4, sz: 0.95, rx: Math.PI / 2 });
    }
  }
  function legs(A, B, g, F, it, glow, npcLong) {
    const tg = glow ? 2 : 1, P = B.pelvis, tier = it ? it.tier : 0, Z = B.pelvisZ;
    const top = 0.075, topR = prof(P, top) + 0.012;
    // kemer
    A.add(tube([[topR + 0.006, top - 0.016], [topR + 0.006, top + 0.016]], { seg: 20, sz: Z }), 'hips', F.metal ? F.trim : F.trim, F.metal ? 'gold' : 'leather', F.metal ? tg : 0);
    A.add(rbox(0.05, 0.04, 0.016), 'hips', 0xd9b25c, 'gold', tg, { y: top, z: (topR + 0.012) * Z });
    if (g === 'f' || npcLong) {
      const len = npcLong ? 0.86 : [0.2, 0.16, 0.2, 0.3, 0.21][tier], flare = npcLong ? 0.11 : [0.085, 0.07, 0.07, 0.09, 0.07][tier];
      const rows = [[topR, top], [prof(P, 0.0) + 0.02, 0.0], [prof(P, -0.06) + 0.035 + flare * 0.4, -0.06], [prof(P, -0.06) + flare + 0.035, -len + 0.02]];
      if (npcLong) rows.splice(3, 0, [0.2, -0.45]);
      rows.push([rows[rows.length - 1][0] + 0.006, -len]);
      rows.sort((a, b) => a[1] - b[1]);
      A.add(tube(rows, { seg: 26, sz: 0.82, ripple: [13, 0.045], rippleFade: true }), 'hips', tier === 2 || tier === 3 ? F.b : F.a, tier === 2 || tier === 3 ? F.cell2 : F.cell, 0);
      if (!F.npc && (tier === 0 || tier === 1)) A.add(rbox(0.1, len * 0.85, 0.01), 'hips', tier === 0 ? F.b : F.a, F.cell, 0, { y: top - len * 0.42, z: topR * Z + 0.03, rx: -0.12 });
      if (tier === 4) A.add(tor(rows[rows.length - 1][0] - 0.004, 0.022, 26), 'hips', F.b, 'fur', 0, { y: -len, rx: Math.PI / 2, sz: 0.82 });
    } else {
      // pantolon (bol şalvar)
      for (const side of ['L', 'R']) {
        A.add(tube(shell(B.thighP, -B.thigh + 0.02, 0.03, 0.022, 5), { seg: 14, sz: 0.95 }), 'leg' + side, F.metal || F.npc ? F.b : F.a, F.metal ? F.cell2 : F.cell, 0);
        A.add(tube(shell(B.shinP, -0.2, 0.03, 0.018, 4), { seg: 12, sz: 0.95 }), 'knee' + side, F.metal || F.npc ? F.b : F.a, F.metal ? F.cell2 : F.cell, 0);
      }
      A.add(tube([[prof(P, -0.1) + 0.03, -0.1], [prof(P, 0.0) + 0.018, 0.0], [topR, top]], { seg: 18, sz: Z }), 'hips', F.metal || F.npc ? F.b : F.a, F.metal ? F.cell2 : F.cell, 0);
    }
    // zırh eteği dilimleri (deri şeritler, pullu/lamel plakalar)
    if (!F.npc && tier >= 1 && tier <= 3) {
      const n = tier === 1 ? 7 : 4, len = [0, 0.24, 0.27, 0.32][tier], w = tier === 1 ? 0.055 : 0.13;
      for (let k = 0; k < n; k++) {
        const a = tier === 1 ? (k / n) * TAU + 0.2 : [0.45, -0.45, 2.3, -2.3][k];
        const rr = topR + 0.02, x = Math.sin(a) * rr, z = Math.cos(a) * rr * Z;
        A.add(rbox(w, len, 0.012), 'hips', F.a, F.cell, F.metal, { x, y: top - len / 2 + 0.005, z, ry: a, rx: -0.2 });
        if (tier >= 2) A.add(rbox(w + 0.01, 0.012, 0.016), 'hips', F.trim, 'gold', tg, { x: Math.sin(a) * (rr + 0.02), y: top - len + 0.01, z: Math.cos(a) * (rr + 0.02) * Z, ry: a, rx: -0.2 });
      }
    }
  }
  function underwear(A, B, g, chestOn, legsOn) {
    if (g === 'f' && !chestOn) {
      A.add(tube(shell(B.torso, 0.205, 0.33, 0.008, 4), { seg: 18, sx: B.torsoX, sz: B.torsoZ }), 'torso', 0x4a3a34, 'cloth');
      for (const sx of [-1, 1]) A.add(sph(12, 9), 'torso', 0x4a3a34, 'cloth', 0, { x: sx * 0.054, y: 0.255, z: 0.054, sx: 0.065, sy: 0.058, sz: 0.054 });
    }
    if (!legsOn) A.add(tube([[prof(B.pelvis, -0.12) + 0.01, -0.12], [prof(B.pelvis, -0.04) + 0.008, -0.04], [prof(B.pelvis, 0.06) + 0.006, 0.06]], { seg: 18, sz: B.pelvisZ }), 'hips', 0x4a3a34, 'cloth');
    if (!legsOn || g === 'f') for (const side of ['L', 'R']) A.add(tube(shell(B.thighP, -0.08, 0.02, 0.006, 2), { seg: 12, sz: 0.95 }), 'leg' + side, 0x4a3a34, 'cloth');
  }
  function feet(A, B, F, it, glow) {
    const tg = glow ? 2 : 1, tier = it ? it.tier : 0;
    for (const side of ['L', 'R']) {
      if (tier === 0 && !F.npc) {
        A.add(rbox(0.082, 0.016, 0.205), 'foot' + side, F.trim, 'leather', 0, { y: -0.046, z: 0.045 });
        for (const z of [0.06, 0.11]) A.add(rbox(0.078, 0.012, 0.016), 'foot' + side, F.b, 'leather', 0, { y: -0.012, z });
        A.add(tube(shell(B.shinP, -B.shin + 0.005, -B.shin + 0.07, 0.006, 2), { seg: 12, sz: 0.95 }), 'knee' + side, F.a, F.cell, 0);
        continue;
      }
      const h = F.npc ? 0.2 : [0, 0.25, 0.28, 0.36, 0.3][tier];
      A.add(rbox(0.082, 0.064, 0.205), 'foot' + side, F.npc ? 0x3a2a20 : F.b, F.npc ? 'leather' : F.cell2 === 'fur' ? 'leather' : F.cell2, 0, { y: -0.024, z: 0.045 });
      A.add(tube(shell(B.shinP, -B.shin - 0.01, -B.shin + h, 0.01, 4), { seg: 12, sz: 0.95 }), 'knee' + side, F.npc ? 0x3a2a20 : F.b, F.npc ? 'leather' : F.cell2 === 'fur' ? 'leather' : F.cell2, 0);
      A.add(tube([[prof(B.shinP, -B.shin + h) + 0.016, -B.shin + h - 0.012], [prof(B.shinP, -B.shin + h) + 0.016, -B.shin + h + 0.012]], { seg: 12, sz: 0.95 }), 'knee' + side, tier === 4 ? F.b : F.trim, tier === 4 ? 'fur' : F.metal ? 'gold' : 'leather', F.metal ? tg : 0);
      if (!F.npc && tier >= 2 && tier <= 3) {
        A.add(tube(shell(B.shinP, -B.shin + 0.05, -0.04, 0.02, 4), { seg: 10, sz: 0.95, arc: [-0.9, 0.9] }), 'knee' + side, F.a, F.cell, 1);
        A.add(sph(10, 6, 0, 1.6), 'knee' + side, F.a, 'metal', 1, { y: 0.0, z: 0.03, sx: 0.05, sy: 0.04, sz: 0.04, rx: 1.4 });
      }
      if (tier === 4) A.add(tor(prof(B.shinP, -B.shin + h) + 0.015, 0.02, 14), 'knee' + side, F.b, 'fur', 0, { y: -B.shin + h, rx: Math.PI / 2 });
    }
  }
  function hands(A, B, F, it, glow) {
    const tg = glow ? 2 : 1, tier = it ? it.tier : 0;
    for (const side of ['L', 'R']) {
      const y0 = tier === 0 ? -B.fore + 0.03 : -B.fore + 0.012, y1 = tier === 0 ? -0.05 : -0.035;
      A.add(tube(shell(B.foreP, y0, y1, tier === 0 ? 0.005 : 0.01, 4), { seg: 12, ripple: tier === 0 ? [7, 0.06] : null }), 'elbow' + side, tier >= 2 && tier <= 3 ? F.a : F.npc ? F.trim : (tier === 0 ? F.a : F.b), tier >= 2 && tier <= 3 ? (tier === 2 ? 'metal' : F.cell) : F.cell, tier >= 2 && tier <= 3 ? 1 : 0);
      if (tier >= 1) {
        A.add(rbox(0.056, 0.06, 0.032), 'hand' + side, tier === 4 ? F.a : F.b, 'leather', 0, { y: -0.03, z: 0.004 });
        for (const y of [y0 + 0.008, y1 - 0.008]) A.add(tube([[prof(B.foreP, y) + 0.016, y - 0.006], [prof(B.foreP, y) + 0.016, y + 0.006]], { seg: 12 }), 'elbow' + side, tier === 4 ? F.b : F.trim, tier === 4 ? 'fur' : F.metal ? 'gold' : 'leather', F.metal ? tg : 0);
      }
      if (tier === 4) for (let k = 0; k < 3; k++) A.add(cone(0.006, 0.03, 5), 'hand' + side, 0xf0e8d8, 'plain', 1, { x: (k - 1) * 0.016, y: -0.09, z: 0.012, rx: 0.4 + Math.PI });
    }
  }
  function shoulders(A, B, g, F, it, glow) {
    const tg = glow ? 2 : 1, tier = it ? it.tier : 0, big = g === 'm' ? 1.18 : 1;
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? -1 : 1;
      if (tier === 0) { A.add(sph(14, 8, 0, 1.75), 'arm' + side, F.a, F.cell, 0, { x: sx * 0.006, y: 0.008, sx: 0.066 * big, sy: 0.06 * big, sz: 0.062 * big, rz: -sx * 0.25 }); continue; }
      const plates = tier === 1 ? 1 : tier === 4 ? 1 : tier === 2 ? 2 : 3;
      for (let k = 0; k < plates; k++) {
        const s = (0.082 - k * 0.006) * big;
        A.add(sph(16, 8, 0, 1.45 + k * 0.08), 'arm' + side, F.a, tier === 3 ? 'lamellar' : tier === 2 ? 'scale' : 'leather', F.metal, { x: sx * (0.012 + k * 0.01), y: 0.012 - k * 0.042, sx: s * 1.1, sy: s * 0.85, sz: s, rz: -sx * (0.35 + k * 0.12) });
        if (F.metal) A.add(tor(s * 0.97, 0.005, 18), 'arm' + side, F.trim, 'gold', tg, { x: sx * (0.012 + k * 0.01 + Math.sin(0.35 + k * 0.12) * s * 0.1), y: 0.012 - k * 0.042 - s * 0.1, rx: Math.PI / 2, rz: -sx * (0.35 + k * 0.12), sz: 0.95 });
      }
      if (tier === 1) for (let k = 0; k < 3; k++) A.add(sph(6, 4), 'arm' + side, 0xb8bcc2, 'metal', 1, { x: sx * 0.03, y: 0.04 - k * 0.0, z: (k - 1) * 0.04, s: 0.008 });
      if (tier === 4) A.add(sph(12, 8), 'arm' + side, F.b, 'fur', 0, { x: sx * 0.02, y: 0.05, sx: 0.08 * big, sy: 0.05, sz: 0.075 * big });
    }
  }
  function headgear(A, B, g, F, it, glow) {
    const tg = glow ? 2 : 1, tier = it ? it.tier : 0, H = B.head;
    if (tier === 0) {
      A.add(tube([[0.083 * H, 0.125 * H], [0.081 * H, 0.15 * H]], { seg: 20, sx: B.headX * 1.04, sz: B.headZ * 1.04 }), 'head', F.b, F.cell, 0, { z: 0.004 });
      for (const sx of [-1, 1]) A.add(rbox(0.018, 0.13, 0.006), 'head', F.b, F.cell, 0, { x: sx * 0.014, y: 0.08 * H, z: -0.088 * H, rz: sx * 0.15, rx: 0.25 });
      return;
    }
    if (tier === 1) {
      A.add(sph(18, 10, 0, 1.45), 'head', F.a, 'leather', 0, { y: 0.105 * H, z: -0.004, sx: 0.097 * H, sy: 0.105 * H, sz: 0.1 * H, rx: -0.25 });
      A.add(tube([[0.1 * H, 0.0], [0.1 * H, 0.018]], { seg: 20, sx: 0.98, sz: 1.02 }), 'head', F.trim, 'leather', 0, { y: 0.115 * H, rx: -0.25 });
      for (const sx of [-1, 1]) A.add(rbox(0.012, 0.07, 0.05), 'head', F.a, 'leather', 0, { x: sx * 0.088 * H, y: 0.07 * H, z: -0.01 });
      return;
    }
    if (tier === 4) {
      A.add(sph(18, 12, 0, 2.0), 'head', F.b, 'fur', 0, { y: 0.1 * H, z: -0.012, sx: 0.104 * H, sy: 0.112 * H, sz: 0.108 * H, rx: -0.55 });
      for (const sx of [-1, 1]) A.add(cone(0.028, 0.07, 6), 'head', F.a, 'fur', 0, { x: sx * 0.058 * H, y: 0.215 * H, z: -0.01, rz: -sx * 0.35 });
      A.add(tube([[0.096 * H, 0.0], [0.096 * H, 0.016]], { seg: 20, sx: 0.98, sz: 1.04 }), 'head', F.trim, 'gold', tg, { y: 0.135 * H, rx: -0.12 });
      return;
    }
    // miğfer (pullu / lamel)
    A.add(sph(18, 10, 0, 1.5), 'head', F.a, tier === 3 ? 'metal' : 'metal', 1, { y: 0.1 * H, z: -0.004, sx: 0.1 * H, sy: 0.112 * H, sz: 0.104 * H, rx: -0.2 });
    A.add(tube([[0.104 * H, 0.0], [0.108 * H, 0.016]], { seg: 22, sx: 0.98, sz: 1.03 }), 'head', F.trim, 'gold', tg, { y: 0.112 * H, rx: -0.2 });
    for (const sx of [-1, 1]) A.add(rbox(0.012, 0.075, 0.06), 'head', F.a, tier === 3 ? 'lamellar' : 'scale', 1, { x: sx * 0.092 * H, y: 0.07 * H, z: 0.005, rz: sx * 0.12 });
    A.add(tube([[0.09 * H, -0.06], [0.1 * H, 0.0]], { seg: 18, arc: [Math.PI * 0.62, Math.PI * 1.38], sz: 1.05 }), 'head', F.a, tier === 3 ? 'lamellar' : 'scale', 1, { y: 0.1 * H });
    A.add(cone(0.012, 0.07, 6), 'head', F.trim, 'gold', tg, { y: 0.22 * H, z: -0.008 });
    A.add(cone(0.035, 0.12, 10), 'head', 0xb3241c, 'fur', 0, { y: 0.21 * H, z: -0.014, rx: Math.PI });
    if (tier === 3) {
      A.add(rbox(0.05, 0.035, 0.008), 'head', F.trim, 'gold', tg, { y: 0.135 * H, z: 0.1 * H, rx: -0.2 });
      for (const sx of [-1, 1]) A.add(rbox(0.006, 0.07, 0.035), 'head', F.trim, 'gold', tg, { x: sx * 0.105 * H, y: 0.16 * H, z: -0.01, rz: sx * 0.5 });
    }
  }
  function npcHat(A, B, look) {
    const H = B.head, c = look.trim || 0xc8a868;
    switch (look.hat) {
      case 'cone': A.add(cone(0.22, 0.11, 18), 'head', 0xd9c48c, 'straw', 0, { y: 0.2 * H }); break;
      case 'band': A.add(tube([[0.084 * H, 0.125 * H], [0.082 * H, 0.15 * H]], { seg: 20, sx: B.headX * 1.04, sz: B.headZ * 1.04 }), 'head', c, 'cloth', 0); break;
      case 'wrap':
        A.add(tube([[0.092 * H, 0.1 * H], [0.1 * H, 0.15 * H], [0.085 * H, 0.2 * H], [0.03, 0.225 * H]], { seg: 18, sx: B.headX * 1.05, sz: B.headZ * 1.05, ripple: [5, 0.05], capTop: true }), 'head', c, 'silk', 0, { rx: -0.12 });
        A.add(sph(8, 6), 'head', 0xd9b25c, 'gold', 1, { y: 0.17 * H, z: 0.095 * H, s: 0.013 });
        break;
      case 'hood': A.add(sph(18, 12, 0, 2.05), 'head', look.cloth, 'cloth', 0, { y: 0.1 * H, z: -0.014, sx: 0.104 * H, sy: 0.113 * H, sz: 0.108 * H, rx: -0.55 }); break;
      case 'helm': A.add(sph(18, 10, 0, 1.5), 'head', 0x8c949c, 'metal', 1, { y: 0.1 * H, sx: 0.1 * H, sy: 0.11 * H, sz: 0.104 * H, rx: -0.2 }); break;
    }
  }
  function shield(A, B, it, glow) {
    const t = it.tier, R = 0.27 + t * 0.012, face = [0xa47a4c, 0x7a5232, 0xc89a44, 0x9a2a22][t], cell = ['wood', 'wood', 'scale', 'silk'][t];
    const tr = { x: -0.06, y: -0.12, z: 0.02, rz: Math.PI / 2 };
    A.add(tube([[0.001, -0.012], [R, -0.004], [R, 0.006], [R * 0.7, 0.026], [R * 0.3, 0.036], [0.001, 0.04]], { seg: 24 }), 'elbowL', face, cell, t >= 2 ? 1 : 0, tr);
    A.add(tor(R, 0.012, 26), 'elbowL', t === 0 ? 0x5a3e28 : t === 3 ? 0xe0b85e : 0x9aa0a6, t === 3 ? 'gold' : 'metal', t === 0 ? 0 : glow ? 2 : 1, { x: tr.x, y: tr.y, z: tr.z, ry: Math.PI / 2 });
    if (t >= 1) A.add(sph(12, 8, 0, 1.6), 'elbowL', t === 3 ? 0xe0b85e : 0xb0b6bc, t === 3 ? 'gold' : 'metal', 1, Object.assign({}, tr, { x: -0.1, s: 0.05 }));
    if (t === 3) A.add(tor(R * 0.55, 0.014, 20, Math.PI * 1.2), 'elbowL', 0xe0b85e, 'gold', glow ? 2 : 1, { x: -0.098, y: tr.y, z: tr.z, ry: Math.PI / 2, rx: 0.6 });
  }
  function jewelry(A, B, eq) {
    const H = B.head;
    const nk = eq.necklace && I[eq.necklace.id];
    if (nk) {
      const gem = [0xefe6d6, 0xc6ccd4, 0xe39a2a][Math.min(2, nk.tier >= 3 ? 2 : nk.tier)], ch = nk.tier === 0 ? 0x8a6a48 : nk.tier >= 3 ? 0xd9b25c : 0xc6ccd4;
      A.add(tor(B.neckR + 0.024, 0.0035, 22), 'torso', ch, 'gold', 1, { y: B.spine - 0.015, z: 0.012, rx: Math.PI / 2 - 0.35 });
      A.add(oct(0.016), 'torso', gem, 'plain', 1, { y: B.spine - 0.055, z: B.neckR + 0.04, sy: 1.4 });
    }
    const er = eq.earring && I[eq.earring.id];
    if (er) {
      const gem = [0xc87a3a, 0xd8dee6, 0x2ec4b0][Math.min(2, er.tier >= 3 ? 2 : er.tier)];
      for (const sx of [-1, 1]) { A.add(sph(6, 5), 'head', 0xd9b25c, 'gold', 1, { x: sx * 0.08 * H, y: 0.064 * H, z: -0.006, s: 0.006 }); A.add(oct(0.01), 'head', gem, 'plain', 1, { x: sx * 0.08 * H, y: 0.048 * H, z: -0.006, sy: 1.5 }); }
    }
    for (const k of ['ring1', 'ring2']) {
      const rg = eq[k] && I[eq[k].id];
      if (rg) A.add(tor(0.016, 0.004, 12), k === 'ring1' ? 'handR' : 'handL', rg.tier >= 3 ? 0xd9b25c : 0xc6ccd4, 'gold', 1, { y: -0.075, z: 0.006, rx: Math.PI / 2 });
    }
  }

  // ---------------- malzemeler ----------------
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const map = atlas();
    const mk = (o, rim) => KY.Gfx.rimPatch(new THREE.MeshPhongMaterial(Object.assign({ map, vertexColors: true, skinning: true }, o)), rim);
    MATS = { cloth: mk({ specular: 0x1c1a18, shininess: 10 }, 0.16), metal: mk({ specular: 0x9a9080, shininess: 70 }, 0.28) };
    return MATS;
  }
  const glowMats = new Map();
  function glowMat(col) {
    let m = glowMats.get(col);
    if (!m) { m = KY.Gfx.rimPatch(new THREE.MeshPhongMaterial({ map: atlas(), vertexColors: true, skinning: true, specular: 0xaaaaaa, shininess: 60, emissive: col, emissiveIntensity: 0.9 }), 0.4); glowMats.set(col, m); }
    return m;
  }

  // ---------------- karakter ----------------
  // opts: { g: 'f'|'m', look: { skin, hair, hair2, ribbon, beard }, scale, npc: look (NPC kıyafeti), only: yuva (simge için yalnız o parça) }
  function build(opts) {
    opts = opts || {};
    const g = opts.g === 'm' ? 'm' : 'f', B = BODY[g];
    const obj = new THREE.Group(), root = new THREE.Group();
    obj.add(root);
    const bones = {}, list = [];
    const off = restOffsets(B), rest = {};
    for (const n of BONES) {
      const b = new THREE.Bone(); b.name = n;
      const [par, x, y, z] = off[n];
      b.position.set(x, y, z);
      bones[n] = b; list.push(b);
      if (par) bones[par].add(b);
      const pr = par ? rest[par] : { x: 0, y: 0, z: 0 };
      rest[n] = { x: pr.x + x, y: pr.y + y, z: pr.z + z };
    }
    const M = mats();
    const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), [M.cloth, M.metal, M.cloth]);
    mesh.add(bones.hips);
    mesh.castShadow = true; mesh.frustumCulled = false;
    root.add(mesh);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    const md = {
      obj, root, mesh, kind: 'avatar', g, B, rest, bones, opts,
      hips: bones.hips, torso: bones.torso, head: bones.head, armL: bones.armL, armR: bones.armR, elbowL: bones.elbowL, elbowR: bones.elbowR,
      handL: bones.handL, handR: bones.handR, legL: bones.legL, legR: bones.legR, kneeL: bones.kneeL, kneeR: bones.kneeR, footL: bones.footL, footR: bones.footR,
      height: (B.hipY + B.waist + B.spine + B.neck + 0.2 * B.head) * (opts.scale || 1), sword: null, tool: null
    };
    root.scale.setScalar(opts.scale || 1);
    md.size = opts.scale || 1;
    md.dress = (eq, o) => dress(md, eq, o);
    return md;
  }
  // kıyafeti (ve elde tutulanı) yeniden kur: iskelet ve animasyon durumu korunur
  function dress(md, eq, o) {
    o = o || {};
    eq = eq || {};
    const g = md.g, B = md.B, A = new Acc(md.rest), look = md.opts.look || {}, npc = md.opts.npc, only = md.opts.only;
    A.side = !!md.opts.side;
    const itemOf = (slot) => eq[slot] ? I[eq[slot].id] : null;
    const famOf = (it) => it ? FAM[it.set] || FAM.keten : null;
    let glowCol = 0;
    const glowOf = (slot) => { const e = eq[slot]; const c = e ? plusGlow(e.plus || 0) : 0; if (c && !glowCol) glowCol = c; return !!c; };
    const want = (slot) => !only || only === slot;
    const helmIt = itemOf('head');
    if (!only) body(A, B, g, look, { helm: (helmIt && helmIt.tier >= 1 && helmIt.tier !== 4 ? 1 : 0) || (npc && (npc.hat === 'hood' || npc.hat === 'helm' || npc.hat === 'wrap')) });
    if (npc) {
      const F = npcFam(npc);
      chest(A, B, g, F, { tier: -1 }, false);
      legs(A, B, g, F, { tier: 0 }, false, g === 'f');
      feet(A, B, F, null, false);
      hands(A, B, F, { tier: 0 }, false);
      npcHat(A, B, npc);
      if (g === 'm' && npc.beard !== false) { /* sakal look.beard ile gelir */ }
    } else {
      const ch = itemOf('armor'), lg = itemOf('legs');
      if (!only) underwear(A, B, g, !!ch, !!lg);
      if (ch && want('armor')) chest(A, B, g, famOf(ch), ch, glowOf('armor'));
      if (lg && want('legs')) legs(A, B, g, famOf(lg), lg, glowOf('legs'));
      const ft = itemOf('feet'); if (ft && want('feet')) feet(A, B, famOf(ft), ft, glowOf('feet'));
      const hd = itemOf('hands'); if (hd && want('hands')) hands(A, B, famOf(hd), hd, glowOf('hands'));
      const sh = itemOf('shoulder'); if (sh && want('shoulder')) shoulders(A, B, g, famOf(sh), sh, glowOf('shoulder'));
      const he = itemOf('head'); if (he && want('head')) headgear(A, B, g, famOf(he), he, glowOf('head'));
      const sd = itemOf('shield'); if (sd && want('shield')) shield(A, B, sd, glowOf('shield'));
      if (!only || only === 'earring' || only === 'necklace' || only === 'ring1') jewelry(A, B, only ? { [only]: eq[only] } : eq);
    }
    const geo = A.geometry();
    if (md.mesh.geometry) md.mesh.geometry.dispose();
    md.mesh.geometry = geo;
    md.mesh.material = [mats().cloth, mats().metal, glowCol ? glowMat(glowCol) : mats().metal];
    // elde tutulan: kılıç ya da NPC aleti
    if (md.held) { md.held.parent && md.held.parent.remove(md.held); md.held = null; md.sword = null; }
    const wp = eq.weapon;
    if (!only && wp && I[wp.id] && KY.Swords) {
      const sw = KY.Swords.build(wp.id, wp.plus || 0, { sprites: !o.noSprites, noShadow: !!o.noShadow });
      const holder = new THREE.Group();
      holder.add(sw.group);
      holder.position.set(0, -0.062, 0.006);
      holder.rotation.set(Math.PI / 2 + 0.28, 0, 0);
      md.handR.add(holder);
      md.held = holder; md.sword = sw;
    } else if (!only && npc && (npc.weapon === 'hammer' || npc.weapon === 'staff' || npc.weapon === 'blade')) {
      const h = new THREE.Group(), Mo = KY.Models;
      if (npc.weapon === 'hammer') {
        const st = new THREE.Mesh(Mo.cylG(0.018, 0.022, 0.5, 6), Mo.mat(0x5a3e28)); st.position.y = 0.12; h.add(st);
        const hd = new THREE.Mesh(Mo.rboxG(0.13, 0.1, 0.2), Mo.mat(0x55585c)); hd.position.y = 0.36; h.add(hd);
      } else if (npc.weapon === 'staff') {
        const st = new THREE.Mesh(Mo.cylG(0.02, 0.024, 1.75, 6), Mo.mat(0x6b4a2e)); st.position.y = 0.25; h.add(st);
        const gm = new THREE.Mesh(Mo.icoG(0.06), Mo.mat(0xe7c46a)); gm.position.y = 1.14; h.add(gm);
      }
      h.traverse(q => { if (q.isMesh) q.castShadow = true; });
      h.position.set(0, -0.06, 0.01);
      h.rotation.set(npc.weapon === 'staff' ? Math.PI / 2 - 1.35 : Math.PI / 2 + 0.2, 0, 0);
      md.handR.add(h); md.held = h;
    }
    md.hasShield = !!eq.shield;
    return md;
  }

  // ---------------- animasyon ----------------
  // a: { phase, blend, idle, swing, cast, hit, die, spin }, e: varlık (moving)
  function animate(md, a, e, dt) {
    const b = a.blend, ph = a.phase, s = Math.sin(ph), c = Math.cos(ph), t = a.idle, f = md.g === 'f';
    const run = b > 0.5 ? 1 : b * 2;
    const H = md.B.hipY;
    // kalça ve gövde
    md.hips.position.y = H + Math.abs(c) * 0.055 * b - 0.025 * b + Math.sin(t * 2.1) * 0.004 * (1 - b);
    md.hips.rotation.set(0, s * 0.12 * b, f ? s * 0.04 * b : 0);
    md.torso.rotation.set(0.12 * b + Math.sin(t * 2.1) * 0.012 * (1 - b), -s * 0.18 * b, (f ? -s * 0.03 * b : 0) + Math.sin(t * 0.7) * 0.02 * (1 - b));
    md.head.rotation.set(-0.08 * b, s * 0.08 * b + Math.sin(t * 0.45) * 0.12 * (1 - b), 0);
    // bacaklar
    md.legL.rotation.set(-s * 0.72 * b, 0, f ? 0.02 : 0.03);
    md.legR.rotation.set(s * 0.72 * b, 0, f ? -0.02 : -0.03);
    md.kneeL.rotation.x = (0.1 + 1.15 * Math.max(0, Math.sin(ph + 1.25)) * run) * b + 0.05 * (1 - b);
    md.kneeR.rotation.x = (0.1 + 1.15 * Math.max(0, Math.sin(ph + 1.25 + Math.PI)) * run) * b + 0.05 * (1 - b);
    md.footL.rotation.x = -0.25 * Math.max(0, -s) * b; md.footR.rotation.x = -0.25 * Math.max(0, s) * b;
    if (b < 0.5 && f) { md.legR.rotation.z -= 0.05 * (1 - b * 2); md.kneeR.rotation.x += 0.12 * (1 - b * 2); }
    // kollar
    md.armL.rotation.set(s * 0.65 * b - 0.05, 0, -0.1 - (f ? 0.02 : 0.08) + Math.sin(t * 2.1) * 0.01);
    md.armR.rotation.set(-s * 0.65 * b - 0.05, 0, 0.1 + (f ? 0.02 : 0.08) - Math.sin(t * 2.1) * 0.01);
    md.elbowL.rotation.set(-(0.25 + 0.75 * b) - (md.hasShield ? 0.5 : 0), 0, 0);
    md.elbowR.rotation.set(-(0.35 + 0.75 * b), 0, 0);
    md.handL.rotation.set(0, 0, 0); md.handR.rotation.set(0, 0, 0);
    if (md.hasShield) { md.armL.rotation.x -= 0.25; md.armL.rotation.z -= 0.15; md.elbowL.rotation.z = 0.3; }
    // saldırı: yukarı kaldır, çaprazlama indir
    if (a.swing >= 0) {
      const k = a.swing;
      let ax, az, el, tw;
      if (k < 0.14) { const u = k / 0.14; ax = lerp(0, -2.5, u); az = lerp(0.1, 0.55, u); el = lerp(-0.4, -1.3, u); tw = lerp(0, 0.5, u); }
      else if (k < 0.3) { const u = (k - 0.14) / 0.16; ax = lerp(-2.5, 0.35, u); az = lerp(0.55, -0.25, u); el = lerp(-1.3, -0.1, u); tw = lerp(0.5, -0.55, u); }
      else { const u = Math.min(1, (k - 0.3) / 0.3); ax = lerp(0.35, 0, u); az = lerp(-0.25, 0.1, u); el = lerp(-0.1, -0.4, u); tw = lerp(-0.55, 0, u); }
      md.armR.rotation.x = ax; md.armR.rotation.z = az; md.elbowR.rotation.x = el;
      md.torso.rotation.y += tw; md.hips.rotation.y += tw * 0.3;
      md.legL.rotation.x += -0.25 * Math.sin(Math.min(1, k / 0.3) * Math.PI); md.kneeR.rotation.x += 0.3 * Math.sin(Math.min(1, k / 0.3) * Math.PI);
    }
    if (a.cast >= 0) {
      const u = Math.min(1, a.cast / 0.22), back = a.cast > 0.4 ? Math.max(0, 1 - (a.cast - 0.4) / 0.2) : 1, k = u * back;
      md.armL.rotation.x = lerp(md.armL.rotation.x, -1.45, k); md.armR.rotation.x = lerp(md.armR.rotation.x, -1.3, k);
      md.armL.rotation.z = lerp(md.armL.rotation.z, -0.35, k); md.armR.rotation.z = lerp(md.armR.rotation.z, 0.3, k);
      md.elbowL.rotation.x = lerp(md.elbowL.rotation.x, -0.25, k); md.elbowR.rotation.x = lerp(md.elbowR.rotation.x, -0.2, k);
      md.torso.rotation.x -= 0.1 * k;
    }
    if (a.hit >= 0) { const k = Math.sin(a.hit / 0.25 * Math.PI); md.torso.rotation.x -= 0.22 * k; md.head.rotation.x -= 0.2 * k; md.root.position.z = -0.08 * k; }
    else md.root.position.z = 0;
    if (a.spin != null && a.spin >= 0) {
      a.spin += dt; md.root.rotation.y = Math.min(1, a.spin / 0.45) * TAU;
      md.armR.rotation.x = -1.4; md.armR.rotation.z = 1.2; md.armL.rotation.z = -1.1;
      if (a.spin > 0.45) { a.spin = -1; md.root.rotation.y = 0; }
    }
    // ölüm: geriye düş
    if (a.die >= 0) {
      const k = Math.min(1, a.die / 0.5), ease = k * k * (3 - 2 * k);
      md.root.rotation.x = -Math.PI / 2 * ease;
      md.root.position.y = 0.12 * ease;
      md.armL.rotation.set(-2.6 * ease, 0, -0.4 * ease); md.armR.rotation.set(-2.4 * ease, 0, 0.5 * ease);
      md.kneeL.rotation.x = 0.5 * ease; md.legR.rotation.x = -0.3 * ease;
    } else if (md.root.rotation.x) { md.root.rotation.x = 0; md.root.position.y = 0; }
  }

  // ---------------- önizleme (çanta paneli) ----------------
  const Preview = {
    r: null, failed: false, el: null, md: null, key: '', yaw: 0.35, t: 0, drag: null, anim: null,
    init() {
      if (this.r) return true;
      if (this.failed) return false;
      try {
        const r = this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        r.setClearColor(0x000000, 0);
        const sc = this.scene = new THREE.Scene();
        sc.add(new THREE.HemisphereLight(0xfff4e6, 0x2a2430, 0.66));
        const key = new THREE.DirectionalLight(0xfff0dc, 0.92); key.position.set(1.4, 2.4, 2.6); sc.add(key);
        const rim = new THREE.DirectionalLight(0x8fb8ff, 0.8); rim.position.set(-2, 1.2, -2.2); sc.add(rim);
        const fill = new THREE.DirectionalLight(0xffc890, 0.3); fill.position.set(-1.5, 0.4, 2); sc.add(fill);
        // ayak altında parlayan halka (Silkroad seçim ekranı havası)
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.42, 48), new THREE.MeshBasicMaterial({ color: 0xe7c46a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; sc.add(ring); this.ring = ring;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2; disc.position.y = 0.001; sc.add(disc);
        this.cam = new THREE.PerspectiveCamera(24, 0.6, 0.05, 30);
        this.holder = new THREE.Group(); sc.add(this.holder);
        const cv = r.domElement;
        cv.setAttribute('aria-hidden', 'true');
        cv.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, yaw: this.yaw }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); e.preventDefault(); });
        cv.addEventListener('pointermove', e => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; });
        const end = () => { this.drag = null; };
        cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
        return true;
      } catch (e) { this.failed = true; this.r = null; return false; }
    },
    mount(el, player) {
      if (!this.init()) { el.classList.add('nogl'); return; }
      const cv = this.r.domElement;
      if (cv.parentNode !== el) el.appendChild(cv);
      this.el = el;
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h && (w !== this.w || h !== this.h)) {
        this.w = w; this.h = h;
        this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.r.setSize(w, h, false);
        this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
      }
      const lk = player.look || {};
      const key = (lk.g || 'f') + '|' + (lk.hair || 0) + '|' + (lk.skin || 0) + '|' + (lk.hair2 || 0) + '|' + JSON.stringify(player.eq);
      if (key !== this.key) {
        if (!this.md || this.md.g !== (lk.g === 'm' ? 'm' : 'f') || this.lookKey !== key.split('|').slice(0, 4).join('|')) {
          if (this.md) this.holder.remove(this.md.obj);
          this.md = build({ g: lk.g, look: lk });
          this.holder.add(this.md.obj);
          this.anim = { phase: 0, blend: 0, idle: 0, swing: -1, cast: -1, hit: -1, die: -1 };
          this.lookKey = key.split('|').slice(0, 4).join('|');
        }
        this.md.dress(player.eq, { noShadow: true });
        this.key = key;
      }
    },
    flash() { this.pulse = 1; },
    update(dt) {
      if (!this.r || !this.el) return;
      if (!this.el.isConnected) { this.el = null; return; }
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (w && h && (w !== this.w || h !== this.h)) {
        this.w = w; this.h = h;
        this.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.r.setSize(w, h, false);
        this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
      }
      this.t += dt;
      const A = this.anim;
      A.idle += dt;
      animate(this.md, A, { moving: false }, dt);
      this.holder.rotation.y = this.yaw + (this.drag ? 0 : Math.sin(this.t * 0.5) * 0.25);
      const hgt = this.md.height, tn = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
      const dist = Math.max(hgt * 0.5 / tn * 1.1, 0.55 / (tn * this.cam.aspect));
      this.cam.position.set(0, hgt * 0.56, dist); this.cam.lookAt(0, hgt * 0.5, 0);
      this.ring.material.opacity = 0.28 + Math.sin(this.t * 2) * 0.08 + (this.pulse || 0) * 0.5;
      if (this.pulse) this.pulse = Math.max(0, this.pulse - dt * 1.5);
      if (this.md.sword) for (const s of this.md.sword.sprites) s.material.opacity = s.userData.base * (0.8 + Math.sin(this.t * 3) * 0.2);
      this.r.render(this.scene, this.cam);
    }
  };

  // ---------------- simgeler: her zırh parçası kendi 3D modelinden çekilir ----------------
  const icons = new Map();
  function makeIcons() {
    if (!Preview.init()) return 0;
    const r = Preview.r, sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfff4e6, 0x2a2430, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(1, 2, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.6); rim.position.set(-2, 1, -2); sc.add(rim);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    const pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(96, 96, false);
    const slotOf = (it) => it.type === 'ring' ? 'ring1' : it.type;
    let n = 0;
    for (const id in I) {
      const it = I[id];
      if (!D.isEquip(it) || it.type === 'weapon') continue;
      try {
        const slot = slotOf(it), g = slot === 'legs' || slot === 'armor' ? 'f' : 'f';
        const md = build({ g, only: slot, side: slot === 'shoulder' || slot === 'hands' || slot === 'feet' });
        md.dress({ [slot]: { id, plus: 0 } }, { noSprites: true });
        const grp = new THREE.Group(); grp.add(md.obj); sc.add(grp);
        grp.rotation.y = slot === 'shield' ? -Math.PI / 2 + 0.35 : slot === 'shoulder' ? 0.0 : 0.45;
        grp.rotation.x = slot === 'feet' ? 0.25 : 0.12;
        md.mesh.updateMatrixWorld(true);
        md.mesh.skeleton.update();
        // sınır kutusu: dönüşlü köşelerden hesapla
        const P = md.mesh.geometry.attributes.position, box = new THREE.Box3(), v = new THREE.Vector3();
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); v.applyMatrix4(md.mesh.matrixWorld); box.expandByPoint(v); }
        const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
        const half = Math.max(s.x, s.y) / 2 * 1.12 || 0.1;
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
        cam.position.set(c.x, c.y, c.z + 5); cam.lookAt(c.x, c.y, c.z);
        r.setClearColor(0x000000, 0);
        r.render(sc, cam);
        icons.set(id, r.domElement.toDataURL('image/png'));
        sc.remove(grp); md.mesh.geometry.dispose(); n++;
      } catch (e) { /* SVG yedeği kullanılır */ }
    }
    r.setPixelRatio(pr);
    Preview.w = Preview.h = 0;
    return n;
  }

  return { build, dress, animate, Preview, makeIcons, iconURL: (id) => icons.get(id) || null, BODY, plusGlow };
})();
