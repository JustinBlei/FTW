// Offline-Cache: App startet sofort aus dem Cache, Updates werden im Hintergrund geladen
// und sind beim nächsten Start aktiv.
const CACHE = 'wt-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // 'reload': am HTTP-Cache vorbei, sonst landen bis zu 10 min alte Dateien im neuen Cache
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    // 'no-cache': beim Server nachfragen (GitHub Pages setzt max-age=600), dank ETag meist nur 304
    const network = fetch(req, { cache: 'no-cache' })
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);
    e.waitUntil(network);
    return cached || (await network) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
