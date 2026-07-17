// Register the offline app-shell service worker in the browser. Skipped in dev
// so it never caches un-fingerprinted dev assets; only runs in a secure context
// (https or localhost) where service workers are allowed.
export default defineNuxtPlugin(() => {
  if (import.meta.dev) {
    return
  }

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
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
