/* MINC · Peritagem — service worker v5.6.0
   - Pré-cache de todo o app (funciona offline desde a primeira abertura).
   - Código (HTML/CSS/JS/manifest): rede primeiro, com limite de 3 s; cai para o cache se a rede falhar.
     Assim uma nova versão publicada chega sozinha, sem trocar nome de cache manualmente.
   - Fontes, ícones e bibliotecas: cache primeiro. */
const VERSION = 'minc-peritagem-v5.6.0';
const CORE = [
  './', './index.html', './styles.css', './app.js', './config.js', './catalogo.js', './manifest.json',
  './vendor/xlsx.mini.min.js', './vendor/supabase.js', './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-700-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/logo-minc.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v) }, e => { clearTimeout(t); no(e) }) });

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = req.mode === 'navigate' ? req : new Request(req.url, { cache: 'no-cache' });
    const res = await withTimeout(fetch(fresh), 3000);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const home = await cache.match('./index.html'); if (home) return home; }
    return new Response('Sem conexão e sem cópia local deste arquivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  try { const res = await fetch(req); if (res && res.ok) cache.put(req, res.clone()); return res; }
  catch (err) { return new Response('', { status: 504 }); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isCode = req.mode === 'navigate' || /\.(html|css|js|json)$/.test(url.pathname) || url.pathname.endsWith('/');
  const isLib = url.pathname.includes('/vendor/');
  e.respondWith(isCode && !isLib ? networkFirst(req) : cacheFirst(req));
});
