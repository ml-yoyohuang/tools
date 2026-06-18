const CACHE = 'clock-v2'
const FILES = [
  './clock.html',
  './clock-manifest.json',
  './clock-icon.svg',
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (new URL(e.request.url).searchParams.has('timesync')) {
    e.respondWith(fetch(e.request))
    return
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)))
})
