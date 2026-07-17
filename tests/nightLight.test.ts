import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createNightLightRuntime } from '../composables/useNightLight'
import { createDefaultSettings } from '../utils/settings'
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

const localDate = (hours: number, minutes: number, seconds = 0): Date => {
  return new Date(2026, 0, 15, hours, minutes, seconds)
}

const createRuntime = (initialTime = localDate(5, 0)) => {
  const settings = ref(createDefaultSettings())
  const clock = new FakeClock(initialTime)
  const storage = new MemoryStorage()
  const runtime = createNightLightRuntime(settings, {
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    storage
  })

  return { clock, runtime, settings, storage }
}

describe('night-light clock lifecycle', () => {
  it('updates the clock while off and cleans up its interval', () => {
    const { clock, runtime } = createRuntime()

    runtime.startClock()
    const initialTime = runtime.currentTime.value.getTime()
    clock.advanceOneSecond()

    expect(runtime.isActive.value).toBe(false)
    expect(runtime.currentTime.value.getTime()).toBe(initialTime + 1000)

    runtime.dispose()
    expect(clock.clearIntervalCalls).toBe(1)
  })

  it('never creates duplicate intervals when started repeatedly', () => {
    const { clock, runtime } = createRuntime()

    runtime.startClock()
    runtime.startClock()
    runtime.startNightLight()
    runtime.startNightLight()

    expect(clock.setIntervalCalls).toBe(1)
    expect(runtime.isActive.value).toBe(true)
    runtime.dispose()
  })
})

describe('active settings updates', () => {
  it('recalculates wake time and duration changes synchronously', () => {
    const { clock, runtime, settings } = createRuntime(localDate(6, 0))
    runtime.startNightLight()

    settings.value.wakeTime = '06:00'
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.nextWakeTime.value).toEqual(localDate(6, 0))

    clock.set(localDate(6, 20))
    runtime.refresh()
    expect(runtime.currentState.value).toBe('wake')

    settings.value.wakeDuration = 10
    expect(runtime.currentState.value).toBe('awake')
    runtime.dispose()
  })

  it('applies color and brightness changes to the displayed active mode immediately', () => {
    const { runtime, settings } = createRuntime()
    runtime.startNightLight()
    expect(runtime.currentState.value).toBe('night')

    settings.value.colors.night = '#123456'
    settings.value.brightness.night = 0

    expect(runtime.currentColor.value).toBe('#123456')
    expect(runtime.getCurrentBrightness.value).toBe(0)
    runtime.dispose()
  })
})

describe('human schedule labels', () => {
  it('derives almost-time and okay-to-get-up labels from settings even while off', () => {
    const { runtime, settings } = createRuntime(localDate(22, 0))
    settings.value.wakeTime = '06:30'
    settings.value.wakeDuration = 30

    // Available without turning the light on, so "tonight's plan" can show them.
    expect(runtime.isActive.value).toBe(false)
    expect(runtime.almostTimeLabel.value).toMatch(/6:30\s?AM/i)
    expect(runtime.okayTimeLabel.value).toMatch(/7:00\s?AM/i)
    runtime.dispose()
  })

  it('rolls the okay-to-get-up label past the hour when the window crosses it', () => {
    const { runtime, settings } = createRuntime(localDate(22, 0))
    settings.value.wakeTime = '06:45'
    settings.value.wakeDuration = 30
    expect(runtime.okayTimeLabel.value).toMatch(/7:15\s?AM/i)
    runtime.dispose()
  })

  it('speaks the wake-window countdown in calm language', () => {
    const { clock, runtime, settings } = createRuntime(localDate(6, 30))
    settings.value.wakeTime = '06:30'
    settings.value.wakeDuration = 30
    runtime.startNightLight()

    clock.set(localDate(6, 45))
    runtime.refresh()
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.humanTimeRemaining.value).toBe('in about 15 minutes')
    runtime.dispose()
  })
})

