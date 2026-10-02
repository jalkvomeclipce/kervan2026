// Tek dosyalık HTML üretir: dist/kervan-yolu.html
const fs = require('fs'), vm = require('vm');
const src = f => fs.readFileSync(__dirname + '/src/' + f, 'utf8');
const order = ['terrain.js', 'data.js', 'logic.js', 'pets.js', 'models.js', 'swords.js', 'scenery.js', 'render.js', 'icons.js', 'sfx.js', 'ui.js', 'main.js'];
const assets = { guard: fs.readFileSync(__dirname + '/assets/guard.glb').toString('base64') };
const js = `var KY = {}; KY.ASSETS = ${JSON.stringify(assets)};\n` + order.map(f => `// ---- ${f} ----\n` + src(f)).join('\n');
// ikonları şablona göm
const ctx = {}; vm.createContext(ctx); vm.runInContext(src('icons.js') + '\nthis.KY = KY;', ctx);
let html = src('index.html')
  .replace('/*CSS*/', () => src('style.css'))
  .replace('/*JS*/', () => js)
  .replace(/\{\{icon:(\w+)\}\}/g, (_, k) => ctx.KY.Icons[k] || '');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/kervan-yolu.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
// sözdizimi kontrolü
new vm.Script(js, { filename: 'bundle.js' });
console.log('syntax ok');
