import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createNightLightRuntime } from '../composables/useNightLight'
import { OVERRIDE_STORAGE_KEY } from '../utils/override'
import { createDefaultSchedule, createDefaultSettings } from '../utils/settings'
import { MemoryStorage } from './helpers/memoryStorage'

class FakeClock {
  private currentTime: number
  private nextIntervalId = 1
  private readonly intervals = new Map<number, () => void>()
  setIntervalCalls = 0
  clearIntervalCalls = 0

  constructor(initialTime: Date) {
    this.currentTime = initialTime.getTime()
  }

  now = (): Date => new Date(this.currentTime)

  setInterval = (callback: () => void): number => {
    this.setIntervalCalls += 1
    const intervalId = this.nextIntervalId++
    this.intervals.set(intervalId, callback)
    return intervalId
  }

  clearInterval = (handle: unknown): void => {
    this.clearIntervalCalls += 1
    this.intervals.delete(handle as number)
  }

  advanceOneSecond(): void {
    this.currentTime += 1000
    for (const callback of this.intervals.values()) {
      callback()
    }
  }

  set(time: Date): void {
    this.currentTime = time.getTime()
  }
}

// 2026-10-16 is a Friday. Defaults: story time 19:10, bedtime 19:30, wake
// 06:30, okay 07:00, idle 08:00.
const localDate = (day: number, hours: number, minutes = 0): Date => new Date(2026, 9, day, hours, minutes)

const createRuntime = (initialTime = localDate(16, 12), storage = new MemoryStorage()) => {
  const settings = ref(createDefaultSettings())
  const clock = new FakeClock(initialTime)
  const runtime = createNightLightRuntime(settings, {
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    storage
  })

  const goTo = (time: Date): void => {
    clock.set(time)
    runtime.refresh()
  }

  return { clock, runtime, settings, storage, goTo }
}

describe('night-light clock lifecycle', () => {
  it('updates the clock and cleans up its interval', () => {
    const { clock, runtime } = createRuntime()

    runtime.startClock()
    const initialTime = runtime.currentTime.value.getTime()
    clock.advanceOneSecond()
    expect(runtime.currentTime.value.getTime()).toBe(initialTime + 1000)

    runtime.dispose()
    expect(clock.clearIntervalCalls).toBe(1)
  })

  it('never creates duplicate intervals when started repeatedly', () => {
    const { clock, runtime } = createRuntime()
    runtime.startClock()
    runtime.startClock()
    expect(clock.setIntervalCalls).toBe(1)
    runtime.dispose()
  })
})

describe('the routine runs by itself', () => {
  it('walks story time → night → wake → awake → idle with no taps', () => {
    const { runtime, goTo } = createRuntime(localDate(16, 19, 5))
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.isLit.value).toBe(false)
    expect(runtime.isArmed.value).toBe(true)

    goTo(localDate(16, 19, 15))
    expect(runtime.currentState.value).toBe('bedtime')
    goTo(localDate(16, 23))
    expect(runtime.currentState.value).toBe('night')
    expect(runtime.isLit.value).toBe(true)
    goTo(localDate(17, 6, 45))
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.humanTimeRemaining.value).toBe('in about 15 minutes')
    goTo(localDate(17, 7, 30))
    expect(runtime.currentState.value).toBe('awake')
    goTo(localDate(17, 8))
    expect(runtime.currentState.value).toBe('inactive')
    runtime.dispose()
  })

  it('applies schedule edits immediately', () => {
    const { runtime, settings } = createRuntime(localDate(17, 6, 40))
    expect(runtime.currentState.value).toBe('wake')
    settings.value.schedule = createDefaultSchedule('07:00')
    expect(runtime.currentState.value).toBe('night')
    runtime.dispose()
  })

  it('is disarmed and dark with auto-schedule off', () => {
    const { runtime, settings } = createRuntime(localDate(16, 23))
    settings.value.autoSchedule = false
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.isArmed.value).toBe(false)
    runtime.dispose()
  })
})

