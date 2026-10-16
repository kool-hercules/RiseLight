// Register the offline app-shell service worker in the browser. Skipped in dev
// so it never caches un-fingerprinted dev assets; only runs in a secure context
// (https or localhost) where service workers are allowed.
export default defineNuxtPlugin(() => {
  if (import.meta.dev) {
    // A worker left behind by a static preview on the same port would keep
    // serving the old app shell and leave dev blank, so retire it.
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          void registration.unregister().then(removed => {
            if (removed && navigator.serviceWorker.controller) {
              window.location.reload()
            }
          })
        }
      })
    }
    return
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  // Hand the worker the build files this page already loaded (before it was
  // in control), so the very first visit is enough to launch offline.
  const sendLoadedAssets = (worker: ServiceWorker | null) => {
    const urls = performance
      .getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => new URL(name).pathname.startsWith('/_nuxt/'))
    worker?.postMessage({ type: 'cache-urls', urls })
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(registration => sendLoadedAssets(registration.active))
      .catch(() => {
        // A registration failure just means no offline support — never fatal.
      })
  }

  // The client plugin can run after `load` has already fired (hydration), in
  // which case the event never comes — register now; otherwise wait for load so
  // registration never competes with first paint.
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
})
