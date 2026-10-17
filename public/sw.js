// A small offline app-shell service worker. RiseLight is a bedside device: it
// must keep glowing through the night even if Wi-Fi drops, so once the app has
// been opened online it should launch and run fully offline.
//
// Strategy:
//   • Navigations → network-first, falling back to the cached shell. This keeps
//     the app fresh when online but always launchable offline.
//   • Fingerprinted build assets (/_nuxt/<hash>.js|css) → cache-first with a
//     background refresh (stale-while-revalidate); their names change on every
//     build, so a cached copy is never wrong.
//   • Everything else same-origin (icons, manifest, and un-fingerprinted dev
//     modules) → network-first with a cache fallback. Serving those cache-first
//     handed a dev server stale Vite modules and left the page blank.
//
// The cache is versioned; bump CACHE_VERSION to invalidate on a shell change.

const CACHE_VERSION = 'riselight-v3'
const FINGERPRINTED = /^\/_nuxt\/[\w.-]+\.(?:js|css)$/
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

// The page loads its build files before this worker controls it, so they'd
// only be cached on the *next* visit. The page posts the ones it loaded (see
// plugins/pwa.client.ts) so a single online visit is enough to launch offline.
self.addEventListener('message', event => {
  const data = event.data
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) {
    return
  }
  const urls = new Set()
  for (const href of data.urls) {
    try {
      const url = new URL(href, self.location.origin)
      if (url.origin === self.location.origin && FINGERPRINTED.test(url.pathname) && !url.search) {
        urls.add(url.href)
      }
    } catch {
      // Not a URL; skip it.
    }
  }
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // addAll rejects the whole batch on a duplicate, hence the Set.
      .then(cache => cache.addAll([...urls]))
      .catch(() => {
        // Best effort; runtime caching still fills in on the next load.
      })
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
          // Only a real, direct 200 may become the offline shell: a 404/5xx or
          // a captive-portal redirect would otherwise replace the app.
          if (response.ok && !response.redirected) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then(cache => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/').then(cached => cached ?? caches.match(request)))
    )
    return
  }

  const store = response => {
    if (response && response.status === 200) {
      const copy = response.clone()
      caches.open(CACHE_VERSION).then(cache => cache.put(request, copy))
    }
    return response
  }

  if (!FINGERPRINTED.test(url.pathname) || url.search) {
    event.respondWith(fetch(request).then(store).catch(() => caches.match(request)))
    return
  }

  // Fingerprinted assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(store)
        .catch(() => cached)
      return cached ?? network
    })
  )
})
