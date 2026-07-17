import {
  computed,
  onMounted,
  onUnmounted,
  readonly,
  ref,
  watch,
  type Ref
} from 'vue'
import type { LightColor, LightMode, LightState, Settings, TimerInfo } from '../types'
import { MODE_PRESENTATION } from '../utils/modes'
import { createDevClock } from '../utils/devClock'
import { rampBrightness, rampColor } from '../utils/ramp'
import { formatClockTime, humanizeCountdown } from '../utils/time'
import { calculateNextWakeTime, calculateScheduleState } from '../utils/schedule'
import { clearActiveSession, readActiveSession, saveActiveSession } from '../utils/session'
import { getBrowserStorage, type StorageLike } from '../utils/settings'

type IntervalHandle = unknown

export type NightLightDependencies = {
  now?: () => Date
  setInterval?: (callback: () => void, milliseconds: number) => IntervalHandle
  clearInterval?: (handle: IntervalHandle) => void
  storage?: StorageLike | null
}

export const createNightLightRuntime = (
  settings: Readonly<Ref<Settings>>,
  dependencies: NightLightDependencies = {}
) => {
  const now = dependencies.now ?? (() => new Date())
  const setClockInterval = dependencies.setInterval
    ?? ((callback, milliseconds) => globalThis.setInterval(callback, milliseconds))
  const clearClockInterval = dependencies.clearInterval
    ?? (handle => globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>))
  const storage = dependencies.storage === undefined ? getBrowserStorage() : dependencies.storage

  const currentTime = ref(new Date(now().getTime()))
  const isActive = ref(false)
  const currentState = ref<LightState>('inactive')
  const timeRemaining = ref(0)
  const nextWakeTime = ref<Date | null>(null)
  const previewMode = ref<LightMode | null>(null)
  let clockInterval: IntervalHandle | null = null

  const resetToInactive = (): void => {
    isActive.value = false
    currentState.value = 'inactive'
    nextWakeTime.value = null
    timeRemaining.value = 0
  }

  const updateLightState = (at: Date = now()): void => {
    currentTime.value = new Date(at.getTime())

    if (!isActive.value || !nextWakeTime.value) {
      currentState.value = 'inactive'
      timeRemaining.value = 0
      return
    }

    const schedule = calculateScheduleState(at, nextWakeTime.value, settings.value.wakeDuration)
    currentState.value = schedule.mode
    timeRemaining.value = schedule.timeRemaining
  }

  const refresh = (): void => {
    updateLightState(now())
  }

  const startClock = (): void => {
    refresh()
    if (clockInterval !== null) {
      return
    }

    clockInterval = setClockInterval(refresh, 1000)
  }

  const stopClock = (): void => {
    if (clockInterval === null) {
      return
    }

    clearClockInterval(clockInterval)
    clockInterval = null
  }

  const startNightLight = (): void => {
    const startedAt = now()
    currentTime.value = new Date(startedAt.getTime())
    nextWakeTime.value = calculateNextWakeTime(
      startedAt,
      settings.value.wakeTime,
      settings.value.wakeDuration
    )
    isActive.value = true
    updateLightState(startedAt)
    saveActiveSession(storage, nextWakeTime.value)
    startClock()
  }

  const stopNightLight = (): void => {
    resetToInactive()
    clearActiveSession(storage)
  }

  const toggleNightLight = (): void => {
    if (isActive.value) {
      stopNightLight()
    } else {
      startNightLight()
    }
  }

  const startPreview = (mode: LightMode): void => {
    previewMode.value = mode
  }

  const stopPreview = (): void => {
    previewMode.value = null
  }

  const restoreSession = (): boolean => {
    const restoredAt = now()
    const restoredWakeTime = readActiveSession(storage, restoredAt)
    currentTime.value = new Date(restoredAt.getTime())

    if (!restoredWakeTime) {
      resetToInactive()
      return false
    }

    nextWakeTime.value = restoredWakeTime
    isActive.value = true
    updateLightState(restoredAt)
    return true
  }

  const stopSettingsWatcher = watch(
    () => [settings.value.wakeTime, settings.value.wakeDuration] as const,
    ([wakeTime], [previousWakeTime]) => {
      if (!isActive.value) {
        return
      }

      const changedAt = now()
      if (wakeTime !== previousWakeTime || !nextWakeTime.value) {
        nextWakeTime.value = calculateNextWakeTime(
          changedAt,
          wakeTime,
          settings.value.wakeDuration
        )
        saveActiveSession(storage, nextWakeTime.value)
      }

      updateLightState(changedAt)
    },
    { flush: 'sync' }
  )

  const displayMode = computed<LightMode | null>(() => {
    if (previewMode.value) {
      return previewMode.value
    }

    return currentState.value === 'inactive' ? null : currentState.value
  })

  const currentColor = computed<LightColor>(() => {
    return displayMode.value ? settings.value.colors[displayMode.value] : '#ffffff'
  })

  const getCurrentBrightness = computed(() => {
    return displayMode.value ? settings.value.brightness[displayMode.value] / 100 : 0
  })

  // How far we are through the live wake window: 0 at its start, 1 at its end.
  // Only meaningful (and non-zero) while the schedule is actually in the wake
  // state; previews and the flat night/awake states don't ramp.
  const rampProgress = computed(() => {
    if (previewMode.value || currentState.value !== 'wake') {
      return 0
    }

    const windowMs = settings.value.wakeDuration * 60 * 1000
    if (windowMs <= 0) {
      return 1
    }

    return Math.min(1, Math.max(0, 1 - timeRemaining.value / windowMs))
  })

  // What actually paints the screen. Identical to the discrete color/brightness
  // everywhere except the live wake window, where it eases continuously through
  // the night → wake → awake keyframes so there is no hard color swap.
  const displayColor = computed<LightColor>(() => {
    if (!displayMode.value) {
      return '#ffffff'
    }

    if (!previewMode.value && currentState.value === 'wake') {
      return rampColor(rampProgress.value, settings.value.colors)
    }

    return settings.value.colors[displayMode.value]
  })

  const displayBrightness = computed(() => {
    if (!displayMode.value) {
      return 0
    }

    if (!previewMode.value && currentState.value === 'wake') {
      return rampBrightness(rampProgress.value, settings.value.brightness) / 100
    }

    return settings.value.brightness[displayMode.value] / 100
  })

  const isPreviewMode = computed(() => previewMode.value !== null)

  const formatTimeRemaining = computed(() => {
    if (timeRemaining.value <= 0) {
      return '00:00:00'
    }

    const totalSeconds = Math.floor(timeRemaining.value / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  // Calm, spoken-language countdown for the wake window ("in about 15 minutes").
  const humanTimeRemaining = computed(() => humanizeCountdown(timeRemaining.value))

  const formatNextWakeTime = computed(() => {
    if (!isActive.value || !nextWakeTime.value) {
      return ''
    }

    return formatClockTime(nextWakeTime.value)
  })

  // The two schedule anchors, derived from settings so they are available even
  // when the light is off (for "tonight's plan"): when "almost time" starts
  // (the configured wake time) and when it becomes "okay to get up" (that time
  // plus the wake-up window). Uses the runtime clock so a dev/QA clock is honored.
  const scheduleAnchor = (extraMinutes: number): Date => {
    const [hours, minutes] = settings.value.wakeTime.split(':').map(Number)
    const at = new Date(now().getTime())
    at.setHours(hours, minutes + extraMinutes, 0, 0)
    return at
  }

  const almostTimeLabel = computed(() => formatClockTime(scheduleAnchor(0)))
  const okayTimeLabel = computed(() => formatClockTime(scheduleAnchor(settings.value.wakeDuration)))

  // Retained for compatibility; equals okayTimeLabel while active.
  const formatOkayToRiseTime = computed(() => (isActive.value ? okayTimeLabel.value : ''))

  const statusMessage = computed(() => {
    if (previewMode.value) {
      return `Previewing “${MODE_PRESENTATION[previewMode.value].label}”`
    }

    if (!isActive.value) {
      return 'Light is off'
    }

    switch (currentState.value) {
      case 'night':
        return `Stay in bed — okay to get up at ${okayTimeLabel.value}`
      case 'wake':
        return `Almost time — okay to get up ${humanTimeRemaining.value}`
      case 'awake':
        return 'Okay to get up — good morning!'
      default:
        return 'Light is off'
    }
  })

  const timerInfo = computed<TimerInfo>(() => ({
    currentTime: currentTime.value,
    nextWakeTime: nextWakeTime.value,
    timeRemaining: timeRemaining.value,
    currentState: currentState.value,
    currentColor: currentColor.value,
    isActive: isActive.value
  }))

  const dispose = (): void => {
    stopClock()
    stopSettingsWatcher()
  }

  return {
    currentTime: readonly(currentTime),
    isActive: readonly(isActive),
    currentState: readonly(currentState),
    currentColor,
    displayColor,
    displayBrightness,
    rampProgress,
    timeRemaining: readonly(timeRemaining),
    nextWakeTime: readonly(nextWakeTime),
    previewMode: readonly(previewMode),
    isPreviewMode,
    timerInfo,
    formatTimeRemaining,
    humanTimeRemaining,
    almostTimeLabel,
    okayTimeLabel,
    getCurrentBrightness,
    formatNextWakeTime,
    formatOkayToRiseTime,
    statusMessage,
    startClock,
    stopClock,
    refresh,
    startNightLight,
    stopNightLight,
    toggleNightLight,
    startPreview,
    stopPreview,
    restoreSession,
    updateLightState,
    dispose
  }
}

export const useNightLight = (settings: Readonly<Ref<Settings>>) => {
  // Opt into an accelerated QA clock when the URL asks for one; otherwise the
  // runtime falls back to the real wall clock. Inert for normal visitors.
  const devNow = typeof window !== 'undefined'
    ? createDevClock(window.location.search)
    : null

  const runtime = createNightLightRuntime(settings, devNow ? { now: devNow } : {})

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      runtime.refresh()
    }
  }

  onMounted(() => {
    runtime.restoreSession()
    runtime.startClock()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    runtime.dispose()
  })

  return runtime
}
