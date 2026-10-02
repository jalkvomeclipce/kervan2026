const fs = require('fs'), vm = require('vm');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(['terrain', 'data', 'logic', 'pets'].map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n') + '\nthis.KY = KY;', ctx);
const KY = ctx.KY, T = KY.Terrain;
const W = new KY.World(null), p = W.player;
p.lv = 9; p.str = 50; p.eq = { weapon: { id: 'w3', plus: 3 }, armor: { id: 'a3', plus: 3 } }; W.recalc(); p.hp = W.stats.maxHp; p.gold = 2000;
function run(sec, cb) { const t0 = W.t; while (W.t - t0 < sec) { W.update(0.05); const ev = W.drain(); for (const e of ev) { if (e.type === 'log') console.log('  [log]', e.text); if (cb) cb(e); } if (cb && cb.stop) break; } }
W.cmdInteract('sarikum-kervan');
let opened = false; run(10, e => { if (e.type === 'openNpc') opened = true; });
console.log('opened kervan npc:', opened, 'openNpc', p.openNpc);
W.cmdTradeBuy('ipek', 5); W.cmdTradeBuy('cay', 10); W.cmdTradeBuy('porselen', 2);
console.log('caravan', JSON.stringify(W.caravan && W.caravan.goods), 'cost', W.caravan && W.caravan.cost, 'gold', p.gold);
W.cmdCloseNpc();
W.cmdInteract('taskale-kervan');
let maxGap = 0, ambush = 0, t0 = W.t, bridgeSeen = false, fights = 0;
while (W.t - t0 < 200 && !p.openNpc) {
  W.update(0.05);
  for (const e of W.drain()) { if (e.type === 'ambush') ambush++; if (e.type === 'log' && /Pusu|kervan|Kervan/.test(e.text)) console.log('  [log]', e.text.slice(0, 80)); }
  if (W.caravan) { maxGap = Math.max(maxGap, Math.hypot(W.caravan.x - p.x, W.caravan.z - p.z)); if (T.onBridge(W.caravan.x, W.caravan.z)) bridgeSeen = true; }
  // saldırganlarla dövüş
  if (!p.pending && !p.interact) {
    const h = [...W.mobs.values()].find(m => !m.dead && m.state === 'chase' && Math.hypot(m.x - p.x, m.z - p.z) < 14);
    if (h && !p.autoAttack) { W.cmdAttack(h.id); fights++; }
    if (!h && !p.autoAttack) W.cmdInteract('taskale-kervan');
  }
  if (p.hp < W.stats.maxHp * 0.5 && W.t > p.potCd) W.cmdPotion('hp');
  if (p.dead) { console.log('player died'); break; }
}
console.log('arrived:', p.openNpc, 'time', (W.t - t0).toFixed(0), 's; caravan alive', !!W.caravan, 'hp', W.caravan && Math.round(W.caravan.hp), 'maxGap', maxGap.toFixed(1), 'bridge', bridgeSeen, 'ambushes', ambush, 'fights', fights);
const g0 = p.gold; W.cmdTradeSell(); for (const e of W.drain()) if (e.type === 'log') console.log('  [log]', e.text);
console.log('gold after sell', p.gold, 'delta', p.gold - g0, 'trade', JSON.stringify(p.trade), 'quest', JSON.stringify(W.quest));
// teleport back & shop & enhance
W.cmdInteract('taskale-kapi'); run(8, e => {});
W.cmdTeleport(); for (const e of W.drain()) if (e.type === 'log') console.log('  [log]', e.text);
console.log('after teleport at', p.x.toFixed(0), p.z.toFixed(0), T.areaName(p.x, p.z));
W.cmdInteract('sarikum-demirci'); run(8);
console.log('at smith', p.openNpc);
W.cmdBuy('toz', 5); for (let k = 0; k < 5; k++) W.cmdEnhance('weapon'); run(0.1);
console.log('weapon', JSON.stringify(p.eq.weapon), 'toz left', W.count('toz'));
const ser = JSON.stringify(W.serialize()); const W2 = new KY.World(JSON.parse(ser));
console.log('save/load ok', W2.player.lv === p.lv && W2.player.gold === p.gold, 'size', ser.length);
