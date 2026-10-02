const fs = require('fs'), vm = require('vm');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(['terrain', 'data', 'logic', 'pets'].map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n') + '\nthis.KY = KY;', ctx);
const KY = ctx.KY;
function duel(type, lv, w, a, plus) {
  const W = new KY.World(null), p = W.player;
  p.lv = lv; p.str = 20 + (lv - 1) * 3; p.int = 20 + (lv - 1) * 2; p.mastery = { kilic: lv, ates: lv };
  p.eq = { weapon: { id: w, plus }, armor: { id: a, plus } }; W.recalc(); p.hp = W.stats.maxHp; p.mp = W.stats.maxMp;
  W.addItem(type === 'tasdev' ? 'hp2' : 'hp1', 40); W.addItem('mp1', 30); W.addItem('hp2', 10);
  const m = [...W.mobs.values()].find(x => x.type === type);
  for (const o of W.mobs.values()) if (o !== m) { o.dead = true; o.respawnAt = 1e9; }
  p.x = m.x + 6; p.z = m.z; p.y = 0;
  W.cmdAttack(m.id);
  let pots = 0, t0 = W.t;
  while (W.t - t0 < 240 && !m.dead && !p.dead) {
    W.update(0.05); W.drain();
    if (p.hp < W.stats.maxHp * 0.5 && W.t >= p.potCd) { W.cmdPotion('hp'); pots++; }
    else if (p.mp < W.stats.maxMp * 0.2 && W.t >= p.potCd) W.cmdPotion('mp');
    for (const s of ['demir', 'alevHalka', 'kasirga', 'atesTopu', 'yarma']) if (W.skillReady(s) === 'ok') { W.cmdSkill(s); break; }
    if (p.hp < W.stats.maxHp * 0.6 && W.skillReady('sifa') === 'ok') W.cmdSkill('sifa');
    if (!p.autoAttack && !m.dead) W.cmdAttack(m.id);
  }
  console.log(type, 'Lv', lv, w + '+' + plus, a + '+' + plus, '=>', m.dead ? 'WIN' : p.dead ? 'DIED' : 'TIMEOUT', 'time', (W.t - t0).toFixed(0) + 's', 'pots', pots, 'mobHp', Math.round(m.hp));
}
duel('kizilyele', 9, 'w3', 'a3', 0);
duel('kizilyele', 10, 'w3', 'a3', 2);
duel('kizilyele', 12, 'w4', 'a4', 2);
duel('tasdev', 15, 'w4', 'a4', 3);
duel('tasdev', 17, 'w4', 'a4', 4);
duel('tasdev', 19, 'w5', 'a4', 5);
duel('kurt', 3, 'w1', 'a1', 0);
duel('haydut', 5, 'w2', 'a2', 0);
duel('akrep', 8, 'w2', 'a2', 1);
