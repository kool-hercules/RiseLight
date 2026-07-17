// A small offline app-shell service worker. RiseLight is a bedside device: it
// must keep glowing through the night even if Wi-Fi drops, so once the app has
// been opened online it should launch and run fully offline.
//
// Strategy:
//   • Navigations → network-first, falling back to the cached shell. This keeps
//     the app fresh when online but always launchable offline.
//   • Same-origin GET assets (hashed JS/CSS, icons) → cache-first with a
//     background refresh (stale-while-revalidate), since Nuxt fingerprints them.
//
// The cache is versioned; bump CACHE_VERSION to invalidate on a shell change.

const CACHE_VERSION = 'riselight-v1'
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // A failed precache must not block activation; runtime caching still works.
      })
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  // App launch / navigations: prefer the network, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then(cache => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then(cached => cached ?? caches.match(request)))
    )
    return
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then(cache => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached ?? network
    })
  )
})
