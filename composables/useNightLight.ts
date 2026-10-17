import {
  computed,
  onMounted,
  onUnmounted,
  readonly,
  ref,
  shallowRef,
  type Ref
} from 'vue'
import type { LightColor, LightMode, LightState, Settings } from '../types'
import { createDevClock } from '../utils/devClock'
import { readOverride, saveOverride } from '../utils/override'
import {
  isOverrideActive,
  phaseDisplay,
  resolvePhase,
  upcomingNight,
  type Override,
  type ResolvedPhase
} from '../utils/routine'
import { getBrowserStorage, type StorageLike } from '../utils/settings'
import { formatClockTime, humanizeCountdown } from '../utils/time'

type IntervalHandle = unknown

export type NightLightDependencies = {
  now?: () => Date
  setInterval?: (callback: () => void, milliseconds: number) => IntervalHandle
  clearInterval?: (handle: IntervalHandle) => void
  storage?: StorageLike | null
}

const isLitState = (state: LightState): boolean => state !== 'inactive'

// The live runtime: a ticking clock, the single persisted override, and the
// phase derived from both plus settings by the pure routine engine. Nothing
// else is stored, so edits and reloads always land on the right phase.
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

  const currentTime = shallowRef(new Date(now().getTime()))
  const override = shallowRef<Override | null>(null)
  const previewMode = ref<LightMode | null>(null)
  let clockInterval: IntervalHandle | null = null

  const phase = computed<ResolvedPhase>(() =>
    resolvePhase(currentTime.value, settings.value, override.value)
  )

  const setOverride = (next: Override | null): void => {
    override.value = next
    saveOverride(storage, next)
  }

  const refresh = (): void => {
    const at = now()
    currentTime.value = new Date(at.getTime())

    // Expired (or clock-skewed) overrides are cleared so storage never holds
    // a stale one.
    if (override.value && !isOverrideActive(override.value, at.getTime(), settings.value)) {
      setOverride(null)
    }
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

  const restore = (): void => {
    const at = now()
    currentTime.value = new Date(at.getTime())
    override.value = readOverride(storage, at)
    refresh()
  }

  // "Start now": light the night from this moment until the next wake, then
  // the usual ramp and hold. Used with auto-schedule off, or for an early night.
  // Over a lit schedule (only reachable after Off for now) it is an undo: the
  // schedule resumes, so story time comes back as story time, not as night.
  const startNow = (): void => {
    refresh()
    if (isLitState(resolvePhase(currentTime.value, settings.value, null).state)) {
      setOverride(null)
      return
    }
    setOverride({ kind: 'on', start: currentTime.value.getTime() })
  }

  const startNap = (minutes: number): void => {
    refresh()
    setOverride({ kind: 'nap', start: currentTime.value.getTime(), minutes })
  }

  const cancelOverride = (): void => {
    setOverride(null)
  }

  // "Off for now". Cancelling an `on`/`nap` hands back to the schedule; if the
  // schedule is itself lit at that moment, it is switched off too, so one tap
  // always means dark. Pressed during the schedule, it stays dark until the next
  // morning ramp (from story time / night) or until idle (from wake / awake).
  const turnOffForNow = (): void => {
    refresh()
    const at = currentTime.value
    const current = phase.value

    if (current.override?.kind === 'off') {
      return
    }

    const base = current.override ? resolvePhase(at, settings.value, null).state : current.state
    if (isLitState(base)) {
      setOverride({ kind: 'off', start: at.getTime(), fromPhase: base })
    } else if (current.override) {
      setOverride(null)
    }
  }

  const startPreview = (mode: LightMode): void => {
    previewMode.value = mode
  }

  const stopPreview = (): void => {
    previewMode.value = null
  }

  const currentState = computed<LightState>(() => phase.value.state)
  const isLit = computed(() => isLitState(phase.value.state))
  const activeOverride = computed(() => phase.value.override)
  // Armed = the device is responsible for something coming up, so the screen
  // must stay awake: the routine runs by itself, or an on/nap is in progress.
  const isArmed = computed(() =>
    settings.value.autoSchedule
    || (phase.value.override !== null && phase.value.override.kind !== 'off')
  )
  const progress = computed(() => phase.value.progress)

  const display = computed(() => {
    if (previewMode.value) {
      return {
        color: settings.value.colors[previewMode.value],
        brightness: settings.value.brightness[previewMode.value] / 100
      }
    }
    return phaseDisplay(phase.value, settings.value, currentTime.value)
  })

  const displayColor = computed<LightColor>(() => display.value.color)
  const displayBrightness = computed(() => display.value.brightness)
  const isPreviewMode = computed(() => previewMode.value !== null)

  const timeRemaining = computed(() =>
    phase.value.phaseEnd === null ? 0 : Math.max(0, phase.value.phaseEnd - currentTime.value.getTime())
  )

  // Calm, spoken-language countdown for the wake window ("in about 15 minutes").
  const humanTimeRemaining = computed(() => humanizeCountdown(timeRemaining.value))

  // "Tonight's plan": the night running now, or the next one. Uses the runtime
  // clock so a dev/QA clock is honored.
  const plan = computed(() => upcomingNight(currentTime.value, settings.value))

  const okayTimeLabel = computed(() => {
    const okayAt = phase.value.okayAt
    return formatClockTime(okayAt !== null ? new Date(okayAt) : plan.value.okayAt)
  })

  const dispose = (): void => {
    stopClock()
  }

  return {
    currentTime: readonly(currentTime),
    phase,
    currentState,
    isLit,
    isArmed,
    override: readonly(override),
    activeOverride,
    progress,
    displayColor,
    displayBrightness,
    timeRemaining,
    humanTimeRemaining,
    plan,
    okayTimeLabel,
    previewMode: readonly(previewMode),
    isPreviewMode,
    startClock,
    stopClock,
    refresh,
    restore,
    startNow,
    startNap,
    turnOffForNow,
    cancelOverride,
    startPreview,
    stopPreview,
    dispose
  }
}

export type NightLightRuntime = ReturnType<typeof createNightLightRuntime>

export const useNightLight = (settings: Readonly<Ref<Settings>>) => {
  // Opt into an accelerated QA clock when the URL asks for one; otherwise the
  // runtime falls back to the real wall clock. Inert for normal visitors.
  const devNow = typeof window !== 'undefined'
    ? createDevClock(window.location.search)
    : null

  const runtime = createNightLightRuntime(settings, devNow ? { now: devNow } : {})

  // Restore before first paint so a mid-night reload never flashes the wrong
  // phase (the schedule itself needs no restoring).
  if (typeof window !== 'undefined') {
    runtime.restore()
  }

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      runtime.refresh()
    }
  }

  onMounted(() => {
    runtime.startClock()
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    runtime.dispose()
  })

  return runtime
}
