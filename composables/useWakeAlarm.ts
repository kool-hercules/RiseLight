import { watch, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Settings } from '../types'
import { computeAlarmTime } from '../utils/alarm'

// Fires an "okay to get up" local notification at the wake transition — even
// when the app is closed or the screen is locked. This is a native-only
// capability (the reason to ship the Capacitor shell); on the web PWA every
// method is a silent no-op, so the same code runs everywhere.
//
// The alarm tracks the live schedule: it's (re)scheduled whenever the light is
// on and the wake time/window changes, and cancelled when the light is off.

const NOTIFICATION_ID = 1001

export const useWakeAlarm = (
  isActive: Readonly<Ref<boolean>>,
  nextWakeTime: Readonly<Ref<Date | null>>,
  settings: Readonly<Ref<Settings>>
) => {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  let permissionGranted: boolean | null = null

  const ensurePermission = async (): Promise<boolean> => {
    if (permissionGranted !== null) {
      return permissionGranted
    }
    try {
      const status = await LocalNotifications.checkPermissions()
      if (status.display === 'granted') {
        permissionGranted = true
      } else if (status.display === 'denied') {
        permissionGranted = false
      } else {
        const requested = await LocalNotifications.requestPermissions()
        permissionGranted = requested.display === 'granted'
      }
    } catch {
      permissionGranted = false
    }
    return permissionGranted
  }

  const cancel = async (): Promise<void> => {
    if (!isNative) {
      return
    }
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
    } catch {
      // Nothing scheduled, or the platform rejected — never fatal.
    }
  }

  const schedule = async (): Promise<void> => {
    if (!isNative) {
      return
    }

    const at = computeAlarmTime(nextWakeTime.value, settings.value.wakeDuration, Date.now())
    if (!at) {
      await cancel()
      return
    }

    if (!(await ensurePermission())) {
      return
    }

    try {
      // Replace any prior schedule so a changed wake time never double-fires.
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_ID,
            title: 'Good morning! ☀️',
            body: "It's okay to get up now.",
            schedule: { at }
          }
        ]
      })
    } catch {
      // A failed schedule must never break the light.
    }
  }

  // Reconcile the alarm with the live schedule.
  watch(
    [isActive, nextWakeTime, () => settings.value.wakeDuration],
    () => {
      if (isActive.value) {
        void schedule()
      } else {
        void cancel()
      }
    },
    { immediate: true }
  )

  return { schedule, cancel }
}
