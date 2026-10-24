const CACHE = 'salary-ticker-v1';
const PAGE = new URL('./salary.html', self.location.href);
const FILES = [
  './salary.html',
  './salary-manifest.json',
  './salary-icon.svg',
  './salary-icon-32.png',
  './salary-apple-touch-icon.png',
  './salary-pwa-192.png',
  './salary-pwa-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('salary-ticker-') && key !== CACHE)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' && url.pathname === PAGE.pathname) {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return cache.match(PAGE.href);
    }));
    return;
  }

  if (FILES.some(file => new URL(file, self.location.href).pathname === url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache =>
      cache.match(event.request).then(cached => cached || fetch(event.request))
    ));
  }
});
