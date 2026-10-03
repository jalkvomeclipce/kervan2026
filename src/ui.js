/* ============================================================
   KERVAN YOLU — ui.js
   HUD, paneller, dükkânlar, mini harita, klavye ve ses bağlantısı.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.UI = (function () {
  const T = KY.Terrain, D = KY.DATA, I = D.items, S = D.skills, G = D.goods, Ic = KY.Icons, Sfx = KY.Sfx;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('tr-TR');
  const SLOTS = D.skillBar.concat(['hp', 'mp']);
  const TIERS = ['Sıradan', 'Sağlam', 'Usta işi', 'Nadir', 'Efsanevi'];
  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const STATL = { atk: v => `Saldırı ${v}`, def: v => `Savunma ${v}`, hp: v => `+${v} can`, mp: v => `+${v} ruh`, patk: v => `Fiziksel +${v}`, mag: v => `Büyü +${v}`, crit: v => `Kritik +%${v}` };
  const SETN = { keten: 'Keten', deri: 'Deri', pullu: 'Pullu', lamel: 'Lamel', kizil: 'Kızıl Yele' };
  const EQ_LEFT = ['head', 'shoulder', 'armor', 'earring', 'ring1'], EQ_RIGHT = ['hands', 'legs', 'feet', 'necklace', 'ring2'];
  const GHOST = { weapon: 'weapon', shield: 'shield', head: 'head', shoulder: 'shoulder', armor: 'armor', hands: 'hands', legs: 'legs', feet: 'feet', earring: 'earring', necklace: 'necklace', ring1: 'ring', ring2: 'ring' };
  const PER = 28;

  class UI {
    constructor(world, view, app) {
      this.w = world; this.v = view; this.app = app;
      this.panel = null; this.sel = null; this.confirm = null; this.dirty = false; this.lastRender = 0;
      this.logEl = $('log'); this.hudT = 0; this.miniT = 0; this.sfxT = {}; this.cache = {};
      this.buildSkillbar();
      this.bind();
      this.buildMiniBase();
      this.refreshQuest();
    }
    setWorld(w) { this.w = w; this.closePanel(); this.refreshQuest(); }

    // ---------- yetenek çubuğu ----------
    buildSkillbar() {
      const bar = $('skillbar');
      bar.innerHTML = SLOTS.map((id, k) => {
        const icon = id === 'hp' ? Ic.potR : id === 'mp' ? Ic.potB : Ic[S[id].icon];
        const name = id === 'hp' ? 'Can iksiri' : id === 'mp' ? 'Ruh iksiri' : S[id].name;
        return `<button class="slot${k >= 6 ? ' pot' : ''}" data-slot="${k}" aria-label="${name}" title="${name}">${icon}<span class="cd"></span><span class="lock">${Ic.lock}</span><span class="key">${KEYS[k]}</span><span class="cnt"></span></button>`;
      }).join('');
      this.slotEls = [...bar.querySelectorAll('.slot')];
      bar.addEventListener('pointerdown', e => {
        const b = e.target.closest('.slot');
        if (!b) return;
        e.preventDefault();
        this.useSlot(+b.dataset.slot);
      });
    }
    useSlot(k) {
      Sfx.init();
      const id = SLOTS[k];
      if (id === 'hp' || id === 'mp') this.w.cmdPotion(id);
      else {
        const st = this.w.skillReady(id);
        if (st !== 'ok') this.flashSlot(k);
        this.w.cmdSkill(id);
      }
    }
    flashSlot(k) { const el = this.slotEls[k]; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

    // ---------- bağlama ----------
    bind() {
      document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { Sfx.init(); Sfx.play('click'); this.toggle(b.dataset.open); }));
      $('panelClose').addEventListener('click', () => this.closePanel());
      $('panelBody').addEventListener('click', e => this.onPanelClick(e));
      $('panelBody').addEventListener('submit', e => {
        e.preventDefault();
        const f = e.target, inp = f.querySelector('input');
        if (f.dataset.form === 'petname') {
          Sfx.init(); Sfx.play('click');
          if (this.w.cmdPetName(+f.dataset.i, inp.value)) inp.value = '';
          this.renderPanel();
          return;
        }
        const v = Math.round(+inp.value);
        if (!inp.value || !isFinite(v)) return;
        Sfx.init(); Sfx.play('click');
        if (f.dataset.form === 'gold') this.w.adminGold(v);
        else if (f.dataset.form === 'lv') this.w.adminLevel(v);
        inp.value = '';
        this.renderPanel();
      });
      this.bindInvDrag();
      this.bindTips();
      this.bindWindowDrag();
      $('mini').addEventListener('click', () => this.openBigMap());
      $('petbar').addEventListener('click', e => { if (e.target.closest('[data-pets]')) { Sfx.init(); Sfx.play('click'); this.toggle('pets'); } });
      $('bigmap').addEventListener('click', () => { $('bigmap').hidden = true; });
      $('respawnBtn').addEventListener('click', () => { this.w.cmdRespawn(); });
      $('tframe').addEventListener('click', () => { const t = this.w.player.target; if (t && this.w.mobs.has(t)) this.w.cmdAttack(t); });
      $('quest').addEventListener('click', () => { const q = this.questTarget(); if (q) this.openBigMap(); });
      addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (!this.app.started) return;
        const k = e.key.toLowerCase();
        const idx = KEYS.indexOf(e.key);
        if (idx >= 0) { this.useSlot(idx); e.preventDefault(); return; }
        if (k === 'tab') { e.preventDefault(); this.w.cmdCycleTarget(); return; }
        if (k === ' ') { e.preventDefault(); const t = this.w.player.target; if (t && this.w.mobs.has(t)) this.w.cmdAttack(t); else { const n = this.w.nearestHostile(20); if (n) this.w.cmdAttack(n.id); } return; }
        if (k === 'escape') { if (!$('bigmap').hidden) $('bigmap').hidden = true; else this.closePanel(); return; }
        const map = { i: 'inv', b: 'inv', c: 'char', k: 'skills', v: 'caravan', m: 'map', o: 'settings', y: 'admin', p: 'pets' };
        if (k === 'y' && !this.app.admin) return;
        if (map[k]) { this.toggle(map[k]); e.preventDefault(); }
      });
    }

    // ---------- sürükle-bırak (çanta ↔ ekipman) ----------
    bindInvDrag() {
      const body = $('panelBody');
      const srcOf = (el) => el.dataset.i != null ? { kind: 'bag', k: +el.dataset.i } : { kind: 'eq', slot: el.dataset.eq };
      const itemOfSrc = (src) => { const p = this.w.player; const s = src.kind === 'bag' ? p.inv[src.k] : p.eq[src.slot]; return s ? { s, it: I[s.id] } : null; };
      body.addEventListener('pointerdown', e => {
        const el = e.target.closest('[data-drag]');
        if (!el || e.button > 0) return;
        const src = srcOf(el);
        if (!itemOfSrc(src)) return;
        this.drag = { el, src, x: e.clientX, y: e.clientY, id: e.pointerId, started: false, touch: e.pointerType !== 'mouse', t0: performance.now() };
        if (this.drag.touch) this.drag.hold = setTimeout(() => { if (this.drag && !this.drag.moved) this.dragBegin(); }, 260);
      });
      addEventListener('pointermove', e => {
        const d = this.drag;
        if (!d || e.pointerId !== d.id) return;
        const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (!d.started) {
          if (d.touch) { if (dist > 10) { d.moved = true; clearTimeout(d.hold); this.drag = null; } return; }
          if (dist < 6) return;
          this.dragBegin();
        }
        this.dragAt(e.clientX, e.clientY);
      });
      // dokunmatikte sürüklerken sayfa kaymasın
      body.addEventListener('touchmove', e => { if (this.drag && this.drag.started) e.preventDefault(); }, { passive: false });
      const end = (e, cancel) => {
        const d = this.drag;
        if (!d || (e && e.pointerId !== d.id)) return;
        clearTimeout(d.hold);
        this.drag = null;
        if (!d.started) return;
        this.suppressClick = true;
        setTimeout(() => { this.suppressClick = false; }, 60);
        if (d.ghost) d.ghost.remove();
        document.body.classList.remove('dragging');
        body.querySelectorAll('.over').forEach(q => q.classList.remove('over', 'bad'));
        if (cancel) return;
        const tgt = document.elementFromPoint(e.clientX, e.clientY);
        const to = tgt && tgt.closest('[data-i], [data-eq]');
        const w = this.w;
        if (to) {
          const dst = srcOf(to);
          if (d.src.kind === 'bag' && dst.kind === 'bag') w.cmdMoveSlot(d.src.k, dst.k);
          else if (d.src.kind === 'bag' && dst.kind === 'eq') w.cmdEquip(d.src.k, dst.slot);
          else if (d.src.kind === 'eq' && dst.kind === 'bag') w.cmdUnequip(d.src.slot, dst.k);
          Sfx.play('click');
        }
        this.sel = null;
        this.renderPanel();
      };
      addEventListener('pointerup', e => end(e, false));
      addEventListener('pointercancel', e => end(e, true));
    }
    dragBegin() {
      const d = this.drag;
      if (!d) return;
      d.started = true;
      this.tipHide();
      const g = document.createElement('div');
      g.className = 'dragghost';
      const icon = d.el.querySelector('img, svg');
      g.innerHTML = icon ? icon.outerHTML : '';
      document.getElementById('app').appendChild(g);
      d.ghost = g;
      document.body.classList.add('dragging');
      if (navigator.vibrate && d.touch) try { navigator.vibrate(12); } catch (e) { /* titreşim yok */ }
      // uygun yuvaları vurgula
      const p = this.w.player, s = d.src.kind === 'bag' ? p.inv[d.src.k] : null, it = s && I[s.id];
      $('panelBody').querySelectorAll('[data-eq]').forEach(q => {
        const sl = q.dataset.eq;
        const ok = it && D.isEquip(it) && (it.type === sl || (it.type === 'ring' && (sl === 'ring1' || sl === 'ring2')));
        q.classList.toggle('can', !!ok);
      });
      this.dragAt(d.x, d.y);
    }
    dragAt(x, y) {
      const d = this.drag;
      if (!d || !d.ghost) return;
      d.ghost.style.transform = `translate(${x - 26}px, ${y - 26}px)`;
      const body = $('panelBody');
      body.querySelectorAll('.over').forEach(q => q.classList.remove('over'));
      const tgt = document.elementFromPoint(x, y);
      const to = tgt && tgt.closest('[data-i], [data-eq]');
      if (to) to.classList.add('over');
    }

    // ---------- ipuçları (fareyle üstüne gelince) ----------
    bindTips() {
      const tip = this.tipEl = document.createElement('div');
      tip.className = 'tip'; tip.hidden = true; tip.setAttribute('role', 'tooltip');
      document.getElementById('app').appendChild(tip);
      const show = (e) => {
        if (e.pointerType !== 'mouse' || this.drag) return;
        const el = e.target.closest('[data-i], [data-eq], [data-tip], .skillbar .slot');
        if (!el) { this.tipHide(); return; }
        const p = this.w.player;
        let html = '';
        if (el.dataset.i != null) { const s = p.inv[+el.dataset.i]; if (s) html = this.tipHtml(I[s.id], s.plus, { hint: D.isEquip(I[s.id]) ? 'Çift tık / sağ tık: kuşan' : I[s.id].type === 'potion' ? 'Çift tık: iç' : '' }); }
        else if (el.dataset.eq) { const e2 = p.eq[el.dataset.eq]; html = e2 ? this.tipHtml(I[e2.id], e2.plus, { equipped: true, hint: 'Sağ tık: çıkar' }) : `<div class="tiphead"><b>${D.slotName[el.dataset.eq]}</b><small>Boş yuva</small></div>`; }
        else if (el.dataset.tip) html = this.tipHtml(I[el.dataset.tip], 0);
        else if (el.dataset.slot != null) {
          const id = SLOTS[+el.dataset.slot];
          if (id === 'hp' || id === 'mp') html = `<div class="tiphead"><b>${id === 'hp' ? 'Can iksiri' : 'Ruh iksiri'}</b><small>Kısayol ${KEYS[+el.dataset.slot]}</small></div><p>Çantadaki en uygun iksiri içer.</p>`;
          else { const sk = S[id], lk = p.mastery[sk.tree] < sk.unlock; html = `<div class="tiphead"><b>${sk.name}</b><small>${D.trees[sk.tree].name} · Kısayol ${KEYS[+el.dataset.slot]}</small></div><ul class="tipst"><li>${sk.mp} ruh</li><li>${sk.cd} sn bekleme</li>${sk.range ? `<li>Menzil ${sk.range} m</li>` : ''}</ul><p>${sk.desc}</p>${lk ? `<small class="tipreq bad">Ustalık ${sk.unlock} gerekli</small>` : ''}`; }
        }
        if (!html) { this.tipHide(); return; }
        if (this.tipKey !== html) { tip.innerHTML = html; this.tipKey = html; }
        tip.hidden = false;
        this.tipMove(e.clientX, e.clientY);
      };
      document.addEventListener('pointerover', show);
      document.addEventListener('pointermove', e => { if (!tip.hidden) { if (!e.target.closest('[data-i], [data-eq], [data-tip], .skillbar .slot')) this.tipHide(); else this.tipMove(e.clientX, e.clientY); } });
      $('panelBody').addEventListener('scroll', () => this.tipHide(), { passive: true });
      // sağ tık: kuşan / kullan / çıkar
      $('panelBody').addEventListener('contextmenu', e => {
        const el = e.target.closest('[data-i], [data-eq]');
        if (!el) return;
        e.preventDefault();
        const w = this.w;
        if (el.dataset.i != null) { const k = +el.dataset.i; if (w.player.inv[k]) { Sfx.play('click'); w.cmdUseSlot(k); } }
        else if (w.player.eq[el.dataset.eq]) { Sfx.play('click'); w.cmdUnequip(el.dataset.eq); }
        this.sel = null; this.tipHide(); this.renderPanel();
      });
    }
    tipMove(x, y) {
      const t = this.tipEl, r = t.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      let px = x + 18, py = y + 14;
      if (px + r.width > W - 8) px = x - r.width - 14;
      if (py + r.height > H - 8) py = H - r.height - 8;
      t.style.transform = `translate(${Math.max(8, px)}px, ${Math.max(8, py)}px)`;
    }
    tipHide() { if (this.tipEl && !this.tipEl.hidden) { this.tipEl.hidden = true; this.tipKey = null; } }

    // ---------- pencereyi başlığından sürükle (masaüstü) ----------
    bindWindowDrag() {
      const pan = $('panel'), head = pan.querySelector('header');
      let d = null;
      head.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'mouse' || innerWidth < 760 || e.target.closest('button')) return;
        const r = pan.getBoundingClientRect();
        d = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height };
        head.setPointerCapture(e.pointerId);
        pan.classList.add('moving');
      });
      head.addEventListener('pointermove', e => {
        if (!d) return;
        const l = Math.max(4, Math.min(innerWidth - d.w - 4, d.l + e.clientX - d.x)), t = Math.max(4, Math.min(innerHeight - 60, d.t + e.clientY - d.y));
        pan.style.left = l + 'px'; pan.style.top = t + 'px'; pan.style.right = 'auto'; pan.style.bottom = 'auto'; pan.style.height = d.h + 'px';
      });
      const up = () => { if (d) { d = null; pan.classList.remove('moving'); } };
      head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
      head.addEventListener('dblclick', () => { pan.style.left = pan.style.top = pan.style.right = pan.style.bottom = pan.style.height = ''; });
    }

    // ---------- olaylar ----------
    handle(evs) {
      const p = this.w.player;
      for (const e of evs) {
        switch (e.type) {
          case 'log': this.addLog(e.text, e.cls); break;
          case 'area': this.banner(e.name, 'area'); break;
          case 'levelup': this.banner(`Seviye ${e.lv}`, 'level', e.admin ? 'Yönetici paneliyle ayarlandı' : '3 stat puanı kazandın'); Sfx.play('level'); this.dirty = true; break;
          case 'questDone': {
            const r = e.reward, bits = [];
            if (r.xp) bits.push(`+${fmt(r.xp)} TP`);
            if (r.gold) bits.push(`+${fmt(r.gold)} altın`);
            if (r.items) r.items.forEach(([id, n]) => bits.push(`${I[id].name} ×${n}`));
            this.banner('Görev tamamlandı', 'quest', `${e.name} · ${bits.join(' · ')}`);
            Sfx.play('ok');
            this.refreshQuest();
            break;
          }
          case 'quest': this.refreshQuest(); break;
          case 'openNpc': this.openPanel('npc', { npc: e.id }); Sfx.play('click'); break;
          case 'closeNpc': if (this.panel && this.panel.kind === 'npc') this.closePanel(); break;
          case 'playerDied': $('death').hidden = false; Sfx.play('die'); break;
          case 'respawn': $('death').hidden = true; break;
          case 'dmg':
            if (e.on === 'mob') this.sfx(e.crit ? 'crit' : 'hit', 0.05);
            else if (e.on === 'player') this.sfx('hurt', 0.25);
            break;
          case 'swing': if (e.id === 'player') this.sfx('swing', 0.05); break;
          case 'cast':
            if (e.skill === 'atesTopu' || e.skill === 'alevHalka') Sfx.play('fire');
            else if (e.skill === 'sifa') Sfx.play('heal');
            else if (e.skill === 'kasirga') Sfx.play('whirl');
            else if (e.skill === 'demir') Sfx.play('ok');
            break;
          case 'hit': if (!e.miss) Sfx.play('boom'); break;
          case 'coin': this.sfx('coin', 0.08); this.dirty = true; break;
          case 'enhance':
            if (KY.Swords && e.slot === 'weapon') KY.Swords.Preview.burst(e.ok);
            Sfx.play(e.ok ? 'ok' : 'fail');
            if (e.ok && e.plus >= 5) this.banner(`+${e.plus}`, 'epic', 'Silahın parlıyor');
            this.dirty = true; break;
          case 'ambush': Sfx.play('horn'); this.banner('Pusu!', 'bad', 'Eşkıyalar kervanına saldırıyor'); break;
          case 'caravanLost': this.banner('Kervan düştü', 'bad', 'Yük yağmalandı'); this.dirty = true; break;
          case 'caravanNew': case 'caravanDone': case 'cargo': this.dirty = true; break;
          case 'petSummon': Sfx.play('ok'); this.dirty = true; break;
          case 'petDismiss': case 'petName': this.dirty = true; break;
          case 'petCare': if (e.what === 'feed' || e.what === 'heal' || e.what === 'revive') this.sfx('heal', 0.3); this.dirty = true; break;
          case 'petDied': this.banner('Hayvanın öldü', 'bad', 'Hayat Otu ile diriltebilirsin'); Sfx.play('die'); this.dirty = true; break;
          case 'petLevel': this.sfx('ok', 0.3); this.dirty = true; break;
          case 'petEvolve': this.banner(e.to, 'epic', `${e.from} dönüştü`); Sfx.play('level'); this.dirty = true; break;
          case 'petPick': this.sfx('coin', 0.1); break;
          case 'tradeLevel': this.banner(`Tüccar seviyesi ${e.lv}`, 'level', `Kervan kapasitesi ${this.w.capacity()}`); Sfx.play('level'); break;
          case 'telegraph': this.sfx('horn', 1); break;
          case 'slam': Sfx.play('slam'); break;
          case 'teleport': Sfx.play('portal'); if (!(this.panel && this.panel.kind === 'admin')) this.closePanel(); this.dirty = true; break;
          case 'blocked': this.addLog('Oraya yürüyemezsin.', 'warn'); break;
          case 'market': case 'inv': case 'equip': case 'stats': case 'mastery': case 'xp': case 'heal': case 'potion': this.dirty = true; break;
        }
      }
    }
    sfx(k, gap) { const t = performance.now() / 1000; if ((this.sfxT[k] || 0) + gap > t) return; this.sfxT[k] = t; Sfx.play(k); }
    addLog(text, cls) {
      const el = document.createElement('div');
      el.className = 'ln ' + (cls || '');
      el.textContent = text;
      this.logEl.appendChild(el);
      while (this.logEl.children.length > 5) this.logEl.firstChild.remove();
      setTimeout(() => el.classList.add('old'), 7000);
    }
    banner(title, cls, sub) {
      const b = $('banner');
      b.className = 'banner show ' + (cls || '');
      b.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
      clearTimeout(this.bannerTO);
      this.bannerTO = setTimeout(() => b.classList.remove('show'), cls === 'area' ? 2200 : 3200);
    }

    // ---------- HUD ----------
    set(id, prop, v) { const k = id + prop; if (this.cache[k] === v) return; this.cache[k] = v; const el = $(id); if (prop === 'text') el.textContent = v; else if (prop === 'w') el.style.width = v; else if (prop === 'html') el.innerHTML = v; }
    update(dt) {
      const w = this.w, p = w.player, st = w.stats;
      this.set('hpFill', 'w', (p.hp / st.maxHp * 100).toFixed(1) + '%');
      this.set('mpFill', 'w', (p.mp / st.maxMp * 100).toFixed(1) + '%');
      this.set('hpTxt', 'text', `${fmt(p.hp)} / ${fmt(st.maxHp)}`);
      this.set('mpTxt', 'text', `${fmt(p.mp)} / ${fmt(st.maxMp)}`);
      const need = D.player.xpNeed(p.lv);
      this.set('xpFill', 'w', (p.xp / need * 100).toFixed(2) + '%');
      this.set('xpTxt', 'text', `Seviye ${p.lv} · TP ${fmt(p.xp)} / ${fmt(need)} (%${(p.xp / need * 100).toFixed(1)})`);
      this.set('pLvl', 'text', String(p.lv));
      this.set('pName', 'text', p.name || 'Gezgin');
      this.set('pGold', 'text', fmt(p.gold));
      $('pLvl').classList.toggle('pts', p.points > 0 || this.canMastery());
      // hedef
      const tg = p.target ? w.getEnt(p.target) : null;
      const tf = $('tframe');
      if (tg && !tg.dead && (tg.kind === 'mob' || tg.kind === 'npc')) {
        tf.hidden = false;
        if (tg.kind === 'mob') {
          const d = tg.lv - p.lv;
          const cls = tg.def.unique ? 'unique' : d >= 5 ? 'red' : d >= 3 ? 'orange' : d <= -5 ? 'grey' : '';
          this.set('tName', 'html', `<b class="${cls}">${tg.name}</b><span>Sv. ${tg.lv}</span>`);
          this.set('tFill', 'w', Math.max(0, tg.hp / tg.maxHp * 100).toFixed(1) + '%');
          this.set('tTxt', 'text', `${fmt(Math.max(0, tg.hp))} / ${fmt(tg.maxHp)}`);
          tf.classList.remove('npc');
        } else {
          this.set('tName', 'html', `<b class="npcname">${tg.name}</b><span>${tg.title}</span>`);
          tf.classList.add('npc');
        }
        tf.classList.toggle('uniq', tg.kind === 'mob' && !!tg.def.unique);
      } else tf.hidden = true;
      // yetenekler
      SLOTS.forEach((id, k) => {
        const el = this.slotEls[k];
        let cdP = 0, locked = false, nomp = false, cnt = '';
        if (id === 'hp' || id === 'mp') {
          const n = id === 'hp' ? w.count('hp1') + w.count('hp2') : w.count('mp1') + w.count('mp2');
          cnt = String(n);
          cdP = Math.max(0, p.potCd - w.t) / 1;
          locked = n === 0;
        } else {
          const sk = S[id];
          locked = p.mastery[sk.tree] < sk.unlock;
          const r = (p.cds[id] || 0) - w.t;
          cdP = r > 0 ? r / sk.cd : 0;
          nomp = !locked && p.mp < sk.mp;
          if (r > 0) cnt = r >= 1 ? String(Math.ceil(r)) : '';
        }
        const key = cdP.toFixed(3) + locked + nomp + cnt;
        if (el._k === key) return;
        el._k = key;
        el.style.setProperty('--p', cdP.toFixed(3));
        el.classList.toggle('locked', locked);
        el.classList.toggle('nomp', nomp);
        el.classList.toggle('oncd', cdP > 0);
        el.querySelector('.cnt').textContent = cnt;
      });
      // hayvan çerçeveleri
      this.petT = (this.petT || 0) - dt;
      if (this.petT <= 0) { this.petT = 0.2; this.drawPetbar(); }
      // güçlendirmeler
      const bh = p.buffs.map(b => `<span class="buff" title="Demir Beden">${Ic.demir}<i>${Math.ceil(b.until - w.t)}</i></span>`).join('') + (w.caravan ? `<span class="buff car" title="Kervan">${Ic.camel}<i>${Math.round(w.caravan.hp / w.caravan.maxHp * 100)}%</i></span>` : '');
      this.set('buffs', 'html', bh);
      // mini harita
      this.miniT -= dt;
      if (this.miniT <= 0) { this.miniT = 0.1; this.drawMini(); this.updateQuestDist(); }
      if (this.dirty && this.panel && performance.now() - this.lastRender > 200) this.renderPanel();
      if (KY.Swords && this.panel) KY.Swords.Preview.update(dt);
      if (KY.Avatar && this.panel) KY.Avatar.Preview.update(dt);
    }
    canMastery() {
      const p = this.w.player;
      return ['kilic', 'ates'].some(t => p.mastery[t] < p.lv && p.sp >= this.w.masteryCost(t));
    }

    // ---------- görev ----------
    refreshQuest() {
      const q = this.w.currentQuest(), el = $('quest');
      if (!q) { el.innerHTML = `<b>Tüm görevler tamam</b><span>Kervan yolunda ustalaştın. Yeni bölgeler yakında.</span>`; return; }
      const g = q.goal;
      let prog = '';
      if (g.kind === 'kill') prog = `${this.w.quest.n} / ${g.n}`;
      else if (g.kind === 'mastery') prog = `${Math.max(this.w.player.mastery.kilic, this.w.player.mastery.ates)} / ${g.n}`;
      else if (g.kind === 'plus') prog = `+${this.w.player.eq.weapon ? this.w.player.eq.weapon.plus : 0} / +${g.n}`;
      el.innerHTML = `<b>${Ic.quest}${q.name}</b><span>${q.text}</span><em>${prog}<i id="qDist"></i></em>`;
      this.cache.qDisttext = null;
    }
    questTarget() {
      const q = this.w.currentQuest();
      if (!q) return null;
      const p = this.w.player, g = q.goal;
      if (g.kind === 'kill') {
        let best = null, bd = 1e9;
        for (const s of D.spawns) if (s.type === g.type) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
        return best ? { x: best.x, z: best.z } : null;
      }
      if (g.kind === 'trade') {
        const n = this.w.npcs.find(q2 => q2.id === (this.w.caravan && this.w.caravan.from === 'sarikum' ? 'taskale-kervan' : 'sarikum-kervan'));
        return n ? { x: n.x, z: n.z } : null;
      }
      if (g.kind === 'weapon' || g.kind === 'plus') {
        const t = T.nearestTown(p.x, p.z).town;
        const n = this.w.npcs.find(q2 => q2.id === t.id + '-demirci');
        return n ? { x: n.x, z: n.z } : null;
      }
      return null;
    }
    updateQuestDist() {
      const el = $('qDist');
      if (!el) return;
      const q = this.questTarget(), p = this.w.player;
      const txt = q ? ` · ${Math.round(Math.hypot(q.x - p.x, q.z - p.z))} m` : '';
      if (el.textContent !== txt) el.textContent = txt;
    }

    // ---------- mini harita ----------
    buildMiniBase() {
      const R = 2, w = Math.floor((T.HALF_W * 2 + 40) / R), h = Math.floor((T.HALF_D * 2 + 40) / R);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'), img = g.createImageData(w, h);
      this.miniOX = -T.HALF_W - 20; this.miniOZ = -T.HALF_D - 20; this.miniR = R;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = this.miniOX + i * R, z = this.miniOZ + j * R, hh = T.height(x, z);
        let col = hh < T.WATER ? [0.25, 0.52, 0.66] : KY.Palette.ground(x, z, hh, 0);
        const sh = 1 + (T.height(x - 2, z - 2) - hh) * -0.04;
        const o = (j * w + i) * 4;
        img.data[o] = Math.min(255, col[0] * 255 * sh); img.data[o + 1] = Math.min(255, col[1] * 255 * sh); img.data[o + 2] = Math.min(255, col[2] * 255 * sh); img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      // kasabalar ve köprü
      g.fillStyle = 'rgba(60,40,20,.55)';
      for (const k in T.TOWNS) { const t = T.TOWNS[k]; g.beginPath(); g.arc((t.x - this.miniOX) / R, (t.z - this.miniOZ) / R, 20 / R, 0, 7); g.lineWidth = 1.5; g.strokeStyle = 'rgba(70,45,20,.8)'; g.stroke(); }
      this.miniBase = c;
      const mc = $('mini'), dpr = Math.min(2, window.devicePixelRatio || 1);
      const sz = mc.clientWidth || 110;
      mc.width = sz * dpr; mc.height = sz * dpr;
      this.miniDpr = dpr;
    }
    drawMini() {
      const mc = $('mini'), g = mc.getContext('2d'), W = mc.width, H = mc.height, p = this.w.player;
      const span = 100, R = this.miniR, sc = W / span;
      g.save();
      g.clearRect(0, 0, W, H);
      g.beginPath(); g.arc(W / 2, H / 2, W / 2 - 1, 0, 7); g.clip();
      g.fillStyle = '#1d222d'; g.fillRect(0, 0, W, H);
      const sx = (p.x - span / 2 - this.miniOX) / R, sz = (p.z - span / 2 - this.miniOZ) / R;
      g.imageSmoothingEnabled = true;
      g.drawImage(this.miniBase, sx, sz, span / R, span / R, 0, 0, W, H);
      const toM = (x, z) => [(x - p.x + span / 2) * sc, (z - p.z + span / 2) * sc];
      const dot = (x, z, r, col, stroke) => { const [a, b] = toM(x, z); g.beginPath(); g.arc(a, b, r * this.miniDpr, 0, 7); g.fillStyle = col; g.fill(); if (stroke) { g.lineWidth = this.miniDpr; g.strokeStyle = stroke; g.stroke(); } };
      for (const m of this.w.mobs.values()) {
        if (m.dead || Math.abs(m.x - p.x) > span / 2 + 2 || Math.abs(m.z - p.z) > span / 2 + 2) continue;
        dot(m.x, m.z, m.def.unique ? 3.6 : 1.9, m.def.unique ? '#cda2ff' : m.state === 'chase' ? '#ff5a3a' : '#e0463a', m.def.unique ? '#fff' : null);
      }
      for (const n of this.w.npcs) dot(n.x, n.z, 2.2, '#f2d99a', '#5a4020');
      if (this.w.caravan) dot(this.w.caravan.x, this.w.caravan.z, 2.8, '#e8ac4c', '#3a2410');
      const q = this.questTarget();
      if (q) {
        let [a, b] = toM(q.x, q.z);
        const cx = W / 2, cy = H / 2, dx = a - cx, dy = b - cy, d = Math.hypot(dx, dy), max = W / 2 - 8 * this.miniDpr;
        if (d > max) { a = cx + dx / d * max; b = cy + dy / d * max; }
        const s = 4.5 * this.miniDpr;
        g.beginPath(); g.moveTo(a, b - s); g.lineTo(a + s, b); g.lineTo(a, b + s); g.lineTo(a - s, b); g.closePath();
        g.fillStyle = '#f2d99a'; g.fill(); g.lineWidth = this.miniDpr; g.strokeStyle = '#3a2410'; g.stroke();
      }
      // kamera yönü
      const yaw = this.v.cam.yaw;
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.moveTo(W / 2, H / 2);
      const fwd = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
      g.arc(W / 2, H / 2, W * 0.45, fwd - 0.55, fwd + 0.55); g.closePath(); g.fill();
      // oyuncu oku
      const ang = Math.atan2(Math.cos(p.rot), Math.sin(p.rot));
      g.translate(W / 2, H / 2); g.rotate(ang);
      const u = 5.5 * this.miniDpr;
      g.beginPath(); g.moveTo(u, 0); g.lineTo(-u * 0.7, u * 0.65); g.lineTo(-u * 0.35, 0); g.lineTo(-u * 0.7, -u * 0.65); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = this.miniDpr; g.strokeStyle = '#141820'; g.stroke();
      g.restore();
      this.set('areaName', 'text', this.w.lastArea);
    }
    openBigMap() {
      const bm = $('bigmap'), cv = bm.querySelector('canvas');
      bm.hidden = false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.min(innerWidth - 24, 900), bh = bw * this.miniBase.height / this.miniBase.width;
      cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
      cv.width = bw * dpr; cv.height = bh * dpr;
      const g = cv.getContext('2d'), sc = cv.width / this.miniBase.width, R = this.miniR;
      g.drawImage(this.miniBase, 0, 0, cv.width, cv.height);
      const toM = (x, z) => [(x - this.miniOX) / R * sc, (z - this.miniOZ) / R * sc];
      g.textAlign = 'center';
      const label = (x, z, text, size, col) => { const [a, b] = toM(x, z); g.font = `700 ${size * dpr}px 'Alegreya SC', Georgia, serif`; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(20,16,10,.75)'; g.strokeText(text, a, b); g.fillStyle = col; g.fillText(text, a, b); };
      for (const k in T.TOWNS) { const t = T.TOWNS[k]; label(t.x, t.z - 24, t.name, 17, '#f2d99a'); }
      label(-80, 80, 'Sarıkum Bozkırı', 13, '#eef3df'); label(75, -85, 'Taşkale Çölü', 13, '#fbf0d8');
      label(T.riverX(-60) + 12, -60, 'Gökırmak', 12, '#d8eef7');
      label(-150, -66, 'Kızıl Koru', 11, '#f0c8ff'); label(150, -66, 'Dev Kayalıkları', 11, '#f0c8ff');
      const mark = (x, z, col, r) => { const [a, b] = toM(x, z); g.beginPath(); g.arc(a, b, r * dpr, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 1.5 * dpr; g.strokeStyle = '#141820'; g.stroke(); };
      const seen = {}, small = cv.width / dpr < 600;
      for (const s of D.spawns) {
        const m = D.monsters[s.type], [a, b] = toM(s.x, s.z);
        g.beginPath(); g.arc(a, b, (m.unique ? 4 : 2.6) * dpr, 0, 7); g.fillStyle = m.unique ? '#cfa6ff' : '#e0463a'; g.fill();
        if (seen[s.type] && small) continue;
        seen[s.type] = 1;
        g.font = `700 ${(small ? 9 : 11) * dpr}px 'Alegreya Sans', sans-serif`; g.textAlign = 'left';
        g.fillStyle = m.unique ? '#ecd6ff' : 'rgba(255,240,220,.92)'; g.strokeStyle = 'rgba(20,16,10,.7)'; g.lineWidth = 2.5 * dpr;
        const txt = `${m.name} ${m.lv}`; g.strokeText(txt, a + 5 * dpr, b + 3 * dpr); g.fillText(txt, a + 5 * dpr, b + 3 * dpr);
      }
      g.textAlign = 'center';
      const q = this.questTarget(); if (q) mark(q.x, q.z, '#f2d99a', 6);
      if (this.w.caravan) mark(this.w.caravan.x, this.w.caravan.z, '#e8ac4c', 5);
      mark(this.w.player.x, this.w.player.z, '#ffffff', 6);
    }

    // ---------- paneller ----------
    toggle(kind) {
      if (kind === 'map') { const bm = $('bigmap'); if (bm.hidden) this.openBigMap(); else bm.hidden = true; return; }
      if (this.panel && this.panel.kind === kind) this.closePanel();
      else this.openPanel(kind, {});
    }
    openPanel(kind, o) {
      this.panel = Object.assign({ kind, tab: o.tab || null }, o);
      this.sel = null; this.confirm = null;
      $('panel').hidden = false;
      $('panelBody').scrollTop = 0;
      document.querySelectorAll('[data-open]').forEach(b => b.classList.toggle('on', b.dataset.open === kind));
      this.renderPanel();
    }
    closePanel() {
      if (this.panel && this.panel.kind === 'npc') this.w.cmdCloseNpc();
      this.panel = null;
      $('panel').hidden = true;
      document.querySelectorAll('[data-open]').forEach(b => b.classList.remove('on'));
    }
    renderPanel() {
      if (!this.panel) return;
      this.dirty = false; this.lastRender = performance.now();
      const body = $('panelBody'), top = body.scrollTop;
      let title = '', html = '';
      const P = this.panel;
      if (P.kind === 'inv') { title = 'Çanta'; html = this.htmlInv(); }
      else if (P.kind === 'char') { title = 'Karakter'; html = this.htmlChar(); }
      else if (P.kind === 'skills') { title = 'Yetenekler'; html = this.htmlSkills(); }
      else if (P.kind === 'caravan') { title = 'Kervan ve Pazar'; html = this.htmlCaravan(); }
      else if (P.kind === 'settings') { title = 'Ayarlar'; html = this.htmlSettings(); }
      else if (P.kind === 'pets') { title = 'Hayvanlar'; html = this.htmlPets(); }
      else if (P.kind === 'admin') { title = 'Yönetici paneli <small>test araçları</small>'; html = this.htmlAdmin(); }
      else if (P.kind === 'npc') {
        const n = this.w.npcs.find(q => q.id === P.npc);
        if (!n) { this.closePanel(); return; }
        title = `${n.name} <small>${n.title}</small>`;
        html = this.htmlNpc(n);
      }
      $('panelTitle').innerHTML = title;
      $('panel').classList.toggle('wide', P.kind === 'inv' && (P.tab || 'bag') === 'bag');
      this.tipHide();
      const keep = {}, act = document.activeElement;
      body.querySelectorAll('input[id]').forEach(i => { keep[i.id] = i.value; });
      const focusId = act && act.tagName === 'INPUT' && body.contains(act) ? act.id : null;
      body.innerHTML = html;
      for (const id in keep) { const i = document.getElementById(id); if (i) i.value = keep[id]; }
      if (focusId) { const i = document.getElementById(focusId); if (i) i.focus(); }
      body.scrollTop = top;
      this.mountPreview();
      if (this.reveal) {
        this.reveal = false;
        const d = body.querySelector('.detail, .showcase');
        if (d) d.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
    tabs(list, cur) {
      return `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button class="tab${k === cur ? ' on' : ''}" data-act="tab" data-tab="${k}" role="tab" aria-selected="${k === cur}">${l}</button>`).join('')}</div>`;
    }
    // eşyanın sayısal katkıları (güçlendirme dahil)
    statsOf(it, plus) {
      const E = D.enhance, pl = plus || 0;
      return {
        atk: it.type === 'weapon' ? Math.round(it.atk * (1 + E.bonus * pl) + pl * 2) : 0,
        def: it.def ? Math.round(it.def * (1 + E.bonus * pl) + pl) : 0,
        hp: it.hpBonus || 0, mp: it.mpBonus || 0, patk: it.atkBonus || 0, mag: it.magBonus || 0, crit: Math.round((it.critBonus || 0) * 100)
      };
    }
    itemLine(it, plus) {
      if (D.isEquip(it)) {
        const st = this.statsOf(it, plus), parts = [];
        for (const k in STATL) if (st[k]) parts.push(STATL[k](st[k]));
        parts.push(`Sv. ${it.lv}`);
        return parts.join(' · ');
      }
      if (it.hp) return `+${it.hp} can`;
      if (it.mp) return `+${it.mp} ruh`;
      return it.desc;
    }
    // aynı yuvadaki kuşanılı eşyaya göre fark çipleri
    compareHtml(it, plus, slotHint) {
      if (!D.isEquip(it)) return '';
      const p = this.w.player, slot = slotHint || this.w.slotFor(it), cur = p.eq[slot];
      const a = this.statsOf(it, plus), b = cur ? this.statsOf(I[cur.id], cur.plus) : {};
      const out = [];
      for (const k in STATL) { const d = (a[k] || 0) - (b[k] || 0); if (d) out.push(`<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${STATL[k](Math.abs(d)).replace(/^\+/, '')}</span>`); }
      return out.length ? `<div class="cmpl"><small>${cur ? 'Kuşanılana göre' : 'Yuva boş'}</small>${out.join('')}</div>` : `<div class="cmpl"><small>Kuşanılanla aynı</small></div>`;
    }
    tipHtml(it, plus, o) {
      o = o || {};
      const p = this.w.player, tier = it.tier || 0, eq = D.isEquip(it);
      let h = `<div class="tiphead t${tier}"><b>${esc(it.name)}${plus ? ' +' + plus : ''}</b><small>${eq ? `${TIERS[tier]} · ${D.slotName[it.type === 'ring' ? 'ring1' : it.type]}` : ({ potion: 'İksir', material: 'Malzeme', pet: 'Hayvan mührü', petitem: 'Hayvan bakımı' }[it.type] || '')}</small></div>`;
      if (eq) {
        const st = this.statsOf(it, plus);
        h += `<ul class="tipst">${Object.keys(STATL).filter(k => st[k]).map(k => `<li>${STATL[k](st[k])}</li>`).join('')}</ul>`;
        if (it.set) {
          const worn = D.armorParts.filter(s2 => p.eq[s2] && I[p.eq[s2].id].set === it.set).length;
          h += `<small class="tipset">${SETN[it.set] || ''} takımı · ${worn}/6 giyili</small>`;
        }
        if (!o.equipped) h += this.compareHtml(it, plus, o.slot);
        h += `<small class="tipreq${p.lv < it.lv ? ' bad' : ''}">Gereken seviye ${it.lv}</small>`;
      } else h += `<p>${esc(this.itemLine(it, plus))}</p>`;
      if (it.desc && eq) h += `<p>${esc(it.desc)}</p>`;
      if (it.sell) h += `<small class="tipsell">${Ic.coin}${fmt(Math.floor(it.sell * (1 + (plus || 0) * 0.5)))} satış</small>`;
      if (o.hint) h += `<small class="tiphint">${o.hint}</small>`;
      return h;
    }
    sourcesOf(id) {
      const out = [];
      for (const tid in D.towns) for (const n of D.towns[tid].npcs) if (n.shop && n.shop.indexOf(id) >= 0) out.push(`${T.TOWNS[tid].name} demircisi`);
      for (const k in D.monsters) for (const dr of D.monsters[k].drops) if (dr[0] === id) out.push(`${D.monsters[k].name} (%${(dr[1] * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })})`);
      if (id === 'w1') out.push('Başlangıç silahı');
      return out;
    }
    showcase(id, plus, extra) {
      const it = I[id], tier = it.tier || 0;
      const src = this.sourcesOf(id);
      return `<div class="showcase t${tier}"><div class="pv3d" data-item="${id}" data-plus="${plus || 0}" role="img" aria-label="${it.name}, döndürülebilir 3D görünüm"></div>
        <div class="scinfo"><small class="tierl">${TIERS[tier]}</small><b>${it.name}${plus ? ' +' + plus : ''}</b><span class="stat1">${this.itemLine(it, plus)}</span>${extra || ''}<p>${it.desc}</p>${src.length ? `<small class="src"><em>Nereden</em>${src.join(' · ')}</small>` : ''}</div></div>`;
    }
    mountPreview() {
      const body = $('panelBody');
      if (KY.Swords) { const el = body.querySelector('.pv3d'); if (el) KY.Swords.Preview.mount(el); else KY.Swords.Preview.el = null; }
      if (KY.Avatar) { const el = body.querySelector('.avpv'); if (el) KY.Avatar.Preview.mount(el, this.w.player); else KY.Avatar.Preview.el = null; }
    }
    htmlColl() {
      const p = this.w.player;
      const ids = Object.keys(I).filter(k => I[k].type === 'weapon').sort((a, b) => I[a].lv - I[b].lv || I[a].tier - I[b].tier);
      const wid = p.eq.weapon ? p.eq.weapon.id : null;
      const has = id => wid === id || p.inv.some(q => q && q.id === id);
      const sel = this.csel && I[this.csel] ? this.csel : (wid || ids[0]);
      const plusOf = id => wid === id ? p.eq.weapon.plus : 0;
      let h = this.showcase(sel, plusOf(sel), has(sel) ? '<span class="cmp up">Elinde</span>' : '');
      h += `<div class="meta"><span><b>${ids.filter(has).length} / ${ids.length}</b> kılıç toplandı</span><span>Nadir kılıçlar canavarlardan düşer</span></div>`;
      h += `<div class="coll">${ids.map(id => {
        const it = I[id];
        return `<button class="ccard tier${it.tier}${id === sel ? ' sel' : ''}${has(id) ? ' own' : ''}" data-act="csel" data-id="${id}"><span class="cimg">${Ic.item(it)}</span><b>${it.name}</b><small>Sv. ${it.lv} · Saldırı ${it.atk}</small>${has(id) ? '<i class="owned">Elinde</i>' : ''}</button>`;
      }).join('')}</div>`;
      return h;
    }
    htmlInv() {
      const w = this.w, p = w.player, st = w.stats;
      const itab = this.panel.tab || 'bag';
      const top = this.tabs([['bag', 'Envanter'], ['coll', 'Kılıç koleksiyonu']], itab);
      if (itab === 'coll') return top + this.htmlColl();
      const page = Math.min(this.page || 0, Math.ceil(p.inv.length / PER) - 1);
      const bagSlot = (k) => {
        const s = p.inv[k];
        if (!s) return `<button class="islot empty" data-act="slot" data-i="${k}" aria-label="Boş göz"></button>`;
        const it = I[s.id], low = D.isEquip(it) && p.lv < it.lv;
        return `<button class="islot${this.sel === k ? ' sel' : ''} tier${it.tier || 0}${low ? ' low' : ''}" data-act="slot" data-i="${k}" data-drag="1" aria-label="${esc(it.name)}">${Ic.item(it)}${s.n > 1 ? `<i class="n">${s.n}</i>` : ''}${s.plus ? `<i class="plus">+${s.plus}</i>` : ''}</button>`;
      };
      const eqSlot = (slot) => {
        const e = p.eq[slot], it = e && I[e.id];
        const ghost = Ic.item({ type: GHOST[slot], tier: 0, id: '_' });
        return `<button class="eqs${e ? ' full tier' + (it.tier || 0) : ''}${this.sel === 'eq:' + slot ? ' sel' : ''}" data-act="eqslot" data-eq="${slot}"${e ? ' data-drag="1"' : ''} aria-label="${D.slotName[slot]}${e ? ': ' + esc(it.name) : ' (boş)'}">${e ? Ic.item(it) + (e.plus ? `<i class="plus">+${e.plus}</i>` : '') : `<span class="ghost">${ghost}</span>`}<i class="lbl">${D.slotName[slot]}</i></button>`;
      };
      const pages = Math.ceil(p.inv.length / PER);
      let h = top + `<div class="invwin">
        <div class="dollcol">
          <div class="doll">
            <div class="dtop">${eqSlot('weapon')}<span class="dname"><b>${esc(p.name)}</b><small>Sv. ${p.lv}</small></span>${eqSlot('shield')}</div>
            <div class="dside">${EQ_LEFT.map(eqSlot).join('')}</div>
            <div class="avpv" role="img" aria-label="Karakterin, sürükleyerek çevir"><span class="rot">⟲ sürükle</span></div>
            <div class="dside">${EQ_RIGHT.map(eqSlot).join('')}</div>
          </div>
          <div class="dstats"><span>Saldırı<b>${fmt(st.phy)}</b></span><span>Büyü<b>${fmt(st.mag)}</b></span><span>Savunma<b>${fmt(st.def)}</b></span><span>Can<b>${fmt(st.maxHp)}</b></span></div>
        </div>
        <div class="bagcol">
          <div class="pages" role="tablist">${Array.from({ length: pages }, (_, i) => `<button class="pg${i === page ? ' on' : ''}" data-act="page" data-n="${i}" role="tab" aria-selected="${i === page}">Sayfa ${i + 1}</button>`).join('')}<button class="pg sort" data-act="sort" title="Çantayı sırala" aria-label="Çantayı sırala">⇅ Sırala</button></div>
          <div class="bag">${Array.from({ length: PER }, (_, i) => bagSlot(page * PER + i)).join('')}</div>
          <div class="goldbar">${Ic.coin}<b>${fmt(p.gold)}</b><span>Altın</span><em>${w.freeSlots()} boş göz</em></div>
        </div>
      </div>`;
      h += this.invDetail();
      return h;
    }
    invDetail() {
      const w = this.w, p = w.player;
      const shop = w.nearNpc() && ['tuccar', 'demirci', 'hayvan'].indexOf(w.nearNpc().role) >= 0;
      if (typeof this.sel === 'string' && this.sel.startsWith('eq:')) {
        const slot = this.sel.slice(3), e = p.eq[slot];
        if (!e) { this.sel = null; return this.invHint(); }
        const it = I[e.id];
        let h = `<div class="detail">`;
        h += it.type === 'weapon' && it.sword ? this.showcase(e.id, e.plus, '<span class="cmp">Kuşanılı</span>') : `<div class="dhead"><span class="ic big tier${it.tier || 0}">${Ic.item(it)}</span><div class="tipbox">${this.tipHtml(it, e.plus, { equipped: true })}</div></div>`;
        h += `<div class="acts"><button class="btn primary" data-act="unequip" data-eq="${slot}">Çıkar</button><span class="hint">Sürükleyip çantaya bırakabilirsin.</span></div></div>`;
        return h;
      }
      if (this.sel != null && p.inv[this.sel]) {
        const s = p.inv[this.sel], it = I[s.id], eq = D.isEquip(it);
        const use = it.type === 'potion' ? 'İç' : eq ? 'Kuşan' : it.type === 'pet' ? (w.isSummoned(s) ? 'Mühre geri gönder' : 'Çağır') : it.type === 'petitem' ? 'Kullan' : null;
        const sellP = Math.floor(it.sell * (1 + (s.plus || 0) * 0.5));
        let h = it.type === 'pet' ? `<div class="detail">${this.petShowcase(this.sel)}`
          : it.type === 'weapon' && it.sword ? `<div class="detail">${this.showcase(s.id, s.plus || 0, this.compareHtml(it, s.plus))}`
          : `<div class="detail"><div class="dhead"><span class="ic big tier${it.tier || 0}">${Ic.item(it)}</span><div class="tipbox">${this.tipHtml(it, s.plus)}</div></div>`;
        h += `<div class="acts">`;
        if (use) h += `<button class="btn primary" data-act="use">${use}</button>`;
        if (it.type === 'ring') h += `<button class="btn" data-act="equipto" data-eq="ring2">2. yüzüğe tak</button>`;
        if (it.type === 'pet') h += `<button class="btn" data-act="gopets">Hayvanlar paneli</button>`;
        else if (w.pets.grab) h += `<button class="btn" data-act="pstore">Hayvana ver</button>`;
        if (shop) h += `<button class="btn" data-act="sell">Sat · ${fmt(sellP)}${s.n > 1 ? ' (1)' : ''}</button>${s.n > 1 ? `<button class="btn" data-act="sellall">Hepsini sat · ${fmt(sellP * s.n)}</button>` : ''}`;
        h += this.confirm === 'drop' ? `<button class="btn danger" data-act="drop2">Evet, at</button>` : `<button class="btn ghost" data-act="drop">At</button>`;
        h += `</div></div>`;
        return h;
      }
      return this.invHint();
    }
    invHint() {
      const touch = document.body.classList.contains('touch');
      return `<p class="hint pad invhint">${touch ? 'Eşyaya dokun: ayrıntı. İki kez dokun: kuşan / kullan. Basılı tutup sürükle: yuvaya tak ya da yer değiştir.' : 'Tıkla: ayrıntı · Çift tık ya da sağ tık: kuşan / kullan · Sürükle: yuvaya tak, çıkar ya da yer değiştir.'}</p>`;
    }
    htmlChar() {
      const w = this.w, p = w.player, st = w.stats, TR = D.trade;
      const need = D.player.xpNeed(p.lv);
      const row = (k, v, sub) => `<div class="kv"><span>${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
      let h = `<div class="charhead"><span class="bigl">${p.lv}</span><div><b>${p.name}</b><span>TP ${fmt(p.xp)} / ${fmt(need)}</span><i class="mini-bar"><i style="width:${(p.xp / need * 100).toFixed(1)}%"></i></i></div></div>`;
      h += `<h3>Özellikler ${p.points ? `<em class="badge">${p.points} puan</em>` : ''}</h3>`;
      const stat = (key, label, desc) => `<div class="stat"><div><b>${label}</b><small>${desc}</small></div><strong>${p[key]}</strong><button class="btn sq${p.points ? ' primary' : ''}" data-act="stat" data-k="${key}" ${p.points ? '' : 'disabled'} aria-label="${label} artır">+</button></div>`;
      h += stat('str', 'GÜÇ', 'Can, fiziksel saldırı ve savunma');
      h += stat('int', 'ZEKÂ', 'Ruh (MP) ve ateş büyüleri');
      h += `<h3>Savaş</h3><div class="kvs">${row('Can', fmt(st.maxHp))}${row('Ruh', fmt(st.maxMp))}${row('Fiziksel saldırı', fmt(st.phy))}${row('Büyü saldırısı', fmt(st.mag))}${row('Savunma', fmt(st.def))}${row('Kritik şansı', '%' + Math.round(st.crit * 100))}</div>`;
      h += `<h3>Tüccarlık</h3><div class="kvs">${row('Tüccar seviyesi', p.trade.lv)}${row('Tecrübe', p.trade.lv >= TR.maxLv ? 'en üst' : fmt(p.trade.xp) + ' / ' + fmt(TR.xpNeed(p.trade.lv)))}${row('Kervan kapasitesi', w.capacity() + ' yük')}${row('Satış bonusu', '%' + Math.round(TR.bonus(p.trade.lv) * 100))}</div>`;
      h += `<h3>Kese</h3><div class="kvs">${row('Altın', fmt(p.gold))}${row('Yetenek puanı (YP)', fmt(p.sp))}</div>`;
      return h;
    }
    htmlSkills() {
      const w = this.w, p = w.player;
      let h = `<div class="meta"><span>Yetenek puanı: <b>${fmt(p.sp)} YP</b></span><span>Canavar keserek kazanılır</span></div>`;
      for (const tk in D.trees) {
        const tr = D.trees[tk], m = p.mastery[tk], cost = w.masteryCost(tk);
        const capped = m >= p.lv, can = !capped && p.sp >= cost;
        h += `<section class="tree"><header><div><b>${tr.name}</b><small>${tr.desc}</small></div><span class="mlv">${m}<small>/${p.lv}</small></span></header>`;
        h += `<button class="btn ${can ? 'primary' : ''} wide" data-act="mastery" data-k="${tk}" ${can ? '' : 'disabled'}>${capped ? 'Ustalık seviyen karakter seviyende' : `Yükselt · ${fmt(cost)} YP`}</button>`;
        h += `<ul class="skl">`;
        for (const sid of D.skillBar) {
          const sk = S[sid];
          if (sk.tree !== tk) continue;
          const lock = m < sk.unlock;
          let pow = '';
          if (sk.mult) pow = `Güç %${Math.round((sk.mult[0] + sk.mult[1] * m) * 100)}`;
          if (sk.heal) pow = `Canın %${Math.round((sk.heal[0] + sk.heal[1] * m) * 100)} kadarı`;
          if (sk.buff) pow = `+%${Math.round(sk.buff.def * 100)} savunma`;
          h += `<li class="${lock ? 'lk' : ''}"><span class="ic">${Ic[sk.icon]}</span><div><b>${sk.name}</b><small>${sk.desc}</small><em>${lock ? `Ustalık ${sk.unlock} olunca açılır` : `${pow} · ${sk.mp} ruh · ${sk.cd} sn`}</em></div></li>`;
        }
        h += `</ul></section>`;
      }
      return h;
    }
    marketTable() {
      const w = this.w;
      let h = `<table class="mkt"><thead><tr><th>Mal</th><th>Alış</th><th>Satış</th><th>Kâr/yük</th></tr></thead><tbody>`;
      for (const g in G) {
        const gd = G[g], other = gd.from === 'sarikum' ? 'taskale' : 'sarikum';
        const buy = w.buyPrice(gd.from, g), sell = w.sellPrice(other, g);
        const tr = w.market[other][g] - w.marketPrev[other][g];
        h += `<tr><td><span class="ic sm">${Ic[gd.icon]}</span>${gd.name}<small>${T.TOWNS[gd.from].name} → ${T.TOWNS[other].name}</small></td><td>${buy}</td><td>${sell}<i class="tr ${tr > 0.005 ? 'up' : tr < -0.005 ? 'down' : ''}">${tr > 0.005 ? '▲' : tr < -0.005 ? '▼' : ''}</i></td><td class="${sell - buy > 0 ? 'pos' : 'neg'}">${sell - buy > 0 ? '+' : ''}${sell - buy}</td></tr>`;
      }
      return h + `</tbody></table><p class="hint">Fiyatlar her dakika biraz değişir. ▲▼ karşı kasabadaki son değişimi gösterir.</p>`;
    }
    caravanBox() {
      const w = this.w, c = w.caravan;
      if (!c) return `<div class="note">Kervanın yok. ${T.TOWNS.sarikum.name} ya da ${T.TOWNS.taskale.name}'deki Kervan Ustası'ndan mal alınca deven yükle birlikte peşinden gelir.</div>`;
      const load = w.load_(), dest = c.from === 'sarikum' ? 'taskale' : 'sarikum';
      let est = 0; for (const g in c.goods) est += w.sellPrice(dest, g) * c.goods[g];
      const goods = Object.keys(c.goods).map(g => `<span class="chip">${Ic[G[g].icon]}${G[g].name} ×${c.goods[g]}</span>`).join('');
      return `<div class="carbox"><div class="kvs">
        <div class="kv"><span>Yük</span><b>${load} / ${w.capacity()}</b></div>
        <div class="kv"><span>Deve canı</span><b>${fmt(c.hp)} / ${fmt(c.maxHp)}</b></div>
        <div class="kv"><span>Maliyet</span><b>${fmt(c.cost)}</b></div>
        <div class="kv"><span>${T.TOWNS[dest].loc} tahmini</span><b class="${est - c.cost >= 0 ? 'pos' : 'neg'}">${fmt(est)} (${est - c.cost >= 0 ? '+' : ''}${fmt(est - c.cost)})</b></div>
      </div><div class="chips">${goods}</div></div>`;
    }
    htmlCaravan() {
      let h = `<h3>Kervanın</h3>${this.caravanBox()}`;
      h += `<h3>Pazar</h3>${this.marketTable()}`;
      h += `<p class="hint">Kervanla yol kapısı kullanılamaz. Yolda eşkıya pususu olabilir; deveni koru, düşerse yük gider.</p>`;
      return h;
    }
    // ---------- hayvanlar ----------
    petDays(st) {
      const d = this.w.petDaysLeft(st);
      return d >= 1 ? `${Math.floor(d)} gün` : d > 0 ? `${Math.ceil(d * 24)} saat` : 'süre doldu';
    }
    petBar(label, v, max, cls, txt) {
      const pct = max > 0 ? Math.max(0, Math.min(100, v / max * 100)) : 0;
      return `<div class="pbarrow"><span>${label}</span><i class="pb ${cls}${cls === 'hg' && pct < 25 ? ' low' : ''}"><i style="width:${pct.toFixed(1)}%"></i></i><em>${txt || fmt(v) + ' / ' + fmt(max)}</em></div>`;
    }
    petShowcase(k) {
      const w = this.w, s = w.player.inv[k], it = I[s.id], def = D.pets[it.pet], st = s.pet, PU = KY.PetUtil;
      const fight = def.type === 'fight', form = PU.formIndex(def, st.lv);
      const species = fight ? def.forms[form].name : def.name, summoned = w.isSummoned(s);
      const status = st.dead ? '<span class="pst bad">Ölü</span>' : summoned ? '<span class="pst on">Çağrılı</span>' : (!fight && w.petDaysLeft(st) <= 0) ? '<span class="pst bad">Süresi doldu</span>' : '<span class="pst">Mühürde</span>';
      let rows = '';
      if (fight) {
        const S = PU.petStats(def, st.lv), need = D.petRules.xpNeed(st.lv), nf = def.forms[form + 1];
        rows = this.petBar('Can', st.hp, S.maxHp, 'hp') + this.petBar('Tokluk', st.hgp, 100, 'hg', '%' + Math.round(st.hgp)) + this.petBar('TP', st.xp, need, 'xp', st.lv >= w.player.lv ? 'seviyende' : '%' + Math.floor(st.xp / need * 100));
        rows += `<span class="stat1">Saldırı ${S.atk} · Savunma ${S.def}</span>`;
        if (nf) rows += `<small class="src"><em>Sonraki dönüşüm</em>Sv. ${nf.lv}: ${nf.name}</small>`;
      } else {
        rows = `<span class="stat1">Çanta ${st.bag.filter(Boolean).length} / ${st.bag.length} · Toplama ${def.reach} m</span><span class="stat1">Kalan süre: ${this.petDays(st)}</span>`;
      }
      return `<div class="showcase pet"><div class="pv3d" data-item="${s.id}" data-form="${form}" role="img" aria-label="${species}, döndürülebilir 3D görünüm"></div>
        <div class="scinfo"><small class="tierl">${fight ? 'Savaş hayvanı' : 'Toplayıcı hayvan'}</small><b>${esc(st.name)}</b>${fight ? `<span class="sp">${st.name !== species ? species + ' · ' : ''}Sv. ${st.lv}</span>` : st.name !== species ? `<span class="sp">${species}</span>` : ''}${status}${rows}</div></div>`;
    }
    petShopShowcase(id) {
      if (!id) return '';
      const it = I[id], def = D.pets[it.pet], fight = def.type === 'fight';
      const fk = fight ? Math.min(this.peekForm || 0, def.forms.length - 1) : 0;
      const nm = fight ? def.forms[fk].name : def.name;
      let rows;
      if (fight) {
        const S = KY.PetUtil.petStats(def, def.forms[fk].lv);
        rows = `<span class="stat1">Sv. ${def.forms[fk].lv}: Can ${S.maxHp} · Saldırı ${S.atk}</span><div class="pformrow">${def.forms.map((f, i) => `<button class="btn sm${i === fk ? ' primary' : ''}" data-act="pform" data-n="${i}">${i === 0 ? 'Yavru' : 'Sv. ' + f.lv}</button>`).join('')}</div>`;
      } else rows = `<span class="stat1">Çanta ${def.bag} göz · Toplama ${def.reach} m · ${def.days} gün</span>`;
      return `<div class="showcase pet"><div class="pv3d" data-item="${id}" data-form="${fk}" role="img" aria-label="${nm}, döndürülebilir 3D görünüm"></div>
        <div class="scinfo"><small class="tierl">${fight ? 'Savaş hayvanı' : 'Toplayıcı hayvan'}</small><b>${nm}</b><p>${def.desc}</p>${rows}</div></div>`;
    }
    htmlPetInfo(short) {
      let h = `<h3>İki tür hayvan var</h3><div class="ptypes">
        <div class="ptype"><b>Toplayıcı</b><ul><li>Yakındaki ganimeti senin yerine toplar</li><li>${D.pets.tavsan.bag}–${D.pets.fenek.bag} gözlük ek çanta taşır</li><li>Canavarlar ona dokunmaz, ölmez</li><li>28 gün çağrılabilir, Süre Muskası uzatır</li></ul></div>
        <div class="ptype"><b>Savaş</b><ul><li>Seninle savaşır, canavarların dikkatini çekebilir</li><li>TP alıp büyür, senin seviyeni geçemez</li><li>10. ve 20. seviyede dönüşür</li><li>Acıkır ve ölebilir, Hayat Otu ile dirilir</li><li>Süre sınırı yok</li></ul></div></div>`;
      if (!short) h += `<h3>Kurallar</h3><ul class="help"><li>Aynı anda bir toplayıcı ve bir savaş hayvanı çağırabilirsin.</li><li>Mühür çantanda durur. Mührü seçip Çağır'a bas ya da bu paneli kullan (P).</li><li>Savaşırken ya da ölüyken hayvan geri gönderilemez.</li><li>Hayvanına bir kez isim verebilirsin.</li><li>Çağrılı hayvanın mührü satılamaz, atılamaz.</li><li>Çantan doluysa toplayıcı eşyayı kendi çantasına koyar.</li><li>Hayvana dokunursan bu panel açılır.</li></ul>`;
      return h;
    }
    htmlPets() {
      const w = this.w, P = this.panel, tab = P.tab || 'mine';
      let h = this.tabs([['mine', 'Hayvanlarım'], ['info', 'Nasıl çalışır']], tab);
      if (tab === 'info') return h + this.htmlPetInfo(false);
      const list = w.petSlots();
      if (!list.length) return h + `<div class="note">Henüz hayvanın yok. Sarıkum'daki Çoban Kaya ya da Taşkale'deki Bahar Hatun'dan bir hayvan mührü alabilirsin.</div>` + this.htmlPetInfo(true);
      const sel = list.find(o => o.k === this.psel) || list.find(o => w.isSummoned(o.s)) || list[0];
      this.psel = sel.k;
      const s = sel.s, st = s.pet, fight = sel.def.type === 'fight', summoned = w.isSummoned(s), c = id => w.count(id);
      h += this.petShowcase(sel.k);
      h += `<div class="acts">`;
      h += summoned ? `<button class="btn" data-act="ptoggle" data-i="${sel.k}">Mühre geri gönder</button>`
        : `<button class="btn primary" data-act="ptoggle" data-i="${sel.k}" ${st.dead || (!fight && w.petDaysLeft(st) <= 0) ? 'disabled' : ''}>Çağır</button>`;
      if (fight) {
        h += `<button class="btn sm" data-act="pfeed" data-i="${sel.k}" ${st.dead || !c('yem') ? 'disabled' : ''}>Besle · Kuru Et ${c('yem')}</button>`;
        h += `<button class="btn sm" data-act="pheal" data-i="${sel.k}" ${st.dead || !c('merhem') ? 'disabled' : ''}>Merhem ${c('merhem')}</button>`;
        if (st.dead) h += `<button class="btn sm primary" data-act="previve" data-i="${sel.k}" ${c('hayatotu') ? '' : 'disabled'}>Dirilt · Hayat Otu ${c('hayatotu')}</button>`;
      } else h += `<button class="btn sm" data-act="pextend" data-i="${sel.k}" ${c('muska') ? '' : 'disabled'}>Süre uzat · Muska ${c('muska')}</button>`;
      h += `</div>`;
      if (fight) h += `<div class="setrow"><div><b>Otomatik bakım</b><small>Tokluk %40'ın, can %45'in altına inince Kuru Et ve Merhem kullanır</small></div><button class="btn sm${st.auto ? ' primary' : ''}" data-act="pauto" data-i="${sel.k}">${st.auto ? 'Açık' : 'Kapalı'}</button></div>`;
      if (!st.named) h += `<form class="nameform" data-form="petname" data-i="${sel.k}"><label for="petName">İsim ver <small>Bir kez verilir, sonra değişmez.</small></label><div class="row"><input id="petName" maxlength="14" autocomplete="off" placeholder="Örn. Börü"><button class="btn sm primary" type="submit">Kaydet</button></div></form>`;
      if (!fight && summoned) {
        const bag = st.bag;
        h += `<h3>Hayvan çantası <em class="cnt">${bag.filter(Boolean).length} / ${bag.length}</em></h3><div class="grid pbag">${bag.map((b, i) => b ? `<button class="islot tier${I[b.id].tier || 0}" data-act="ptake" data-i="${i}" aria-label="${I[b.id].name}, çantana al">${Ic.item(I[b.id])}${b.n > 1 ? `<i class="n">${b.n}</i>` : ''}${b.plus ? `<i class="plus">+${b.plus}</i>` : ''}</button>` : `<span class="islot empty"></span>`).join('')}</div><p class="hint">Eşyaya dokununca kendi çantana alınır. Hayvana eşya vermek için Çanta'da eşyayı seçip "Hayvana ver"e bas.</p>`;
      } else if (!fight) h += `<p class="hint">Hayvan çantasını görmek için önce hayvanı çağır.</p>`;
      h += `<h3>Mühürler</h3><div class="coll">${list.map(o => {
        const s2 = o.s.pet, f2 = o.def.type === 'fight', on = w.isSummoned(o.s);
        const tag = s2.dead ? 'Ölü' : on ? 'Çağrılı' : f2 ? `Sv. ${s2.lv}` : this.petDays(s2);
        return `<button class="ccard${o.k === sel.k ? ' sel' : ''}${on ? ' own' : ''}" data-act="psel" data-i="${o.k}"><span class="cimg">${Ic.item(I[o.s.id])}</span><b>${esc(s2.name)}</b><small>${f2 ? 'Savaş' : 'Toplayıcı'} · ${tag}</small>${on ? '<i class="owned">Çağrılı</i>' : ''}</button>`;
      }).join('')}</div>`;
      return h;
    }
    drawPetbar() {
      const w = this.w, el = $('petbar'), parts = [], f = w.pets.fight, g = w.pets.grab;
      if (f) {
        const st = f.slot.pet, S = KY.PetUtil.petStats(f.def, st.lv);
        parts.push(`<button class="pchip fight box" data-pets aria-label="${esc(st.name)}, savaş hayvanı"><span class="pic">${Ic.item(I[f.slot.id])}</span><span class="pinfo"><b>${esc(st.name)}</b><small>Sv. ${st.lv}</small><i class="pb hp"><i style="width:${Math.round(st.hp / S.maxHp * 100)}%"></i></i><i class="pb hg${st.hgp < 25 ? ' low' : ''}"><i style="width:${Math.round(st.hgp)}%"></i></i></span></button>`);
      }
      if (g) {
        const st = g.slot.pet;
        parts.push(`<button class="pchip grab box" data-pets aria-label="${esc(st.name)}, toplayıcı hayvan"><span class="pic">${Ic.item(I[g.slot.id])}</span><span class="pinfo"><b>${esc(st.name)}</b><small>${st.bag.filter(Boolean).length}/${st.bag.length} · ${this.petDays(st)}</small></span></button>`);
      }
      const html = parts.join('');
      if (this.cache.petbar !== html) { this.cache.petbar = html; el.innerHTML = html; el.hidden = !html; }
    }
    htmlAdmin() {
      const w = this.w, p = w.player, TR = D.trade;
      const b = (act, label, extra, cls) => `<button class="btn sm${cls ? ' ' + cls : ''}" data-act="${act}"${extra || ''}>${label}</button>`;
      const on = (v) => v ? ' primary' : '';
      let h = `<p class="hint">Sadece test için. Ölümsüzlük ve hızlı koşu sayfayı yenileyince kapanır.</p>`;
      h += `<section class="adm"><header><b>Altın</b><span>${Ic.coin}${fmt(p.gold)}</span></header>
        <div class="row">${b('agold', '+1.000', ' data-n="1000"')}${b('agold', '+10.000', ' data-n="10000"')}${b('agold', '+100.000', ' data-n="100000"')}${b('agold', '+1 milyon', ' data-n="1000000"')}</div>
        <form class="row inp" data-form="gold"><label class="sr" for="admGold">Altın miktarı</label><input id="admGold" type="number" inputmode="numeric" min="0" step="1" placeholder="Miktar yaz"><button class="btn sm primary" type="submit">Ekle</button></form></section>`;
      h += `<section class="adm"><header><b>Seviye</b><span>Sv. ${p.lv} / ${D.player.maxLv}</span></header>
        <div class="row">${b('alv', '−1', ` data-n="${p.lv - 1}"`)}${b('alv', '+1', ` data-n="${p.lv + 1}"`)}${b('alv', '+5', ` data-n="${p.lv + 5}"`)}${b('alv', 'Sv. 10', ' data-n="10"')}${b('alv', 'Sv. 20', ' data-n="20"')}${b('alv', `Sv. ${D.player.maxLv}`, ` data-n="${D.player.maxLv}"`)}</div>
        <form class="row inp" data-form="lv"><label class="sr" for="admLv">Seviye</label><input id="admLv" type="number" inputmode="numeric" min="1" max="${D.player.maxLv}" step="1" placeholder="1–${D.player.maxLv}"><button class="btn sm primary" type="submit">Ayarla</button></form>
        <p class="hint">Seviye düşürmek dağıttığın stat puanlarını sıfırlar.</p></section>`;
      h += `<section class="adm"><header><b>Güç ve yetenek</b><span>${p.points} puan · ${fmt(p.sp)} YP</span></header>
        <div class="row">${b('astats', 'Puanları dağıt', p.points ? '' : ' disabled')}${b('amast', 'Ustalıkları seviyeye çıkar')}${b('asp', '+10.000 YP')}</div></section>`;
      h += `<section class="adm"><header><b>Eşya</b><span>${w.freeSlots()} boş yer</span></header>
        <div class="row">${b('agive', '+50 Toz', ' data-id="toz" data-n="50"')}${b('agive', '+50 Büyük can', ' data-id="hp2" data-n="50"')}${b('agive', '+50 Büyük ruh', ' data-id="mp2" data-n="50"')}${b('aswords', 'Tüm kılıçlar')}</div>
        <div class="sub">Silah: ${I[p.eq.weapon.id].name} +${p.eq.weapon.plus}</div>
        <div class="row plusrow">${[0, 3, 5, 7, 9].map(n => b('aplus', '+' + n, ` data-n="${n}"`, p.eq.weapon.plus === n ? 'primary' : '')).join('')}</div></section>`;
      h += `<section class="adm"><header><b>Hileler</b></header>
        <div class="row">${b('agod', p.god ? 'Ölümsüzlük: açık' : 'Ölümsüzlük: kapalı', '', on(p.god).trim())}${b('afast', p.fast ? 'Hızlı koşu: açık' : 'Hızlı koşu: kapalı', '', on(p.fast).trim())}${b('aheal', 'Canı doldur')}${b('aboss', 'Büyükleri doğur')}</div></section>`;
      const Bq = T.BRIDGE;
      const spots = [['Sarıkum', T.TOWNS.sarikum.x, T.TOWNS.sarikum.z + 2.5], ['Taşkale', T.TOWNS.taskale.x, T.TOWNS.taskale.z + 2.5], ['Köprü', Bq.x, Bq.z], ['Kızıl Yele', -140, -74], ['Kum Akrepleri', 34, -32], ['Taş Dev', 141, -74]];
      h += `<section class="adm"><header><b>Işınlan</b></header><div class="row">${spots.map(([n, x, z]) => b('atp', n, ` data-x="${x.toFixed(1)}" data-z="${z.toFixed(1)}"`)).join('')}</div></section>`;
      h += `<section class="adm"><header><b>Hayvanlar</b>${w.pets.fight ? `<span>${esc(w.pets.fight.slot.pet.name)} · Sv. ${w.pets.fight.slot.pet.lv}</span>` : ''}</header>
        <div class="row">${b('apets', 'Tüm hayvanlar + bakım')}${b('apetlv', 'Savaş hayvanı +5 sv', w.pets.fight ? '' : ' disabled')}${b('apetcare', 'Hepsini doyur ve dirilt')}</div></section>`;
      h += `<section class="adm"><header><b>Tüccarlık</b><span>Sv. ${p.trade.lv} / ${TR.maxLv}</span></header>
        <div class="row">${b('atrade', '+1', ` data-n="${p.trade.lv + 1}"`)}${b('atrade', `En üst (${TR.maxLv})`, ` data-n="${TR.maxLv}"`)}</div></section>`;
      return h;
    }
    htmlSettings() {
      const q = this.v.quality, A = this.app.acct || {};
      let h = `<h3>Hesap</h3>`;
      h += A.mode === 'google'
        ? `<div class="setrow"><div><b>${esc(A.name || 'Google hesabı')}</b><small>☁ İlerlemen buluta otomatik kaydediliyor. Her cihazda aynı hesapla devam edersin.</small></div><button class="btn" data-act="logout">Çıkış yap</button></div>`
        : `<div class="setrow"><div><b>Misafir</b><small>İlerlemen yalnızca bu tarayıcıda. Google ile bağlanırsan buluta taşınır ve her cihazda devam edersin.</small></div><button class="btn primary" data-act="linkgoogle">Google ile bağlan</button></div><div class="setrow"><div><b>Giriş ekranı</b><small>Hesap değiştir ya da karakter seç</small></div><button class="btn ghost" data-act="logout">Çıkış</button></div>`;
      h += `<h3>Oyun</h3><div class="setrow"><div><b>Ses</b><small>Vuruş, büyü ve arayüz sesleri</small></div><button class="btn" data-act="sound">${Sfx.on ? 'Açık' : 'Kapalı'}</button></div>`;
      h += `<div class="setrow"><div><b>Grafik</b><small>Performans modu gölgeleri kapatır</small></div><button class="btn" data-act="quality">${q === 'low' ? 'Performans' : 'Yüksek'}</button></div>`;
      h += `<div class="setrow"><div><b>Yönetici düğmesi</b><small>Menüdeki taç düğmesi ve Y kısayolu</small></div><button class="btn" data-act="admtoggle">${this.app.admin ? 'Görünür' : 'Gizli'}</button></div>`;
      h += `<div class="setrow"><div><b>Kamerayı sıfırla</b><small>Açı ve uzaklığı varsayılana döndürür</small></div><button class="btn" data-act="camreset">Sıfırla</button></div>`;
      h += `<div class="setrow"><div><b>Kaydet</b><small>${A.mode === 'google' ? 'Oyun 15 saniyede bir yerele, 30 saniyede bir buluta kendiliğinden kaydedilir' : 'Oyun her 15 saniyede bir bu tarayıcıya kendiliğinden kaydedilir'}</small></div><button class="btn" data-act="save">Şimdi kaydet</button></div>`;
      h += `<h3>Nasıl oynanır</h3><ul class="help">
        <li><b>Yürümek:</b> yere dokun ya da tıkla.</li>
        <li><b>Saldırmak:</b> canavara dokun. Karakterin otomatik vurur.</li>
        <li><b>Yetenekler:</b> alttaki çubuk (klavyede 1–8). Hedef yoksa en yakın canavarı seçer.</li>
        <li><b>Kamera:</b> sürükleyerek döndür, iki parmakla ya da tekerlekle yakınlaş.</li>
        <li><b>Kasaba:</b> NPC'ye dokun. Tüccar iksir satar, Demirci silah satar ve güçlendirir.</li>
        <li><b>Kervan:</b> Kervan Ustası'ndan mal al, öbür kasabaya yürüyerek götür, kârla sat.</li>
        <li><b>Büyük canavarlar</b> kırmızı daire açar. Daire dolmadan dışına kaç.</li>
        <li><b>Envanter:</b> eşyayı sürükleyip yuvaya bırak, çift tıkla ya da sağ tıkla kuşan. Kuşandığın her parça karakterinde görünür.</li>
        <li><b>Kısayollar:</b> Tab hedef, Boşluk saldır, I/B envanter, C karakter, K yetenek, V kervan, M harita.</li></ul>`;
      h += `<h3>Kayıt</h3><div class="setrow"><div><b>Yeni oyun</b><small>Karakterin ve eşyaların silinir</small></div>${this.confirm === 'reset' ? `<button class="btn danger" data-act="reset2">Evet, sil</button>` : `<button class="btn ghost" data-act="reset">Yeni oyun</button>`}</div>`;
      return h;
    }
    shopRows(ids, town, peek) {
      const w = this.w, p = w.player;
      const cat = id => { const t = I[id].type; return t === 'weapon' ? 'Silahlar' : t === 'shield' ? 'Kalkanlar' : D.armorParts.indexOf(t) >= 0 ? `${SETN[I[id].set] || ''} zırh takımı` : ['earring', 'necklace', 'ring'].indexOf(t) >= 0 ? 'Takılar' : t === 'potion' ? 'İksirler' : t === 'pet' ? 'Hayvanlar' : t === 'petitem' ? 'Bakım' : 'Malzeme'; };
      let last = null;
      return `<ul class="shop">${ids.map(id => {
        const c = cat(id), head = c !== last && ids.length > 6 ? `<li class="grp">${c}</li>` : '';
        last = c;
        return head + this.shopRow(id, peek);
      }).join('')}</ul>`;
    }
    shopRow(id, peek) {
      const w = this.w, p = w.player;
      return [id].map(id => {
        const it = I[id], stack = !!it.stack, can = p.gold >= it.price;
        const low = (it.lv || 1) > p.lv;
        const pv = (it.type === 'weapon' && it.sword) || it.type === 'pet';
        return `<li${pv ? ` class="peekable${peek === id ? ' sel' : ''}" data-act="peek" data-id="${id}"` : ''} data-tip="${id}"><span class="ic tier${it.tier || 0}">${Ic.item(it)}</span><div><b>${it.name}</b><small class="${low ? 'neg' : ''}">${this.itemLine(it, 0)}</small></div><div class="buy"><span class="price">${Ic.coin}${fmt(it.price)}</span><div class="qty"><button class="btn sm${can ? ' primary' : ''}" data-act="buy" data-id="${id}" data-n="1" ${can ? '' : 'disabled'}>Al</button>${stack ? `<button class="btn sm" data-act="buy" data-id="${id}" data-n="10" ${p.gold >= it.price * 10 ? '' : 'disabled'}>×10</button>` : ''}</div></div></li>`;
      }).join('');
    }
    sellList() {
      const p = this.w.player;
      const items = p.inv.map((s, k) => ({ s, k })).filter(o => o.s);
      if (!items.length) return `<p class="hint pad">Çantan boş.</p>`;
      return `<ul class="shop">${items.map(({ s, k }) => {
        const it = I[s.id], pr = Math.floor(it.sell * (1 + (s.plus || 0) * 0.5));
        return `<li><span class="ic tier${it.tier || 0}">${Ic.item(it)}${s.plus ? `<i class="plus">+${s.plus}</i>` : ''}</span><div><b>${it.name}${s.n > 1 ? ' ×' + s.n : ''}</b><small>${fmt(pr)} altın / adet</small></div><div class="buy"><div class="qty"><button class="btn sm" data-act="sellk" data-i="${k}" data-n="1">Sat</button>${s.n > 1 ? `<button class="btn sm" data-act="sellk" data-i="${k}" data-n="${s.n}">Hepsi</button>` : ''}</div></div></li>`;
      }).join('')}</ul>`;
    }
    htmlNpc(n) {
      const w = this.w, p = w.player, P = this.panel;
      const gold = `<div class="meta"><span>${Ic.coin}<b>${fmt(p.gold)}</b> altın</span><span>${w.freeSlots()} boş yer</span></div>`;
      if (n.role === 'hayvan') {
        const tab = P.tab || 'buy', shop = w.shopOf(n);
        let h = `<p class="say">“${n.town === 'sarikum' ? 'Hayvan sabırla büyür, sen de onunla.' : 'Çölde yol arkadaşı altından kıymetlidir.'}”</p>` + this.tabs([['buy', 'Hayvanlar'], ['care', 'Bakım'], ['sell', 'Sat']], tab) + gold;
        if (tab === 'buy') {
          const pets = shop.filter(id => I[id].type === 'pet');
          const pk = this.peek && pets.indexOf(this.peek) >= 0 ? this.peek : pets[0];
          h += this.petShopShowcase(pk) + this.shopRows(pets, null, pk);
        } else if (tab === 'care') h += this.shopRows(shop.filter(id => I[id].type === 'petitem')) + `<p class="hint">Kuru Et açlığı, Merhem canı giderir. Hayat Otu ölen savaş hayvanını diriltir, Süre Muskası toplayıcının süresini 28 gün uzatır.</p>`;
        else h += this.sellList();
        return h;
      }
      if (n.role === 'tuccar') {
        const tab = P.tab || 'buy';
        return `<p class="say">“Yolun uzun, iksirin bol olsun.”</p>` + this.tabs([['buy', 'Satın al'], ['sell', 'Sat']], tab) + gold + (tab === 'buy' ? this.shopRows(w.shopOf(n)) : this.sellList());
      }
      if (n.role === 'demirci') {
        const tab = P.tab || 'buy';
        let h = `<p class="say">“Çelik ateşte, usta sabırda sınanır.”</p>` + this.tabs([['buy', 'Silah ve zırh'], ['enh', 'Güçlendir'], ['sell', 'Sat']], tab) + gold;
        h += `<p class="hint">Zırh parçaları karakterinin üstünde ayrı ayrı görünür. Aynı takımı tamamlamak görünüşü bütünler.</p>`;
        if (tab === 'buy') {
          const shop = w.shopOf(n), wp = shop.filter(id => I[id].type === 'weapon');
          const pk = this.peek && wp.indexOf(this.peek) >= 0 ? this.peek : wp[0];
          if (pk) h += this.showcase(pk, 0, '');
          h += this.shopRows(shop, null, pk);
        }
        else if (tab === 'sell') h += this.sellList();
        else {
          const E = D.enhance, toz = w.count('toz');
          if (p.eq.weapon) h += this.showcase(p.eq.weapon.id, p.eq.weapon.plus, '<span class="cmp">Kuşanılı</span>');
          h += `<p class="hint">Her deneme 1 Güçlendirme Tozu ve altın ister. +3'ten sonra başarısızlık eşyayı bir seviye düşürür. +5'te silahın parlamaya başlar.</p>`;
          h += `<div class="meta"><span>${Ic.toz}Güçlendirme Tozu: <b>${toz}</b></span></div>`;
          for (const slot of ['weapon', 'shield', 'head', 'shoulder', 'armor', 'hands', 'legs', 'feet']) {
            const e = p.eq[slot];
            if (!e) continue;
            const it = I[e.id], max = e.plus >= E.max;
            const cost = E.cost(e.plus), ch = E.chance[e.plus];
            const can = !max && toz > 0 && p.gold >= cost;
            h += `<div class="enh"><span class="ic tier${it.tier}">${Ic.item(it)}${e.plus ? `<i class="plus">+${e.plus}</i>` : ''}</span><div><b>${it.name} +${e.plus}${max ? '' : ` → +${e.plus + 1}`}</b><small>${this.itemLine(it, e.plus)}${max ? '' : ` → ${this.itemLine(it, e.plus + 1).split(' · ')[0]}`}</small>${max ? '<em>En üst seviye</em>' : `<em>Şans %${Math.round(ch * 100)} · ${fmt(cost)} altın${e.plus >= 3 ? ' · risk: -1' : ''}</em>`}</div><button class="btn${can ? ' primary' : ''}" data-act="enhance" data-k="${slot}" ${can ? '' : 'disabled'}>Güçlendir</button></div>`;
          }
          if (!toz) h += `<p class="hint">Tozu “Silah ve zırh” sekmesinden alabilir ya da canavarlardan düşürebilirsin.</p>`;
        }
        return h;
      }
      if (n.role === 'kervan') {
        const town = n.town, other = town === 'sarikum' ? 'taskale' : 'sarikum', c = w.caravan;
        let h = `<p class="say">“${town === 'sarikum' ? 'İpek doğudan gelir, altın batıdan.' : 'Çölü aşan kervan, pazarı da aşar.'}”</p>`;
        h += this.caravanBox();
        if (c) {
          let rev = 0; for (const g in c.goods) rev += w.sellPrice(town, g) * c.goods[g];
          const prof = rev - c.cost, same = c.from === town;
          h += `<button class="btn ${same ? '' : 'primary'} wide" data-act="tsell">${same ? `Geri sat (zararına) · ${fmt(rev)}` : `Yükü sat · ${fmt(rev)} altın (${prof >= 0 ? 'kâr +' : 'zarar '}${fmt(prof)})`}</button>`;
        }
        const room = w.capacity() - w.load_();
        const blocked = c && c.from !== town;
        h += `<h3>${T.TOWNS[town].name} malları</h3>`;
        if (blocked) h += `<p class="hint">Yeni mal almak için önce yükünü sat.</p>`;
        h += `<ul class="shop">`;
        for (const g in G) {
          const gd = G[g];
          if (gd.from !== town) continue;
          const bp = w.buyPrice(town, g), sp = w.sellPrice(other, g), lock = p.trade.lv < gd.trade;
          const maxN = Math.max(0, Math.min(room, Math.floor(p.gold / bp)));
          const dis = lock || blocked || maxN <= 0;
          h += `<li class="${lock ? 'lk' : ''}"><span class="ic">${Ic[gd.icon]}</span><div><b>${gd.name}</b><small>Alış ${bp} · ${T.TOWNS[other].loc} ~${sp} <span class="pos">(+${sp - bp})</span></small>${lock ? `<em>Tüccar seviyesi ${gd.trade} gerekir</em>` : ''}</div><div class="buy"><div class="qty"><button class="btn sm" data-act="tbuy" data-g="${g}" data-n="1" ${dis ? 'disabled' : ''}>+1</button><button class="btn sm${dis ? '' : ' primary'}" data-act="tbuy" data-g="${g}" data-n="${maxN}" ${dis ? 'disabled' : ''}>Doldur${maxN > 0 && !dis ? ' ' + maxN : ''}</button></div></div></li>`;
        }
        h += `</ul><p class="hint">Kapasite ${w.capacity()} yük. Karşı kasabadaki Kervan Ustası'na yürüyerek götür. Tüccar seviyen kârla artar.</p>`;
        return h;
      }
      if (n.role === 'kapi') {
        const dest = n.town === 'sarikum' ? 'taskale' : 'sarikum';
        const cost = D.trade.teleportCost, can = !w.caravan && p.gold >= cost;
        return `<p class="say">Taş kemerin içinde soğuk bir ışık dönüyor.</p><div class="note">${T.TOWNS[dest].dat} anında geçiş. Kervanla kullanılamaz.</div><button class="btn primary wide" data-act="teleport" ${can ? '' : 'disabled'}>${T.TOWNS[dest].dat} geç · ${cost} altın</button>${w.caravan ? '<p class="hint">Kervanın varken yol kapısı kapalı.</p>' : ''}`;
      }
      return '';
    }
    // çift tık / çift dokunuş
    dbl(key) {
      const now = performance.now(), hit = this.lastTap && this.lastTap.key === key && now - this.lastTap.t < 360;
      this.lastTap = hit ? null : { key, t: now };
      return hit;
    }
    onPanelClick(e) {
      if (this.suppressClick) { this.suppressClick = false; return; }
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      Sfx.init(); Sfx.play('click');
      const w = this.w, a = b.dataset.act, P = this.panel;
      switch (a) {
        case 'tab': P.tab = b.dataset.tab; break;
        case 'eqslot': { const sl = b.dataset.eq; if (!w.player.eq[sl]) { this.sel = null; break; } if (this.dbl('eq:' + sl)) { w.cmdUnequip(sl); this.sel = null; break; } this.sel = this.sel === 'eq:' + sl ? null : 'eq:' + sl; this.confirm = null; this.reveal = true; break; }
        case 'unequip': w.cmdUnequip(b.dataset.eq); this.sel = null; break;
        case 'equipto': if (this.sel != null) { w.cmdEquip(this.sel, b.dataset.eq); if (!w.player.inv[this.sel]) this.sel = null; } break;
        case 'page': this.page = +b.dataset.n; this.sel = null; break;
        case 'sort': w.cmdSortInv(); this.sel = null; break;
        case 'csel': this.csel = b.dataset.id; this.reveal = true; break;
        case 'peek': if (this.peek !== b.dataset.id) this.peekForm = 0; this.peek = b.dataset.id; this.reveal = true; break;
        case 'slot': {
          const k = +b.dataset.i;
          if (w.player.inv[k] && this.dbl('i' + k)) { w.cmdUseSlot(k); this.sel = w.player.inv[k] ? k : null; break; }
          this.sel = w.player.inv[k] ? (this.sel === k ? null : k) : null; this.confirm = null; this.reveal = this.sel != null; break;
        }
        case 'use': if (this.sel != null) { w.cmdUseSlot(this.sel); if (!w.player.inv[this.sel]) this.sel = null; } break;
        case 'sell': if (this.sel != null) { w.cmdSell(this.sel, 1); if (!w.player.inv[this.sel]) this.sel = null; } break;
        case 'sellall': if (this.sel != null) { w.cmdSell(this.sel, 999); this.sel = null; } break;
        case 'drop': this.confirm = 'drop'; break;
        case 'drop2': if (this.sel != null) { w.cmdDropSlot(this.sel); this.sel = null; } this.confirm = null; break;
        case 'stat': w.cmdStat(b.dataset.k); break;
        case 'mastery': w.cmdMastery(b.dataset.k); break;
        case 'buy': w.cmdBuy(b.dataset.id, +b.dataset.n); break;
        case 'sellk': w.cmdSell(+b.dataset.i, +b.dataset.n); break;
        case 'enhance': w.cmdEnhance(b.dataset.k); break;
        case 'tbuy': w.cmdTradeBuy(b.dataset.g, +b.dataset.n); break;
        case 'tsell': w.cmdTradeSell(); break;
        case 'teleport': w.cmdTeleport(); return;
        case 'sound': Sfx.on = !Sfx.on; this.app.savePrefs(); break;
        case 'quality': this.v.setQuality(this.v.quality === 'low' ? 'high' : 'low'); this.app.savePrefs(); break;
        case 'camreset': Object.assign(this.v.cam, { yaw: -1.05, pitch: innerWidth < innerHeight ? 0.48 : 0.4, dist: innerWidth < innerHeight ? 18 : 15 }); break;
        case 'save': this.app.save(true); break;
        case 'logout': this.app.logout(); return;
        case 'linkgoogle': this.app.linkGoogle(); return;
        case 'reset': this.confirm = 'reset'; break;
        case 'reset2': this.app.newGame(); return;
        case 'agold': w.adminGold(+b.dataset.n); break;
        case 'alv': w.adminLevel(+b.dataset.n); break;
        case 'asp': w.adminSP(10000); break;
        case 'amast': w.adminMastery(); break;
        case 'astats': w.adminStats(); break;
        case 'agive': w.adminGive(b.dataset.id, +b.dataset.n); break;
        case 'aswords': w.adminAllSwords(); break;
        case 'aplus': w.adminPlus('weapon', +b.dataset.n); break;
        case 'agod': w.player.god = !w.player.god; break;
        case 'afast': w.player.fast = !w.player.fast; break;
        case 'aheal': w.adminHeal(); break;
        case 'aboss': w.adminBosses(); break;
        case 'atp': w.adminTeleport(+b.dataset.x, +b.dataset.z); return;
        case 'atrade': w.adminTrade(+b.dataset.n); break;
        case 'apets': w.adminPets(); break;
        case 'apetlv': w.adminPetLevel(5); break;
        case 'apetcare': w.adminPetCare(); break;
        case 'gopets': { const k = this.sel; this.openPanel('pets', {}); this.psel = k; this.renderPanel(); return; }
        case 'psel': this.psel = +b.dataset.i; this.reveal = true; break;
        case 'ptoggle': w.cmdPetToggle(+b.dataset.i); break;
        case 'pfeed': w.cmdPetFeed(w.player.inv[+b.dataset.i]); break;
        case 'pheal': w.cmdPetHeal(w.player.inv[+b.dataset.i]); break;
        case 'previve': w.cmdPetRevive(w.player.inv[+b.dataset.i]); break;
        case 'pextend': w.cmdPetExtend(w.player.inv[+b.dataset.i]); break;
        case 'pauto': { const k = +b.dataset.i, s = w.player.inv[k]; if (s && s.pet) w.cmdPetAuto(k, !s.pet.auto); break; }
        case 'ptake': w.cmdPetTake(+b.dataset.i); break;
        case 'pstore': if (this.sel != null) { w.cmdPetStore(this.sel); if (!w.player.inv[this.sel]) this.sel = null; } break;
        case 'pform': this.peekForm = +b.dataset.n; break;
        case 'admtoggle': this.app.setAdmin(!this.app.admin); break;
      }
      this.renderPanel();
    }
  }
  return UI;
})();
