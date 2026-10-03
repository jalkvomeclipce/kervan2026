/* ============================================================
   KERVAN YOLU — render.js
   Three.js çizim katmanı. Dünyanın durumunu (KY.World) okur,
   modelleri yerleştirir, animasyon ve efektleri oynatır.
   Oyun kurallarına dokunmaz. 3D'yi değiştirmek istediğinde
   sadece bu dosya ve models.js / scenery.js değişir.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.View = (function () {
  const T = KY.Terrain, D = KY.DATA, Mo = KY.Models, I = D.items;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
  const V = new THREE.Vector3();

  // bölge atmosferi: bozkır (serin mavi pus) ↔ çöl (sıcak altın pus)
  const ATM = {
    steppe: { fog: 0xc7d8e4, horizon: 0xd2e1ec, top: 0x3b77c4, hemiSky: 0xd8e6ff, hemiGround: 0x7d7650, sun: 0xfff0d6, sunI: 1.12, hemiI: 0.64 },
    desert: { fog: 0xe6d4b2, horizon: 0xefe0c0, top: 0x4b86c6, hemiSky: 0xfff0dc, hemiGround: 0x9a7b54, sun: 0xffe4bc, sunI: 1.08, hemiI: 0.6 }
  };
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  function plusGlow(plus) {
    if (plus >= 9) return 0xc26bff;
    if (plus >= 7) return 0xffc040;
    if (plus >= 5) return 0x4aa3ff;
    return 0;
  }

  // ---------------- parçacıklar ----------------
  class Particles {
    constructor(scene, tex, n, additive) {
      this.items = [];
      this.next = 0;
      for (let k = 0; k < n; k++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
        sp.visible = false;
        scene.add(sp);
        this.items.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 1, s1: 0, g: 0, drag: 0, a: 1 });
      }
    }
    emit(x, y, z, o) {
      const it = this.items[this.next];
      this.next = (this.next + 1) % this.items.length;
      it.sp.visible = true;
      it.sp.position.set(x, y, z);
      it.vx = o.vx || 0; it.vy = o.vy || 0; it.vz = o.vz || 0;
      it.life = it.max = o.life || 0.6;
      it.s0 = o.size || 0.4; it.s1 = o.size1 == null ? 0 : o.size1;
      it.g = o.g || 0; it.drag = o.drag || 0; it.a = o.alpha == null ? 1 : o.alpha;
      it.sp.material.color.setHex(o.color || 0xffffff);
      it.sp.scale.setScalar(it.s0);
      it.sp.material.opacity = it.a;
    }
    burst(x, y, z, n, o) {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, sp = (o.speed || 3) * (0.5 + Math.random() * 0.7);
        const s = Math.sqrt(1 - u * u);
        this.emit(x, y, z, Object.assign({}, o, { vx: Math.cos(a) * s * sp, vy: Math.abs(u) * sp * (o.up || 1) + (o.lift || 0), vz: Math.sin(a) * s * sp, life: (o.life || 0.6) * (0.7 + Math.random() * 0.6) }));
      }
    }
    update(dt) {
      for (const it of this.items) {
        if (!it.sp.visible) continue;
        it.life -= dt;
        if (it.life <= 0) { it.sp.visible = false; continue; }
        const t = 1 - it.life / it.max;
        it.vy -= it.g * dt;
        const d = 1 - it.drag * dt;
        it.vx *= d; it.vy *= d; it.vz *= d;
        it.sp.position.x += it.vx * dt; it.sp.position.y += it.vy * dt; it.sp.position.z += it.vz * dt;
        it.sp.scale.setScalar(lerp(it.s0, it.s1, t));
        it.sp.material.opacity = it.a * (1 - t * t);
      }
    }
  }

  class View {
    constructor(canvas, world, opts) {
      this.world = world;
      this.canvas = canvas;
      this.opts = opts;
      this.quality = opts.quality || 'high';
      this.fxLayer = opts.fxLayer;
      this.labelLayer = opts.labelLayer;
      this.time = 0;
      const R = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality === 'high', powerPreference: 'high-performance' });
      R.setClearColor(ATM.steppe.horizon);
      KY.Gfx.setAniso(R);
      this.post = null;
      this.applyQuality();
      const S = this.scene = new THREE.Scene();
      S.fog = new THREE.Fog(ATM.steppe.fog, 35, 290);
      this.camera = new THREE.PerspectiveCamera(48, 1, 0.4, 1500);
      this.hemi = new THREE.HemisphereLight(ATM.steppe.hemiSky, ATM.steppe.hemiGround, ATM.steppe.hemiI);
      S.add(this.hemi);
      const sun = this.sun = new THREE.DirectionalLight(ATM.steppe.sun, ATM.steppe.sunI);
      sun.castShadow = true;
      sun.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
      const sc = sun.shadow.camera; sc.left = -44; sc.right = 44; sc.top = 44; sc.bottom = -44; sc.near = 10; sc.far = 280;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      S.add(sun); S.add(sun.target);
      this.sunDir = KY.Gfx.U.uSunDir.value;
      this.desert = 0;

      try { S.environment = KY.Swords.envFor(R); } catch (e) { /* ortam haritası yoksa kılıçlar düz ışıkla çizilir */ }
      this.world_ = KY.Scenery.build(S, this.quality);
      this.glowTex = this.world_.glowTex;
      this.dustTex = this.makeDustTex();
      this.pGlow = new Particles(S, this.glowTex, 260, true);
      this.pDust = new Particles(S, this.dustTex, 120, false);
      this.initMotes();
      this.ents = new Map();
      this.proj = new Map();
      this.tfx = [];
      this.labels = new Map();
      this.floats = [];
      this.shake = 0;

      // hedef halkası ve tıklama işareti
      const ringG = new THREE.RingGeometry(0.8, 1.0, 36); ringG.rotateX(-Math.PI / 2);
      this.selRing = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xe0463a, transparent: true, opacity: 0.9, depthWrite: false }));
      this.selRing.visible = false; S.add(this.selRing);
      this.marker = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0, depthWrite: false }));
      this.marker.visible = false; S.add(this.marker);
      this.markerT = 9;
      // oyuncu aura (Demir Beden)
      const auraG = new THREE.RingGeometry(0.7, 1.05, 32); auraG.rotateX(-Math.PI / 2);
      this.aura = new THREE.Mesh(auraG, new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.aura.visible = false; S.add(this.aura);

      // kamera durumu
      this.cam = { yaw: -1.05, pitch: innerWidth < innerHeight ? 0.48 : 0.4, dist: innerWidth < innerHeight ? 18 : 15, tx: world.player.x, ty: world.player.y, tz: world.player.z, orbit: false };
      this.raycaster = new THREE.Raycaster();
      this.initTrail();
      this.buildStatics();
      this.bindInput();
      this.resize();
      addEventListener('resize', () => this.resize());
    }

    setWorld(w) {
      for (const [id, rec] of [...this.ents]) if (rec.kind !== 'npc') this.removeEnt(id);
      for (const g of this.proj.values()) this.scene.remove(g);
      this.proj.clear();
      this.world = w;
      this.rebuildPlayer();
      Object.assign(this.cam, { tx: w.player.x, ty: w.player.y, tz: w.player.z });
    }
    applyQuality() {
      const R = this.renderer, coarse = matchMedia('(pointer: coarse)').matches;
      const dpr = window.devicePixelRatio || 1;
      R.setPixelRatio(Math.min(dpr, this.quality === 'high' ? (coarse ? 1.5 : 1.75) : 1));
      R.shadowMap.enabled = this.quality !== 'low';
      R.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.sun) { this.sun.castShadow = this.quality !== 'low'; }
      if (this.world_) {
        this.world_.static.children.forEach(m => m.castShadow = this.quality !== 'low');
        this.world_.leaves.children.forEach(m => m.castShadow = this.quality !== 'low');
      }
      // ışıltı + renk düzenleme yalnızca yüksek kalitede
      if (this.quality === 'high' && !this.post) { try { this.post = new KY.Gfx.Post(R); } catch (e) { console.warn('son işleme kapalı', e); this.post = null; } }
      this.usePost = this.quality === 'high' && !!this.post;
      if (this.camera) this.resize();
    }
    setQuality(q) {
      this.quality = q;
      this.applyQuality();
      this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    }
    // havada süzülen polen / toz zerreleri (kameranın çevresinde)
    initMotes() {
      const N = 140, pos = new Float32Array(N * 3);
      this.motes = { N, vel: new Float32Array(N * 3), pos };
      for (let k = 0; k < N; k++) { pos[k * 3] = (Math.random() - 0.5) * 50; pos[k * 3 + 1] = Math.random() * 9; pos[k * 3 + 2] = (Math.random() - 0.5) * 50; this.motes.vel[k * 3] = Math.random(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex, size: 0.22, color: 0xfff4d0, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.frustumCulled = false;
      this.scene.add(m);
      this.motes.mesh = m;
    }
    updateMotes(dt) {
      const M = this.motes, P = M.pos, C = this.cam, t = this.time;
      for (let k = 0; k < M.N; k++) {
        const i = k * 3, ph = M.vel[i] * 6.283;
        P[i] += (Math.sin(t * 0.4 + ph) * 0.35 + 0.25 + this.desert * 1.6) * dt;
        P[i + 1] += Math.sin(t * 0.7 + ph * 2) * 0.12 * dt;
        P[i + 2] += Math.cos(t * 0.33 + ph) * 0.35 * dt;
        let dx = P[i] - C.tx, dz = P[i + 2] - C.tz;
        if (dx > 25) P[i] -= 50; else if (dx < -25) P[i] += 50;
        if (dz > 25) P[i + 2] -= 50; else if (dz < -25) P[i + 2] += 50;
        const gy = T.height(P[i], P[i + 2]);
        if (P[i + 1] < gy + 0.3 || P[i + 1] > gy + 9) P[i + 1] = gy + 0.5 + Math.random() * 6;
        // kameraya çok yaklaşan zerre ekranda dev bir kare olur: uzağa taşı
        const cp = this.camera.position;
        if ((P[i] - cp.x) ** 2 + (P[i + 1] - cp.y) ** 2 + (P[i + 2] - cp.z) ** 2 < 36) { P[i] = C.tx + (Math.random() - 0.5) * 50; P[i + 2] = C.tz + (Math.random() - 0.5) * 50; }
      }
      M.mesh.geometry.attributes.position.needsUpdate = true;
      M.mesh.material.color.setHex(this.desert > 0.5 ? 0xffe2b0 : 0xfff6d8);
      M.mesh.material.size = this.desert > 0.5 ? 0.16 : 0.22;
    }
    makeDustTex() {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    }

    resize() {
      const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
      this.renderer.setSize(w, h, false);
      if (this.post) this.post.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.fov = w < h ? 56 : 46;
      this.camera.updateProjectionMatrix();
      this.W = w; this.H = h;
    }

    // ---------------- sabit varlıklar ----------------
    buildStatics() {
      const W = this.world;
      for (const n of W.npcs) {
        if (n.role === 'kapi') {
          this.ents.set(n.id, { id: n.id, kind: 'npc', model: null, h: 3.5 });
        } else {
          const md = this.npcModel(n);
          md.obj.position.set(n.x, n.y, n.z);
          md.obj.rotation.y = n.rot;
          this.scene.add(md.obj);
          this.ents.set(n.id, { id: n.id, kind: 'npc', model: md, anim: this.newAnim(), h: 2.0 });
        }
        this.addLabel(n.id, n.name === n.title ? `<b>${n.name}</b>` : `<b>${n.name}</b><span>${n.title}</span>`, 'npc');
      }
      for (const s of this.world_.signs) this.addLabel('sign' + s.x, s.text, 'sign', { x: s.x, y: s.y, z: s.z });
      this.rebuildPlayer();
    }
    // kılıç izi: vuruş sırasında bıçak ucunun çizdiği parlak şerit
    initTrail() {
      const N = 14, geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
      const idx = [];
      for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.frustumCulled = false; m.visible = false;
      this.scene.add(m);
      this.trail = { mesh: m, N, samples: [], col: new THREE.Color(), v1: new THREE.Vector3(), v2: new THREE.Vector3() };
    }
    updateTrail(rec) {
      const sw = rec.model.sword, Tr = this.trail;
      if (!sw || !Tr) return;
      const a = rec.anim;
      const active = !this.world.player.dead && ((a.swing >= 0.11 && a.swing <= 0.36) || (a.spin != null && a.spin >= 0));
      rec.model.obj.updateMatrixWorld(true);
      const tip = sw.group.localToWorld(Tr.v1.set(0, sw.tipY, 0));
      const base = sw.group.localToWorld(Tr.v2.set(0, sw.seatY + sw.len * 0.3, 0));
      Tr.samples.push({ tx: tip.x, ty: tip.y, tz: tip.z, bx: base.x, by: base.y, bz: base.z, a: active ? 1 : 0 });
      if (Tr.samples.length > Tr.N) Tr.samples.shift();
      const S = Tr.samples, pos = Tr.mesh.geometry.attributes.position, col = Tr.mesh.geometry.attributes.color;
      let any = false;
      Tr.col.setHex(sw.trailColor);
      for (let i = 0; i < Tr.N; i++) {
        const s = S[Math.max(0, i - (Tr.N - S.length))];
        const k = i / (Tr.N - 1), f = s.a * k * k * sw.trailI;
        if (f > 0.01) any = true;
        pos.setXYZ(i * 2, s.tx, s.ty, s.tz); pos.setXYZ(i * 2 + 1, s.bx, s.by, s.bz);
        col.setXYZ(i * 2, Tr.col.r * f, Tr.col.g * f, Tr.col.b * f);
        col.setXYZ(i * 2 + 1, Tr.col.r * f * 0.12, Tr.col.g * f * 0.12, Tr.col.b * f * 0.12);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
      Tr.mesh.visible = any;
    }
    newAnim() { return { phase: Math.random() * 6, blend: 0, swing: -1, cast: -1, die: -1, hit: -1, idle: Math.random() * 6 }; }

    // ---------------- karakterler: modüler avatar ----------------
    npcModel(n) {
      const md = KY.Avatar.build({ g: n.g || 'm', look: { skin: n.g === 'f' ? 1 : 0, hair: n.g === 'f' ? 0 : 0, beard: n.look.beard }, npc: n.look, scale: 1.0 });
      md.dress({}, { noShadow: false });
      return md;
    }
    mobHuman(m) {
      const L = m.def.look;
      const md = KY.Avatar.build({ g: 'm', look: { skin: 2, hair2: 0 }, npc: Object.assign({}, L, { weapon: null }), scale: m.def.size });
      md.dress({ weapon: { id: m.type === 'yagmaci' ? 'w3' : 'w2', plus: 0 } }, { noSprites: true });
      return md;
    }
    rebuildPlayer() {
      const p = this.world.player;
      const old = this.ents.get('player');
      const lk = p.look || { g: 'f' };
      const sig = (lk.g || 'f') + '|' + (lk.hair || 0) + '|' + (lk.skin || 0) + '|' + (lk.hair2 || 0);
      // aynı gövde: sadece giysiyi değiştir (iskelet ve animasyon sürer)
      if (old && old.model && old.model.kind === 'avatar' && old.sig === sig) {
        old.model.dress(p.eq);
        return;
      }
      if (old && old.model) this.scene.remove(old.model.obj);
      const md = KY.Avatar.build({ g: lk.g, look: lk });
      md.dress(p.eq);
      md.obj.position.set(p.x, p.y, p.z);
      md.obj.rotation.y = old && old.model ? old.model.obj.rotation.y : p.rot;
      this.scene.add(md.obj);
      const rec = { id: 'player', kind: 'player', model: md, anim: old ? old.anim : this.newAnim(), h: 2.0, sig };
      this.ents.set('player', rec);
      if (p.dead) rec.anim.die = 5;
    }

    // ---------------- etiketler ----------------
    addLabel(id, html, cls, fixed) {
      if (!this.labelLayer) return;
      const el = document.createElement('div');
      el.className = 'wlabel ' + cls;
      el.innerHTML = html;
      this.labelLayer.appendChild(el);
      this.labels.set(id, { el, fixed, cls });
      return el;
    }
    removeLabel(id) { const L = this.labels.get(id); if (L) { L.el.remove(); this.labels.delete(id); } }
    toScreen(x, y, z) {
      V.set(x, y, z).project(this.camera);
      if (V.z > 1 || V.z < -1) return null;
      return { x: (V.x + 1) / 2 * this.W, y: (1 - V.y) / 2 * this.H };
    }
    updateLabels() {
      const p = this.world.player;
      for (const [id, L] of this.labels) {
        let x, y, z;
        if (L.fixed) { x = L.fixed.x; y = L.fixed.y; z = L.fixed.z; }
        else {
          const e = this.world.getEnt(id);
          if (!e || e.dead) { L.el.style.display = 'none'; continue; }
          const rec = this.ents.get(id);
          x = e.x; z = e.z; y = e.y + (rec ? rec.h : 2) + 0.35;
          if (L.bar) L.bar.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
        }
        const far = Math.hypot(x - p.x, z - p.z) > (L.cls === 'sign' ? 40 : 55);
        const s = far ? null : this.toScreen(x, y, z);
        if (!s || s.x < -80 || s.x > this.W + 80 || s.y < -40 || s.y > this.H + 40) { L.el.style.display = 'none'; continue; }
        L.el.style.display = '';
        L.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
    }
    floatText(x, y, z, text, cls) {
      if (!this.fxLayer) return;
      if (this.floats.length > 40) { const f = this.floats.shift(); f.el.remove(); }
      const el = document.createElement('div');
      el.className = 'ftext ' + (cls || '');
      el.textContent = text;
      this.fxLayer.appendChild(el);
      this.floats.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z: z + (Math.random() - 0.5) * 0.6, t: 0, dur: cls && cls.indexOf('big') >= 0 ? 1.6 : 1.05 });
    }
    updateFloats(dt) {
      for (let k = this.floats.length - 1; k >= 0; k--) {
        const f = this.floats[k];
        f.t += dt;
        if (f.t >= f.dur) { f.el.remove(); this.floats.splice(k, 1); continue; }
        const s = this.toScreen(f.x, f.y + f.t * 1.4, f.z);
        if (!s) { f.el.style.opacity = 0; continue; }
        const a = f.t < 0.1 ? f.t / 0.1 : 1 - Math.max(0, (f.t - f.dur * 0.6) / (f.dur * 0.4));
        const sc = f.t < 0.12 ? 1.35 - f.t * 2.5 : 1;
        f.el.style.opacity = a.toFixed(2);
        f.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
      }
    }

    // ---------------- varlık senkronu ----------------
    ensureMob(m) {
      let rec = this.ents.get(m.id);
      if (rec) return rec;
      const md = m.def.model === 'human' ? this.mobHuman(m) : Mo.build(m.def);
      md.obj.position.set(m.x, m.y, m.z);
      md.obj.rotation.y = m.rot;
      this.scene.add(md.obj);
      rec = { id: m.id, kind: 'mob', model: md, anim: this.newAnim(), h: md.height };
      if (m.dead) { rec.anim.die = 10; md.obj.visible = false; }
      this.ents.set(m.id, rec);
      if (m.def.unique) this.addLabel(m.id, `<b>${m.name}</b><span>Seviye ${m.lv} · Efsanevi</span>`, 'unique');
      if (m.ambush) this.addLabel(m.id, `<b>${m.name}</b>`, 'hostile');
      return rec;
    }
    ensurePet(pe) {
      let rec = this.ents.get(pe.id);
      const form = pe.form || 0;
      if (rec && rec.form === form && rec.species === pe.species) return rec;
      const keepRot = rec ? rec.model.obj.rotation.y : pe.rot;
      if (rec) this.removeEnt(pe.id);
      const md = Mo.pet(pe.species, form);
      md.obj.position.set(pe.x, pe.y + md.fly, pe.z);
      md.obj.rotation.y = keepRot;
      this.scene.add(md.obj);
      rec = { id: pe.id, kind: 'pet', model: md, anim: this.newAnim(), h: md.height + md.fly + 0.25, species: pe.species, form };
      if (md.final) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: md.glowCol || 0xffd46b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
        sp.scale.setScalar(md.kind === 'bird' ? 1.6 : 2.2); sp.position.y = md.kind === 'bird' ? 0 : 0.6;
        md.obj.add(sp); rec.glow = sp;
      }
      this.ents.set(pe.id, rec);
      const fight = pe.ptype === 'fight';
      const el = this.addLabel(pe.id, `<b></b>${fight ? '<i class="hpbar"><i></i></i>' : ''}`, 'pet' + (fight ? ' fight' : ''));
      if (el) { const L = this.labels.get(pe.id); L.key = ''; if (fight) L.pbar = el.querySelector('.hpbar i'); }
      return rec;
    }
    ensureCaravan(c) {
      let rec = this.ents.get('caravan');
      if (rec) return rec;
      const md = Mo.camel(true);
      md.obj.position.set(c.x, c.y, c.z);
      this.scene.add(md.obj);
      rec = { id: 'caravan', kind: 'caravan', model: md, anim: this.newAnim(), h: md.height + 0.4 };
      this.ents.set('caravan', rec);
      const el = this.addLabel('caravan', '<b>Kervan</b><i class="hpbar"><i></i></i>', 'caravan');
      this.labels.get('caravan').bar = el.querySelector('.hpbar i');
      return rec;
    }
    ensureLoot(L) {
      let rec = this.ents.get(L.id);
      if (rec) return rec;
      const g = new THREE.Group();
      if (L.gold) {
        for (let k = 0; k < 3; k++) {
          const c = new THREE.Mesh(Mo.cylG(0.16, 0.16, 0.05, 8), Mo.mat(0xe7b93a));
          c.position.set((k - 1) * 0.12, 0.05 + k * 0.05, (k % 2) * 0.1); c.rotation.z = (k - 1) * 0.2; c.castShadow = true; g.add(c);
        }
      } else {
        const it = I[L.items[0][0]];
        const col = it.type === 'weapon' || it.type === 'armor' ? 0x6b3a8a : it.id === 'toz' ? 0x3f7fd6 : 0x8a5a36;
        const bag = new THREE.Mesh(Mo.boxG(0.34, 0.3, 0.3), Mo.mat(col)); bag.position.y = 0.17; bag.castShadow = true; g.add(bag);
        const tie = new THREE.Mesh(Mo.boxG(0.2, 0.08, 0.2), Mo.mat(0xe0b44a)); tie.position.y = 0.35; g.add(tie);
        if (L.rare) {
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3.2, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xc26bff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
          beam.position.y = 1.6; g.add(beam);
        }
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: L.gold ? 0xffd46b : L.rare ? 0xd08bff : 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
      sp.scale.setScalar(0.9); sp.position.y = 0.25; g.add(sp);
      g.position.set(L.x, L.y, L.z);
      this.scene.add(g);
      rec = { id: L.id, kind: 'loot', model: { obj: g }, anim: { t: Math.random() * 6 }, h: 0.6 };
      this.ents.set(L.id, rec);
      return rec;
    }
    removeEnt(id) {
      const rec = this.ents.get(id);
      if (!rec) return;
      if (rec.model) this.scene.remove(rec.model.obj);
      this.ents.delete(id);
      this.removeLabel(id);
    }

    // ---------------- olaylar ----------------
    handle(events) {
      const W = this.world;
      for (const e of events) {
        const ent = e.id ? W.getEnt(e.id) : null;
        const rec = e.id ? this.ents.get(e.id) : null;
        switch (e.type) {
          case 'dmg': {
            if (!ent) break;
            const h = rec ? rec.h : 1.6;
            const cls = e.on === 'player' ? 'dmg-in' : e.on === 'caravan' ? 'dmg-car' : e.on === 'pet' ? 'dmg-pet' : e.by === 'pet' ? 'petdmg' : (e.kind === 'burn' ? 'burn' : e.kind === 'mag' ? 'mag' : 'phys');
            this.floatText(ent.x, ent.y + h * 0.9, ent.z, (e.crit ? '' : '') + e.v, cls + (e.crit ? ' crit' : ''));
            if (rec && rec.anim) rec.anim.hit = 0;
            if (e.on === 'mob') {
              const col = e.kind === 'mag' || e.kind === 'burn' ? 0xff8a2a : 0xfff1c4;
              this.pGlow.burst(ent.x, ent.y + h * 0.55, ent.z, e.crit ? 10 : 5, { color: col, size: e.crit ? 0.5 : 0.35, speed: 4, life: 0.35, g: 6 });
            } else if (e.on === 'player') {
              this.pGlow.burst(ent.x, ent.y + 1.1, ent.z, 4, { color: 0xff5040, size: 0.3, speed: 3, life: 0.3, g: 6 });
            }
            break;
          }
          case 'heal':
            if (ent && e.v > 0) this.floatText(ent.x, ent.y + 2.1, ent.z, '+' + e.v, e.what === 'hp' ? 'heal' : 'mana');
            break;
          case 'float':
            this.floatText(e.x, e.y, e.z, e.text, e.cls);
            break;
          case 'swing': if (rec && rec.anim) rec.anim.swing = 0; break;
          case 'petSummon': {
            const pe = W.getEnt(e.id);
            if (pe) this.pGlow.burst(pe.x, pe.y + 0.6, pe.z, 22, { color: pe.ptype === 'fight' ? 0xffc46b : 0x9df0d0, size: 0.4, speed: 3, life: 0.8, lift: 2 });
            break;
          }
          case 'petDismiss': case 'petBlink': {
            const r2 = this.ents.get(e.id);
            if (r2) { const o = r2.model.obj.position; this.pGlow.burst(o.x, o.y + 0.5, o.z, 16, { color: 0xe6f1ff, size: 0.35, speed: 2.5, life: 0.6, lift: 1.5 }); }
            if (e.type === 'petDismiss') this.removeEnt(e.id);
            break;
          }
          case 'petDied': {
            const r2 = this.ents.get(e.id);
            const y = r2 ? r2.model.obj.position.y : T.groundY(e.x, e.z);
            this.pDust.burst(e.x, y + 0.4, e.z, 12, { color: 0x9a8f84, size: 0.8, size1: 1.8, speed: 2, life: 1, alpha: 0.55, drag: 2 });
            this.floatText(e.x, y + 1.4, e.z, 'Hayvanın düştü', 'dmg-in');
            break;
          }
          case 'petPick': this.pGlow.burst(e.x, T.groundY(e.x, e.z) + 0.4, e.z, 10, { color: 0xffd46b, size: 0.3, speed: 2, life: 0.5, lift: 2 }); if (rec) rec.anim.swing = 0; break;
          case 'petLevel': case 'petEvolve': {
            const pe = W.getEnt(e.id);
            if (!pe) break;
            const r2 = this.ents.get(e.id), fy = r2 ? r2.model.fly : 0;
            this.pGlow.burst(pe.x, pe.y + fy + 0.6, pe.z, e.type === 'petEvolve' ? 50 : 20, { color: e.type === 'petEvolve' ? 0xcfa6ff : 0xffd46b, size: 0.45, speed: e.type === 'petEvolve' ? 5 : 3, life: 1, lift: 2.5, g: 2 });
            this.floatText(pe.x, pe.y + fy + 1.8, pe.z, e.type === 'petEvolve' ? e.to.toUpperCase() : 'SEVİYE ' + e.lv, e.type === 'petEvolve' ? 'lvl big evo' : 'lvl');
            break;
          }
          case 'cast': this.onCast(e); break;
          case 'projectile': this.addProjectile(e.id); break;
          case 'hit': this.onProjectileHit(e); break;
          case 'fx': if (e.kind === 'flameRing') this.fxFlameRing(e.x, e.z, e.r); break;
          case 'die':
            if (rec && rec.anim) { rec.anim.die = 0; }
            if (ent) this.pDust.burst(ent.x, ent.y + 0.4, ent.z, 8, { color: 0xc9b38a, size: 0.9, size1: 1.8, speed: 2, life: 0.9, alpha: 0.5, drag: 2 });
            if (this.world.player.target === e.id) this.selRing.visible = false;
            break;
          case 'respawnMob':
            if (rec) { rec.anim.die = -1; rec.model.obj.visible = true; this.resetPose(rec); }
            break;
          case 'remove': this.removeEnt(e.id); break;
          case 'lootGone': {
            const r2 = this.ents.get(e.id);
            if (r2 && e.picked) { const o = r2.model.obj.position; this.pGlow.burst(o.x, o.y + 0.4, o.z, 8, { color: 0xffd46b, size: 0.3, speed: 2.5, life: 0.5, lift: 2 }); }
            this.removeEnt(e.id);
            break;
          }
          case 'levelup': this.fxLevelUp(); break;
          case 'playerDied': { const r = this.ents.get('player'); if (r) r.anim.die = 0; break; }
          case 'respawn': case 'teleport': {
            const r = this.ents.get('player'); if (r) { r.anim.die = -1; this.resetPose(r); }
            const p = W.player;
            this.cam.tx = p.x; this.cam.ty = p.y; this.cam.tz = p.z;
            this.pGlow.burst(p.x, p.y + 1, p.z, 30, { color: 0x7fe0d0, size: 0.5, speed: 4, life: 0.9, lift: 2 });
            break;
          }
          case 'moveMarker':
            this.marker.position.set(e.x, T.groundY(e.x, e.z) + 0.08, e.z);
            this.marker.visible = true; this.markerT = 0;
            break;
          case 'target': this.selTarget = e.id; break;
          case 'telegraph': this.fxTelegraph(e); break;
          case 'slam': this.fxSlam(e); break;
          case 'enhance': {
            this.rebuildPlayer();
            const p = W.player;
            if (e.ok) this.pGlow.burst(p.x, p.y + 1.3, p.z, 28, { color: plusGlow(e.plus) || 0xffd46b, size: 0.45, speed: 3.5, life: 0.9, lift: 1.5 });
            else this.pDust.burst(p.x, p.y + 1.3, p.z, 12, { color: 0x6b6660, size: 0.7, size1: 1.6, speed: 1.5, life: 1.1, alpha: 0.6, drag: 1.5 });
            break;
          }
          case 'equip': this.rebuildPlayer(); break;
          case 'caravanLost': case 'caravanDone': {
            const r = this.ents.get('caravan');
            if (r) {
              const o = r.model.obj.position;
              if (e.type === 'caravanLost') this.pDust.burst(o.x, o.y + 1, o.z, 14, { color: 0xb59a74, size: 1, size1: 2.2, speed: 2.5, life: 1.2, alpha: 0.6, drag: 1.5 });
              else this.pGlow.burst(o.x, o.y + 1.5, o.z, 20, { color: 0xffd46b, size: 0.4, speed: 3, life: 0.8, lift: 2 });
            }
            this.removeEnt('caravan');
            break;
          }
          case 'potion': {
            const p = W.player;
            this.pGlow.burst(p.x, p.y + 1, p.z, 8, { color: e.kind === 'hp' ? 0xff6a5a : 0x6aa8ff, size: 0.3, speed: 1.5, life: 0.7, lift: 2.5 });
            break;
          }
          case 'aggro':
            if (ent) this.floatText(ent.x, ent.y + (rec ? rec.h : 1.5) + 0.6, ent.z, '!', 'aggro');
            break;
        }
      }
    }
    resetPose(rec) {
      const m = rec.model;
      if (!m) return;
      if (m.kind === 'avatar') { m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); return; }
      m.root.rotation.set(0, 0, 0); m.root.position.set(0, 0, 0);
      const s = m.kind === 'golem' ? m.size * 0.75 : (m.size || (m.kind === 'human' ? m.root.scale.x : 1));
      m.root.scale.setScalar(s || 1);
    }

    // ---------------- yetenek efektleri ----------------
    onCast(e) {
      const p = this.world.player, rec = this.ents.get('player');
      if (rec) rec.anim[e.skill === 'yarma' || e.skill === 'kasirga' ? 'swing' : 'cast'] = 0;
      if (e.skill === 'kasirga') { rec.anim.spin = 0; }
      const tg = e.target ? this.world.getEnt(e.target) : null;
      switch (e.skill) {
        case 'yarma': this.fxSlash(p, tg); break;
        case 'kasirga': this.fxWhirl(p); break;
        case 'demir': this.fxShield(p); break;
        case 'sifa': this.fxHeal(p); break;
        case 'atesTopu': this.pGlow.burst(p.x, p.y + 1.4, p.z, 6, { color: 0xffa040, size: 0.35, speed: 1.5, life: 0.4 }); break;
        case 'alevHalka': if (tg) this.pGlow.burst(p.x, p.y + 1.6, p.z, 8, { color: 0xff7a2a, size: 0.35, speed: 1.5, life: 0.5, lift: 1 }); break;
      }
    }
    addTimed(mesh, dur, fn) { this.scene.add(mesh); this.tfx.push({ mesh, t: 0, dur, fn }); }
    fxSlash(p, tg) {
      const g = new THREE.RingGeometry(0.9, 1.5, 20, 1, 0, Math.PI * 0.95);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      const rot = tg ? Math.atan2(tg.x - p.x, tg.z - p.z) : p.rot;
      m.position.set(p.x + Math.sin(rot) * 1.1, p.y + 1.1, p.z + Math.cos(rot) * 1.1);
      m.rotation.set(0, rot + Math.PI / 2, 0.6);
      this.addTimed(m, 0.32, (mm, t) => { mm.material.opacity = 0.9 * (1 - t); mm.rotation.z = 0.6 - t * 2.4; mm.scale.setScalar(1 + t * 0.4); });
    }
    fxWhirl(p) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.14, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe6f1ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = Math.PI / 2;
      m.position.set(p.x, p.y + 0.9, p.z);
      this.addTimed(m, 0.55, (mm, t) => { mm.scale.setScalar(1 + t * 2.6); mm.material.opacity = 0.8 * (1 - t); mm.rotation.z += 0.5; });
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        this.pDust.emit(p.x + Math.cos(a) * 1.5, p.y + 0.3, p.z + Math.sin(a) * 1.5, { vx: Math.cos(a) * 5, vz: Math.sin(a) * 5, vy: 0.6, color: 0xc9b38a, size: 0.8, size1: 1.8, life: 0.6, alpha: 0.5, drag: 3 });
      }
    }
    fxShield(p) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(p.x, p.y + 1.2, p.z);
      this.addTimed(m, 0.8, (mm, t) => { mm.material.opacity = 0.5 * (1 - t); mm.scale.set(1 + t * 0.3, 1 - t * 0.2, 1 + t * 0.3); mm.position.set(this.world.player.x, this.world.player.y + 1.2, this.world.player.z); });
      this.pGlow.burst(p.x, p.y + 1, p.z, 16, { color: 0x9fc4ff, size: 0.35, speed: 2.5, life: 0.7, lift: 1 });
    }
    fxHeal(p) {
      for (let k = 0; k < 26; k++) {
        const a = Math.random() * 6.28, r = 0.4 + Math.random() * 0.8;
        this.pGlow.emit(p.x + Math.cos(a) * r, p.y + 0.2 + Math.random() * 0.6, p.z + Math.sin(a) * r, { vy: 1.5 + Math.random() * 1.5, color: k % 3 ? 0x9df08a : 0xffe08a, size: 0.35, size1: 0.05, life: 1.1 });
      }
      const g = new THREE.RingGeometry(0.3, 0.55, 28); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x9df08a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(p.x, p.y + 0.1, p.z);
      this.addTimed(m, 0.7, (mm, t) => { mm.scale.setScalar(1 + t * 3.5); mm.material.opacity = 0.8 * (1 - t); });
    }
    fxFlameRing(x, z, r) {
      const y = T.groundY(x, z);
      const g = new THREE.RingGeometry(r * 0.25, r, 36); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(x, y + 0.15, z);
      this.addTimed(m, 0.9, (mm, t) => { mm.material.opacity = 0.55 * (1 - t); mm.scale.setScalar(0.6 + t * 0.5); });
      for (let k = 0; k < 34; k++) {
        const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r;
        this.pGlow.emit(x + Math.cos(a) * rr, y + 0.3, z + Math.sin(a) * rr, { vy: 2 + Math.random() * 3, color: k % 2 ? 0xff7a2a : 0xffc040, size: 0.7, size1: 0.1, life: 0.8 + Math.random() * 0.4 });
      }
    }
    addProjectile(id) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(Mo.icoG(0.22, 1), Mo.mat(0xffe08a, true)));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(1.6); g.add(sp);
      this.scene.add(g);
      this.proj.set(id, g);
      const pr = this.world.projectiles.find(q => q.id === id);
      if (pr) g.position.set(pr.x, pr.y, pr.z);
    }
    onProjectileHit(e) {
      const g = this.proj.get(e.id);
      if (g) { this.scene.remove(g); this.proj.delete(e.id); }
      if (!e.miss) {
        this.pGlow.burst(e.x, e.y, e.z, 16, { color: 0xff8a2a, size: 0.6, size1: 0.1, speed: 5, life: 0.45, g: 3 });
        this.pGlow.burst(e.x, e.y, e.z, 6, { color: 0xffe08a, size: 0.9, size1: 0.2, speed: 1.5, life: 0.3 });
      }
    }
    fxLevelUp() {
      const p = this.world.player;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd46b, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(p.x, p.y + 4.5, p.z);
      this.addTimed(m, 1.6, (mm, t) => { mm.material.opacity = 0.55 * (1 - t); mm.scale.set(1 - t * 0.5, 1, 1 - t * 0.5); mm.position.set(this.world.player.x, this.world.player.y + 4.5, this.world.player.z); });
      this.pGlow.burst(p.x, p.y + 1, p.z, 40, { color: 0xffd46b, size: 0.45, speed: 5, life: 1.1, lift: 3, g: 2 });
      this.floatText(p.x, p.y + 2.6, p.z, 'SEVİYE ' + p.lv, 'lvl big');
    }
    fxTelegraph(e) {
      const y = T.groundY(e.x, e.z) + 0.12;
      const grp = new THREE.Group();
      const c1 = new THREE.CircleGeometry(e.r, 40); c1.rotateX(-Math.PI / 2);
      const base = new THREE.Mesh(c1, new THREE.MeshBasicMaterial({ color: 0xd8321f, transparent: true, opacity: 0.22, depthWrite: false }));
      const fill = new THREE.Mesh(c1, new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.35, depthWrite: false }));
      const rg = new THREE.RingGeometry(e.r * 0.95, e.r, 48); rg.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0.9, depthWrite: false }));
      fill.position.y = 0.01; ring.position.y = 0.02;
      grp.add(base, fill, ring);
      grp.position.set(e.x, y, e.z);
      this.addTimed(grp, e.dur, (g, t) => { fill.scale.setScalar(Math.max(0.01, t)); });
    }
    fxSlam(e) {
      const y = T.groundY(e.x, e.z);
      const g = new THREE.RingGeometry(e.r * 0.8, e.r, 40); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(e.x, y + 0.2, e.z);
      this.addTimed(m, 0.5, (mm, t) => { mm.scale.setScalar(1 + t * 0.6); mm.material.opacity = 0.8 * (1 - t); });
      this.pDust.burst(e.x, y + 0.4, e.z, 18, { color: 0xb59a74, size: 1.2, size1: 2.6, speed: 5, life: 0.9, alpha: 0.55, drag: 2.5, up: 0.4 });
      const p = this.world.player;
      if (Math.hypot(p.x - e.x, p.z - e.z) < 25) this.shake = 0.45;
    }

    // ---------------- animasyon ----------------
    animate(rec, e, dt) {
      const md = rec.model, a = rec.anim;
      if (!md || !a) return;
      a.blend = lerp(a.blend, e.moving ? 1 : 0, 1 - Math.exp(-dt * 10));
      const speed = e.kind === 'mob' ? e.def.speed : e.kind === 'caravan' ? 6 : e.kind === 'pet' ? e.def.speed * 0.9 : 7;
      a.phase += dt * (e.moving ? speed * 1.55 : 0);
      a.idle += dt;
      if (a.swing >= 0) a.swing += dt;
      if (a.cast >= 0) a.cast += dt;
      if (a.hit >= 0) a.hit += dt;
      if (a.swing > 0.6) a.swing = -1;
      if (a.cast > 0.6) a.cast = -1;
      if (a.hit > 0.25) a.hit = -1;
      const s = Math.sin(a.phase), c = Math.cos(a.phase), b = a.blend;
      if (md.kind === 'avatar') {
        if (a.die >= 0) a.die += dt;
        KY.Avatar.animate(md, a, e, dt);
        if (rec.kind === 'mob' && a.die > 2.4) { md.root.position.y -= Math.min(1.5, (a.die - 2.4) * 1.2); if (a.die > 3.6) md.obj.visible = false; }
        return;
      }
      if (a.die >= 0) { a.die += dt; this.animDeath(rec, e, a); return; }
      if (md.kind === 'human') {
        md.legL.rotation.x = s * 0.75 * b;
        md.legR.rotation.x = -s * 0.75 * b;
        md.armL.rotation.x = -s * 0.55 * b;
        md.armR.rotation.x = s * 0.45 * b;
        md.armL.rotation.z = -0.08; md.armR.rotation.z = 0.08;
        md.hips.position.y = 0.92 + Math.abs(c) * 0.06 * b + Math.sin(a.idle * 2) * 0.01;
        md.torso.rotation.y = 0; md.torso.rotation.x = 0.06 * b;
        md.head.rotation.x = 0;
        if (a.swing >= 0) {
          const t = a.swing;
          let r;
          if (t < 0.13) r = lerp(0, -2.5, t / 0.13);
          else if (t < 0.3) r = lerp(-2.5, 0.7, (t - 0.13) / 0.17);
          else r = lerp(0.7, 0, Math.min(1, (t - 0.3) / 0.3));
          md.armR.rotation.x = r;
          md.armR.rotation.z = 0.25;
          md.torso.rotation.y = t < 0.3 ? lerp(0.4, -0.35, t / 0.3) : lerp(-0.35, 0, Math.min(1, (t - 0.3) / 0.3));
          if (a.spin != null && a.spin >= 0) { a.spin += dt; md.root.rotation.y = Math.min(1, a.spin / 0.45) * Math.PI * 2; if (a.spin > 0.45) { a.spin = -1; md.root.rotation.y = 0; } }
        }
        if (a.cast >= 0) {
          const t = Math.min(1, a.cast / 0.25), back = a.cast > 0.4 ? 1 - (a.cast - 0.4) / 0.2 : 1;
          md.armL.rotation.x = -1.5 * t * back; md.armR.rotation.x = -1.3 * t * back;
          md.armL.rotation.z = -0.3 * t * back;
        }
        if (rec.kind === 'npc') { md.head.rotation.y = Math.sin(a.idle * 0.5) * 0.3; md.armL.rotation.x = Math.sin(a.idle * 1.3) * 0.08; }
      } else if (md.kind === 'quad') {
        const L = md.legs;
        L[0].rotation.x = s * 0.7 * b; L[3].rotation.x = s * 0.7 * b;
        L[1].rotation.x = -s * 0.7 * b; L[2].rotation.x = -s * 0.7 * b;
        md.body.position.y = md.body.userData.y0 == null ? (md.body.userData.y0 = md.body.position.y) : md.body.userData.y0;
        md.body.position.y += Math.abs(c) * 0.05 * b + Math.sin(a.idle * 2.2) * 0.01;
        md.body.rotation.x = 0;
        if (md.tail) md.tail.rotation.y = Math.sin(a.idle * (b > 0.5 ? 9 : 3)) * 0.35;
        md.head.position.z = md.head.userData.z0 == null ? (md.head.userData.z0 = md.head.position.z) : md.head.userData.z0;
        md.head.rotation.x = md.neck ? -0.55 : 0;
        if (!e.moving && !md.neck) md.head.rotation.x += Math.sin(a.idle * 0.7) * 0.08 + 0.05;
        if (a.swing >= 0) {
          const t = a.swing, k = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.3);
          md.head.position.z += 0.35 * k; md.head.rotation.x += 0.35 * k - 0.2 * (t < 0.15 ? 1 - k : 0);
          md.body.rotation.x = 0.12 * k;
        }
      } else if (md.kind === 'scorpion') {
        md.legs.forEach((l, k) => { l.rotation.x = Math.sin(a.phase * 1.6 + k * 1.3) * 0.4 * b; });
        md.claws.forEach((cl, k) => { cl.rotation.x = Math.sin(a.idle * 2 + k) * 0.1; });
        md.tail.rotation.x = Math.sin(a.idle * 1.5) * 0.08;
        md.body.position.y = 0.38 + Math.sin(a.idle * 3) * 0.01;
        if (a.swing >= 0) {
          const t = a.swing, k = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 0.3);
          md.tail.rotation.x = -0.1 + 0.9 * k;
          md.segs[1].rotation.x = 0.55 + 0.3 * k;
          md.claws.forEach(cl => cl.rotation.x = -0.3 * k);
        } else md.segs[1].rotation.x = 0.55;
      } else if (md.kind === 'bird') {
        const fq = e.moving ? 15 : 8, fl = Math.sin(a.idle * fq) * (e.moving ? 0.8 : 0.45);
        md.wingL.rotation.z = fl; md.wingR.rotation.z = -fl;
        md.tipL.rotation.z = fl * 0.6; md.tipR.rotation.z = -fl * 0.6;
        md.body.rotation.x = e.moving ? 0.22 : 0.04;
        md.tail.rotation.x = Math.sin(a.idle * 2) * 0.12;
        md.head.rotation.y = Math.sin(a.idle * 0.9) * 0.35;
        md.root.position.y = 0;
        if (a.swing >= 0) {
          // pike: aşağı dalış, kanatlar geriye
          const t = a.swing, k = t < 0.2 ? t / 0.2 : Math.max(0, 1 - (t - 0.2) / 0.3);
          md.root.position.y = -md.fly * 0.8 * k;
          md.body.rotation.x = 0.04 + 0.9 * k;
          md.wingL.rotation.z = fl * (1 - k) - 1.0 * k; md.wingR.rotation.z = -fl * (1 - k) + 1.0 * k;
        }
      } else if (md.kind === 'golem') {
        md.legL.rotation.x = s * 0.4 * b; md.legR.rotation.x = -s * 0.4 * b;
        md.armL.rotation.x = -s * 0.3 * b; md.armR.rotation.x = s * 0.3 * b;
        md.torso.rotation.z = Math.sin(a.phase) * 0.06 * b;
        md.hips.position.y = 1.05 + Math.abs(c) * 0.08 * b;
        if (a.swing >= 0) {
          const t = a.swing;
          const r = t < 0.25 ? lerp(0, -2.6, t / 0.25) : t < 0.4 ? lerp(-2.6, 0.4, (t - 0.25) / 0.15) : lerp(0.4, 0, Math.min(1, (t - 0.4) / 0.2));
          md.armL.rotation.x = r; md.armR.rotation.x = r;
        }
      }
      // vuruş tepkisi
      if (a.hit >= 0 && md.root) {
        const k = Math.sin(a.hit / 0.25 * Math.PI);
        md.root.position.z = -0.12 * k;
      } else if (md.root) md.root.position.z = 0;
    }
    animDeath(rec, e, a) {
      const md = rec.model, t = a.die;
      if (!md.root) return;
      const k = Math.min(1, t / 0.45);
      if (md.kind === 'human') { md.root.rotation.x = -Math.PI / 2 * k; md.root.position.y = 0.15 * k; }
      else if (md.kind === 'quad') { md.root.rotation.z = Math.PI / 2 * k; md.root.position.y = 0; }
      else if (md.kind === 'scorpion') { md.root.rotation.z = Math.PI * k; md.root.position.y = 0.5 * k; }
      else if (md.kind === 'golem') { md.root.scale.y = (md.size * 0.75) * (1 - 0.6 * k); md.root.rotation.x = 0.4 * k; }
      if (rec.kind !== 'player' && t > 2.4) {
        md.root.position.y -= Math.min(1.5, (t - 2.4) * 1.2);
        if (t > 3.6) md.obj.visible = false;
      }
    }

    // ---------------- kare güncellemesi ----------------
    update(dt) {
      this.time += dt;
      const W = this.world, p = W.player;
      // oyuncu
      const prec = this.ents.get('player');
      if (prec) {
        const o = prec.model.obj;
        o.position.set(p.x, p.y, p.z);
        o.rotation.y = angLerp(o.rotation.y, p.rot, 1 - Math.exp(-dt * 14));
        this.animate(prec, p, dt);
        if (prec.model.sword) prec.model.sword.sprites.forEach((g, k) => g.material.opacity = g.userData.base * (0.75 + Math.sin(this.time * 4 + k) * 0.25));
        this.updateTrail(prec);
      }
      const buffed = p.buffs.some(b => b.id === 'demir');
      this.aura.visible = buffed && !p.dead;
      if (buffed) { this.aura.position.set(p.x, p.y + 0.08, p.z); this.aura.rotation.y += dt; this.aura.material.opacity = 0.45 + Math.sin(this.time * 5) * 0.15; }
      // canavarlar
      for (const m of W.mobs.values()) {
        const rec = this.ensureMob(m);
        const o = rec.model.obj;
        const far = Math.hypot(m.x - p.x, m.z - p.z) > 95;
        if (far) { o.visible = false; continue; }
        if (!m.dead || rec.anim.die < 3.6) o.visible = true;
        o.position.set(m.x, m.y, m.z);
        o.rotation.y = angLerp(o.rotation.y, m.rot, 1 - Math.exp(-dt * 10));
        this.animate(rec, m, dt);
      }
      for (const [id, rec] of this.ents) if (rec.kind === 'mob' && !W.mobs.has(id)) this.removeEnt(id);
      // NPC'ler
      for (const n of W.npcs) {
        const rec = this.ents.get(n.id);
        if (rec && rec.model) {
          const want = Math.hypot(p.x - n.x, p.z - n.z) < 7 ? Math.atan2(p.x - n.x, p.z - n.z) : n.rot;
          rec.model.obj.rotation.y = angLerp(rec.model.obj.rotation.y, want, 1 - Math.exp(-dt * 4));
          this.animate(rec, { moving: false, kind: 'npc' }, dt);
        }
      }
      for (const cm of this.world_.camels) {
        cm.head.rotation.x = -0.55 + Math.sin(this.time * 0.6 + cm.obj.position.x) * 0.12;
        if (cm.tail) cm.tail.rotation.y = Math.sin(this.time * 2) * 0.3;
      }
      // hayvanlar
      for (const type of ['grab', 'fight']) {
        const pe = W.pets[type], id = 'pet-' + type;
        if (!pe) { if (this.ents.has(id)) this.removeEnt(id); continue; }
        const rec = this.ensurePet(pe);
        const o = rec.model.obj, fly = rec.model.fly;
        const bob = fly ? Math.sin(this.time * 2.3) * 0.16 : 0;
        o.position.set(pe.x, pe.y + fly + bob, pe.z);
        o.rotation.y = angLerp(o.rotation.y, pe.rot, 1 - Math.exp(-dt * 12));
        this.animate(rec, pe, dt);
        if (rec.glow) rec.glow.material.opacity = 0.3 + Math.sin(this.time * 3) * 0.12;
        const st = pe.slot.pet, L = this.labels.get(id);
        const key = st.name + '|' + st.lv;
        if (L && L.key !== key) { L.key = key; L.el.querySelector('b').textContent = type === 'fight' ? `${st.name} · Sv. ${st.lv}` : st.name; }
        if (L && L.pbar) { const mx = KY.PetUtil.petStats(pe.def, st.lv).maxHp; L.pbar.style.width = Math.max(0, st.hp / mx * 100).toFixed(1) + '%'; }
      }
      // kervan
      if (W.caravan) {
        const c = W.caravan, rec = this.ensureCaravan(c);
        const o = rec.model.obj;
        o.position.set(c.x, c.y, c.z);
        o.rotation.y = angLerp(o.rotation.y, c.rot, 1 - Math.exp(-dt * 8));
        this.animate(rec, c, dt);
        let load = 0; for (const g in c.goods) load += c.goods[g];
        const cap = W.capacity(), packs = rec.model.packs;
        const show = Math.ceil(load / cap * packs.length);
        const cols = Object.keys(c.goods).map(g => ({ ipek: 0xb3372e, cay: 0x6b8a3a, porselen: 0xdfe6ef, baharat: 0xd9772a, tuz: 0xefeae0, kilim: 0x7a2f5a }[g]));
        packs.forEach((pk, k) => { pk.visible = k < show; if (cols.length) pk.material = Mo.mat(cols[k % cols.length]); });
      }
      // ganimet
      for (const L of W.loot.values()) {
        const rec = this.ensureLoot(L);
        rec.anim.t += dt;
        const o = rec.model.obj;
        o.position.y = L.y + 0.08 + Math.sin(rec.anim.t * 3) * 0.06;
        o.rotation.y += dt * 1.2;
      }
      for (const [id, rec] of this.ents) if (rec.kind === 'loot' && !W.loot.has(id)) this.removeEnt(id);
      // mermiler
      for (const pr of W.projectiles) {
        const g = this.proj.get(pr.id);
        if (!g) continue;
        g.position.set(pr.x, pr.y, pr.z);
        g.children[0].rotation.x += dt * 8;
        this.pGlow.emit(pr.x, pr.y, pr.z, { color: Math.random() < 0.5 ? 0xff8a2a : 0xffc040, size: 0.5, size1: 0.05, life: 0.35, vy: 0.4 });
      }
      // seçim halkası
      const tgt = p.target ? W.getEnt(p.target) : null;
      if (tgt && !tgt.dead && (tgt.kind === 'mob' || tgt.kind === 'npc')) {
        this.selRing.visible = true;
        const r = tgt.kind === 'mob' ? Math.max(0.7, tgt.rad * 1.6) : 0.9;
        this.selRing.scale.setScalar(r);
        this.selRing.position.set(tgt.x, T.groundY(tgt.x, tgt.z) + 0.07, tgt.z);
        this.selRing.material.color.setHex(tgt.kind === 'mob' ? 0xe0463a : 0xe7c46a);
        this.selRing.rotation.y += dt * 0.8;
      } else this.selRing.visible = false;
      // tıklama işareti
      if (this.marker.visible) {
        this.markerT += dt;
        const t = this.markerT / 0.6;
        if (t >= 1) this.marker.visible = false;
        else { this.marker.scale.setScalar(lerp(1.2, 0.3, t)); this.marker.material.opacity = 0.9 * (1 - t); }
      }
      // zamanlı efektler
      for (let k = this.tfx.length - 1; k >= 0; k--) {
        const f = this.tfx[k];
        f.t += dt;
        const t = Math.min(1, f.t / f.dur);
        f.fn(f.mesh, t);
        if (f.t >= f.dur) { this.scene.remove(f.mesh); this.tfx.splice(k, 1); }
      }
      // fenerler ve kapılar
      for (const g of this.world_.glows) {
        const f = g.flicker ? 0.85 + Math.sin(this.time * 13 + g.ph) * 0.08 + Math.sin(this.time * 7.3) * 0.07 : 1 + Math.sin(this.time * 1.5 + g.ph) * 0.05;
        g.sp.scale.setScalar(g.base * f);
      }
      for (const pm of this.world_.portals) { pm.material.map.rotation += dt * 0.4; pm.material.opacity = 0.8 + Math.sin(this.time * 2) * 0.15; }
      for (const pm of this.world_.portals) pm.material.map.center.set(0.5, 0.5);
      this.pGlow.update(dt);
      this.pDust.update(dt);
      KY.Gfx.U.uTime.value = this.time;
      this.updateCamera(dt);
      this.updateAtmosphere();
      this.updateMotes(dt);
      this.updateLabels();
      this.updateFloats(dt);
      if (this.usePost) this.post.render(this.scene, this.camera);
      else this.renderer.render(this.scene, this.camera);
    }
    // bölgeye göre sis, gök ve ışık renkleri yumuşakça değişir
    updateAtmosphere() {
      const C = this.cam, e = T.smoothstep(-20, 40, C.tx - T.riverX(C.tz) * 0.5);
      this.desert = e;
      const A = ATM.steppe, B = ATM.desert, U = KY.Gfx.U;
      const mixc = (target, a, b) => target.copy(_ca.setHex(a)).lerp(_cb.setHex(b), e);
      mixc(this.scene.fog.color, A.fog, B.fog);
      mixc(U.uHorizon.value, A.horizon, B.horizon);
      mixc(U.uSkyTop.value, A.top, B.top);
      mixc(this.hemi.color, A.hemiSky, B.hemiSky);
      mixc(this.hemi.groundColor, A.hemiGround, B.hemiGround);
      mixc(this.sun.color, A.sun, B.sun);
      U.uSunCol.value.copy(this.sun.color);
      this.sun.intensity = A.sunI + (B.sunI - A.sunI) * e;
      this.hemi.intensity = A.hemiI + (B.hemiI - A.hemiI) * e;
      this.renderer.setClearColor(U.uHorizon.value);
      if (this.post) this.post.mComp.uniforms.uWarm.value = e;
    }

    updateCamera(dt) {
      const p = this.world.player, C = this.cam;
      let fx = p.x, fy = p.y, fz = p.z;
      if (C.orbit) {
        const tw = T.TOWNS.sarikum;
        C.yaw += dt * 0.06;
        fx = tw.x; fz = tw.z; fy = tw.h;
      }
      const k = 1 - Math.exp(-dt * (C.orbit ? 2 : 9));
      C.tx = lerp(C.tx, fx, k); C.ty = lerp(C.ty, fy + 1.35, k); C.tz = lerp(C.tz, fz, k);
      const dist = C.orbit ? 44 : C.dist, pitch = C.orbit ? 0.4 : C.pitch;
      let cx = C.tx + Math.sin(C.yaw) * Math.cos(pitch) * dist;
      let cz = C.tz + Math.cos(C.yaw) * Math.cos(pitch) * dist;
      let cy = C.ty + Math.sin(pitch) * dist;
      const gy = Math.max(T.height(cx, cz), T.WATER) + 1.6;
      if (cy < gy) cy = gy;
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        const a = this.shake * 0.8;
        cx += (Math.random() - 0.5) * a; cy += (Math.random() - 0.5) * a; cz += (Math.random() - 0.5) * a;
      }
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(C.tx, C.ty, C.tz);
      KY.Gfx.U.uFocus.value.set(p.x, p.y + 1.0, p.z);
      this.world_.sky.position.set(cx, cy, cz);
      this.world_.mountains.position.set(cx, cy - 4, cz);
      // güneş ve gölge kamerası: bakılan yöne biraz ileride ortalanır, texel'e kenetlenir (titremesin)
      const s = this.sun, fwx = -Math.sin(C.yaw), fwz = -Math.cos(C.yaw), ahead = 14 * Math.cos(pitch);
      let ox = C.tx + fwx * ahead, oz = C.tz + fwz * ahead;
      const texel = 88 / s.shadow.mapSize.x;
      ox = Math.round(ox / texel) * texel; oz = Math.round(oz / texel) * texel;
      s.position.set(ox + this.sunDir.x * 120, C.ty + this.sunDir.y * 120, oz + this.sunDir.z * 120);
      s.target.position.set(ox, C.ty, oz);
      s.target.updateMatrixWorld();
    }

    // ---------------- dokunma / fare ----------------
    bindInput() {
      const cv = this.canvas, ptrs = new Map();
      let mode = null, sx = 0, sy = 0, lx = 0, ly = 0, pinch0 = 0, dist0 = 0, downT = 0;
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 1) {
          mode = e.button === 2 || e.button === 1 ? 'rotate' : 'pending';
          sx = lx = e.clientX; sy = ly = e.clientY; downT = performance.now();
        } else if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = this.cam.dist; mode = 'pinch';
        }
      });
      cv.addEventListener('pointermove', e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'pinch' && ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch0 > 0) this.cam.dist = clamp(dist0 * pinch0 / d, 7, 44);
          return;
        }
        if (mode === 'pending' && Math.hypot(e.clientX - sx, e.clientY - sy) > 9) mode = 'rotate';
        if (mode === 'rotate') {
          this.cam.yaw -= (e.clientX - lx) * 0.0085;
          this.cam.pitch = clamp(this.cam.pitch + (e.clientY - ly) * 0.005, 0.22, 1.38);
          if (this.onCamera) this.onCamera();
        }
        lx = e.clientX; ly = e.clientY;
      });
      const up = e => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        if (mode === 'pending' && ptrs.size === 0 && performance.now() - downT < 700) {
          const hit = this.pick(e.clientX, e.clientY);
          if (hit && this.onTap) this.onTap(hit);
        }
        if (ptrs.size === 0) mode = null;
        else if (ptrs.size === 1) { mode = 'rotate'; const v = [...ptrs.values()][0]; lx = v.x; ly = v.y; }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (!ptrs.size) mode = null; });
      cv.addEventListener('wheel', e => { e.preventDefault(); this.cam.dist = clamp(this.cam.dist * (1 + e.deltaY * 0.0012), 7, 44); }, { passive: false });
    }
    pick(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      const W = this.world, p = W.player;
      let best = null, bd = 1e9;
      const test = (e, kind, h, minR) => {
        const mid = this.toScreen(e.x, e.y + h * 0.5, e.z);
        if (!mid) return;
        const top = this.toScreen(e.x, e.y + h, e.z);
        const rad = Math.max(minR, top ? Math.abs(mid.y - top.y) * 1.25 : minR);
        const d = Math.hypot(mid.x - x, mid.y - y);
        if (d < rad && d < bd) { bd = d; best = { type: kind, id: e.id }; }
      };
      for (const m of W.mobs.values()) {
        if (m.dead || Math.hypot(m.x - p.x, m.z - p.z) > 70) continue;
        const rec = this.ents.get(m.id);
        test(m, 'mob', rec ? rec.h : 1.2, 30);
      }
      for (const n of W.npcs) test(n, 'npc', n.role === 'kapi' ? 3.6 : 2.0, 30);
      for (const type of ['grab', 'fight']) {
        const pe = W.pets[type], rec = pe && this.ents.get(pe.id);
        if (pe && rec) test({ id: pe.id, x: pe.x, y: pe.y + rec.model.fly, z: pe.z }, 'pet', rec.model.height + 0.3, 26);
      }
      for (const L of W.loot.values()) test(L, 'loot', 0.8, 26);
      if (best) return best;
      this.raycaster.setFromCamera({ x: x / rect.width * 2 - 1, y: -(y / rect.height) * 2 + 1 }, this.camera);
      const hits = this.raycaster.intersectObjects(this.world_.terrain.children, false);
      if (hits.length) return { type: 'ground', x: hits[0].point.x, z: hits[0].point.z };
      return null;
    }
  }
  return View;
})();