describe('sunrise ramp (display color/brightness)', () => {
  it('shows the exact night color/brightness at the window start with no seam', () => {
    const { runtime, settings } = createRuntime(localDate(5, 0))
    settings.value.wakeTime = '06:30'
    settings.value.wakeDuration = 30
    runtime.startNightLight()

    expect(runtime.currentState.value).toBe('night')
    expect(runtime.displayColor.value).toBe(settings.value.colors.night)
    expect(runtime.displayBrightness.value).toBe(settings.value.brightness.night / 100)
    runtime.dispose()
  })

  it('eases through the wake keyframe at the window midpoint', () => {
    const { clock, runtime, settings } = createRuntime(localDate(6, 30))
    settings.value.wakeTime = '06:30'
    settings.value.wakeDuration = 30
    runtime.startNightLight()

    // 15 minutes into a 30-minute window is the midpoint → the wake keyframe.
    clock.set(localDate(6, 45))
    runtime.refresh()
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.rampProgress.value).toBeCloseTo(0.5, 5)
    expect(runtime.displayColor.value).toBe(settings.value.colors.wake)
    expect(runtime.displayBrightness.value).toBeCloseTo(settings.value.brightness.wake / 100, 5)
    runtime.dispose()
  })

  it('lands on the awake color/brightness as the window closes', () => {
    const { clock, runtime, settings } = createRuntime(localDate(6, 30))
    settings.value.wakeTime = '06:30'
    settings.value.wakeDuration = 30
    runtime.startNightLight()

    clock.set(localDate(7, 0))
    runtime.refresh()
    expect(runtime.currentState.value).toBe('awake')
    expect(runtime.displayColor.value).toBe(settings.value.colors.awake)
    expect(runtime.displayBrightness.value).toBe(settings.value.brightness.awake / 100)
    runtime.dispose()
  })

  it('does not ramp a previewed mode — it shows that mode exactly', () => {
    const { runtime, settings } = createRuntime()
    runtime.startPreview('wake')
    expect(runtime.rampProgress.value).toBe(0)
    expect(runtime.displayColor.value).toBe(settings.value.colors.wake)
    expect(runtime.displayBrightness.value).toBe(settings.value.brightness.wake / 100)
    runtime.dispose()
  })
})

describe('mode previews', () => {
  it('uses the selected mode brightness when colors are duplicated', () => {
    const { runtime, settings } = createRuntime()
    settings.value.colors.night = '#123456'
    settings.value.colors.wake = '#123456'
    settings.value.brightness.night = 10
    settings.value.brightness.wake = 85

    runtime.startPreview('wake')

    expect(runtime.currentColor.value).toBe('#123456')
    expect(runtime.getCurrentBrightness.value).toBe(0.85)
    runtime.dispose()
  })

  it('updates live edits to the previewed mode', () => {
    const { runtime, settings } = createRuntime()
    runtime.startPreview('awake')

    settings.value.colors.awake = '#abcdef'
    settings.value.brightness.awake = 25

    expect(runtime.currentColor.value).toBe('#abcdef')
    expect(runtime.getCurrentBrightness.value).toBe(0.25)
    runtime.dispose()
  })

  it('exits preview back to the exact prior off display', () => {
    const { runtime } = createRuntime()

    runtime.startPreview('awake')
    runtime.stopPreview()

    expect(runtime.isActive.value).toBe(false)
    expect(runtime.currentState.value).toBe('inactive')
    expect(runtime.currentColor.value).toBe('#ffffff')
    expect(runtime.getCurrentBrightness.value).toBe(0)
    runtime.dispose()
  })

  it('exits preview back to the current active schedule state', () => {
    const { clock, runtime, settings } = createRuntime()
    settings.value.wakeDuration = 30
    runtime.startNightLight()
    expect(runtime.currentState.value).toBe('night')

    runtime.startPreview('awake')
    clock.set(localDate(6, 30))
    runtime.refresh()
    expect(runtime.currentState.value).toBe('wake')

    runtime.stopPreview()
    expect(runtime.isActive.value).toBe(true)
    expect(runtime.currentColor.value).toBe(settings.value.colors.wake)
    expect(runtime.getCurrentBrightness.value).toBe(settings.value.brightness.wake / 100)
    runtime.dispose()
  })
})
