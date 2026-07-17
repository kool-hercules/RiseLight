import { onBeforeUnmount, watch, type Ref } from 'vue'

// A night light is useless if the screen sleeps, so hold a screen wake lock
// while the light is on. Browsers release the lock whenever the tab is hidden
// (or the device auto-locks), so we re-acquire on visibility change. Everything
// degrades to a no-op where the API is unavailable (older Safari, non-secure
// contexts) rather than throwing.
export const useWakeLock = (active: Readonly<Ref<boolean>>) => {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  let sentinel: WakeLockSentinel | null = null

  const release = async (): Promise<void> => {
    const current = sentinel
    sentinel = null
    if (current) {
      try {
        await current.release()
      } catch {
        // Already released (e.g. the tab was hidden) — nothing to do.
      }
    }
  }

  const acquire = async (): Promise<void> => {
    if (!supported || !active.value || sentinel || document.visibilityState !== 'visible') {
      return
    }

    try {
      sentinel = await navigator.wakeLock.request('screen')
      // If the OS drops the lock (tab hidden, battery saver), forget the stale
      // handle so the next visibility/active change can request a fresh one.
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch {
      sentinel = null
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

  if (supported) {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  onBeforeUnmount(() => {
    if (supported) {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    void release()
  })

  return { supported }
}
