// Service worker: guarda o app no aparelho para funcionar sem internet.
// A versão é gerada pelo build.js a partir do conteúdo do app.
const CACHE = 'rotina-rpg-fb27a6cec4';
const FONTS = 'rotina-rpg-fontes';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: usa a cópia guardada e atualiza em segundo plano.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then((cache) =>
        cache.match(req).then((hit) => {
          const fresh = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || fresh;
        }),
      ),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Página: tenta a internet primeiro (para pegar atualizações) e cai no cache offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('index.html', copy));
          return res;
        })
        .catch(() => caches.match('index.html')),
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
