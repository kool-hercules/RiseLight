import { onBeforeUnmount, watch, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'

// Native parity for the web `useWakeLock`: hold the screen on while the light is
// active inside the Capacitor shell. The web Screen Wake Lock API isn't reliable
// in a WKWebView, so on native we use the KeepAwake plugin instead. This is a
// silent no-op on the web PWA (`useWakeLock` covers that case), so the same code
// runs everywhere.
export const useKeepAwake = (active: Readonly<Ref<boolean>>) => {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

  const apply = async (keepOn: boolean): Promise<void> => {
    if (!isNative) {
      return
    }
    try {
      if (keepOn) {
        await KeepAwake.keepAwake()
      } else {
        await KeepAwake.allowSleep()
      }
    } catch {
      // Never let a screen-wake failure break the light.
    }
  }

  watch(active, keepOn => void apply(keepOn), { immediate: true })

  // Always let the device sleep again when the app tears down.
  onBeforeUnmount(() => void apply(false))

  return { supported: isNative }
}
