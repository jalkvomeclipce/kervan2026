import sys, time, json
from playwright.sync_api import sync_playwright
THREE = open('/home/claude/kervan/node_modules/three/build/three.min.js').read()
HTML = open('/home/claude/kervan/dist/kervan-yolu.html').read()
page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + HTML + '</body></html>'
mode = sys.argv[1] if len(sys.argv) > 1 else 'mobile'
def route(r):
    u = r.request.url
    if 'three.min.js' in u: return r.fulfill(status=200, content_type='application/javascript', body=THREE)
    if 'fonts.googleapis' in u: return r.fulfill(status=200, content_type='text/css', body='')
    if u.startswith('http://game.local'): return r.fulfill(status=200, content_type='text/html', body=page_html)
    return r.abort()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    if mode == 'mobile':
        ctx = b.new_context(viewport={'width': 390, 'height': 760}, device_scale_factor=2, has_touch=True, is_mobile=True)
    else:
        ctx = b.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
    pg = ctx.new_page()
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    ctx.route('**/*', route)
    t0 = time.time()
    pg.goto('http://game.local/', wait_until='load')
    try:
        pg.wait_for_function('document.body.classList.contains("ready")', timeout=30000)
    except Exception as e:
        print('NOT READY'); print('\n'.join(logs[:40])); pg.screenshot(path=f'shots/{mode}-fail.png'); b.close(); sys.exit(1)
    print('boot seconds', round(time.time() - t0, 1))
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'shots/{mode}-1-intro.png')
    pg.click('#startBtn')
    pg.wait_for_timeout(2500)
    pg.screenshot(path=f'shots/{mode}-2-town.png')
    # fps ölçümü
    fps = pg.evaluate('''() => new Promise(res => { let n = 0; const t0 = performance.now(); function f(){ n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); } requestAnimationFrame(f); })''')
    print('fps (swiftshader)', fps)
    print('\n'.join(logs[:30]))
    b.close()
