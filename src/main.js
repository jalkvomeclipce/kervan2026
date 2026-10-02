/* ============================================================
   KERVAN YOLU — main.js
   Her şeyi birbirine bağlar: dünya, çizim, arayüz, kayıt, döngü.
   ============================================================ */
(function () {
  const SAVE_KEY = 'kervanYolu.save.v1', PREF_KEY = 'kervanYolu.prefs.v1';
  const $ = (id) => document.getElementById(id);
  const read = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const drop = (k) => { try { localStorage.removeItem(k); } catch (e) { } };

  let world, view, ui, saveT = 0;
  const App = {
    started: false,
    save(manual) {
      if (!world || !App.started) return;
      const ok = write(SAVE_KEY, world.serialize());
      if (manual) ui.addLog(ok ? 'Oyun kaydedildi.' : 'Bu tarayıcıda kayıt yapılamıyor (gizli pencere olabilir).', ok ? 'good' : 'warn');
    },
    admin: true,
    savePrefs() { write(PREF_KEY, { sound: KY.Sfx.on, quality: view.quality, admin: App.admin }); },
    setAdmin(v) { App.admin = !!v; $('adminBtn').hidden = !App.admin; App.savePrefs(); },
    newGame() {
      drop(SAVE_KEY);
      world = new KY.World(null);
      view.setWorld(world);
      ui.setWorld(world);
      $('death').hidden = true;
      App.begin();
      write(SAVE_KEY, world.serialize());
    },
    begin() {
      App.started = true;
      $('intro').hidden = true;
      $('hud').hidden = false;
      view.cam.orbit = false;
      KY.Sfx.init();
      ui.banner(world.lastArea, 'area');
      ui.refreshQuest();
      if (world.player.dead) $('death').hidden = false;
      if (world.player.lv === 1 && world.player.xp === 0 && world.quest.i === 0) {
        const touch = matchMedia('(pointer: coarse)').matches;
        ui.addLog(touch ? 'İpucu: yere dokunarak yürü, canavara dokunarak saldır.' : 'İpucu: yere tıklayarak yürü, canavara tıklayarak saldır.', 'good');
        ui.addLog('Tilkiler kasabanın dışında. Mini haritadaki sarı işareti izle.', 'good');
      }
    }
  };
  window.KervanApp = App;

  function boot(hot) {
    const prefs = read(PREF_KEY) || {};
    KY.Sfx.on = prefs.sound !== false;
    App.admin = prefs.admin !== false;
    $('adminBtn').hidden = !App.admin;
    const coarse = matchMedia('(pointer: coarse)').matches;
    const quality = prefs.quality || 'high';
    const saved = (hot && hot.save) || read(SAVE_KEY);
    try {
      world = new KY.World(saved);
      view = new KY.View($('gl'), world, { quality, fxLayer: $('fx'), labelLayer: $('labels') });
    } catch (e) {
      console.error(e);
      $('introBody').innerHTML = `<p class="err">3D görüntü başlatılamadı. Tarayıcında WebGL kapalı olabilir.</p>`;
      return;
    }
    try { KY.Swords.makeIcons(); } catch (e) { /* SVG simgelerle devam */ }
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
    // giriş ekranı
    const hasSave = !!saved;
    $('startBtn').textContent = hasSave ? 'Devam et' : 'Yola çık';
    $('newBtn').hidden = !hasSave;
    if (hasSave) $('saveInfo').textContent = `Kayıtlı oyun: Seviye ${world.player.lv} · ${world.lastArea}`;
    $('startBtn').addEventListener('click', () => App.begin());
    let armed = false;
    $('newBtn').addEventListener('click', () => {
      if (!armed) { armed = true; $('newBtn').textContent = 'Kayıt silinsin mi? Onayla'; $('newBtn').classList.add('danger'); return; }
      App.newGame();
    });
    $('introHelp').innerHTML = coarse
      ? `<li><b>Dokun</b> yürü, saldır, konuş</li><li><b>Sürükle</b> kamerayı döndür</li><li><b>İki parmak</b> yakınlaş</li><li><b>Alt çubuk</b> yetenek ve iksir</li>`
      : `<li><b>Sol tık</b> yürü, saldır, konuş</li><li><b>Sürükle</b> kamerayı döndür</li><li><b>Tekerlek</b> yakınlaş</li><li><b>1–8</b> yetenek ve iksir</li>`;
    if (hot && hot.started) App.begin();
    else view.cam.orbit = true;

    window.claude?.hot?.snapshot?.(() => ({ save: world.serialize(), started: App.started }));
    const flush = () => { if (App.started) App.save(false); };
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
      saveT += dt;
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
