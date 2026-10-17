import { onBeforeUnmount, watch, type Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Settings } from '../types'
import { ALARM_IDS, planAlarms } from '../utils/alarm'
import type { NightLightRuntime } from './useNightLight'

// Fires an "okay to get up" local notification at each of the next seven
// okay-to-wake moments — even when the app is closed or the screen is locked.
// This is a native-only capability (the reason to ship the Capacitor shell); on
// the web PWA every method is a silent no-op, so the same code runs everywhere.
//
// Re-synced whenever settings or the override change, when the app returns
// to the foreground, and once the earliest scheduled alarm has passed (so a
// device left on screen for days never runs out of alarms). The chime toggle decides whether they make a sound: off
// still posts the notification, just silently.

// Android 8+ takes sound from the channel, so keep one audible and one quiet.
const CHANNEL_AUDIBLE = 'riselight-wake'
const CHANNEL_QUIET = 'riselight-wake-quiet'

export const useWakeAlarm = (
  runtime: Pick<NightLightRuntime, 'currentTime' | 'override'>,
  settings: Readonly<Ref<Settings>>
) => {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  let permissionGranted: boolean | null = null
  let channelsReady = false

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

  const ensureChannels = async (): Promise<void> => {
    if (channelsReady || Capacitor.getPlatform() !== 'android') {
      return
    }
    try {
      await LocalNotifications.createChannel({ id: CHANNEL_AUDIBLE, name: 'Okay to get up', importance: 4 })
      await LocalNotifications.createChannel({ id: CHANNEL_QUIET, name: 'Okay to get up (silent)', importance: 2 })
      channelsReady = true
    } catch {
      // Falls back to the default channel.
    }
  }

  const cancel = async (): Promise<void> => {
    if (!isNative) {
      return
    }
    try {
      await LocalNotifications.cancel({ notifications: ALARM_IDS.map(id => ({ id })) })
    } catch {
      // Nothing scheduled, or the platform rejected — never fatal.
    }
  }

  // Serialize syncs so overlapping triggers can't interleave cancel/schedule.
  let syncing: Promise<void> = Promise.resolve()
  // The earliest alarm in the last plan; once the clock passes it, top up.
  let resyncAfter = Infinity

  const syncNow = async (): Promise<void> => {
    if (!isNative) {
      return
    }

    // Use the runtime clock so a dev clock is honored consistently.
    const plan = planAlarms(runtime.currentTime.value, settings.value, runtime.override.value)
    resyncAfter = plan.length > 0 ? Math.min(...plan.map(({ at }) => at.getTime())) : Infinity
    await cancel()
    if (plan.length === 0 || !(await ensurePermission())) {
      return
    }
    await ensureChannels()

    const audible = settings.value.chimeEnabled
    try {
      await LocalNotifications.schedule({
        notifications: plan.map(({ id, at }) => ({
          id,
          title: 'Good morning! ☀️',
          body: "It's okay to get up now.",
          schedule: { at },
          // iOS: no `sound` = silent; an unknown name falls back to the default sound.
          sound: audible ? 'default' : undefined,
          channelId: channelsReady ? (audible ? CHANNEL_AUDIBLE : CHANNEL_QUIET) : undefined
        }))
      })
    } catch {
      // A failed schedule must never break the light.
    }
  }

  const sync = (): Promise<void> => {
    syncing = syncing.then(syncNow, syncNow)
    return syncing
  }

  // Only the fields that move an okay-to-wake time (or its sound), so slider
  // drags elsewhere don't churn native scheduling.
  const alarmKey = (): string => {
    const { schedule, wakeDuration, awakeHoldMinutes, autoSchedule, chimeEnabled } = settings.value
    return JSON.stringify([schedule, wakeDuration, awakeHoldMinutes, autoSchedule, chimeEnabled])
  }

  watch(
    [() => runtime.override.value, alarmKey],
    () => void sync(),
    { immediate: true }
  )

  watch(
    () => runtime.currentTime.value.getTime() > resyncAfter,
    passed => {
      if (passed) {
        resyncAfter = Infinity
        void sync()
      }
    }
  )

  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      void sync()
    }
  }

  if (isNative) {
    document.addEventListener('visibilitychange', handleVisibility)
  }

  onBeforeUnmount(() => {
    if (isNative) {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  })

  return { sync, cancel }
}
