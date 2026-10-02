import sys
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/kervan/node_modules/three/build/three.min.js').read()
src = lambda f: open('/home/claude/kervan/src/' + f).read()
JS = '\n'.join(src(f) for f in ['terrain.js', 'data.js', 'swords.js'])
page = '''<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#12151c}canvas{display:block}</style></head><body>
<canvas id="c" width="1600" height="700"></canvas>
<script src="http://game.local/three.js"></script><script>''' + JS + '''
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
r.setClearColor(0x161a22);
const sc = new THREE.Scene(); sc.environment = KY.Swords.envFor(r);
sc.add(new THREE.HemisphereLight(0xfff4e0, 0x2c2834, 0.75));
const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(1.6, 2.2, 3); sc.add(key);
const rim = new THREE.DirectionalLight(0x9fc4ff, 0.9); rim.position.set(-2.2, 1, -2); sc.add(rim);
const ids = ['w1','w2','w3','w4','w6','w7','w5','w8'];
const cam = new THREE.PerspectiveCamera(22, 1600/700, 0.1, 50); cam.position.set(0, 0.0, 7.2); cam.lookAt(0, 0, 0);
ids.forEach((id, k) => { const b = KY.Swords.build(id, 0, {}); b.group.position.set((k - 3.5) * 0.62, -0.62, 0); b.group.rotation.y = ''' + sys.argv[1] + '''; sc.add(b.group); });
r.render(sc, cam);
document.title = 'done';
</script></body></html>'''
def route(req):
    u = req.request.url
    if u.endswith('three.js'): return req.fulfill(status=200, content_type='application/javascript', body=THREE)
    return req.fulfill(status=200, content_type='text/html', body=page)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1600, 'height': 700})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.route('**/*', route)
    pg.goto('http://game.local/')
    pg.wait_for_function('document.title === "done"', timeout=60000)
    pg.screenshot(path='/home/claude/kervan/shots/swords-' + sys.argv[2] + '.png')
    print('\n'.join(errs[:10]) or 'ok')
    b.close()
