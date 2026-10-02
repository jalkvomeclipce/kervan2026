const fs = require('fs'), vm = require('vm');
const ctx = { console };
vm.createContext(ctx);
const src = ['terrain', 'data', 'logic'].map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js', 'utf8')).join('\n') + '\nthis.KY = KY;';
let t0 = Date.now();
vm.runInContext(src, ctx);
const KY = ctx.KY, T = KY.Terrain, D = KY.DATA;
T.height(0, 0);
console.log('cache build ms', Date.now() - t0);
// sanity: towns, bridge, spawns walkable
for (const k in T.TOWNS) { const t = T.TOWNS[k]; console.log(k, t.x.toFixed(1), t.z.toFixed(1), 'walk', T.walkable(t.x, t.z + 2.5), 'h', T.height(t.x, t.z).toFixed(2)); }
console.log('bridge', T.BRIDGE, 'walk mid', T.walkable(T.BRIDGE.x, T.BRIDGE.z), 'riverdepth', T.height(T.BRIDGE.x, T.BRIDGE.z + 6).toFixed(2));
for (const s of D.spawns) { let ok = 0; for (let k = 0; k < 30; k++) { const a = k / 30 * 6.28, r = s.r * 0.7; if (T.walkable(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r)) ok++; } console.log('spawn', s.type, s.x, s.z, 'walkable%', Math.round(ok / 30 * 100), 'center', T.walkable(s.x, s.z), T.height(s.x, s.z).toFixed(1)); }
// route test
console.log('route W->E', JSON.stringify(T.route(-100, 0, 100, 5).map(p => [p.x.toFixed(1), p.z.toFixed(1)])));
// NPC reachability
const W = new KY.World(null);
for (const n of W.npcs) console.log('npc', n.id, 'walk', T.walkable(n.x, n.z), 'col', !!T.collides(n.x, n.z, 0.3));
module.exports = { KY, W };
let water = 0, blocked = 0, tot = 0;
for (let x = -170; x <= 170; x += 2) for (let z = -100; z <= 100; z += 2) { tot++; const h = T.height(x, z); if (h <= T.WATER + 0.15) water++; else if (h >= T.BLOCK_H) blocked++; }
console.log('water%', (water / tot * 100).toFixed(1), 'mountain%', (blocked / tot * 100).toFixed(1));
