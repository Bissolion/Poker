// Gera duas saídas a partir dos módulos em engine/ e ui/:
//  1. mesa-de-treino.html — página única (artifact / abrir direto no navegador)
//  2. docs/ — app instalável (PWA) para o GitHub Pages: index.html, manifest, service worker e ícones
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dir = __dirname;
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

// Junta os módulos (em ordem de nome) de uma pasta
const join = (sub, ext) => fs.readdirSync(path.join(dir, sub)).filter(f => f.endsWith(ext)).sort().map(f => read(path.join(sub, f))).join('\n');
const engine = join('engine', '.js');
fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
fs.writeFileSync(path.join(dir, 'dist', 'engine.js'), engine); // usado pelos testes no Node
const ui = `(() => {\n${join('ui', '.js')}})();`;
const en = fs.existsSync(path.join(dir, 'i18n/en.json')) ? JSON.stringify(JSON.parse(read('i18n/en.json'))) : '{}';
// Idioma escolhido (ou o do aparelho) antes do motor carregar; trocar de idioma recarrega a página
const langScript = `<script>var POKER_LANG = (function () { try { var v = localStorage.getItem('mesa-treino-lang'); if (v) return v; } catch (e) {} return /^pt/i.test(navigator.language || 'pt') ? 'pt' : 'en'; })(); document.documentElement.lang = POKER_LANG === 'en' ? 'en' : 'pt-BR'; var POKER_EN = ${en.replace(/<\//g, '<\\/')};</script>`;
const page = `${read('ui/head.html')}<style>\n${read('ui/estilo.css')}</style>\n\n${read('ui/corpo.html')}\n${langScript}\n<script>${engine}</script>\n<script>\n${ui}\n</script>\n`;
fs.writeFileSync(path.join(dir, 'mesa-de-treino.html'), page);

// ---- PWA ----
const docs = path.join(dir, 'docs');
fs.mkdirSync(path.join(docs, 'icons'), { recursive: true });
const cut = page.indexOf('<div class="app">');
if (cut < 0) throw new Error('marcador <div class="app"> não encontrado em ui/corpo.html');
const headPart = page.slice(0, cut), bodyPart = page.slice(cut);
const desc = "Treino de Texas Hold'em contra bots, com coach de equity, pot odds, quiz e torneios.";
const index = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${desc}">
<meta name="theme-color" content="#0d1613">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mesa de Treino">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}</style>
<script>window.__MESA_PWA = true;</script>
${headPart}</head>
<body>
${bodyPart}
<script>if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</body>
</html>
`;
fs.writeFileSync(path.join(docs, 'index.html'), index);

const manifest = {
  name: 'Mesa de Treino', short_name: 'Mesa', description: desc, lang: 'pt-BR',
  start_url: './', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#0d1613', theme_color: '#0d1613',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(docs, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// O nome do cache muda com o conteúdo, então cada versão nova substitui a antiga no celular
const version = crypto.createHash('sha256').update(index).digest('hex').slice(0, 10);
const sw = `// Service worker da Mesa de Treino (gerado por build.js)
const CACHE = 'mesa-app-${version}';
const FONTS = 'mesa-fonts';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mesa-app-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Página: tenta a rede (para pegar atualizações) e cai no cache sem internet
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }
  // Arquivos do app: cache primeiro
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }
  // Fontes do Google: usa o cache e atualiza em segundo plano
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
`;
fs.writeFileSync(path.join(docs, 'sw.js'), sw);
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
  if (!fs.existsSync(path.join(docs, 'icons', f))) console.warn(`aviso: docs/icons/${f} não existe; rode python3 tools/make-icons.py`);
}
console.log(`mesa-de-treino.html e docs/ gerados (versão ${version})`);
