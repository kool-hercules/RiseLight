import { onBeforeUnmount, readonly, ref, watch, type Ref } from 'vue'

// A night light is useless if the screen sleeps, so hold a screen wake lock
// while the light is on. Browsers release the lock whenever the tab is hidden
// (or the device auto-locks), so we re-acquire on visibility change. Everything
// degrades to a no-op where the API is unavailable (older Safari, non-secure
// contexts) rather than throwing. `supported`/`held` let the page warn when the
// light is armed but the screen may still sleep.
export const useWakeLock = (active: Readonly<Ref<boolean>>) => {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator && Boolean(navigator.wakeLock)
  const supported = ref(isSupported)
  const held = ref(false)
  let sentinel: WakeLockSentinel | null = null

  const release = async (): Promise<void> => {
    const current = sentinel
    sentinel = null
    held.value = false
    if (current) {
      try {
        await current.release()
      } catch {
        // Already released (e.g. the tab was hidden) — nothing to do.
      }
    }
  }

  const acquire = async (): Promise<void> => {
    if (!isSupported || !active.value || sentinel || document.visibilityState !== 'visible') {
      return
    }

    try {
      const acquired = await navigator.wakeLock.request('screen')
      sentinel = acquired
      held.value = true
      // If the OS drops the lock (tab hidden, battery saver), forget the stale
      // handle so the next visibility/active change can request a fresh one.
      acquired.addEventListener('release', () => {
        if (sentinel === acquired) {
          sentinel = null
          held.value = false
        }
      })
    } catch {
      sentinel = null
      held.value = false
    }
  }

  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible' && active.value) {
      void acquire()
    }
  }

  watch(
    active,
    isActive => {
      if (isActive) {
        void acquire()
      } else {
        void release()
      }
    },
    { immediate: true }
  )

  if (isSupported) {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  onBeforeUnmount(() => {
    if (isSupported) {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    void release()
  })

  return { supported: readonly(supported), held: readonly(held) }
}