describe('overrides', () => {
  it('Start now lights the night, arms the device, and persists', () => {
    const { runtime, settings, storage } = createRuntime(localDate(16, 12))
    settings.value.autoSchedule = false

    runtime.startNow()
    expect(runtime.currentState.value).toBe('night')
    expect(runtime.isArmed.value).toBe(true)
    expect(JSON.parse(storage.getItem(OVERRIDE_STORAGE_KEY)!).override.kind).toBe('on')
    runtime.dispose()
  })

  it('Off for now during an on override with an idle base just cancels it', () => {
    const { runtime, settings, storage } = createRuntime(localDate(16, 12))
    settings.value.autoSchedule = false
    runtime.startNow()
    runtime.turnOffForNow()
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.override.value).toBeNull()
    expect(storage.getItem(OVERRIDE_STORAGE_KEY)).toBeNull()
    runtime.dispose()
  })

  it('Off for now over a lit schedule goes dark, and the morning still comes', () => {
    const { runtime, goTo } = createRuntime(localDate(16, 19, 15))
    runtime.turnOffForNow()
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.isArmed.value).toBe(true)

    goTo(localDate(16, 23))
    expect(runtime.currentState.value).toBe('inactive')
    goTo(localDate(17, 6, 30))
    expect(runtime.currentState.value).toBe('wake')
    // Expired overrides are cleared on the tick.
    expect(runtime.override.value).toBeNull()
    runtime.dispose()
  })

  it('Off for now during an early start that overlaps story time is one tap to dark', () => {
    const { runtime, goTo } = createRuntime(localDate(16, 18, 50))
    runtime.startNow()
    goTo(localDate(16, 19, 15))
    expect(runtime.currentState.value).toBe('night')
    runtime.turnOffForNow()
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.override.value?.kind).toBe('off')
    runtime.dispose()
  })

  it('a daytime nap ramps to green then hands back to idle', () => {
    const { runtime, goTo } = createRuntime(localDate(16, 13))
    runtime.startNap(30)
    expect(runtime.currentState.value).toBe('night')
    goTo(localDate(16, 13, 27))
    expect(runtime.currentState.value).toBe('wake')
    goTo(localDate(16, 13, 30))
    expect(runtime.currentState.value).toBe('awake')
    goTo(localDate(16, 13, 45))
    expect(runtime.currentState.value).toBe('inactive')
    runtime.dispose()
  })

  it('restores an override from storage on reload', () => {
    const storage = new MemoryStorage()
    const first = createRuntime(localDate(16, 13), storage)
    first.runtime.startNap(60)
    first.runtime.dispose()

    const second = createRuntime(localDate(16, 13, 20), storage)
    second.runtime.restore()
    expect(second.runtime.currentState.value).toBe('night')
    expect(second.runtime.activeOverride.value?.kind).toBe('nap')
    second.runtime.dispose()
  })

  it('a mid-night reload restores from the schedule with no override at all', () => {
    const { runtime } = createRuntime(localDate(17, 2))
    runtime.restore()
    expect(runtime.currentState.value).toBe('night')
    runtime.dispose()
  })
})

describe('display', () => {
  it('ramps through the wake keyframe at the window midpoint', () => {
    const { runtime, settings } = createRuntime(localDate(17, 6, 45))
    expect(runtime.progress.value).toBeCloseTo(0.5, 5)
    expect(runtime.displayColor.value).toBe(settings.value.colors.wake)
    expect(runtime.displayBrightness.value).toBeCloseTo(settings.value.brightness.wake / 100, 5)
    runtime.dispose()
  })

  it('shows story time in the bedtime colour', () => {
    const { runtime, settings } = createRuntime(localDate(16, 19, 15))
    expect(runtime.displayColor.value).toBe(settings.value.colors.bedtime)
    expect(runtime.displayBrightness.value).toBe(settings.value.brightness.bedtime / 100)
    runtime.dispose()
  })

  it('applies colour and brightness edits to the live phase immediately', () => {
    const { runtime, settings } = createRuntime(localDate(16, 23))
    settings.value.colors.night = '#123456'
    settings.value.brightness.night = 0
    expect(runtime.displayColor.value).toBe('#123456')
    expect(runtime.displayBrightness.value).toBe(0)
    runtime.dispose()
  })

  it('is dark while idle', () => {
    const { runtime } = createRuntime(localDate(16, 12))
    expect(runtime.displayBrightness.value).toBe(0)
    runtime.dispose()
  })
})

describe('previews', () => {
  it('shows the previewed mode exactly and tracks live edits', () => {
    const { runtime, settings } = createRuntime(localDate(16, 12))
    runtime.startPreview('bedtime')
    expect(runtime.displayColor.value).toBe(settings.value.colors.bedtime)
    settings.value.brightness.bedtime = 25
    expect(runtime.displayBrightness.value).toBe(0.25)
    runtime.dispose()
  })

  it('exits back to the live phase', () => {
    const { runtime, settings, goTo } = createRuntime(localDate(16, 23))
    runtime.startPreview('awake')
    goTo(localDate(17, 6, 30))
    runtime.stopPreview()
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.displayColor.value).toBe(settings.value.colors.night)
    runtime.dispose()
  })
})

describe('plan labels', () => {
  it('derives tonight’s okay-to-get-up time from the schedule', () => {
    const { runtime, settings } = createRuntime(localDate(16, 12))
    expect(runtime.okayTimeLabel.value).toMatch(/7:00\s?AM/i)
    settings.value.schedule = createDefaultSchedule('06:45')
    expect(runtime.okayTimeLabel.value).toMatch(/7:15\s?AM/i)
    expect(runtime.plan.value.bedtime.getHours()).toBe(19)
    runtime.dispose()
  })
})
