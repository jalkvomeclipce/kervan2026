const fs = require('fs'), vm = require('vm');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(['terrain', 'data', 'logic', 'pets'].map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n') + '\nthis.KY = KY;', ctx);
const KY = ctx.KY, T = KY.Terrain, D = KY.DATA;
const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL') + ' ' + m); if (!c) process.exitCode = 1; };
const W = new KY.World(null), p = W.player;
const run = (sec, cb) => { const t0 = W.t; while (W.t - t0 < sec) { W.update(0.05); const ev = W.drain(); if (cb) ev.forEach(cb); } };
// 1) satın al
const trainer = W.npcs.find(n => n.id === 'sarikum-hayvan');
ok(!!trainer && T.walkable(trainer.x, trainer.z) && !T.collides(trainer.x, trainer.z, 0.3), 'Hayvan Terbiyecisi kasabada, ulaşılabilir');
W.cmdInteract(trainer.id); run(8);
ok(p.openNpc === trainer.id, 'terbiyecinin penceresi açıldı');
p.gold = 5000;
W.cmdBuy('pet_tavsan', 1); W.cmdBuy('pet_kurt', 1); W.cmdBuy('yem', 10); W.cmdBuy('hayatotu', 1);
const ks = W.petSlots(); ok(ks.length === 2 && ks.every(o => o.s.pet), 'iki mühür alındı, durum bilgisi var');
// 2) toplayıcı
const kT = ks.find(o => o.def.type === 'grab').k, kK = ks.find(o => o.def.type === 'fight').k;
W.cmdUseSlot(kT); ok(W.pets.grab && W.pets.grab.slot === p.inv[kT], 'tavşan çağrıldı');
W.cmdCloseNpc(); W.cmdMove(p.x - 30, p.z); run(6);
const L = { id: 'Ltest', kind: 'loot', x: p.x + 8, z: p.z + 3, y: 0, gold: 25, items: [['toz', 2]], expires: W.t + 90 };
L.y = T.groundY(L.x, L.z); W.loot.set(L.id, L);
const g0 = p.gold, t0 = W.count('toz');
run(5);
ok(!W.loot.has('Ltest') && p.gold === g0 + 25 && W.count('toz') === t0 + 2, 'tavşan ganimeti topladı (altın + toz)');
// çanta dolunca hayvan çantasına
for (let i = 0; i < p.inv.length; i++) if (!p.inv[i]) p.inv[i] = { id: 'w2', n: 1, plus: 0 };
W.loot.set('L2', { id: 'L2', kind: 'loot', x: p.x + 5, z: p.z - 4, y: T.groundY(p.x + 5, p.z - 4), gold: 0, items: [['w3', 1]], expires: W.t + 90 });
run(5);
ok(W.petBag().some(s => s && s.id === 'w3'), 'çanta dolu → eşya hayvan çantasına gitti');
p.inv = p.inv.map(s => s && s.id === 'w2' ? null : s);
const bi = W.petBag().findIndex(s => s && s.id === 'w3'); W.cmdPetTake(bi);
ok(W.count('w3') === 1 && !W.petBag().some(Boolean), 'hayvan çantasından çantaya alındı');
ok(!W.cmdDropSlot(kT), 'çağrılı mühür atılamaz');
// süre dolması
p.inv[kT].pet.expires = Date.now() - 1000; run(1.2);
ok(!W.pets.grab, 'süre dolunca toplayıcı mühre döndü');
ok(!W.cmdPetSummon(kT), 'süresi dolan çağrılamaz');
W.addItem('muska', 1); W.cmdPetExtend(); ok(W.petDaysLeft(p.inv[kT].pet) > 27, 'muska: 28 gün eklendi');
// 3) savaş hayvanı
W.adminLevel(12);
W.cmdUseSlot(kK); const wolf = W.pets.fight; ok(!!wolf, 'kurt yavrusu çağrıldı');
const m = [...W.mobs.values()].filter(x => x.type === 'tilki').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
p.x = m.x + 4; p.z = m.z; wolf.x = p.x + 1; wolf.z = p.z + 1;
let petHits = 0, petDmg = 0;
const lv0 = wolf.slot.pet.lv;
W.cmdAttack(m.id);
run(12, e => { if (e.type === 'dmg' && e.by === 'pet') petHits++; if (e.type === 'dmg' && e.on === 'pet') petDmg++; });
ok(petHits > 0, `kurt saldırdı (${petHits} vuruş)`);
ok(wolf.slot.pet.xp > 0 || wolf.slot.pet.lv > lv0, `kurt TP kazandı (sv ${wolf.slot.pet.lv}, tp ${wolf.slot.pet.xp})`);
// dikkat çekme: boştaki canavara hayvan vurur
const m2 = [...W.mobs.values()].find(x => x.type === 'domuz' && !x.dead);
W.hitMob(m2, 1, false, 'pet', 'pet'); ok(m2.target === 'pet', 'hayvanın vurduğu canavar hayvana döndü');
// seviye üst sınırı ve dönüşüm
let evolved = null;
W.adminPetLevel(20); run(0.1, e => { if (e.type === 'petEvolve') evolved = e.to; });
ok(wolf.slot.pet.lv === 12 && wolf.form === 1, `seviye oyuncuyu geçmez (${wolf.slot.pet.lv}), 10'da dönüştü: ${wolf.slot.pet.name}`);
W.adminLevel(25); W.adminPetLevel(20);
ok(wolf.slot.pet.lv >= 20 && wolf.form === 2 && wolf.slot.pet.name === 'Gök Kurt', 'Sv. 20 dönüşümü: ' + wolf.slot.pet.name);
// isim
ok(W.cmdPetName(kK, 'Börü') && !W.cmdPetName(kK, 'Başka'), 'isim bir kez verildi: ' + p.inv[kK].pet.name);
// savaşta geri gönderme engeli
wolf.lastCombat = W.t; ok(!W.cmdPetDismiss('fight'), 'savaşta geri gönderilemez');
// açlık → ölüm → diriltme
wolf.lastCombat = -99; W.clearIntent(); p.target = null;
for (const mm of W.mobs.values()) { mm.state = 'idle'; mm.target = null; mm.def = Object.assign({}, mm.def, { aggro: 0 }); }
p.x = T.TOWNS.sarikum.x; p.z = T.TOWNS.sarikum.z + 2.5; p.y = T.groundY(p.x, p.z);
p.inv[kK].pet.auto = false; p.inv[kK].pet.hgp = 0.5;
let died = false; run(120, e => { if (e.type === 'petDied') died = true; });
ok(died && p.inv[kK].pet.dead && !W.pets.fight, 'aç kalan hayvan öldü, mühre döndü');
ok(!W.cmdPetSummon(kK), 'ölü hayvan çağrılamaz');
ok(W.cmdPetRevive() && !p.inv[kK].pet.dead, 'Hayat Otu ile dirildi');
// otomatik besleme
W.cmdPetSummon(kK); p.inv[kK].pet.auto = true; p.inv[kK].pet.hgp = 30; const y0 = W.count('yem'); run(1.5);
ok(W.count('yem') === y0 - 1 && p.inv[kK].pet.hgp > 60, 'otomatik besleme çalıştı');
// kayıt
W.cmdPetSummon(kT);
const save = JSON.parse(JSON.stringify(W.serialize()));
const W2 = new KY.World(save);
ok(W2.pets.fight && W2.pets.grab && W2.pets.fight.slot.pet.name === 'Börü' && W2.pets.fight.slot.pet.lv >= 20, 'kayıttan hayvanlar geri geldi ve çağrılı');
// 4) uzun savaş: kurt ölüyor mu, ne kadar yardım ediyor
const SP = process.argv[2] || 'kurt';
const W3 = new KY.World(null), q = W3.player; W3.adminLevel(10); W3.adminStats(); W3.adminMastery(); q.eq.weapon = { id: 'w3', plus: 2 }; q.eq.armor = { id: 'a3', plus: 2 }; W3.recalc(); W3.addItem('pet_' + SP, 1); W3.addItem('merhem', 30); W3.addItem('yem', 20);
const kk = W3.petSlots()[0].k; W3.cmdPetSummon(kk); W3.adminPetLevel(9);
let kills = 0, pdmg = 0, alldmg = 0, deaths = 0, pdeaths = 0, pots = 0;
const o = W3.killMob.bind(W3); W3.killMob = mm => { kills++; o(mm); };
const t0b = W3.t;
while (W3.t - t0b < 300) {
  W3.update(0.05);
  for (const e of W3.drain()) { if (e.type === 'dmg' && e.on === 'mob') { alldmg += e.v; if (e.by === 'pet') pdmg += e.v; } if (e.type === 'petDied') deaths++; if (e.type === 'playerDied') pdeaths++; }
  if (q.dead) W3.cmdRespawn();
  if (q.hp < W3.stats.maxHp * 0.5 && W3.t >= q.potCd) { W3.addItem('hp1', 1); W3.cmdPotion('hp'); pots++; }
  { const ct = q.target && W3.mobs.get(q.target); if (ct && Math.hypot(ct.x - q.x, ct.z - q.z) < 6) for (const s of ['alevHalka', 'kasirga', 'atesTopu', 'yarma']) if (W3.skillReady(s) === 'ok') { W3.cmdSkill(s); break; } }
  const tg = q.target && W3.mobs.get(q.target);
  if (!tg || tg.dead || !q.autoAttack) { let b = null, bd = 1e9; for (const mm of W3.mobs.values()) { if (mm.dead || mm.def.unique || mm.lv > q.lv) continue; const d = Math.hypot(mm.x - q.x, mm.z - q.z) + (q.lv - mm.lv) * 10; if (d < bd) { bd = d; b = mm; } } if (b) W3.cmdAttack(b.id); }
  if (!W3.pets.fight && q.inv[kk] && q.inv[kk].pet.dead) { W3.addItem('hayatotu', 1); W3.cmdPetRevive(); W3.cmdPetSummon(kk); }
}
console.log(`[${SP}] 5 dk savaş: ${kills} canavar, oyuncu ölümü ${pdeaths}, iksir ${pots}, merhem kalan ${W3.count('merhem')}, hayvanın hasar payı %${Math.round(pdmg / alldmg * 100)}, hayvan ölümü ${deaths}, hayvan sv ${q.inv[kk].pet.lv}, tokluk ${q.inv[kk].pet.hgp.toFixed(0)}`);
