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

  const formatNextWakeTime = computed(() => {
    if (!isActive.value || !nextWakeTime.value) {
      return ''
    }

    return nextWakeTime.value.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  })

  const statusMessage = computed(() => {
    if (previewMode.value) {
      return `Previewing ${previewMode.value} mode`
    }

    if (!isActive.value) {
      return 'Night light is off'
    }

    switch (currentState.value) {
      case 'night':
        return `Night mode until ${formatNextWakeTime.value}`
      case 'wake':
        return `Wake mode - ${formatTimeRemaining.value} remaining`
      case 'awake':
        return 'Awake mode - ready to start your day!'
      default:
        return 'Night light is off'
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
    timeRemaining: readonly(timeRemaining),
    nextWakeTime: readonly(nextWakeTime),
    previewMode: readonly(previewMode),
    isPreviewMode,
    timerInfo,
    formatTimeRemaining,
    getCurrentBrightness,
    formatNextWakeTime,
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
  const runtime = createNightLightRuntime(settings)

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
