/* ============================================================
   KERVAN YOLU — logic.js
   Oyun mantığı. Ekrana ne çizildiğini bilmez; sadece durum
   tutar, komut alır ve olay (event) üretir. Aynı sınıf ileride
   çok oyunculu sunucuda da çalışabilecek şekilde yazıldı.
   ============================================================ */
var KY = (typeof KY !== 'undefined') ? KY : {};

KY.World = (function () {
  const T = KY.Terrain, D = KY.DATA;
  const M = D.monsters, I = D.items, S = D.skills, G = D.goods, TR = D.trade;
  const INV_SIZE = 56;   // iki sayfa × 28 göz (Silkroad düzeni: 4 sütun)

  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rndi = (a, b) => Math.floor(rnd(a, b + 1));

  class World {
    constructor(save) {
      this.t = 0;
      this.events = [];
      this.timers = [];
      this.uid = 1;
      this.mobs = new Map();
      this.loot = new Map();
      this.projectiles = [];
      this.pets = { grab: null, fight: null };
      this.caravan = null;
      this.npcs = [];
      this.market = {};
      this.marketPrev = {};
      this.nextMarket = 50;
      this.quest = { i: 0, n: 0 };
      this.lastArea = '';
      this.stats = null;
      this.buildNpcs();
      this.initMarket();
      this.player = this.newPlayer();
      if (save) this.load(save);
      this.spawnAll();
      this.recalc();
      if (!save) { this.player.hp = this.stats.maxHp; this.player.mp = this.stats.maxMp; }
      this.questState();
      this.lastArea = T.areaName(this.player.x, this.player.z);
      if (this.loadPets) this.loadPets(save ? save.pets : null);
    }

    // ---------- kurulum ----------
    newPlayer() {
      const tw = T.TOWNS.sarikum, sp = D.towns.sarikum.spawn;
      const inv = new Array(INV_SIZE).fill(null);
      inv[0] = { id: 'hp1', n: 10 };
      inv[1] = { id: 'mp1', n: 6 };
      const p = {
        id: 'player', kind: 'player', name: 'Gezgin', rad: 0.45,
        x: tw.x + sp.dx, z: tw.z + sp.dz, y: 0, rot: Math.PI,
        lv: 1, xp: 0, sp: 0, str: 20, int: 20, points: 0,
        hp: 1, mp: 1, gold: 60,
        mastery: { kilic: 1, ates: 1 },
        inv, eq: World.freshEq(), look: { g: 'f', hair: 0, skin: 0 },
        trade: { lv: 1, xp: 0 },
        cds: {}, buffs: [], target: null, autoAttack: false, pending: null, pendingTarget: null,
        interact: null, pickup: null, path: [], moving: false, nextAtk: 0, gcd: 0, potCd: 0,
        lastCombat: -99, dead: false, openNpc: null, trail: [], stuck: 0, lastMoveT: -99
      };
      p.y = T.groundY(p.x, p.z);
      return p;
    }
    buildNpcs() {
      for (const tid in D.towns) {
        const tw = T.TOWNS[tid], L = D.towns[tid];
        for (const n of L.npcs) {
          const x = tw.x + n.dx, z = tw.z + n.dz;
          const role = D.npcRoles[n.role];
          this.npcs.push({
            id: tid + '-' + n.role, kind: 'npc', role: n.role, name: n.name, title: role.title,
            town: tid, x, z, y: T.groundY(x, z), rot: Math.atan2(tw.x - x, tw.z - z), rad: 0.6,
            shop: n.shop || role.shop || null, look: n.look || null, g: n.g || 'm'
          });
        }
      }
    }
    initMarket() {
      for (const tid in T.TOWNS) {
        this.market[tid] = {}; this.marketPrev[tid] = {};
        for (const g in G) { const v = rnd(0.9, 1.1); this.market[tid][g] = v; this.marketPrev[tid][g] = v; }
      }
    }
    spawnAll() {
      D.spawns.forEach((s, gi) => {
        for (let k = 0; k < s.n; k++) this.makeMob(s.type, s, gi);
      });
    }
    makeMob(type, area, group, opts) {
      const def = opts && opts.def ? opts.def : M[type];
      const id = 'm' + (this.uid++);
      const pos = opts && opts.pos ? opts.pos : this.randomPoint(area);
      const m = {
        id, kind: 'mob', type, def, lv: def.lv, name: def.name,
        hp: def.hp, maxHp: def.hp, x: pos.x, z: pos.z, y: T.groundY(pos.x, pos.z), rot: rnd(0, 6.28),
        rad: 0.55 * def.size, area, group, home: { x: pos.x, z: pos.z },
        state: 'idle', target: null, wanderTo: null, wanderAt: this.t + rnd(1, 6),
        nextAtk: 0, dead: false, respawnAt: 0, moving: false, burn: null, ambush: !!(opts && opts.ambush), lastHit: -99
      };
      this.mobs.set(id, m);
      return m;
    }
    randomPoint(area) {
      for (let k = 0; k < 40; k++) {
        const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * area.r;
        const x = area.x + Math.cos(a) * r, z = area.z + Math.sin(a) * r;
        if (T.walkable(x, z) && !T.townAt(x, z, 4) && !T.collides(x, z, 0.6)) return { x, z };
      }
      return { x: area.x, z: area.z };
    }

    // ---------- yardımcılar ----------
    emit(type, data) { const e = data || {}; e.type = type; this.events.push(e); }
    log(text, cls) { this.emit('log', { text, cls: cls || '' }); }
    drain() { const e = this.events; this.events = []; return e; }
    later(delay, fn) { this.timers.push({ at: this.t + delay, fn }); }
    getEnt(id) {
      if (!id) return null;
      if (id === 'player') return this.player;
      if (id === 'caravan') return this.caravan;
      if (id === 'pet-grab') return this.pets.grab;
      if (id === 'pet-fight') return this.pets.fight;
      return this.mobs.get(id) || this.npcs.find(n => n.id === id) || this.loot.get(id) || null;
    }
    town(tid) { return T.TOWNS[tid]; }

    // kuşanılan eşyanın değeri (güçlendirme dahil)
    static eqValue(e) {
      if (!e) return { atk: 0, def: 0 };
      const it = I[e.id], E = D.enhance, pl = e.plus || 0;
      return { atk: it.atk ? it.atk * (1 + E.bonus * pl) + pl * 2 : 0, def: it.def ? it.def * (1 + E.bonus * pl) + pl : 0 };
    }
    recalc() {
      const p = this.player;
      const w = p.eq.weapon;
      const wAtk = w ? World.eqValue(w).atk : 3;
      let aDef = 0, hpB = 0, mpB = 0, atkB = 0, magB = 0, critB = 0;
      for (const slot of D.eqSlots) {
        const e = p.eq[slot];
        if (!e || slot === 'weapon') continue;
        const it = I[e.id];
        aDef += World.eqValue(e).def;
        hpB += it.hpBonus || 0; mpB += it.mpBonus || 0; atkB += it.atkBonus || 0; magB += it.magBonus || 0; critB += it.critBonus || 0;
      }
      let defMul = 1;
      for (const b of p.buffs) if (b.def) defMul += b.def;
      this.stats = {
        maxHp: Math.round(100 + p.str * 7 + p.lv * 18 + hpB),
        maxMp: Math.round(60 + p.int * 6 + p.lv * 10 + mpB),
        phy: Math.round(wAtk + atkB + p.str * 1.1 + p.lv * 1.5),
        mag: Math.round(p.int * 1.5 + p.lv * 2 + wAtk * 0.3 + magB),
        def: Math.round((aDef + p.str * 0.35 + p.lv * 0.8) * defMul),
        crit: 0.06 + critB, wAtk: Math.round(wAtk), aDef: Math.round(aDef)
      };
      if (p.hp > this.stats.maxHp) p.hp = this.stats.maxHp;
      if (p.mp > this.stats.maxMp) p.mp = this.stats.maxMp;
      return this.stats;
    }

    calcDmg(atk, def, mult, crit, lvDiff) {
      let v = atk * mult * rnd(0.9, 1.1) - def * 0.6;
      if (lvDiff) v *= clamp(1 + lvDiff * 0.06, 0.5, 1.4);
      const isCrit = Math.random() < crit;
      if (isCrit) v *= 1.8;
      return { v: Math.max(1, Math.round(v)), crit: isCrit };
    }

    // ---------- envanter ----------
    count(id) { let n = 0; for (const s of this.player.inv) if (s && s.id === id) n += s.n || 1; return n; }
    freeSlots() { return this.player.inv.filter(s => !s).length; }
    addItem(id, n, plus) {
      const inv = this.player.inv, it = I[id];
      n = n || 1;
      if (it.stack) {
        for (const s of inv) {
          if (s && s.id === id && s.n < it.stack) { const add = Math.min(n, it.stack - s.n); s.n += add; n -= add; if (!n) return 0; }
        }
        while (n > 0) {
          const k = inv.indexOf(null);
          if (k < 0) return n;
          const add = Math.min(n, it.stack); inv[k] = { id, n: add }; n -= add;
        }
        return 0;
      }
      while (n > 0) {
        const k = inv.indexOf(null);
        if (k < 0) return n;
        inv[k] = { id, n: 1, plus: plus || 0 };
        if (it.type === 'pet' && this.newPetState) inv[k].pet = this.newPetState(id);
        n--;
      }
      return 0;
    }
    removeItem(id, n) {
      const inv = this.player.inv;
      for (let k = inv.length - 1; k >= 0 && n > 0; k--) {
        const s = inv[k];
        if (s && s.id === id) { const take = Math.min(n, s.n || 1); s.n -= take; n -= take; if (s.n <= 0) inv[k] = null; }
      }
    }

    // ---------- komutlar ----------
    canAct() { return !this.player.dead; }
    clearIntent() { const p = this.player; p.autoAttack = false; p.pending = null; p.interact = null; p.pickup = null; p.path = []; p.routeT = 0; }

    cmdMove(x, z) {
      if (!this.canAct()) return;
      const p = this.player;
      this.clearIntent();
      p.path = T.route(p.x, p.z, x, z);
      p.stuck = 0;
      this.emit('moveMarker', { x, z });
    }
    cmdAttack(id) {
      if (!this.canAct()) return;
      const m = this.mobs.get(id);
      if (!m || m.dead) return;
      const p = this.player;
      this.clearIntent();
      p.target = id; p.autoAttack = true;
      this.emit('target', { id });
    }
    cmdSelect(id) { this.player.target = id; this.emit('target', { id }); }
    cmdInteract(id) {
      if (!this.canAct()) return;
      const n = this.npcs.find(q => q.id === id);
      if (!n) return;
      this.clearIntent();
      this.player.interact = id;
      this.player.target = id;
      this.emit('target', { id });
    }
    cmdPickup(id) {
      if (!this.canAct()) return;
      if (!this.loot.has(id)) return;
      this.clearIntent();
      this.player.pickup = id;
    }
    cmdCloseNpc() { this.player.openNpc = null; }
    cmdCycleTarget() {
      const p = this.player;
      let best = null, bd = 26;
      const cur = p.target;
      for (const m of this.mobs.values()) {
        if (m.dead || m.id === cur) continue;
        const d = dist(p, m);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) this.cmdSelect(best.id);
    }
    nearestHostile(range) {
      const p = this.player;
      let best = null, bd = range;
      for (const m of this.mobs.values()) {
        if (m.dead) continue;
        const d = dist(p, m) - m.rad;
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    }

    skillReady(id) {
      const p = this.player, sk = S[id];
      if (p.mastery[sk.tree] < sk.unlock) return 'locked';
      if (this.t < (p.cds[id] || 0)) return 'cooldown';
      if (p.mp < sk.mp) return 'mp';
      return 'ok';
    }
    cmdSkill(id) {
      if (!this.canAct()) return;
      const p = this.player, sk = S[id];
      const st = this.skillReady(id);
      if (st === 'locked') { this.log(`${sk.name} için ${D.trees[sk.tree].name} ${sk.unlock}. seviye gerekli.`, 'warn'); return; }
      if (st === 'cooldown') return;
      if (st === 'mp') { this.log('Yeterli ruh (MP) yok.', 'warn'); return; }
      if (this.t < p.gcd) return;
      if (sk.self) {
        if (sk.aoe && !this.nearestHostile(sk.aoe + 1)) { this.log('Çevrende düşman yok.', 'warn'); return; }
        this.castSkill(sk, null);
        return;
      }
      let tg = p.target ? this.mobs.get(p.target) : null;
      if (!tg || tg.dead) tg = this.nearestHostile(22);
      if (!tg) { this.log('Yakında hedef yok.', 'warn'); return; }
      p.target = tg.id; p.autoAttack = true; p.interact = null; p.pickup = null; p.path = []; p.routeT = 0;
      this.emit('target', { id: tg.id });
      if (dist(p, tg) <= sk.range + tg.rad) this.castSkill(sk, tg);
      else { p.pending = id; p.pendingTarget = tg.id; }
    }
    castSkill(sk, tg) {
      const p = this.player, st = this.stats, m = p.mastery[sk.tree];
      p.mp -= sk.mp;
      p.cds[sk.id] = this.t + sk.cd;
      p.gcd = this.t + 0.45;
      p.nextAtk = Math.max(p.nextAtk, this.t + 0.7);
      p.lastCombat = this.t;
      if (tg) p.rot = Math.atan2(tg.x - p.x, tg.z - p.z);
      const mult = sk.mult ? sk.mult[0] + sk.mult[1] * m : 1;
      this.emit('cast', { id: 'player', skill: sk.id, target: tg ? tg.id : null });
      const lvd = tg ? p.lv - tg.lv : 0;
      switch (sk.id) {
        case 'yarma':
          this.later(0.25, () => {
            if (tg.dead) return;
            const r = this.calcDmg(st.phy, tg.def.def, mult, st.crit + 0.1, Math.min(0, lvd));
            this.hitMob(tg, r.v, r.crit, 'phys');
          });
          break;
        case 'kasirga':
          this.later(0.2, () => {
            for (const mb of this.mobs.values()) {
              if (mb.dead || dist(p, mb) > sk.aoe + mb.rad) continue;
              const r = this.calcDmg(st.phy, mb.def.def, mult, st.crit, Math.min(0, p.lv - mb.lv));
              this.hitMob(mb, r.v, r.crit, 'phys');
            }
          });
          break;
        case 'demir':
          p.buffs = p.buffs.filter(b => b.id !== 'demir');
          p.buffs.push({ id: 'demir', def: sk.buff.def, until: this.t + sk.buff.dur, dur: sk.buff.dur });
          this.recalc();
          this.log('Demir Beden: savunman arttı.', 'good');
          break;
        case 'atesTopu': {
          const pid = 'pr' + (this.uid++);
          const pr = { id: pid, skill: 'atesTopu', x: p.x, z: p.z, y: p.y + 1.4, target: tg.id, speed: 24, mult, born: this.t };
          this.later(0.18, () => { this.projectiles.push(pr); this.emit('projectile', { id: pid, skill: 'atesTopu' }); });
          break;
        }
        case 'alevHalka':
          this.later(0.35, () => {
            const cx = tg.x, cz = tg.z;
            this.emit('fx', { kind: 'flameRing', x: cx, z: cz, r: sk.aoe });
            for (const mb of this.mobs.values()) {
              if (mb.dead || Math.hypot(mb.x - cx, mb.z - cz) > sk.aoe + mb.rad) continue;
              const r = this.calcDmg(st.mag, mb.def.def * 0.8, mult, st.crit, Math.min(0, p.lv - mb.lv));
              this.hitMob(mb, r.v, r.crit, 'mag');
              mb.burn = { dmg: Math.max(1, Math.round(r.v * sk.burn[0])), ticks: sk.burn[1], next: this.t + 1 };
            }
          });
          break;
        case 'sifa': {
          const v = Math.round(st.maxHp * (sk.heal[0] + sk.heal[1] * m));
          this.healPlayer(v, 'hp');
          break;
        }
      }
    }
    healPlayer(v, what) {
      const p = this.player, st = this.stats;
      if (what === 'hp') { const a = Math.min(v, st.maxHp - p.hp); p.hp += a; this.emit('heal', { id: 'player', v: Math.round(a), what }); }
      else { const a = Math.min(v, st.maxMp - p.mp); p.mp += a; this.emit('heal', { id: 'player', v: Math.round(a), what }); }
    }
    cmdPotion(kind) {
      if (!this.canAct()) return;
      const p = this.player;
      if (this.t < p.potCd) return;
      const order = kind === 'hp' ? ['hp2', 'hp1'] : ['mp2', 'mp1'];
      const st = this.stats;
      const missing = kind === 'hp' ? st.maxHp - p.hp : st.maxMp - p.mp;
      let pick = null;
      // eksik az ise küçük iksiri tercih et
      const pref = missing < (kind === 'hp' ? 300 : 200) ? order.slice().reverse() : order;
      for (const id of pref) if (this.count(id) > 0) { pick = id; break; }
      if (!pick) { this.log(kind === 'hp' ? 'Can iksirin kalmadı.' : 'Ruh iksirin kalmadı.', 'warn'); return; }
      this.drink(pick);
    }
    drink(id) {
      const p = this.player, it = I[id];
      if (this.t < p.potCd) return;
      p.potCd = this.t + 1;
      this.removeItem(id, 1);
      if (it.hp) this.healPlayer(it.hp, 'hp');
      if (it.mp) this.healPlayer(it.mp, 'mp');
      this.emit('potion', { kind: it.hp ? 'hp' : 'mp' });
    }
    cmdUseSlot(k) {
      const p = this.player, s = p.inv[k];
      if (!s || p.dead) return;
      const it = I[s.id];
      if (it.type === 'potion') { this.drink(s.id); return; }
      if (it.type === 'pet') { this.cmdPetToggle(k); return; }
      if (it.type === 'petitem') { this.usePetItem(s.id); return; }
      if (D.isEquip(it)) this.cmdEquip(k);
    }
    // eşyanın gideceği yuva (yüzük: boş olan ilk yüzük yuvası)
    slotFor(it, want) {
      if (!D.isEquip(it)) return null;
      if (it.type === 'ring') {
        if (want === 'ring1' || want === 'ring2') return want;
        const p = this.player;
        return !p.eq.ring1 ? 'ring1' : !p.eq.ring2 ? 'ring2' : 'ring1';
      }
      return it.type;
    }
    cmdEquip(k, want) {
      const p = this.player, s = p.inv[k];
      if (!s || p.dead) return false;
      const it = I[s.id], slot = this.slotFor(it, want);
      if (!slot || (want && slot !== want)) { if (want) this.log(`${it.name} bu yuvaya takılmaz.`, 'warn'); return false; }
      if (p.lv < it.lv) { this.log(`${it.name} için ${it.lv}. seviye gerekli.`, 'warn'); return false; }
      const old = p.eq[slot];
      const hpR = p.hp / this.stats.maxHp, mpR = p.mp / this.stats.maxMp;
      p.eq[slot] = { id: s.id, plus: s.plus || 0 };
      p.inv[k] = old ? { id: old.id, n: 1, plus: old.plus } : null;
      this.recalc();
      p.hp = Math.min(this.stats.maxHp, Math.max(p.hp, Math.round(this.stats.maxHp * hpR))); p.mp = Math.min(this.stats.maxMp, Math.max(p.mp, Math.round(this.stats.maxMp * mpR)));
      this.emit('equip', { slot });
      this.log(`${it.name}${s.plus ? ' +' + s.plus : ''} kuşanıldı.`, 'good');
      this.questState();
      return true;
    }
    cmdUnequip(slot, k) {
      const p = this.player, e = p.eq[slot];
      if (!e || p.dead) return false;
      if (k == null || p.inv[k]) k = p.inv.indexOf(null);
      if (k < 0) { this.log('Çantada yer yok.', 'warn'); return false; }
      p.inv[k] = { id: e.id, n: 1, plus: e.plus };
      p.eq[slot] = null;
      this.recalc();
      this.emit('equip', { slot });
      this.log(`${I[e.id].name} çıkarıldı.`);
      return true;
    }
    // çanta içinde iki gözü yer değiştir (sürükle-bırak)
    cmdMoveSlot(a, b) {
      const inv = this.player.inv;
      if (a === b || a < 0 || b < 0 || a >= INV_SIZE || b >= INV_SIZE) return;
      const A = inv[a], B = inv[b];
      if (A && B && A.id === B.id && I[A.id].stack && !A.plus && !B.plus) {
        const mv = Math.min(A.n, I[A.id].stack - B.n);
        B.n += mv; A.n -= mv; if (A.n <= 0) inv[a] = null;
      } else { inv[a] = B; inv[b] = A; }
      this.emit('inv');
    }
    cmdSortInv() {
      const p = this.player, order = { weapon: 0, shield: 1, head: 2, shoulder: 3, armor: 4, hands: 5, legs: 6, feet: 7, earring: 8, necklace: 9, ring: 10, potion: 20, petitem: 21, pet: 22, material: 23 };
      const items = p.inv.filter(Boolean);
      items.sort((a, b) => (order[I[a.id].type] ?? 30) - (order[I[b.id].type] ?? 30) || (I[b.id].tier || 0) - (I[a.id].tier || 0) || a.id.localeCompare(b.id));
      p.inv = new Array(INV_SIZE).fill(null);
      items.forEach((it, k) => p.inv[k] = it);
      this.emit('inv');
    }
    cmdDropSlot(k) {
      const s = this.player.inv[k];
      if (s && this.isSummoned && this.isSummoned(s)) { this.log('Önce hayvanı mühre geri gönder.', 'warn'); return false; }
      this.player.inv[k] = null; this.emit('inv'); return true;
    }

    nearNpc(role) {
      const p = this.player;
      if (!p.openNpc) return null;
      const n = this.npcs.find(q => q.id === p.openNpc);
      if (!n || (role && n.role !== role) || dist(p, n) > 6) return null;
      return n;
    }
    shopOf(n) {
      if (!n) return null;
      if (n.role === 'demirci') return D.towns[n.town].npcs.find(q => q.role === 'demirci').shop;
      return n.shop;
    }
    cmdBuy(id, qty) {
      const n = this.nearNpc();
      const shop = this.shopOf(n);
      if (!shop || shop.indexOf(id) < 0) return false;
      const p = this.player, it = I[id];
      qty = Math.max(1, qty | 0);
      const cost = it.price * qty;
      if (p.gold < cost) { this.log('Yeterli altının yok.', 'warn'); return false; }
      const left = this.addItem(id, qty);
      const bought = qty - left;
      if (!bought) { this.log('Çantan dolu.', 'warn'); return false; }
      p.gold -= it.price * bought;
      this.emit('coin');
      this.log(`${it.name}${bought > 1 ? ' ×' + bought : ''} satın alındı (${it.price * bought} altın).`);
      return true;
    }
    cmdSell(k, qty) {
      const n = this.nearNpc();
      if (!n || (n.role !== 'tuccar' && n.role !== 'demirci' && n.role !== 'hayvan')) { this.log('Satmak için bir tüccar, demirci ya da hayvan terbiyecisinin yanında olmalısın.', 'warn'); return false; }
      const p = this.player, s = p.inv[k];
      if (!s) return false;
      if (this.isSummoned && this.isSummoned(s)) { this.log('Önce hayvanı mühre geri gönder.', 'warn'); return false; }
      const it = I[s.id];
      qty = Math.min(qty || s.n || 1, s.n || 1);
      const price = Math.floor(it.sell * (1 + (s.plus || 0) * 0.5)) * qty;
      s.n -= qty;
      if (s.n <= 0) p.inv[k] = null;
      p.gold += price;
      this.emit('coin');
      this.log(`${it.name}${qty > 1 ? ' ×' + qty : ''} satıldı (+${price} altın).`);
      return true;
    }
    cmdEnhance(slot) {
      const n = this.nearNpc('demirci');
      if (!n) return;
      const p = this.player, E = D.enhance, e = p.eq[slot];
      if (!e) return;
      const it = I[e.id];
      if (e.plus >= E.max) { this.log('Bu eşya en üst seviyede.', 'warn'); return; }
      const cost = E.cost(e.plus);
      if (this.count('toz') < 1) { this.log('Güçlendirme Tozu gerekiyor.', 'warn'); return; }
      if (p.gold < cost) { this.log('Yeterli altının yok.', 'warn'); return; }
      p.gold -= cost;
      this.removeItem('toz', 1);
      const ok = Math.random() < E.chance[e.plus];
      const before = e.plus;
      if (ok) e.plus++;
      else if (e.plus >= 3) e.plus--;
      this.recalc();
      this.emit('enhance', { ok, plus: e.plus, before, slot });
      if (ok) this.log(`${it.name} +${e.plus} oldu!`, 'good');
      else this.log(`Güçlendirme başarısız. ${it.name} +${e.plus}.`, 'bad');
      this.questState();
    }
    cmdStat(which) {
      const p = this.player;
      if (p.points <= 0) return;
      p.points--; p[which]++;
      const st0 = this.stats;
      const hpR = p.hp / st0.maxHp, mpR = p.mp / st0.maxMp;
      this.recalc();
      p.hp = Math.round(this.stats.maxHp * hpR); p.mp = Math.round(this.stats.maxMp * mpR);
      this.emit('stats');
    }
    masteryCost(tree) { return 40 + 25 * this.player.mastery[tree]; }
    cmdMastery(tree) {
      const p = this.player, m = p.mastery[tree];
      if (m >= p.lv) { this.log('Ustalık seviyesi karakter seviyeni geçemez.', 'warn'); return; }
      const c = this.masteryCost(tree);
      if (p.sp < c) { this.log('Yeterli yetenek puanı (YP) yok.', 'warn'); return; }
      p.sp -= c; p.mastery[tree]++;
      this.emit('mastery', { tree });
      for (const k in S) if (S[k].tree === tree && S[k].unlock === p.mastery[tree]) this.log(`Yeni yetenek açıldı: ${S[k].name}!`, 'good');
      this.questState();
    }
    cmdRespawn() {
      const p = this.player;
      if (!p.dead) return;
      const nt = T.nearestTown(p.x, p.z).town, sp = D.towns[nt.id].spawn;
      p.x = nt.x + sp.dx; p.z = nt.z + sp.dz; p.y = T.groundY(p.x, p.z);
      p.dead = false;
      this.recalc();
      p.hp = Math.round(this.stats.maxHp * 0.5); p.mp = Math.round(this.stats.maxMp * 0.5);
      const loss = Math.floor(D.player.xpNeed(p.lv) * 0.02);
      p.xp = Math.max(0, p.xp - loss);
      p.target = null; this.clearIntent(); p.trail = [];
      this.emit('respawn', { town: nt.id });
      this.log(`${nt.loc} dirildin.${loss ? ' (-' + loss + ' TP)' : ''}`);
    }
    // ---------- yönetici komutları (test için) ----------
    adminGold(n) {
      const p = this.player;
      p.gold = Math.max(0, Math.min(999999999, p.gold + Math.round(n)));
      this.emit('coin');
      this.log(`Yönetici: ${n >= 0 ? '+' : ''}${Math.round(n).toLocaleString('tr-TR')} altın.`, 'good');
    }
    adminLevel(lv) {
      const p = this.player, max = D.player.maxLv;
      lv = Math.max(1, Math.min(max, Math.round(lv)));
      if (lv === p.lv) return;
      if (lv > p.lv) {
        const d = lv - p.lv;
        p.lv = lv; p.points += 3 * d; p.str += d; p.int += d;
      } else {
        // seviye düşünce dağıtılmış puanlar sıfırlanır
        p.lv = lv; p.str = 20 + (lv - 1); p.int = 20 + (lv - 1); p.points = 3 * (lv - 1);
        p.mastery.kilic = Math.min(p.mastery.kilic, lv); p.mastery.ates = Math.min(p.mastery.ates, lv);
      }
      p.xp = 0;
      this.recalc();
      p.hp = this.stats.maxHp; p.mp = this.stats.maxMp;
      this.emit('levelup', { lv: p.lv, admin: true });
      this.emit('stats');
      this.log(`Yönetici: seviye ${p.lv}.`, 'good');
    }
    adminSP(n) { this.player.sp += Math.round(n); this.emit('stats'); this.log(`Yönetici: +${Math.round(n).toLocaleString('tr-TR')} YP.`, 'good'); }
    adminMastery() {
      const p = this.player;
      p.mastery.kilic = p.lv; p.mastery.ates = p.lv;
      this.emit('mastery', { tree: 'kilic' });
      this.log('Yönetici: ustalıklar seviyene çıktı, tüm yetenekler açık.', 'good');
      this.questState();
    }
    adminStats() {
      const p = this.player;
      if (!p.points) return;
      const half = Math.ceil(p.points / 2);
      p.str += half; p.int += p.points - half; p.points = 0;
      this.recalc(); p.hp = this.stats.maxHp; p.mp = this.stats.maxMp;
      this.emit('stats');
    }
    adminHeal() {
      const p = this.player;
      if (p.dead) { this.cmdRespawn(); }
      this.recalc(); p.hp = this.stats.maxHp; p.mp = this.stats.maxMp; p.cds = {};
      if (this.caravan) this.caravan.hp = this.caravan.maxHp;
      this.emit('heal', { id: 'player', v: 0, what: 'hp' });
    }
    adminGive(id, n) {
      const left = this.addItem(id, n);
      if (left >= n) { this.log('Çantada yer yok.', 'warn'); return; }
      this.emit('inv');
      this.log(`Yönetici: ${I[id].name} ×${n - left}.`, 'good');
    }
    adminAllSwords() {
      const have = new Set(Object.values(this.player.eq).filter(Boolean).map(e => e.id));
      for (const s of this.player.inv) if (s) have.add(s.id);
      let n = 0;
      for (const id in I) if (I[id].type === 'weapon' && !have.has(id)) { if (this.addItem(id, 1) === 0) n++; }
      this.emit('inv');
      this.log(n ? `Yönetici: ${n} kılıç çantaya eklendi.` : 'Tüm kılıçlar zaten elinde ya da çanta dolu.', n ? 'good' : 'warn');
    }
    adminPlus(slot, plus) {
      const e = this.player.eq[slot];
      if (!e) return;
      e.plus = Math.max(0, Math.min(D.enhance.max, plus | 0));
      this.recalc();
      this.emit('equip', { slot });
      this.questState();
    }
    adminTrade(lv) {
      const t = this.player.trade;
      t.lv = Math.max(1, Math.min(TR.maxLv, lv)); t.xp = 0;
      this.emit('tradeLevel', { lv: t.lv });
    }
    adminTeleport(x, z) {
      const p = this.player;
      let best = null;
      for (let r = 0; r < 30 && !best; r += 1.5) for (let a = 0; a < 6.28 && !best; a += 0.5) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (T.walkable(px, pz) && !T.collides(px, pz, 0.6)) best = { x: px, z: pz };
      }
      if (!best) return;
      if (p.dead) { p.dead = false; this.recalc(); p.hp = this.stats.maxHp; p.mp = this.stats.maxMp; this.emit('respawn', { town: null }); }
      p.x = best.x; p.z = best.z; p.y = T.groundY(p.x, p.z);
      this.clearIntent(); p.target = null; p.openNpc = null; p.trail = [];
      this.emit('teleport', { town: null });
    }
    adminBosses() {
      let n = 0;
      for (const m of this.mobs.values()) if (m.def.unique && m.dead) { m.respawnAt = this.t; n++; }
      this.log(n ? 'Yönetici: büyük canavarlar yeniden doğuyor.' : 'Büyük canavarlar zaten hayatta.', n ? 'good' : 'warn');
    }
    cmdTeleport() {
      const n = this.nearNpc('kapi');
      if (!n) return;
      const p = this.player;
      if (this.caravan) { this.log('Kervanla yol kapısı kullanılamaz. Malları yolda taşımalısın.', 'warn'); return; }
      if (p.gold < TR.teleportCost) { this.log('Yeterli altının yok.', 'warn'); return; }
      p.gold -= TR.teleportCost;
      const dest = n.town === 'sarikum' ? 'taskale' : 'sarikum';
      const tw = T.TOWNS[dest], sp = D.towns[dest].spawn;
      p.x = tw.x + sp.dx; p.z = tw.z + sp.dz; p.y = T.groundY(p.x, p.z);
      p.openNpc = null; p.target = null; this.clearIntent(); p.trail = [];
      this.emit('teleport', { town: dest });
      this.log(`Yol kapısından ${tw.dat} geçtin.`);
    }

    // ---------- ticaret ----------
    load_() { const c = this.caravan; if (!c) return 0; let n = 0; for (const g in c.goods) n += c.goods[g]; return n; }
    capacity() { return TR.capacity(this.player.trade.lv); }
    buyPrice(town, g) { return Math.max(1, Math.round(G[g].base * this.market[town][g])); }
    sellPrice(town, g) {
      const gd = G[g], m = this.market[town][g];
      if (gd.from === town) return Math.round(gd.base * TR.sameTownMult * m);
      return Math.round(gd.base * TR.routeMult * m * (1 + TR.bonus(this.player.trade.lv)));
    }
    cmdTradeBuy(g, qty) {
      const n = this.nearNpc('kervan');
      if (!n) return;
      const p = this.player, gd = G[g];
      if (gd.from !== n.town) return;
      if (p.trade.lv < gd.trade) { this.log(`${gd.name} için ${gd.trade}. tüccar seviyesi gerekli.`, 'warn'); return; }
      if (this.caravan && this.caravan.from !== n.town) { this.log('Önce kervanındaki yükü sat.', 'warn'); return; }
      const room = this.capacity() - this.load_();
      qty = Math.min(qty, room);
      if (qty <= 0) { this.log('Kervanın dolu.', 'warn'); return; }
      const price = this.buyPrice(n.town, g);
      if (p.gold < price) { this.log('Yeterli altının yok.', 'warn'); return; }
      qty = Math.min(qty, Math.floor(p.gold / price));
      p.gold -= price * qty;
      if (!this.caravan) this.newCaravan(n.town);
      const c = this.caravan;
      c.goods[g] = (c.goods[g] || 0) + qty;
      c.cost += price * qty;
      this.emit('coin');
      this.emit('cargo');
      this.log(`${gd.name} ×${qty} kervana yüklendi (${price * qty} altın).`);
    }
    newCaravan(from) {
      const p = this.player, hp = TR.camelHp(p.trade.lv);
      const x = p.x - Math.sin(p.rot) * 2.5, z = p.z - Math.cos(p.rot) * 2.5;
      const ok = T.walkable(x, z) && !T.collides(x, z, 0.8);
      this.caravan = {
        id: 'caravan', kind: 'caravan', name: 'Kervan Devesi', rad: 0.9,
        x: ok ? x : p.x + 1.5, z: ok ? z : p.z + 1.5, y: 0, rot: p.rot,
        hp, maxHp: hp, def: { def: 10 }, lv: p.lv, goods: {}, cost: 0, from,
        moving: false, lastHit: -99, nextAmbush: this.t + 12, dead: false
      };
      this.caravan.y = T.groundY(this.caravan.x, this.caravan.z);
      p.trail = [];
      this.emit('caravanNew');
    }
    cmdTradeSell() {
      const n = this.nearNpc('kervan');
      const c = this.caravan;
      if (!n || !c) return;
      const p = this.player;
      let rev = 0;
      for (const g in c.goods) rev += this.sellPrice(n.town, g) * c.goods[g];
      const profit = rev - c.cost;
      p.gold += rev;
      const route = n.town !== c.from;
      this.caravan = null;
      this.emit('caravanDone');
      this.emit('coin');
      this.log(`Yük satıldı: +${rev} altın (${profit >= 0 ? 'kâr +' + profit : 'zarar ' + profit}).`, profit > 0 ? 'good' : 'bad');
      if (route && profit > 0) {
        const tr = p.trade;
        tr.xp += profit;
        this.log(`Tüccar tecrübesi +${profit}.`);
        while (tr.lv < TR.maxLv && tr.xp >= TR.xpNeed(tr.lv)) {
          tr.xp -= TR.xpNeed(tr.lv); tr.lv++;
          this.emit('tradeLevel', { lv: tr.lv });
          this.log(`Tüccar seviyesi ${tr.lv}! Kervan kapasitesi ${this.capacity()}.`, 'good');
        }
        this.questCheck('trade', { town: n.town, profit });
      }
    }

    // ---------- savaş ----------
    hitMob(m, v, crit, kind, src) {
      if (m.dead) return;
      m.hp -= v;
      m.lastHit = this.t;
      const byPet = src === 'pet';
      if (!byPet) this.player.lastCombat = this.t;
      this.emit('dmg', { id: m.id, v, crit, kind, on: 'mob', by: byPet ? 'pet' : 'player' });
      if (byPet) {
        // hayvan vurunca canavar dikkatini ona çevirebilir (tank gibi)
        if (m.state !== 'chase' || (m.target === 'player' && Math.random() < 0.15)) m.target = 'pet';
        m.state = 'chase';
      } else if (m.state !== 'chase' || (m.target !== 'player' && m.target !== 'pet')) {
        if (!m.ambush || Math.random() < 0.6 || !this.caravan) { m.target = 'player'; }
        m.state = 'chase';
      }
      // sürü: kurtlar birbirini çağırır
      if (m.type === 'kurt' || m.type === 'haydut' || m.type === 'yagmaci') {
        for (const o of this.mobs.values()) {
          if (o !== m && !o.dead && o.type === m.type && o.state !== 'chase' && dist(o, m) < 8) { o.state = 'chase'; o.target = byPet ? 'pet' : 'player'; }
        }
      }
      if (m.hp <= 0) this.killMob(m);
    }
    killMob(m) {
      const p = this.player;
      m.dead = true; m.hp = 0; m.moving = false; m.burn = null;
      m.respawnAt = this.t + (m.def.respawn || rnd(14, 22));
      this.emit('die', { id: m.id });
      const d = m.lv - p.lv;
      const f = d >= 0 ? 1 + 0.1 * Math.min(d, 5) : (d >= -2 ? 1 : Math.max(0.1, 1 + 0.15 * (d + 2)));
      const xp = Math.max(1, Math.round(m.def.xp * f));
      const sp = Math.max(1, Math.round(xp * 0.12));
      this.gainXp(xp, sp);
      if (this.petGainXp) this.petGainXp(xp);
      this.dropLoot(m);
      this.questCheck('kill', { type: m.type });
      if (p.target === m.id) { p.target = null; p.autoAttack = false; p.pending = null; }
      if (m.def.unique) this.log(`${m.name} yenildi!`, 'epic');
      if (m.ambush) this.later(3, () => { this.mobs.delete(m.id); this.emit('remove', { id: m.id }); });
    }
    dropLoot(m) {
      const def = m.def, items = [];
      for (const dr of def.drops) {
        if (Math.random() < dr[1]) items.push([dr[0], dr[2] || 1]);
      }
      const gold = Math.round(rnd(def.gold[0], def.gold[1]));
      if (!items.length && !gold) return;
      // altın ayrı, eşyalar ayrı torba
      const mk = (g, its, off) => {
        const id = 'L' + (this.uid++);
        const x = m.x + off[0], z = m.z + off[1];
        this.loot.set(id, { id, kind: 'loot', x, z, y: T.groundY(x, z), gold: g, items: its, expires: this.t + 90, rare: its.some(i => D.isEquip(I[i[0]])) });
        this.emit('loot', { id });
      };
      mk(gold, [], [rnd(-0.6, 0.6), rnd(-0.6, 0.6)]);
      items.forEach((it, k) => mk(0, [it], [Math.cos(k * 2.1) * 1.2, Math.sin(k * 2.1) * 1.2]));
    }
    pickupLoot(L) {
      const p = this.player;
      if (L.gold) { p.gold += L.gold; this.emit('coin'); this.emit('float', { x: L.x, z: L.z, y: L.y + 1, text: '+' + L.gold, cls: 'gold' }); }
      for (const [id, n] of L.items) {
        const left = this.addItem(id, n);
        if (left >= n) { this.log('Çantan dolu!', 'warn'); return; }
        const it = I[id];
        this.log(`Toplandı: ${it.name}${n > 1 ? ' ×' + n : ''}`, D.isEquip(it) ? 'epic' : '');
      }
      this.loot.delete(L.id);
      this.emit('lootGone', { id: L.id, picked: true });
    }
    gainXp(xp, sp) {
      const p = this.player;
      if (p.lv >= D.player.maxLv) { p.sp += sp; return; }
      p.xp += xp; p.sp += sp;
      this.emit('xp', { xp, sp });
      while (p.lv < D.player.maxLv && p.xp >= D.player.xpNeed(p.lv)) {
        p.xp -= D.player.xpNeed(p.lv);
        p.lv++; p.points += 3; p.str++; p.int++;
        this.recalc();
        p.hp = this.stats.maxHp; p.mp = this.stats.maxMp;
        this.emit('levelup', { lv: p.lv });
        this.log(`Seviye atladın! Artık ${p.lv}. seviyesin. 3 stat puanı kazandın.`, 'epic');
      }
    }
    hitPlayer(m, v, crit) {
      const p = this.player;
      if (p.dead) return;
      if (p.god) v = 0;
      p.hp -= v; p.lastCombat = this.t;
      this.emit('dmg', { id: 'player', v, crit, kind: 'phys', on: 'player' });
      if (!p.target || !this.mobs.get(p.target) || this.mobs.get(p.target).dead) { p.target = m.id; this.emit('target', { id: m.id }); }
      if (p.hp <= 0) this.killPlayer();
    }
    killPlayer() {
      const p = this.player;
      p.hp = 0; p.dead = true; p.moving = false; this.clearIntent(); p.target = null; p.openNpc = null;
      this.emit('playerDied');
      this.log('Yenildin…', 'bad');
      if (this.caravan) this.loseCaravan('Sen düşünce kervan yağmalandı.');
      for (const m of this.mobs.values()) if (m.target === 'player' || m.target === 'pet') { m.state = 'return'; m.target = null; }
      if (this.pets.fight) this.pets.fight.target = null;
    }
    hitCaravan(m, v) {
      const c = this.caravan;
      if (!c) return;
      if (this.player.god) v = 0;
      c.hp -= v; c.lastHit = this.t;
      this.emit('dmg', { id: 'caravan', v, crit: false, kind: 'phys', on: 'caravan' });
      if (c.hp <= 0) this.loseCaravan('Kervan devesi düştü, yükün yağmalandı!');
    }
    loseCaravan(msg) {
      this.caravan = null;
      this.emit('caravanLost');
      this.log(msg, 'bad');
      for (const m of this.mobs.values()) if (m.target === 'caravan') { m.target = 'player'; }
    }
    spawnAmbush() {
      const c = this.caravan, p = this.player;
      const reg = T.region(c.x, c.z);
      const n = 2 + (p.trade.lv >= 4 ? 1 : 0);
      const lv = clamp(p.lv + 1, 2, 30);
      const def = {
        name: reg === 1 ? 'Yol Eşkıyası' : 'Çöl Eşkıyası', lv, hp: 45 * lv + 60, atk: Math.round(10 + 5.3 * lv), def: Math.round(2 + 2.1 * lv),
        speed: 6.8, aggro: 30, size: 1, atkRange: 2.0, atkInt: 1.6, gold: [lv * 4, lv * 8], model: 'human',
        look: reg === 1 ? { skin: 0xc28a62, cloth: 0x6b2a24, trim: 0x2b2b2b, pants: 0x3b2a22, hat: 'hood', weapon: 'blade' }
          : { skin: 0xa8734f, cloth: 0x3a3226, trim: 0xa33a2a, pants: 0x2a241c, hat: 'wrap', weapon: 'blade' },
        drops: [['hp1', 0.3], ['toz', 0.15]], xp: Math.round(10 + Math.pow(lv, 1.6) * 9)
      };
      for (let k = 0; k < n; k++) {
        let pos = null;
        for (let tries = 0; tries < 20 && !pos; tries++) {
          // yolun ilerisinden, karşıdan gelirler
          const a = p.rot + rnd(-1.1, 1.1), r = rnd(13, 17);
          const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
          if (T.walkable(x, z) && !T.townAt(x, z, 4) && !T.collides(x, z, 0.6)) pos = { x, z };
        }
        if (!pos) continue;
        const m = this.makeMob('eskiya', { x: pos.x, z: pos.z, r: 4 }, -1, { def, pos, ambush: true });
        m.state = 'chase'; m.target = 'caravan';
        this.emit('spawnMob', { id: m.id });
      }
      this.emit('ambush');
      this.log('Pusu! Eşkıyalar kervanına saldırıyor!', 'bad');
    }

    // ---------- hareket ----------
    stepToward(e, gx, gz, speed, dt, stop, isMob) {
      const dx = gx - e.x, dz = gz - e.z, d = Math.hypot(dx, dz);
      if (d <= stop) return 'arrived';
      const step = Math.min(speed * dt, d - stop);
      let nx = e.x + dx / d * step, nz = e.z + dz / d * step;
      // bina çemberlerinden kay
      for (let it = 0; it < 2; it++) {
        const c = T.collides(nx, nz, e.rad * 0.7);
        if (!c) break;
        const ox = nx - c.x, oz = nz - c.z, od = Math.hypot(ox, oz) || 1, rr = c.r + e.rad * 0.7 + 0.01;
        nx = c.x + ox / od * rr; nz = c.z + oz / od * rr;
      }
      const ok = (x, z) => T.walkable(x, z) && (!isMob || !T.townAt(x, z, 3));
      if (!ok(nx, nz)) {
        if (ok(e.x + dx / d * step, e.z)) { nx = e.x + dx / d * step; nz = e.z; }
        else if (ok(e.x, e.z + dz / d * step)) { nx = e.x; nz = e.z + dz / d * step; }
        else return 'blocked';
      }
      const moved = Math.hypot(nx - e.x, nz - e.z);
      e.x = nx; e.z = nz; e.y = T.groundY(nx, nz);
      e.rot = Math.atan2(dx, dz);
      e.moving = true;
      return moved < step * 0.2 ? 'slow' : 'moved';
    }

    updatePlayer(dt) {
      const p = this.player;
      if (p.dead) return;
      const st = this.stats;
      // yenilenme
      const inCombat = this.t - p.lastCombat < 6;
      p.hp = Math.min(st.maxHp, p.hp + st.maxHp * (inCombat ? 0.003 : 0.03) * dt);
      p.mp = Math.min(st.maxMp, p.mp + st.maxMp * (inCombat ? 0.008 : 0.04) * dt);
      // güçlendirme süreleri
      const nb = p.buffs.length;
      p.buffs = p.buffs.filter(b => b.until > this.t);
      if (p.buffs.length !== nb) this.recalc();

      p.moving = false;
      const speed = (this.caravan ? D.player.speedCaravan : D.player.speed) * (p.fast ? 2 : 1);
      let goal = null, stop = 0.1, isEnt = false;
      const tgt = p.target ? this.mobs.get(p.target) : null;
      if (p.target && tgt && tgt.dead) { p.target = null; p.autoAttack = false; }
      if (p.pending) {
        const sk = S[p.pending], tg = this.mobs.get(p.pendingTarget);
        if (!tg || tg.dead) p.pending = null;
        else if (dist(p, tg) <= sk.range + tg.rad) {
          const id = p.pending; p.pending = null;
          if (this.skillReady(id) === 'ok') this.castSkill(sk, tg);
        } else { goal = tg; stop = sk.range * 0.9 + tg.rad; isEnt = true; }
      }
      if (!goal && tgt && !tgt.dead && p.autoAttack) {
        const range = D.player.atkRange + tgt.rad;
        const d = dist(p, tgt);
        if (d <= range) {
          p.rot = Math.atan2(tgt.x - p.x, tgt.z - p.z);
          if (this.t >= p.nextAtk) this.playerAttack(tgt);
        } else { goal = tgt; stop = range * 0.8; isEnt = true; }
      }
      if (!goal && p.interact) {
        const n = this.npcs.find(q => q.id === p.interact);
        if (n && dist(p, n) <= 3.0) {
          p.interact = null; p.openNpc = n.id;
          p.rot = Math.atan2(n.x - p.x, n.z - p.z);
          this.emit('openNpc', { id: n.id });
        } else if (n) { goal = n; stop = 2.6; isEnt = true; }
      }
      if (!goal && p.pickup) {
        const L = this.loot.get(p.pickup);
        if (!L) p.pickup = null;
        else { goal = L; stop = 0.3; isEnt = true; }
      }
      if (goal && isEnt && !p.path.length && this.t >= (p.routeT || 0)) {
        // hedefe düz yol yoksa (sur, nehir) kapı ve köprü üzerinden rota çıkar
        p.routeT = this.t + 0.6;
        if (!T.segmentClear(p.x, p.z, goal.x, goal.z)) { const rt = T.route(p.x, p.z, goal.x, goal.z); if (rt.length > 1) p.path = rt.slice(0, -1); }
      }
      if (goal && isEnt && p.path.length) {
        // hedefe gitmeden önce köprü ara noktaları
        if (dist(p, p.path[0]) < 0.6) p.path.shift();
        if (p.path.length) { goal = p.path[0]; stop = 0.1; isEnt = false; }
      }
      if (!goal && p.path.length) {
        goal = p.path[0];
        if (dist(p, goal) < 0.35) { p.path.shift(); goal = p.path[0] || null; }
      }
      if (goal) {
        const ox = p.x, oz = p.z;
        const r = this.stepToward(p, goal.x, goal.z, speed, dt, stop, false);
        if (r === 'blocked' || r === 'slow') {
          p.stuck += dt;
          if (p.stuck > 0.8) { p.path = []; p.stuck = 0; if (!isEnt) this.emit('blocked'); else { p.autoAttack = false; p.pending = null; p.interact = null; p.pickup = null; } }
        } else p.stuck = 0;
        if (Math.hypot(p.x - ox, p.z - oz) > 0.001) {
          p.lastMoveT = this.t;
          const last = p.trail[p.trail.length - 1];
          if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 0.5) { p.trail.push({ x: p.x, z: p.z }); if (p.trail.length > 200) p.trail.shift(); }
        }
      }
      // tüccar penceresinden uzaklaşınca kapat
      if (p.openNpc) {
        const n = this.npcs.find(q => q.id === p.openNpc);
        if (!n || dist(p, n) > 6) { p.openNpc = null; this.emit('closeNpc'); }
      }
      // yakındaki ganimeti otomatik topla
      for (const L of this.loot.values()) {
        if (Math.hypot(L.x - p.x, L.z - p.z) < 1.8) { this.pickupLoot(L); if (p.pickup === L.id) p.pickup = null; }
      }
      // bölge değişimi
      const an = T.areaName(p.x, p.z);
      if (an !== this.lastArea) { this.lastArea = an; this.emit('area', { name: an }); }
    }
    playerAttack(tg) {
      const p = this.player, st = this.stats;
      p.nextAtk = this.t + D.player.atkInt;
      p.lastCombat = this.t;
      this.emit('swing', { id: 'player' });
      this.later(0.22, () => {
        if (tg.dead || p.dead) return;
        if (dist(p, tg) > D.player.atkRange + tg.rad + 1.2) return;
        const r = this.calcDmg(st.phy, tg.def.def, 1, st.crit, Math.min(0, p.lv - tg.lv));
        this.hitMob(tg, r.v, r.crit, 'phys');
      });
    }

    updateMob(m, dt) {
      if (m.dead) {
        if (!m.ambush && this.t >= m.respawnAt) this.respawnMob(m);
        return;
      }
      const def = m.def, p = this.player;
      m.moving = false;
      if (m.burn && this.t >= m.burn.next) {
        m.burn.next = this.t + 1; m.burn.ticks--;
        m.hp -= m.burn.dmg;
        this.emit('dmg', { id: m.id, v: m.burn.dmg, crit: false, kind: 'burn', on: 'mob' });
        if (m.burn.ticks <= 0) m.burn = null;
        if (m.hp <= 0) { this.killMob(m); return; }
      }
      const leash = m.ambush ? 80 : def.unique ? 24 : 30;
      if (m.state === 'return') {
        m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.15 * dt);
        const r = this.stepToward(m, m.home.x, m.home.z, def.speed * 1.3, dt, 0.8, true);
        if (r === 'arrived' || r === 'blocked') { m.state = 'idle'; m.target = null; m.hp = m.maxHp; }
        return;
      }
      if (m.state === 'chase') {
        let tgt = m.target === 'caravan' ? this.caravan : m.target === 'pet' ? this.pets.fight : (p.dead ? null : p);
        if ((m.target === 'caravan' || m.target === 'pet') && !tgt) { m.target = 'player'; tgt = p.dead ? null : p; }
        if (!tgt || (tgt === p && T.townAt(p.x, p.z, 2)) || Math.hypot(m.x - m.home.x, m.z - m.home.z) > leash) {
          m.state = 'return'; m.target = null; m.burn = null;
          if (m.ambush) { m.state = 'idle'; m.home = { x: m.x, z: m.z }; }
          return;
        }
        const d = dist(m, tgt), range = def.atkRange + (tgt.rad || 0.5);
        if (d > range) {
          const r = this.stepToward(m, tgt.x, tgt.z, def.speed, dt, range * 0.85, true);
          if (r === 'blocked') { m.state = 'return'; m.target = null; }
        } else {
          m.rot = Math.atan2(tgt.x - m.x, tgt.z - m.z);
          if (def.unique && this.t >= (m.nextSpecial || 0)) {
            // büyük canavarın alan saldırısı: kırmızı daire çıkar, dışına kaçan kurtulur
            m.nextSpecial = this.t + rnd(7, 10);
            m.nextAtk = this.t + 1.6;
            const sx = tgt.x, sz = tgt.z, R = 4.2 + def.size;
            this.emit('telegraph', { id: m.id, x: sx, z: sz, r: R, dur: 1.1 });
            this.later(1.1, () => {
              if (m.dead) return;
              this.emit('slam', { id: m.id, x: sx, z: sz, r: R });
              if (!p.dead && Math.hypot(p.x - sx, p.z - sz) < R + p.rad) {
                const r = this.calcDmg(def.atk * 1.9, this.stats.def, 1, 0, Math.max(0, m.lv - p.lv));
                this.hitPlayer(m, r.v, true);
              }
              const c = this.caravan;
              if (c && Math.hypot(c.x - sx, c.z - sz) < R + c.rad) this.hitCaravan(m, Math.round(def.atk * 1.5));
              const fp = this.pets.fight;
              if (fp && !fp.def.fly && Math.hypot(fp.x - sx, fp.z - sz) < R + fp.rad) this.hitPet(m, Math.round(def.atk * 1.6));
            });
            return;
          }
          if (this.t >= m.nextAtk) {
            m.nextAtk = this.t + def.atkInt * rnd(0.9, 1.1);
            this.emit('swing', { id: m.id });
            this.later(0.3, () => {
              if (m.dead) return;
              const cur = m.target === 'caravan' ? this.caravan : m.target === 'pet' ? this.pets.fight : p;
              if (!cur || cur.dead || dist(m, cur) > range + 1.5) return;
              if (cur === p) {
                const r = this.calcDmg(def.atk, this.stats.def, 1, 0.05, Math.max(0, m.lv - p.lv));
                this.hitPlayer(m, r.v, r.crit);
              } else if (cur.kind === 'pet') {
                const ps = KY.PetUtil.petStats(cur.def, cur.slot.pet.lv);
                const r = this.calcDmg(def.atk, ps.def, 1, 0, Math.max(0, m.lv - cur.slot.pet.lv) * 0.5);
                this.hitPet(m, r.v);
              } else {
                const r = this.calcDmg(def.atk, cur.def.def, 1, 0, 0);
                this.hitCaravan(m, r.v);
              }
            });
          }
        }
        return;
      }
      // boşta: saldırgan canavar oyuncuyu fark eder
      if (def.aggro && !p.dead && dist(m, p) < def.aggro && !T.townAt(p.x, p.z, 2)) {
        m.state = 'chase'; m.target = 'player';
        this.emit('aggro', { id: m.id });
        return;
      }
      if (this.t >= m.wanderAt) {
        m.wanderAt = this.t + rnd(4, 10);
        m.wanderTo = Math.random() < 0.7 ? this.randomPoint(m.area) : null;
      }
      if (m.wanderTo) {
        const r = this.stepToward(m, m.wanderTo.x, m.wanderTo.z, def.speed * 0.35, dt, 0.3, true);
        if (r !== 'moved') m.wanderTo = null;
      }
    }
    respawnMob(m) {
      const pos = this.randomPoint(m.area);
      m.x = pos.x; m.z = pos.z; m.y = T.groundY(pos.x, pos.z);
      m.home = { x: pos.x, z: pos.z };
      m.hp = m.maxHp; m.dead = false; m.state = 'idle'; m.target = null; m.wanderTo = null; m.burn = null;
      this.emit('respawnMob', { id: m.id });
      if (m.def.unique) this.log(`${m.name} yeniden ortaya çıktı!`, 'epic');
    }
    separate() {
      const arr = [];
      for (const m of this.mobs.values()) if (!m.dead && m.state === 'chase') arr.push(m);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = (a.rad + b.rad) * 0.9;
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5, ux = dx / d, uz = dz / d;
          if (T.walkable(a.x - ux * push, a.z - uz * push)) { a.x -= ux * push; a.z -= uz * push; }
          if (T.walkable(b.x + ux * push, b.z + uz * push)) { b.x += ux * push; b.z += uz * push; }
        }
      }
    }
    updateProjectiles(dt) {
      const st = this.stats, p = this.player;
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        const tg = this.mobs.get(pr.target);
        if (!tg || tg.dead || this.t - pr.born > 3) { this.projectiles.splice(i, 1); this.emit('hit', { id: pr.id, x: pr.x, y: pr.y, z: pr.z, miss: true }); continue; }
        const ty = tg.y + 0.6 * tg.def.size;
        const dx = tg.x - pr.x, dy = ty - pr.y, dz = tg.z - pr.z, d = Math.hypot(dx, dy, dz);
        const step = pr.speed * dt;
        if (d <= step + 0.3) {
          this.projectiles.splice(i, 1);
          this.emit('hit', { id: pr.id, x: tg.x, y: ty, z: tg.z });
          const r = this.calcDmg(st.mag, tg.def.def * 0.8, pr.mult, st.crit, Math.min(0, p.lv - tg.lv));
          this.hitMob(tg, r.v, r.crit, 'mag');
        } else { pr.x += dx / d * step; pr.y += dy / d * step; pr.z += dz / d * step; }
      }
    }
    updateCaravan(dt) {
      const c = this.caravan, p = this.player;
      if (!c) return;
      c.moving = false;
      const d = dist(c, p);
      if (d > 45) {
        c.x = p.x - Math.sin(p.rot) * 3; c.z = p.z - Math.cos(p.rot) * 3;
        if (!T.walkable(c.x, c.z)) { c.x = p.x; c.z = p.z; }
        c.y = T.groundY(c.x, c.z); p.trail = [];
      } else if (d > 3.4) {
        while (p.trail.length > 1 && Math.hypot(p.trail[0].x - c.x, p.trail[0].z - c.z) < 0.7) p.trail.shift();
        const pt = p.trail.length ? p.trail[0] : p;
        const sp = Math.min(11, Math.max(D.player.speedCaravan, d * 1.6));
        const r = this.stepToward(c, pt.x, pt.z, sp, dt, 0.05, false);
        if (r === 'blocked') { p.trail.shift(); }
      }
      if (this.t - c.lastHit > 8) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.01 * dt);
      if (this.t >= c.nextAmbush) {
        c.nextAmbush = this.t + 9;
        const nt = T.nearestTown(c.x, c.z);
        let active = 0;
        for (const m of this.mobs.values()) if (m.ambush && !m.dead) active++;
        const chance = p.trade.lv <= 1 ? 0.14 : 0.2;
        if (nt.dist > 34 && this.t - p.lastMoveT < 4 && active === 0 && Math.random() < chance) this.spawnAmbush();
      }
    }
    updateLoot() {
      for (const L of this.loot.values()) if (this.t > L.expires) { this.loot.delete(L.id); this.emit('lootGone', { id: L.id }); }
    }
    updateMarket() {
      if (this.t < this.nextMarket) return;
      this.nextMarket = this.t + 50;
      for (const tid in this.market) for (const g in this.market[tid]) {
        this.marketPrev[tid][g] = this.market[tid][g];
        this.market[tid][g] = clamp(this.market[tid][g] + rnd(-0.07, 0.07), 0.82, 1.22);
      }
      this.emit('market');
    }

    // ---------- görevler ----------
    currentQuest() { return D.quests[this.quest.i] || null; }
    questCheck(kind, data) {
      const q = this.currentQuest();
      if (!q) return;
      const g = q.goal;
      if (kind === 'kill' && g.kind === 'kill' && data.type === g.type) {
        this.quest.n++;
        this.emit('quest');
        if (this.quest.n >= g.n) this.completeQuest();
      } else if (kind === 'trade' && g.kind === 'trade' && data.town === g.town && data.profit > 0) this.completeQuest();
    }
    questState() {
      const q = this.currentQuest();
      if (!q) return;
      const p = this.player, g = q.goal;
      let done = false;
      if (g.kind === 'mastery') { this.quest.n = Math.max(p.mastery.kilic, p.mastery.ates); done = this.quest.n >= g.n; }
      const wp = p.eq.weapon;
      if (g.kind === 'weapon') done = !!wp && (I[wp.id].tier >= 1 || wp.plus >= g.n);
      if (g.kind === 'plus') { this.quest.n = wp ? wp.plus : 0; done = !!wp && wp.plus >= g.n; }
      this.emit('quest');
      if (done) this.completeQuest();
    }
    completeQuest() {
      const q = this.currentQuest();
      if (!q) return;
      const r = q.reward, p = this.player;
      this.quest.i++; this.quest.n = 0;
      if (r.gold) { p.gold += r.gold; this.emit('coin'); }
      if (r.items) for (const [id, n] of r.items) this.addItem(id, n);
      this.emit('questDone', { name: q.name, reward: r });
      this.log(`Görev tamamlandı: ${q.name}!`, 'epic');
      if (r.xp) this.gainXp(r.xp, Math.round(r.xp * 0.15));
      this.later(0.5, () => this.questState());
    }

    // ---------- ana döngü ----------
    update(dt) {
      dt = Math.min(dt, 0.1);
      this.t += dt;
      if (this.timers.length) {
        const due = this.timers.filter(tm => tm.at <= this.t);
        if (due.length) { this.timers = this.timers.filter(tm => tm.at > this.t); for (const tm of due) tm.fn(); }
      }
      this.updatePlayer(dt);
      if (this.updatePets) this.updatePets(dt);
      for (const m of this.mobs.values()) this.updateMob(m, dt);
      this.separate();
      this.updateProjectiles(dt);
      this.updateCaravan(dt);
      this.updateLoot();
      this.updateMarket();
    }

    // ---------- kayıt ----------
    serialize() {
      const p = this.player, c = this.caravan;
      return {
        v: 1,
        p: {
          lv: p.lv, xp: p.xp, sp: p.sp, str: p.str, int: p.int, points: p.points, hp: Math.round(p.hp), mp: Math.round(p.mp),
          gold: p.gold, mastery: p.mastery, inv: p.inv, eq: p.eq, trade: p.trade, x: p.x, z: p.z, rot: p.rot, dead: p.dead,
          name: p.name, look: p.look
        },
        at: Date.now(),
        c: c ? { goods: c.goods, cost: c.cost, from: c.from, hp: c.hp, maxHp: c.maxHp, x: c.x, z: c.z } : null,
        q: this.quest,
        pets: this.serializePets ? this.serializePets() : null
      };
    }
    load(s) {
      if (!s || s.v !== 1 || !s.p) return;
      const p = this.player, sp = s.p;
      Object.assign(p, {
        lv: sp.lv, xp: sp.xp, sp: sp.sp, str: sp.str, int: sp.int, points: sp.points, hp: sp.hp, mp: sp.mp,
        gold: sp.gold, mastery: Object.assign({ kilic: 1, ates: 1 }, sp.mastery), eq: World.migrateEq(sp.eq), trade: sp.trade || { lv: 1, xp: 0 },
        rot: sp.rot || 0, name: sp.name || p.name, look: Object.assign({ g: 'f', hair: 0, skin: 0 }, sp.look)
      });
      p.inv = new Array(INV_SIZE).fill(null);
      (sp.inv || []).forEach((it, k) => { if (k < INV_SIZE && it && I[it.id]) p.inv[k] = it; });
      if (T.walkable(sp.x, sp.z)) { p.x = sp.x; p.z = sp.z; }
      p.y = T.groundY(p.x, p.z);
      if (sp.dead) { p.dead = true; p.hp = 0; }
      if (s.q) this.quest = { i: s.q.i || 0, n: s.q.n || 0 };
      this.recalc();
      if (s.c && !p.dead) {
        this.caravan = null;
        this.newCaravan(s.c.from);
        Object.assign(this.caravan, { goods: s.c.goods, cost: s.c.cost, hp: s.c.hp, maxHp: s.c.maxHp });
        if (T.walkable(s.c.x, s.c.z)) { this.caravan.x = s.c.x; this.caravan.z = s.c.z; this.caravan.y = T.groundY(s.c.x, s.c.z); }
      }
    }
  }
  World.INV_SIZE = INV_SIZE;
  World.freshEq = () => {
    const eq = {};
    for (const k of D.eqSlots) eq[k] = null;
    Object.assign(eq, { weapon: { id: 'w1', plus: 0 }, armor: { id: 'a1', plus: 0 }, legs: { id: 'lg1', plus: 0 }, feet: { id: 'bt1', plus: 0 } });
    return eq;
  };
  // eski kayıtlar: yalnız silah + zırh vardı; yeni yuvalar boş, başlangıç etek ve sandaleti verilir
  World.migrateEq = (eq) => {
    const out = {};
    for (const k of D.eqSlots) out[k] = eq && eq[k] && I[eq[k].id] ? { id: eq[k].id, plus: eq[k].plus || 0 } : null;
    if (eq && !('legs' in eq)) { out.legs = { id: 'lg1', plus: 0 }; out.feet = out.feet || { id: 'bt1', plus: 0 }; }
    return out;
  };
  return World;
})();
