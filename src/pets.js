/* ============================================================
   KERVAN YOLU — pets.js
   Hayvan sistemi (oyun mantığı; çizimden bağımsız).
   İki tür:
   - Toplayıcı: ganimeti toplar, ek çanta taşır, ölümsüzdür,
     süreyle çağrılır (28 gün, muskayla uzar).
   - Savaş: seninle savaşır, TP kazanır, seviye atlar, 10 ve 20'de
     dönüşür, acıkır, ölebilir; ölünce Hayat Otu ile dirilir.
   Mühür eşyası çantada durur; hayvanın bütün durumu o eşyanın
   üstünde saklanır. Aynı anda bir toplayıcı + bir savaş hayvanı.
   ============================================================ */
(function () {
  const T = KY.Terrain, D = KY.DATA, I = D.items, PETS = D.pets, R = D.petRules;
  const P = KY.World.prototype;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- tanım yardımcıları ----------
  function speciesOf(slot) { return slot && I[slot.id] && I[slot.id].type === 'pet' ? PETS[I[slot.id].pet] : null; }
  function formIndex(def, lv) { if (!def.forms) return 0; let k = 0; def.forms.forEach((f, i) => { if (lv >= f.lv) k = i; }); return k; }
  function petStats(def, lv) {
    return {
      maxHp: Math.round(def.hp[0] + def.hp[1] * (lv - 1)),
      atk: Math.round(def.atk[0] + def.atk[1] * (lv - 1)),
      def: Math.round(def.def[0] + def.def[1] * (lv - 1))
    };
  }
  KY.PetUtil = { speciesOf, formIndex, petStats };

  P.newPetState = function (itemId) {
    const def = PETS[I[itemId].pet];
    const st = { name: def.forms ? def.forms[0].name : def.name, named: false, lv: 1, xp: 0, dead: false, auto: true };
    if (def.type === 'fight') { st.hp = petStats(def, 1).maxHp; st.hgp = 100; }
    else { st.bag = new Array(def.bag).fill(null); st.expires = Date.now() + def.days * R.dayMs; }
    return st;
  };
  P.petSlots = function () {
    const out = [];
    this.player.inv.forEach((s, k) => { if (s && I[s.id] && I[s.id].type === 'pet') out.push({ k, s, def: speciesOf(s) }); });
    return out;
  };
  P.isSummoned = function (slot) {
    return !!slot && ((this.pets.grab && this.pets.grab.slot === slot) || (this.pets.fight && this.pets.fight.slot === slot));
  };
  P.petDaysLeft = function (st) { return Math.max(0, (st.expires - Date.now()) / R.dayMs); };
  P.petMax = function (slot) { const def = speciesOf(slot); return def && def.type === 'fight' ? petStats(def, slot.pet.lv) : null; };

  // ---------- çağır / geri gönder ----------
  P.cmdPetSummon = function (k) {
    const p = this.player, slot = p.inv[k], def = speciesOf(slot);
    if (!def) return false;
    if (p.dead) { this.log('Ölüyken hayvan çağrılamaz.', 'warn'); return false; }
    const st = slot.pet;
    if (def.type === 'fight' && st.dead) { this.log(`${st.name} ölü. Önce Hayat Otu ile dirilt.`, 'warn'); return false; }
    if (def.type === 'grab' && this.petDaysLeft(st) <= 0) { this.log(`${st.name} için çağırma süresi doldu. Süre Muskası kullan.`, 'warn'); return false; }
    if (this.isSummoned(slot)) return true;
    const cur = this.pets[def.type];
    if (cur) this.dismissPet(def.type, true);
    const a = p.rot + (def.type === 'fight' ? -2.2 : 2.2);
    let x = p.x + Math.sin(a) * 1.8, z = p.z + Math.cos(a) * 1.8;
    if (!T.walkable(x, z) || T.collides(x, z, 0.4)) { x = p.x; z = p.z; }
    const e = {
      id: 'pet-' + def.type, kind: 'pet', ptype: def.type, def, slot, species: I[slot.id].pet,
      x, z, y: T.groundY(x, z), rot: p.rot, rad: def.type === 'fight' ? 0.5 : 0.3,
      moving: false, target: null, nextAtk: 0, lastCombat: -99, carry: null, stuck: 0, form: formIndex(def, st.lv), nextTick: this.t + 1
    };
    this.pets[def.type] = e;
    this.emit('petSummon', { id: e.id });
    this.log(`${st.name} çağrıldı.`, 'good');
    return true;
  };
  P.dismissPet = function (type, silent) {
    const e = this.pets[type];
    if (!e) return false;
    for (const m of this.mobs.values()) if (m.target === 'pet' && type === 'fight') { m.target = 'player'; }
    this.pets[type] = null;
    this.emit('petDismiss', { id: e.id });
    if (!silent) this.log(`${e.slot.pet.name} mühre döndü.`);
    return true;
  };
  P.cmdPetDismiss = function (type) {
    const e = this.pets[type];
    if (!e) return false;
    if (this.player.dead) { this.log('Ölüyken hayvan geri gönderilemez.', 'warn'); return false; }
    if (type === 'fight' && this.t - e.lastCombat < 4) { this.log('Hayvanın savaşırken geri gönderilemez.', 'warn'); return false; }
    return this.dismissPet(type);
  };
  P.cmdPetToggle = function (k) {
    const slot = this.player.inv[k], def = speciesOf(slot);
    if (!def) return;
    if (this.isSummoned(slot)) this.cmdPetDismiss(def.type); else this.cmdPetSummon(k);
  };

  // ---------- bakım ----------
  P.findFightPetSlot = function (pred) {
    if (this.pets.fight && pred(this.pets.fight.slot)) return this.pets.fight.slot;
    const f = this.petSlots().find(o => o.def.type === 'fight' && pred(o.s));
    return f ? f.s : null;
  };
  P.cmdPetFeed = function (slot) {
    slot = slot || this.findFightPetSlot(s => !s.pet.dead && s.pet.hgp < 99);
    if (!slot) { this.log('Doyurulacak savaş hayvanı yok.', 'warn'); return false; }
    if (this.count('yem') < 1) { this.log('Kuru Et yok. Hayvan Terbiyecisi satar.', 'warn'); return false; }
    this.removeItem('yem', 1);
    slot.pet.hgp = Math.min(100, slot.pet.hgp + 50);
    this.emit('petCare', { what: 'feed' });
    return true;
  };
  P.cmdPetHeal = function (slot) {
    slot = slot || this.findFightPetSlot(s => !s.pet.dead && s.pet.hp < this.petMax(s).maxHp);
    if (!slot) { this.log('İyileştirilecek savaş hayvanı yok.', 'warn'); return false; }
    if (this.count('merhem') < 1) { this.log('Hayvan Merhemi yok.', 'warn'); return false; }
    this.removeItem('merhem', 1);
    const mx = this.petMax(slot).maxHp;
    slot.pet.hp = Math.min(mx, slot.pet.hp + mx * 0.5);
    this.emit('petCare', { what: 'heal' });
    return true;
  };
  P.cmdPetRevive = function (slot) {
    slot = slot || this.findFightPetSlot(s => s.pet.dead);
    if (!slot) { this.log('Ölü savaş hayvanın yok.', 'warn'); return false; }
    if (this.count('hayatotu') < 1) { this.log('Hayat Otu yok. Hayvan Terbiyecisi satar.', 'warn'); return false; }
    this.removeItem('hayatotu', 1);
    const st = slot.pet;
    st.dead = false; st.hp = Math.round(this.petMax(slot).maxHp * 0.5); st.hgp = Math.max(st.hgp, 50);
    this.emit('petCare', { what: 'revive' });
    this.log(`${st.name} dirildi.`, 'good');
    return true;
  };
  P.cmdPetExtend = function (slot) {
    if (!slot) {
      const g = this.petSlots().filter(o => o.def.type === 'grab').sort((a, b) => a.s.pet.expires - b.s.pet.expires)[0];
      slot = g && g.s;
    }
    if (!slot) { this.log('Süresi uzatılacak toplayıcı hayvan yok.', 'warn'); return false; }
    if (this.count('muska') < 1) { this.log('Süre Muskası yok.', 'warn'); return false; }
    this.removeItem('muska', 1);
    const def = speciesOf(slot);
    slot.pet.expires = Math.max(Date.now(), slot.pet.expires) + def.days * R.dayMs;
    this.emit('petCare', { what: 'extend' });
    this.log(`${slot.pet.name}: süre ${Math.floor(this.petDaysLeft(slot.pet))} gün.`, 'good');
    return true;
  };
  P.cmdPetName = function (k, name) {
    const slot = this.player.inv[k];
    if (!speciesOf(slot)) return false;
    if (slot.pet.named) { this.log('Hayvanın adı bir kez verilir.', 'warn'); return false; }
    name = String(name || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
    if (name.length < 2) { this.log('İsim en az 2 harf olmalı.', 'warn'); return false; }
    slot.pet.name = name; slot.pet.named = true;
    this.emit('petName', { k });
    this.log(`Hayvanının adı artık ${name}.`, 'good');
    return true;
  };
  P.cmdPetAuto = function (k, on) { const s = this.player.inv[k]; if (speciesOf(s)) { s.pet.auto = !!on; this.emit('petCare', { what: 'auto' }); } };

  // toplayıcının çantası
  P.petBag = function () { const g = this.pets.grab; return g ? g.slot.pet.bag : null; };
  P.cmdPetTake = function (i) {
    const bag = this.petBag(); if (!bag || !bag[i]) return false;
    const s = bag[i], it = I[s.id];
    if (!it.stack) {
      const k = this.player.inv.indexOf(null);
      if (k < 0) { this.log('Çantan dolu.', 'warn'); return false; }
      this.player.inv[k] = s; bag[i] = null;
    } else {
      const left = this.addItem(s.id, s.n);
      if (left === s.n) { this.log('Çantan dolu.', 'warn'); return false; }
      if (left) s.n = left; else bag[i] = null;
    }
    this.emit('inv');
    return true;
  };
  P.cmdPetStore = function (k) {
    const bag = this.petBag(), p = this.player, s = p.inv[k];
    if (!bag) { this.log('Önce bir toplayıcı hayvan çağır.', 'warn'); return false; }
    if (!s) return false;
    if (I[s.id].type === 'pet') { this.log('Mühürler hayvan çantasına konmaz.', 'warn'); return false; }
    const it = I[s.id];
    if (it.stack) for (const b of bag) if (b && b.id === s.id && b.n < it.stack) { const add = Math.min(s.n, it.stack - b.n); b.n += add; s.n -= add; if (!s.n) { p.inv[k] = null; this.emit('inv'); return true; } }
    const j = bag.indexOf(null);
    if (j < 0) { this.log('Hayvanın çantası dolu.', 'warn'); this.emit('inv'); return false; }
    bag[j] = s; p.inv[k] = null;
    this.emit('inv');
    return true;
  };
  function bagAdd(bag, id, n) {
    const it = I[id];
    if (it.stack) for (const b of bag) if (b && b.id === id && b.n < it.stack) { const add = Math.min(n, it.stack - b.n); b.n += add; n -= add; if (!n) return 0; }
    while (n > 0) { const j = bag.indexOf(null); if (j < 0) return n; const add = it.stack ? Math.min(n, it.stack) : 1; bag[j] = { id, n: add, plus: 0 }; n -= add; }
    return 0;
  }

  // ---------- TP ve dönüşüm ----------
  P.petGainXp = function (xp) {
    const e = this.pets.fight;
    if (!e || e.slot.pet.dead) return;
    if (dist(e, this.player) > 45) return;
    const st = e.slot.pet, cap = this.player.lv;
    st.xp += Math.round(xp * R.xpShare);
    let up = false;
    while (st.lv < cap && st.xp >= R.xpNeed(st.lv)) { st.xp -= R.xpNeed(st.lv); st.lv++; up = true; }
    if (st.lv >= cap) st.xp = Math.min(st.xp, R.xpNeed(st.lv) - 1);
    if (up) {
      st.hp = petStats(e.def, st.lv).maxHp;
      this.emit('petLevel', { id: e.id, lv: st.lv });
      const nf = formIndex(e.def, st.lv);
      if (nf !== e.form) {
        const oldName = e.def.forms[e.form].name, newName = e.def.forms[nf].name;
        e.form = nf;
        if (!st.named) st.name = newName;
        this.emit('petEvolve', { id: e.id, from: oldName, to: newName });
        this.log(`${oldName} dönüştü: ${newName}!`, 'epic');
      } else this.log(`${st.name} seviye ${st.lv} oldu.`, 'good');
    }
  };

  // ---------- hasar ----------
  P.hitPet = function (m, v) {
    const e = this.pets.fight;
    if (!e) return;
    if (this.player.god) v = 0;
    const st = e.slot.pet;
    st.hp -= v; e.lastCombat = this.t;
    this.emit('dmg', { id: e.id, v, crit: false, kind: 'phys', on: 'pet' });
    if (!e.target && m && !m.dead) e.target = m.id;
    if (st.hp <= 0) this.killPet('Savaşta düştü');
  };
  P.killPet = function (why) {
    const e = this.pets.fight;
    if (!e) return;
    const st = e.slot.pet;
    st.hp = 0; st.dead = true;
    this.emit('petDied', { id: e.id, x: e.x, z: e.z });
    this.log(`${st.name} öldü (${why}). Hayat Otu ile diriltebilirsin.`, 'bad');
    this.dismissPet('fight', true);
  };

  // ---------- her kare ----------
  P.petFollowPoint = function (side) {
    const p = this.player, a = p.rot + Math.PI + side * 0.75;
    return { x: p.x + Math.sin(a) * 2.2, z: p.z + Math.cos(a) * 2.2 };
  };
  P.petMove = function (e, gx, gz, speed, dt, stop) {
    const r = this.stepToward(e, gx, gz, speed, dt, stop, false);
    if (r === 'blocked' || r === 'slow') { e.stuck += dt; if (e.stuck > 1.2) { e.stuck = 0; e.x = gx; e.z = gz; e.y = T.groundY(gx, gz); } }
    else e.stuck = 0;
    return r;
  };
  P.petCatchUp = function (e) {
    const p = this.player;
    if (dist(e, p) > 40) {
      const f = this.petFollowPoint(e.ptype === 'fight' ? -1 : 1);
      const ok = T.walkable(f.x, f.z);
      e.x = ok ? f.x : p.x; e.z = ok ? f.z : p.z; e.y = T.groundY(e.x, e.z); e.target = null; e.carry = null;
      this.emit('petBlink', { id: e.id });
      return true;
    }
    return false;
  };
  P.playerSpeed = function () { return (this.caravan ? D.player.speedCaravan : D.player.speed) * (this.player.fast ? 2 : 1); };

  P.updateGrabPet = function (e, dt) {
    const p = this.player, st = e.slot.pet, def = e.def;
    e.moving = false;
    if (this.t >= e.nextTick) {
      e.nextTick = this.t + 1;
      if (this.petDaysLeft(st) <= 0) { this.log(`${st.name}: çağırma süresi doldu.`, 'warn'); this.dismissPet('grab', true); return; }
    }
    if (this.petCatchUp(e)) return;
    const sp = Math.max(def.speed, this.playerSpeed() * 1.2);
    // ganimet seç
    if (e.carry && !this.loot.has(e.carry)) e.carry = null;
    if (!e.carry && !p.dead) {
      let best = null, bd = 1e9;
      for (const L of this.loot.values()) {
        if (L.skip && L.skip > this.t) continue;
        const d = Math.hypot(L.x - p.x, L.z - p.z);
        if (d > def.reach) continue;
        const de = dist(L, e);
        if (de < bd) { bd = de; best = L; }
      }
      if (best) e.carry = best.id;
    }
    if (e.carry) {
      const L = this.loot.get(e.carry);
      if (dist(e, L) < 0.7) { this.petPickup(L); e.carry = null; return; }
      this.petMove(e, L.x, L.z, sp, dt, 0.3);
      return;
    }
    const f = this.petFollowPoint(1);
    if (Math.hypot(f.x - e.x, f.z - e.z) > 1.2) this.petMove(e, f.x, f.z, Math.min(sp, Math.max(3, Math.hypot(f.x - e.x, f.z - e.z) * 2.2)), dt, 0.4);
  };
  P.petPickup = function (L) {
    const p = this.player, bag = this.pets.grab.slot.pet.bag;
    if (L.gold) { p.gold += L.gold; this.emit('coin'); this.emit('float', { x: L.x, z: L.z, y: L.y + 1, text: '+' + L.gold, cls: 'gold' }); L.gold = 0; }
    const rest = [];
    for (const [id, n] of L.items) {
      let left = this.addItem(id, n);
      let where = 'çantana';
      if (left) { left = bagAdd(bag, id, left); where = 'hayvanın çantasına'; }
      if (left) rest.push([id, left]);
      if (left < n) { const it = I[id]; this.log(`${this.pets.grab.slot.pet.name} topladı: ${it.name}${n - left > 1 ? ' ×' + (n - left) : ''} (${where})`, (it.type === 'weapon' || it.type === 'armor') ? 'epic' : ''); }
    }
    this.emit('petPick', { id: 'pet-grab', x: L.x, z: L.z });
    if (rest.length) { L.items = rest; L.skip = this.t + 8; this.log('Çantalar dolu, ganimet yerde kaldı.', 'warn'); return; }
    this.loot.delete(L.id);
    this.emit('lootGone', { id: L.id, picked: true });
    this.emit('inv');
  };

  P.updateFightPet = function (e, dt) {
    const p = this.player, st = e.slot.pet, def = e.def, S = petStats(def, st.lv);
    e.moving = false;
    // açlık ve bakım (saniyede bir)
    if (this.t >= e.nextTick) {
      e.nextTick = this.t + 1;
      st.hgp = Math.max(0, st.hgp - R.hungerPerSec);
      if (st.auto) {
        if (st.hgp < 40 && this.count('yem') > 0) this.cmdPetFeed(e.slot);
        if (st.hp < S.maxHp * 0.45 && this.count('merhem') > 0) this.cmdPetHeal(e.slot);
      }
      if (st.hgp <= 0) {
        st.hp -= S.maxHp * R.starveDmg;
        if (!e.hungryWarned) { e.hungryWarned = true; this.log(`${st.name} açlıktan eriyor! Kuru Et ver.`, 'bad'); }
        if (st.hp <= 0) { this.killPet('açlıktan'); return; }
      } else e.hungryWarned = false;
      if (this.t - e.lastCombat > 6 && st.hgp > 0) st.hp = Math.min(S.maxHp, st.hp + S.maxHp * 0.02);
    }
    if (this.petCatchUp(e)) return;
    // hedef seç
    let tg = e.target ? this.mobs.get(e.target) : null;
    if (tg && (tg.dead || dist(tg, p) > 26)) { tg = null; e.target = null; }
    if (!p.dead) {
      const pt = p.target ? this.mobs.get(p.target) : null;
      if (pt && !pt.dead && (p.autoAttack || p.pending || this.t - p.lastCombat < 3) && dist(pt, p) < 22) tg = pt;
      if (!tg) {
        let bd = 12;
        for (const m of this.mobs.values()) {
          if (m.dead || m.state !== 'chase' || (m.target !== 'player' && m.target !== 'pet' && m.target !== 'caravan')) continue;
          const d = dist(m, p);
          if (d < bd) { bd = d; tg = m; }
        }
      }
    } else tg = null;
    e.target = tg ? tg.id : null;
    const sp = Math.max(def.speed, this.playerSpeed() * 1.15);
    if (tg) {
      const range = def.range + tg.rad;
      const d = dist(e, tg);
      if (d > range) this.petMove(e, tg.x, tg.z, sp, dt, range * 0.85);
      else {
        e.rot = Math.atan2(tg.x - e.x, tg.z - e.z);
        if (this.t >= e.nextAtk) {
          e.nextAtk = this.t + def.atkInt;
          e.lastCombat = this.t;
          this.emit('swing', { id: e.id });
          this.later(0.25, () => {
            if (tg.dead || this.pets.fight !== e) return;
            if (dist(e, tg) > range + 1.5) return;
            const r = this.calcDmg(S.atk, tg.def.def, 1, 0.08, clamp(st.lv - tg.lv, -8, 0));
            this.hitMob(tg, r.v, r.crit, 'pet', 'pet');
          });
        }
      }
      return;
    }
    const f = this.petFollowPoint(-1);
    const df = Math.hypot(f.x - e.x, f.z - e.z);
    if (df > 1.2) this.petMove(e, f.x, f.z, Math.min(sp, Math.max(3, df * 2.2)), dt, 0.4);
  };

  P.updatePets = function (dt) {
    if (this.pets.grab) this.updateGrabPet(this.pets.grab, dt);
    if (this.pets.fight) this.updateFightPet(this.pets.fight, dt);
  };

  // ---------- eşya kullanımı ----------
  P.usePetItem = function (id) {
    if (id === 'yem') return this.cmdPetFeed();
    if (id === 'merhem') return this.cmdPetHeal();
    if (id === 'hayatotu') return this.cmdPetRevive();
    if (id === 'muska') return this.cmdPetExtend();
    return false;
  };

  // ---------- kayıt ----------
  P.serializePets = function () {
    const inv = this.player.inv;
    return { grab: this.pets.grab ? inv.indexOf(this.pets.grab.slot) : -1, fight: this.pets.fight ? inv.indexOf(this.pets.fight.slot) : -1 };
  };
  P.loadPets = function (sp) {
    // eski kayıtlardaki mühürlere eksik durum bilgisini ekle
    this.player.inv.forEach(s => { if (s && I[s.id] && I[s.id].type === 'pet' && !s.pet) s.pet = this.newPetState(s.id); });
    if (!sp || this.player.dead) return;
    for (const k of [sp.grab, sp.fight]) if (k >= 0 && this.player.inv[k]) this.cmdPetSummon(k);
    this.drain();
  };

  // ---------- yönetici ----------
  P.adminPets = function () {
    let n = 0;
    for (const id in I) if (I[id].type === 'pet' && !this.player.inv.some(s => s && s.id === id)) { if (this.addItem(id, 1) === 0) n++; }
    this.addItem('yem', 50); this.addItem('merhem', 20); this.addItem('hayatotu', 5); this.addItem('muska', 3);
    this.emit('inv');
    this.log(`Yönetici: ${n} hayvan mührü ve bakım malzemesi eklendi.`, 'good');
  };
  P.adminPetLevel = function (d) {
    const e = this.pets.fight;
    if (!e) { this.log('Önce bir savaş hayvanı çağır.', 'warn'); return; }
    const st = e.slot.pet, target = Math.min(this.player.lv, st.lv + d);
    if (target <= st.lv) { this.log('Hayvan seviyesi senin seviyeni geçemez.', 'warn'); return; }
    let need = 0; for (let l = st.lv; l < target; l++) need += R.xpNeed(l);
    this.petGainXp((need - st.xp + 1) / R.xpShare);
  };
  P.adminPetCare = function () {
    for (const o of this.petSlots()) {
      const st = o.s.pet;
      if (o.def.type === 'fight') { st.dead = false; st.hp = petStats(o.def, st.lv).maxHp; st.hgp = 100; }
      else st.expires = Math.max(st.expires, Date.now() + o.def.days * R.dayMs);
    }
    this.emit('petCare', { what: 'admin' });
    this.log('Yönetici: tüm hayvanlar doyuruldu, dirildi, süreleri yenilendi.', 'good');
  };
})();
