import sys
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/kervan/node_modules/three/build/three.min.js').read()
src = lambda f: open('/home/claude/kervan/src/' + f).read()
JS = '\n'.join(src(f) for f in ['terrain.js', 'data.js', 'models.js'])
page = '''<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#12151c}canvas{display:block}</style></head><body>
<canvas id="c" width="1600" height="600"></canvas>
<script src="http://game.local/three.js"></script><script>''' + JS + '''
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
r.setClearColor(0x2a3140);
const sc = new THREE.Scene();
sc.add(new THREE.HemisphereLight(0xd6e4ff, 0x8a6a45, 0.7));
const sun = new THREE.DirectionalLight(0xfff0d8, 0.95); sun.position.set(-3, 5, 4); sc.add(sun);
const list = [['tavsan',0],['sincap',0],['fenek',0],['kurt',0],['kurt',1],['kurt',2],['sahin',0],['sahin',1],['sahin',2]];
const cam = new THREE.PerspectiveCamera(30, 1600/600, 0.1, 100); cam.position.set(0, 2.2, 9.5); cam.lookAt(0, 0.5, 0);
const g = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshLambertMaterial({ color: 0x8cae55 })); g.rotation.x = -Math.PI/2; sc.add(g);
list.forEach(([sp, f], k) => { const m = KY.Models.pet(sp, f); m.obj.position.set((k - 4) * 1.55, m.fly ? 0.9 : 0, 0); m.obj.rotation.y = 0.9; sc.add(m.obj); });
r.render(sc, cam);
document.title = 'done';
</script></body></html>'''
def route(req):
    u = req.request.url
    if u.endswith('three.js'): return req.fulfill(status=200, content_type='application/javascript', body=THREE)
    return req.fulfill(status=200, content_type='text/html', body=page)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1600, 'height': 600})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto('http://game.local/')
    pg.wait_for_function('document.title === "done"', timeout=60000)
    pg.screenshot(path='/home/claude/kervan/shots/pets-lineup.png')
    print('\n'.join(errs[:10]) or 'ok')
    b.close()
