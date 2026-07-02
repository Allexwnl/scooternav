// Service worker: app-shell cachen zodat de app opent en "op het homescherm" kan.
// ponytail: alleen same-origin GET. Kaarttegels / API / Valhalla (cross-origin) NIET
// cachen — die moeten vers blijven (anders spookmeldingen). Bump CACHE bij een release
// om oude assets te lozen.
const CACHE = 'sweetscoots-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // cross-origin → altijd netwerk

  if (request.mode === 'navigate') {
    // Network-first: verse app als er verbinding is, anders de gecachte shell (offline).
    e.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }
  // Statische assets (gehashte JS/CSS): cache-first; nieuwe build = nieuwe hash = nieuwe fetch.
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        }),
    ),
  )
})
