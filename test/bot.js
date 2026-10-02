const fs = require('fs'), vm = require('vm');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(['terrain', 'data', 'logic', 'pets'].map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n') + '\nthis.KY = KY;', ctx);
const KY = ctx.KY, D = KY.DATA;
const W = new KY.World(null);
const p = W.player;
let deaths = 0, pots = 0, lvT = {}, lastLv = 1, kills = {};
const gearFor = lv => ({ w: lv >= 15 ? 'w4' : lv >= 12 ? 'w4' : lv >= 8 ? 'w3' : lv >= 4 ? 'w2' : 'w1', a: lv >= 12 ? 'a4' : lv >= 8 ? 'a3' : lv >= 4 ? 'a2' : 'a1' });
const origKill = W.killMob.bind(W);
const fight = {}; const fstats = {};
const origHit = W.hitMob.bind(W);
W.hitMob = (m, v, c, k) => { if (!fight[m.id]) fight[m.id] = { t: W.t, hp: p.hp, lvp: p.lv }; origHit(m, v, c, k); };
W.killMob = m => { kills[m.type] = (kills[m.type] || 0) + 1; const f = fight[m.id]; if (f) { const s = fstats[m.type] = fstats[m.type] || { n: 0, t: 0, dhp: 0, lv: 0 }; s.n++; s.t += W.t - f.t; s.dhp += (f.hp - p.hp) / W.stats.maxHp; s.lv += f.lvp; delete fight[m.id]; } origKill(m); };
const dt = 0.05, MIN = +process.argv[2] || 40;
let errors = 0;
for (let step = 0; step < MIN * 60 / dt; step++) {
  try {
    W.update(dt);
  } catch (e) { errors++; if (errors < 3) console.log('ERR', e.stack); }
  const ev = W.drain();
  for (const e of ev) if (e.type === 'playerDied') deaths++;
  if (p.dead) { W.cmdRespawn(); continue; }
  while (p.points > 0) W.cmdStat(p.points % 3 === 0 ? 'int' : 'str');
  for (const tr of ['kilic', 'ates']) if (p.sp >= W.masteryCost(tr) && p.mastery[tr] < p.lv) W.cmdMastery(tr);
  const g = gearFor(p.lv); if (p.eq.weapon.id !== g.w) { p.eq.weapon = { id: g.w, plus: 2 }; W.recalc(); } if (p.eq.armor.id !== g.a) { p.eq.armor = { id: g.a, plus: 2 }; W.recalc(); }
  if (W.count('hp1') < 5) W.addItem('hp1', 20); if (W.count('mp1') < 5) W.addItem('mp1', 20);
  const st = W.stats;
  if (p.hp < st.maxHp * 0.45 && W.t >= p.potCd) { W.cmdPotion('hp'); pots++; }
  if (p.mp < st.maxMp * 0.2 && W.t >= p.potCd) { W.cmdPotion('mp'); }
  const tg = p.target && W.mobs.get(p.target);
  if (!tg || tg.dead || !p.autoAttack) {
    let best = null, bd = 1e9;
    for (const m of W.mobs.values()) {
      if (m.dead || m.def.unique || m.lv > p.lv + 1) continue;
      const d = Math.hypot(m.x - p.x, m.z - p.z) + (p.lv - m.lv) * 12;
      if (d < bd) { bd = d; best = m; }
    }
    if (best) W.cmdAttack(best.id);
  } else if (Math.hypot(tg.x - p.x, tg.z - p.z) < 6) {
    for (const s of ['alevHalka', 'kasirga', 'atesTopu', 'yarma']) if (W.skillReady(s) === 'ok') { W.cmdSkill(s); break; }
    if (p.hp < st.maxHp * 0.6 && W.skillReady('sifa') === 'ok') W.cmdSkill('sifa');
  }
  if (p.lv !== lastLv) { lastLv = p.lv; lvT[p.lv] = (W.t / 60).toFixed(1); }
}
console.log('minutes', MIN, 'level', p.lv, 'deaths', deaths, 'pots', pots, 'errors', errors);
console.log('level times (min):', JSON.stringify(lvT));
console.log('kills', JSON.stringify(kills));
console.log('mastery', JSON.stringify(p.mastery), 'sp', p.sp, 'gold', p.gold, 'stats', JSON.stringify(W.stats));
for (const k in fstats) { const s = fstats[k]; console.log(k.padEnd(11), 'n', s.n, 'ttk', (s.t / s.n).toFixed(1) + 's', 'hp%lost', (s.dhp / s.n * 100).toFixed(0), 'avgPlv', (s.lv / s.n).toFixed(1)); }
console.log('quest', JSON.stringify(W.quest));
