import sys, time
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/kervan/node_modules/three/build/three.min.js').read()
GLTFL = open('/home/claude/kervan/node_modules/three/examples/js/loaders/GLTFLoader.js').read()
SKU = open('/home/claude/kervan/node_modules/three/examples/js/utils/SkeletonUtils.js').read()
HTML = open('/home/claude/kervan/dist/kervan-yolu.html').read()
page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + HTML + '</body></html>'
mode = sys.argv[1] if len(sys.argv) > 1 else 'mobile'
steps = sys.argv[2].split(',') if len(sys.argv) > 2 else ['fight']
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(status=200, content_type='application/javascript', body=THREE)
    if 'GLTFLoader.js' in u: return r.fulfill(status=200, content_type='application/javascript', body=GLTFL)
    if 'SkeletonUtils.js' in u: return r.fulfill(status=200, content_type='application/javascript', body=SKU)
    if 'fonts.googleapis' in u: return r.fulfill(status=200, content_type='text/css', body='')
    if u.startswith('http://game.local'): return r.fulfill(status=200, content_type='text/html', body=page_html)
    return r.abort()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    if mode == 'mobile':
        ctx = b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=1, has_touch=True, is_mobile=True)
    else:
        ctx = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') and 'GPU stall' not in m.text and 'swiftshader' not in m.text.lower() else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    ctx.route('**/*', route)
    pg.goto('http://game.local/', wait_until='load')
    pg.wait_for_function('document.body.classList.contains("ready")', timeout=60000)
    pg.click('#startBtn')
    pg.wait_for_function("() => __ky.view.ents.get('player').model.kind === 'skinned'", timeout=60000)
    pg.wait_for_timeout(800)
    info = pg.evaluate('() => { const r = __ky.view.renderer.info.render; return {calls: r.calls, tris: r.triangles} }')
    print('render info', info)
    def wait_game(sec):  # oyun saatine göre bekle
        pg.evaluate(f'''() => new Promise(res => {{ const w = __ky.world, t0 = w.t; (function f(){{ if (w.t - t0 >= {sec}) res(); else requestAnimationFrame(f); }})(); }})''')
    for st in steps:
        if st == 'fight':
            pg.evaluate("() => { const w = __ky.world; const m = [...w.mobs.values()].filter(m => m.type === 'tilki').sort((a,b)=>Math.hypot(a.x-w.player.x,a.z-w.player.z)-Math.hypot(b.x-w.player.x,b.z-w.player.z))[0]; w.cmdAttack(m.id); }")
            pg.wait_for_function("() => { const w = __ky.world, t = w.mobs.get(w.player.target); return t && Math.hypot(t.x - w.player.x, t.z - w.player.z) < 3; }", timeout=240000)
            pg.evaluate("() => __ky.world.cmdSkill('atesTopu')")
            wait_game(0.6)
            pg.screenshot(path=f'shots/{mode}-fight.png')
            wait_game(3)
            pg.screenshot(path=f'shots/{mode}-fight2.png')
        elif st.startswith('panel:'):
            k = st.split(':')[1]
            pg.evaluate(f"() => __ky.ui.openPanel('{k}', {{}})")
            pg.wait_for_timeout(400)
            pg.screenshot(path=f'shots/{mode}-panel-{k}.png')
            pg.evaluate("() => __ky.ui.closePanel()")
        elif st.startswith('npc:'):
            k = st.split(':')[1]
            pg.evaluate(f"() => {{ const w = __ky.world, n = w.npcs.find(q => q.id === '{k}'); w.player.x = n.x + 1.5; w.player.z = n.z + 1.5; w.cmdInteract(n.id); }}")
            pg.wait_for_function("() => !!__ky.ui.panel", timeout=60000)
            pg.wait_for_timeout(500)
            pg.screenshot(path=f'shots/{mode}-npc-{k}.png')
        elif st.startswith('tab:'):
            k = st.split(':')[1]
            pg.evaluate(f"() => {{ __ky.ui.panel.tab = '{k}'; __ky.ui.renderPanel(); }}")
            pg.wait_for_timeout(300)
            pg.screenshot(path=f'shots/{mode}-tab-{k}.png')
        elif st.startswith('tp:'):
            _, x, z = st.split(':')
            pg.evaluate(f"() => {{ const w = __ky.world; __ky.ui.closePanel(); w.player.x = {x}; w.player.z = {z}; w.player.y = KY.Terrain.groundY({x},{z}); const v = __ky.view; v.cam.tx = {x}; v.cam.tz = {z}; }}")
            wait_game(1.0)
            pg.screenshot(path=f'shots/{mode}-at-{x}_{z}.png')
        elif st == 'caravan':
            pg.evaluate("() => { const w = __ky.world; w.player.gold = 999; const n = w.npcs.find(q => q.id === 'sarikum-kervan'); w.player.x = n.x+1; w.player.z = n.z+1; w.player.openNpc = n.id; w.cmdTradeBuy('ipek', 8); __ky.ui.closePanel(); w.cmdMove(w.player.x + 22, w.player.z - 2); }")
            wait_game(4)
            pg.screenshot(path=f'shots/{mode}-caravan.png')
        elif st == 'boss':
            pg.evaluate("() => { const w = __ky.world, p = w.player; p.lv = 14; p.str = 70; w.recalc(); p.hp = w.stats.maxHp; const m = [...w.mobs.values()].find(m => m.type === 'kizilyele'); p.x = m.x + 5; p.z = m.z; p.y = KY.Terrain.groundY(p.x, p.z); __ky.view.cam.tx = p.x; __ky.view.cam.tz = p.z; w.cmdAttack(m.id); m.nextSpecial = w.t + 1.5; }")
            pg.wait_for_function("() => __ky.view.tfx.length > 0", timeout=120000)
            wait_game(0.5)
            pg.screenshot(path=f'shots/{mode}-boss.png')
        elif st == 'levelup':
            pg.evaluate("() => { __ky.world.gainXp(200, 20); }")
            wait_game(0.4)
            pg.screenshot(path=f'shots/{mode}-levelup.png')
        elif st == 'map':
            pg.evaluate("() => __ky.ui.openBigMap()")
            pg.wait_for_timeout(300)
            pg.screenshot(path=f'shots/{mode}-bigmap.png')
            pg.evaluate("() => document.getElementById('bigmap').hidden = true")
        elif st == 'die':
            pg.evaluate("() => { const w = __ky.world; w.player.lv = 3; w.player.xp = 200; w.killPlayer(); }")
            pg.wait_for_timeout(1200)
            pg.screenshot(path=f'shots/{mode}-dead.png')
            pg.click('#respawnBtn')
            pg.wait_for_timeout(800)
            print('after respawn dead=', pg.evaluate('() => __ky.world.player.dead'), 'overlay hidden=', pg.evaluate("() => document.getElementById('death').hidden"))
        elif st == 'newgame':
            pg.evaluate("() => __ky.ui.openPanel('settings', {})")
            pg.click('[data-act=reset]'); pg.click('[data-act=reset2]')
            pg.wait_for_timeout(800)
            print('after new game lv', pg.evaluate('() => __ky.world.player.lv'), 'gold', pg.evaluate('() => __ky.world.player.gold'))
        elif st == 'reload':
            pg.evaluate("() => { __ky.world.player.gold = 777; __ky.App.save(); }")
            pg.reload(wait_until='load')
            pg.wait_for_function('document.body.classList.contains("ready")', timeout=60000)
            print('start button:', pg.inner_text('#startBtn'), '| info:', pg.inner_text('#saveInfo'))
            pg.click('#startBtn'); pg.wait_for_timeout(500)
            print('gold after reload', pg.evaluate('() => __ky.world.player.gold'))
        elif st == 'keys':
            for k in ['b', 'c', 'k', 'v', 'Escape', 'Tab', '1', '4', ' ']:
                pg.keyboard.press(k); pg.wait_for_timeout(150)
            print('panel after keys', pg.evaluate('() => __ky.ui.panel && __ky.ui.panel.kind'))
        elif st.startswith('equip:'):
            _, wid, plus = st.split(':')
            pg.evaluate(f"() => {{ const w = __ky.world, p = w.player; p.lv = 20; w.recalc(); p.eq.weapon = {{ id: '{wid}', plus: {plus} }}; w.addItem('w6', 1); w.addItem('w8', 1, 2); w.recalc(); __ky.view.rebuildPlayer(); }}")
            pg.wait_for_timeout(300)
        elif st == 'swing':
            pg.evaluate("() => { const w = __ky.world, p = w.player; const m = [...w.mobs.values()].filter(m => m.type === 'tilki').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]; p.x = m.x + 1.6; p.z = m.z; p.y = KY.Terrain.groundY(p.x, p.z); __ky.view.cam.tx = p.x; __ky.view.cam.tz = p.z; __ky.view.cam.dist = 11; m.hp = m.maxHp = 1e6; w.cmdAttack(m.id); }")
            pg.wait_for_function("() => { const a = __ky.view.ents.get('player').anim; return a.swing > 0.18 && a.swing < 0.36 && __ky.view.trail.mesh.visible; }", timeout=120000, polling=10)
            pg.screenshot(path=f'shots/{mode}-swing.png')
        elif st.startswith('invsel:'):
            k = st.split(':')[1]
            pg.evaluate(f"() => {{ const u = __ky.ui; u.openPanel('inv', {{}}); u.sel = {k if k == 'eq' and False else k}; u.renderPanel(); }}".replace('u.sel = eq', "u.sel = 'eq'"))
            pg.wait_for_timeout(900)
            pg.screenshot(path=f'shots/{mode}-invsel-{k}.png')
        elif st == 'coll':
            pg.evaluate("() => { const u = __ky.ui; u.openPanel('inv', { tab: 'coll' }); u.csel = 'w7'; u.renderPanel(); }")
            pg.wait_for_timeout(900)
            pg.screenshot(path=f'shots/{mode}-coll.png')
            pg.evaluate("() => { __ky.ui.panel.tab = 'coll'; __ky.ui.renderPanel(); document.getElementById('panelBody').scrollTop = 400; }")
            pg.wait_for_timeout(300)
            pg.screenshot(path=f'shots/{mode}-coll2.png')
        elif st == 'admin':
            pg.click('#adminBtn')
            pg.wait_for_timeout(400)
            pg.screenshot(path=f'shots/{mode}-admin1.png')
            pg.click('[data-act=agold][data-n="100000"]')
            pg.click('[data-act=alv][data-n="20"]')
            pg.fill('#admGold', '2500'); pg.press('#admGold', 'Enter')
            pg.click('[data-act=agod]')
            pg.wait_for_timeout(600)
            print('gold', pg.evaluate('() => __ky.world.player.gold'), 'lv', pg.evaluate('() => __ky.world.player.lv'), 'god', pg.evaluate('() => !!__ky.world.player.god'))
            pg.screenshot(path=f'shots/{mode}-admin2.png')
            pg.evaluate("() => document.getElementById('panelBody').scrollTop = 9999")
            pg.wait_for_timeout(200)
            pg.screenshot(path=f'shots/{mode}-admin3.png')
            pg.click('[data-act=atp]:has-text("Taşkale")')
            pg.wait_for_timeout(900)
            print('after tp area', pg.evaluate('() => __ky.world.lastArea'), 'panel open', pg.evaluate('() => !!__ky.ui.panel'))
            pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
            pg.keyboard.press('y'); pg.wait_for_timeout(200)
            print('Y key opens', pg.evaluate('() => __ky.ui.panel && __ky.ui.panel.kind'))
        elif st == 'pets':
            pg.evaluate("() => { const w = __ky.world; w.adminLevel(12); w.adminPets(); const ks = w.petSlots(); for (const o of ks) if (o.s.id === 'pet_kurt' || o.s.id === 'pet_tavsan') w.cmdPetSummon(o.k); __ky.view.cam.dist = 13; }")
            pg.evaluate("() => { const w = __ky.world; w.cmdMove(w.player.x - 26, w.player.z + 1); }")
            wait_game(4)
            pg.screenshot(path=f'shots/{mode}-pets-world.png')
        elif st == 'petsahin':
            pg.evaluate("() => { const w = __ky.world; const o = w.petSlots().find(o => o.s.id === 'pet_sahin'); w.cmdPetDismiss('fight'); w.pets.fight && (w.pets.fight.lastCombat = -99, w.cmdPetDismiss('fight')); w.cmdPetSummon(o.k); w.adminPetLevel(9); }")
            wait_game(1)
        elif st.startswith('pform:'):
            n = st.split(':')[1]
            pg.evaluate(f"() => {{ __ky.ui.peek = 'pet_sahin'; __ky.ui.peekForm = {n}; __ky.ui.renderPanel(); }}")
            pg.wait_for_timeout(900)
            pg.screenshot(path=f'shots/{mode}-pform-{n}.png')
        elif st == 'petfight':
            pg.evaluate("() => { const w = __ky.world, p = w.player; const m = [...w.mobs.values()].filter(m => m.type === 'tilki' && !m.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]; p.x = m.x + 5; p.z = m.z; p.y = KY.Terrain.groundY(p.x, p.z); m.hp = m.maxHp = 1e5; __ky.view.cam.tx = p.x; __ky.view.cam.tz = p.z; w.cmdAttack(m.id); }")
            pg.wait_for_function("() => { const f = __ky.world.pets.fight, a = f && __ky.view.ents.get(f.id); return a && a.anim.swing > 0.05 && a.anim.swing < 0.3; }", timeout=120000, polling=10)
            pg.screenshot(path=f'shots/{mode}-pets-fight.png')
        elif st == 'petevolve':
            pg.evaluate("() => { const w = __ky.world; w.adminLevel(25); w.adminPetLevel(20); w.adminPetLevel(20); }")
            wait_game(1.2)
            pg.screenshot(path=f'shots/{mode}-pets-evolve.png')
        elif st == 'petspanel':
            pg.evaluate("() => { __ky.ui.openPanel('pets', {}); }")
            pg.wait_for_timeout(900)
            pg.screenshot(path=f'shots/{mode}-pets-panel.png')
            pg.evaluate("() => { document.getElementById('panelBody').scrollTop = 9999; }")
            pg.wait_for_timeout(300)
            pg.screenshot(path=f'shots/{mode}-pets-panel2.png')
            pg.evaluate("() => { __ky.ui.closePanel(); }")
        elif st.startswith('close'):
            pg.evaluate("() => { const v = __ky.view; v.cam.dist = 7.5; v.cam.pitch = 0.42; v.cam.yaw = -0.6; }")
            wait_game(1.5)
            pg.screenshot(path=f'shots/{mode}-{st}.png')
        elif st == 'runclose':
            pg.evaluate("() => { const w = __ky.world, v = __ky.view; v.cam.dist = 8; v.cam.pitch = 0.45; v.cam.yaw = -1.2; w.cmdMove(w.player.x - 30, w.player.z + 3); }")
            wait_game(1.2)
            pg.screenshot(path=f'shots/{mode}-runclose.png')
        elif st == 'swdir':
            print(pg.evaluate('''() => { const r = __ky.view.ents.get('player'), m = r.model, sw = m.sword.group; m.obj.updateMatrixWorld(true);
              const q = new THREE.Quaternion(); sw.getWorldQuaternion(q); const y = new THREE.Vector3(0,1,0).applyQuaternion(q);
              const fq = new THREE.Quaternion(); m.obj.getWorldQuaternion(fq); const f = new THREE.Vector3(0,0,1).applyQuaternion(fq);
              const hand = m.obj.getObjectByName('hand_R'); const hq = new THREE.Quaternion(); hand.getWorldQuaternion(hq);
              const hy = new THREE.Vector3(0,1,0).applyQuaternion(hq);
              const ar = m.obj.getObjectByName('forearm_R'), hp = new THREE.Vector3(), ap = new THREE.Vector3(); hand.getWorldPosition(hp); ar.getWorldPosition(ap);
              return { cur: m.cur, blade: y.toArray().map(v=>+v.toFixed(2)), forward: f.toArray().map(v=>+v.toFixed(2)), handY: hy.toArray().map(v=>+v.toFixed(2)), forearmToHand: hp.sub(ap).normalize().toArray().map(v=>+v.toFixed(2)) }; }'''))
        elif st == 'swsample':
            print(pg.evaluate('''() => { const r = __ky.view.ents.get('player'), m = r.model, sw = m.sword.group, out = {};
              m.mixer.stopAllAction();
              for (const n of ['Idle','Run','Attack','Cast']) { const a = m.clips[n]; if (!a) continue; a.reset().play(); const D = a.getClip().duration, rows = [];
                for (let i = 0; i < 6; i++) { a.time = D * i / 6; m.mixer.update(0); m.obj.updateMatrixWorld(true);
                  const q = new THREE.Quaternion(); sw.getWorldQuaternion(q); const y = new THREE.Vector3(0,1,0).applyQuaternion(q);
                  const iq = new THREE.Quaternion(); m.obj.getWorldQuaternion(iq); iq.invert(); y.applyQuaternion(iq);
                  rows.push(y.toArray().map(v=>+v.toFixed(2))); }
                a.stop(); out[n] = rows; }
              m.clips.Idle.reset().play(); m.cur = 'Idle'; return JSON.stringify(out); }'''))
        elif st == 'model':
            print('model kind', pg.evaluate("() => __ky.view.ents.get('player').model.kind"), 'clips', pg.evaluate("() => { const m = __ky.view.ents.get('player').model; return m.clips ? Object.keys(m.clips) : null; }"))
        elif st == 'intro':
            pg.screenshot(path=f'shots/{mode}-hud.png')
    print('\n'.join(logs[:20]))
    b.close()
