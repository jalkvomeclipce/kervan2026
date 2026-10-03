/* ============================================================
   KERVAN YOLU — main.js
   Her şeyi birbirine bağlar: dünya, çizim, arayüz, giriş, kayıt,
   döngü. Kayıt: misafirde bu tarayıcı, Google girişinde bulut
   (Firestore) + yerel önbellek; otomatik ve sessiz.
   ============================================================ */
(function () {
  const SAVE_KEY = 'kervanYolu.save.v1', PREF_KEY = 'kervanYolu.prefs.v1', AUTH_KEY = 'kervanYolu.auth.v1';
  const $ = (id) => document.getElementById(id);
  const read = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const drop = (k) => { try { localStorage.removeItem(k); } catch (e) { } };
  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let world, view, ui, saveT = 0, cloudT = 0;
  // hesap: misafir ya da Google
  const Acct = { mode: null, uid: null, name: '', photo: '' };
  const saveKey = () => Acct.mode === 'google' ? SAVE_KEY + '.' + Acct.uid : SAVE_KEY;

  const App = {
    started: false,
    acct: Acct,
    save(manual) {
      if (!world || !App.started) return;
      const data = world.serialize();
      const ok = write(saveKey(), data);
      if (Acct.mode === 'google' && (manual || cloudT <= 0)) {
        cloudT = 30;
        KY.Cloud.save(data).then(r => { if (manual) ui.addLog(r ? 'Buluta kaydedildi.' : 'Bulut kaydı şu an yapılamadı, yerelde saklandı.', r ? 'good' : 'warn'); });
      } else if (manual) ui.addLog(ok ? 'Oyun kaydedildi.' : 'Bu tarayıcıda kayıt yapılamıyor (gizli pencere olabilir).', ok ? 'good' : 'warn');
    },
    admin: true,
    savePrefs() { write(PREF_KEY, { sound: KY.Sfx.on, quality: view.quality, admin: App.admin }); },
    setAdmin(v) { App.admin = !!v; $('adminBtn').hidden = !App.admin; App.savePrefs(); },
    // eski düğme: kaydı sil, karakter oluşturmaya dön
    newGame() { App.started = false; document.body.classList.remove('playing'); $('hud').hidden = true; ui.closePanel(); view.cam.orbit = true; Login.show('create'); },
    enter(save) {
      world = new KY.World(save);
      view.setWorld(world);
      ui.setWorld(world);
      $('death').hidden = true;
      App.begin();
    },
    begin() {
      App.started = true;
      document.body.classList.add('playing');
      $('intro').hidden = true;
      $('hud').hidden = false;
      view.cam.orbit = false;
      KY.Sfx.init();
      ui.banner(world.lastArea, 'area');
      ui.refreshQuest();
      if (world.player.dead) $('death').hidden = false;
      if (world.player.lv === 1 && world.player.xp === 0 && world.quest.i === 0) {
        const touch = matchMedia('(pointer: coarse)').matches;
        ui.addLog(`Hoş geldin, ${world.player.name}.`, 'good');
        ui.addLog(touch ? 'İpucu: yere dokunarak yürü, canavara dokunarak saldır.' : 'İpucu: yere tıklayarak yürü, canavara tıklayarak saldır.', 'good');
        ui.addLog('Tilkiler kasabanın dışında. Mini haritadaki sarı işareti izle.', 'good');
      }
      App.save(false);
    },
    async logout() {
      App.save(false);
      if (Acct.mode === 'google') { try { await KY.Cloud.signOut(); } catch (e) { /* çevrimdışı */ } }
      Acct.mode = null; Acct.uid = null; drop(AUTH_KEY);
      App.started = false; document.body.classList.remove('playing'); $('hud').hidden = true; ui.closePanel(); view.cam.orbit = true;
      Login.show('login');
    },
    // misafir ilerlemesini Google hesabına taşı
    async linkGoogle() {
      if (!KY.Cloud.enabled()) { ui.addLog('Google girişi bu sürümde ayarlanmadı.', 'warn'); return; }
      try {
        const u = await KY.Cloud.signIn();
        if (!u) return;
        Acct.mode = 'google'; Acct.uid = u.uid; Acct.name = u.displayName || u.email || 'Oyuncu'; Acct.photo = u.photoURL || '';
        write(AUTH_KEY, { mode: 'google' });
        cloudT = 0; App.save(true);
        ui.renderPanel();
      } catch (e) { ui.addLog(KY.Cloud.errText(e), 'warn'); }
    }
  };
  window.KervanApp = App;

  // ---------------- giriş, karakter seçimi, karakter oluşturma ----------------
  const Login = {
    step: 'login', save: null, look: { g: 'f', hair: 0, hair2: 0, skin: 0 },
    show(step) {
      this.step = step;
      $('intro').hidden = false;
      document.querySelectorAll('#introBody .step').forEach(s => { s.hidden = s.dataset.step !== step; });
      $('intro').dataset.step = step;
      if (step === 'select') this.fillSelect();
      if (step === 'create') this.fillCreate();
      const f = document.querySelector(`#introBody .step[data-step="${step}"] button, #introBody .step[data-step="${step}"] input`);
      if (f && !matchMedia('(pointer: coarse)').matches) setTimeout(() => f.focus({ preventScroll: true }), 30);
    },
    note(id, t, bad) { const el = $(id); el.textContent = t || ''; el.classList.toggle('bad', !!bad); },
    // yerel ve buluttaki kayıttan yenisini seç
    async loadFor() {
      const local = read(saveKey());
      if (Acct.mode !== 'google') return local;
      let cloud = null;
      try { cloud = await KY.Cloud.load(); } catch (e) { console.warn('bulut okunamadı', e); }
      if (cloud && (!local || (cloud.at || 0) >= (local.at || 0))) { write(saveKey(), cloud); return cloud; }
      return local;
    },
    async afterAuth() {
      this.note('loginNote', 'Kayıt aranıyor…');
      this.save = await this.loadFor();
      this.note('loginNote', '');
      // eski misafir kaydı varsa ve hesapta kayıt yoksa: taşı
      if (!this.save && Acct.mode === 'google') { const g = read(SAVE_KEY); if (g) { this.save = g; write(saveKey(), g); KY.Cloud.save(g); } }
      this.show(this.save ? 'select' : 'create');
    },
    fillSelect() {
      const s = this.save, p = s.p, look = Object.assign({ g: 'f' }, p.look);
      $('acctName').textContent = Acct.mode === 'google' ? Acct.name : 'Misafir (bu cihaz)';
      $('acctPic').innerHTML = Acct.photo ? `<img src="${esc(Acct.photo)}" alt="" referrerpolicy="no-referrer">` : esc((Acct.mode === 'google' ? Acct.name : 'M').slice(0, 1).toUpperCase());
      const eq = KY.World.migrateEq(p.eq);
      const parts = KY.DATA.armorParts.filter(k => eq[k]).length;
      $('charCard').innerHTML = `<b>${esc(p.name || 'Gezgin')}</b><span>Seviye ${p.lv} · ${look.g === 'm' ? 'Erkek' : 'Kadın'} savaşçı</span><dl><dt>Altın</dt><dd>${(p.gold || 0).toLocaleString('tr-TR')}</dd><dt>Zırh</dt><dd>${parts}/6 parça</dd><dt>Silah</dt><dd>${eq.weapon ? esc(KY.DATA.items[eq.weapon.id].name) + (eq.weapon.plus ? ' +' + eq.weapon.plus : '') : '—'}</dd></dl>${Acct.mode === 'google' ? '<small class="cloudok">☁ Buluta otomatik kaydediliyor</small>' : '<small>Bu cihazda kayıtlı</small>'}`;
      $('saveInfo').textContent = s.at ? `Son kayıt: ${new Date(s.at).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}` : '';
      this.preview = { look, eq };
      KY.Avatar.Preview.mount(document.querySelector('.sel3d'), this.preview);
      $('newBtn').textContent = 'Yeni karakter'; $('newBtn').classList.remove('danger'); this.armed = false;
    },
    fillCreate() {
      const L = this.look, B = KY.Avatar.BODY[L.g];
      const hairs = L.g === 'f' ? ['Topuz', 'Çift topuz', 'Uzun'] : ['Tepe topuzu', 'Kısa'];
      if (L.hair >= hairs.length) L.hair = 0;
      const seg = (opt, items) => items.map((t, i) => `<button type="button" data-v="${i}" aria-pressed="${L[opt] === i}">${t}</button>`).join('');
      document.querySelector('.seg[data-opt="hair"]').innerHTML = seg('hair', hairs);
      const sw = (opt, cols, names) => cols.map((c, i) => `<button type="button" data-v="${i}" aria-pressed="${L[opt] === i}" aria-label="${names[i]}" title="${names[i]}" style="--c:#${c.toString(16).padStart(6, '0')}"></button>`).join('');
      document.querySelector('.sw[data-opt="hair2"]').innerHTML = sw('hair2', B.hair, ['Koyu kahve', 'Kestane', 'Siyah'].map((n, i) => L.g === 'm' && i === 2 ? 'Kır' : n));
      document.querySelector('.sw[data-opt="skin"]').innerHTML = sw('skin', B.skin, ['Açık', 'Buğday', 'Esmer']);
      document.querySelectorAll('.seg[data-opt="g"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === L.g));
      this.preview = { look: Object.assign({}, L), eq: KY.World.freshEq() };
      KY.Avatar.Preview.mount(document.querySelector('.cr3d'), this.preview);
      this.note('createNote', '');
    },
    bind() {
      $('guestBtn').addEventListener('click', () => { KY.Sfx.init(); Acct.mode = 'guest'; write(AUTH_KEY, { mode: 'guest' }); this.afterAuth(); });
      $('googleBtn').addEventListener('click', async () => {
        KY.Sfx.init();
        if (!KY.Cloud.enabled()) { this.note('loginNote', 'Google girişi bu sürümde henüz açılmadı (Firebase ayarı bekleniyor). Şimdilik misafir olarak oynayabilirsin; ilerlemen bu cihazda saklanır.', true); return; }
        $('googleBtn').disabled = true; this.note('loginNote', 'Google penceresi açılıyor…');
        try {
          const u = await KY.Cloud.signIn();
          if (!u) return;   // yönlendirmeyle devam edecek
          Acct.mode = 'google'; Acct.uid = u.uid; Acct.name = u.displayName || u.email || 'Oyuncu'; Acct.photo = u.photoURL || '';
          write(AUTH_KEY, { mode: 'google' });
          await this.afterAuth();
        } catch (e) { this.note('loginNote', KY.Cloud.errText(e), true); }
        finally { $('googleBtn').disabled = false; }
      });
      $('logoutBtn').addEventListener('click', () => App.logout());
      $('startBtn').addEventListener('click', () => { KY.Sfx.init(); App.enter(this.save); });
      $('newBtn').addEventListener('click', () => {
        if (!this.armed) { this.armed = true; $('newBtn').textContent = 'Mevcut karakter silinecek. Onayla'; $('newBtn').classList.add('danger'); return; }
        this.show('create');
      });
      $('createBack').addEventListener('click', () => this.show(this.save ? 'select' : 'login'));
      const form = $('createForm');
      form.addEventListener('click', e => {
        const b = e.target.closest('button[data-v]');
        if (!b) return;
        const opt = b.parentElement.dataset.opt;
        this.look[opt] = opt === 'g' ? b.dataset.v : +b.dataset.v;
        if (opt === 'g') { this.look.hair = 0; this.look.hair2 = 0; this.look.skin = 0; }
        KY.Sfx.play('click');
        this.fillCreate();
      });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const name = $('charName').value.trim().replace(/\s+/g, ' ');
        if (name.length < 2 || !/^[\p{L}][\p{L}\p{N} '-]*$/u.test(name)) { this.note('createNote', 'Ad en az 2 harf olmalı; harf, rakam, boşluk ve tire kullanılabilir.', true); return; }
        KY.Sfx.init();
        drop(saveKey());
        world = new KY.World(null);
        world.player.name = name;
        world.player.look = Object.assign({}, this.look);
        world.recalc();
        view.setWorld(world);
        ui.setWorld(world);
        $('death').hidden = true;
        App.begin();
        App.save(true);
      });
    }
  };
  App.login = Login;

  function boot(hot) {
    const prefs = read(PREF_KEY) || {};
    KY.Sfx.on = prefs.sound !== false;
    App.admin = prefs.admin !== false;
    $('adminBtn').hidden = !App.admin;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const quality = prefs.quality || 'high';
    try {
      world = new KY.World((hot && hot.save) || null);
      view = new KY.View($('gl'), world, { quality, fxLayer: $('fx'), labelLayer: $('labels') });
    } catch (e) {
      console.error(e);
      $('introBody').innerHTML = `<p class="err">3D görüntü başlatılamadı. Tarayıcında WebGL kapalı olabilir.</p>`;
      return;
    }
    try { KY.Swords.makeIcons(); } catch (e) { /* SVG simgelerle devam */ }
    try { KY.Avatar.makeIcons(); } catch (e) { /* SVG simgelerle devam */ }
    ui = new KY.UI(world, view, App);
    document.body.classList.toggle('touch', coarse);
    view.onTap = (hit) => {
      if (!App.started || world.player.dead) return;
      KY.Sfx.init();
      if (hit.type === 'mob') world.cmdAttack(hit.id);
      else if (hit.type === 'npc') world.cmdInteract(hit.id);
      else if (hit.type === 'loot') world.cmdPickup(hit.id);
      else if (hit.type === 'pet') ui.openPanel('pets', {});
      else if (hit.type === 'ground') world.cmdMove(hit.x, hit.z);
    };
    $('introHelp').innerHTML = coarse
      ? `<li><b>Dokun</b> yürü, saldır, konuş</li><li><b>Sürükle</b> kamerayı döndür</li><li><b>İki parmak</b> yakınlaş</li><li><b>Alt çubuk</b> yetenek ve iksir</li>`
      : `<li><b>Sol tık</b> yürü, saldır, konuş</li><li><b>Sağ sürükle</b> kamerayı döndür</li><li><b>Tekerlek</b> yakınlaş</li><li><b>1–8</b> yetenek · <b>I</b> envanter</li>`;
    Login.bind();
    $('googleBtn').classList.toggle('off', !KY.Cloud.enabled());
    if (hot && hot.started) { Acct.mode = hot.acct || 'guest'; App.begin(); }
    else {
      view.cam.orbit = true;
      Login.show('login');
      // önceki oturum: misafirse doğrudan seçime, Google ise oturum doğrulanınca
      const last = read(AUTH_KEY);
      if (last && last.mode === 'guest') { Acct.mode = 'guest'; Login.afterAuth(); }
      if (KY.Cloud.enabled()) {
        KY.Cloud.init().then(u => {
          if (u && !App.started && Login.step === 'login') {
            Acct.mode = 'google'; Acct.uid = u.uid; Acct.name = u.displayName || u.email || 'Oyuncu'; Acct.photo = u.photoURL || '';
            Login.afterAuth();
          }
        }).catch(e => console.warn('bulut başlatılamadı', e));
      }
    }

    window.claude?.hot?.snapshot?.(() => ({ save: world.serialize(), started: App.started, acct: Acct.mode }));
    const flush = () => { if (App.started) { cloudT = 0; App.save(false); } };
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      world.update(dt);
      const evs = world.drain();
      view.handle(evs);
      ui.handle(evs);
      view.update(dt);
      ui.update(dt);
      if (!App.started && (Login.step === 'select' || Login.step === 'create')) KY.Avatar.Preview.update(dt);
      saveT += dt; cloudT -= dt;
      if (saveT > 15) { saveT = 0; App.save(false); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.__ky = { get world() { return world; }, view, ui, App };
    document.body.classList.add('ready');
  }

  const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? null);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
