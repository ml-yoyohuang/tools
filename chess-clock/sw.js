const CACHE_NAME = 'chess-clock-v16';
const APP_SHELL = ['./', './index.html', './app.js?v=584242f22d8e', './styles.css?v=99447850ad1d', './vue.global.prod.js?v=c459ba7cc8db', './manifest.webmanifest?v=86f39818bd58', './favicon.svg?v=6dcb783d91b2', './og-image.png?v=dd65798840a7'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response; }))); });
