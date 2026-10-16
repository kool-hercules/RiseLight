import { describe, expect, it } from 'vitest'
import type { Settings } from '../types'
import {
  buildSplitSchedule,
  createDefaultSchedule,
  createDefaultSettings
} from '../utils/settings'
import {
  isOverrideActive,
  overrideEnd,
  phaseDisplay,
  resolvePhase,
  upcomingNight,
  upcomingOkayToWake,
  type Override
} from '../utils/routine'

// 2026-10-16 is a Friday. Local time; vitest pins TZ=America/New_York.
const at = (day: number, hours: number, minutes = 0, month = 9): Date =>
  new Date(2026, month, day, hours, minutes)

const MIN = 60_000

// Defaults: bedtime 19:30, wind-down 20, wake 06:30, window 30, hold 60.
const makeSettings = (patch: Partial<Settings> = {}): Settings => ({ ...createDefaultSettings(), ...patch })

const stateAt = (date: Date, settings = makeSettings(), override: Override | null = null) =>
  resolvePhase(date, settings, override).state

describe('test environment', () => {
  it('runs in a DST-observing zone', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).not.toBe(new Date(2026, 6, 1).getTimezoneOffset())
    expect(at(16, 12).getDay()).toBe(5)
  })
})

describe('resolvePhase: schedule boundaries', () => {
  const settings = makeSettings()

  it('walks every phase boundary of a night', () => {
    expect(stateAt(at(16, 19, 9), settings)).toBe('inactive')
    expect(stateAt(at(16, 19, 10), settings)).toBe('bedtime')
    expect(stateAt(at(16, 19, 29), settings)).toBe('bedtime')
    expect(stateAt(at(16, 19, 30), settings)).toBe('night')
    expect(stateAt(at(17, 6, 29), settings)).toBe('night')
    expect(stateAt(at(17, 6, 30), settings)).toBe('wake')
    expect(stateAt(at(17, 6, 59), settings)).toBe('wake')
    expect(stateAt(at(17, 7, 0), settings)).toBe('awake')
    expect(stateAt(at(17, 7, 59), settings)).toBe('awake')
    expect(stateAt(at(17, 8, 0), settings)).toBe('inactive')
  })

  it('reports phase start/end and the okay-to-get-up instant', () => {
    const phase = resolvePhase(at(16, 23), settings, null)
    expect(phase.phaseStart).toBe(at(16, 19, 30).getTime())
    expect(phase.phaseEnd).toBe(at(17, 6, 30).getTime())
    expect(phase.okayAt).toBe(at(17, 7).getTime())
    expect(phase.base).toBe('night')
  })

  it('resolves 2am to the previous evening’s night', () => {
    const phase = resolvePhase(at(17, 2), settings, null)
    expect(phase.state).toBe('night')
    expect(phase.phaseStart).toBe(at(16, 19, 30).getTime())
  })

  it('uses each day’s own row: Friday night → Saturday morning differ from weekdays', () => {
    const split = makeSettings({
      schedule: buildSplitSchedule(
        { wakeTime: '06:30', bedtime: '19:30' },
        { wakeTime: '07:30', bedtime: '20:30' }
      )
    })
    // Thursday evening uses the weekday bedtime; Friday evening the weekend one.
    expect(stateAt(at(15, 19, 30), split)).toBe('night')
    expect(stateAt(at(16, 19, 30), split)).toBe('inactive')
    expect(stateAt(at(16, 20, 10), split)).toBe('bedtime')
    // Friday morning wakes at 06:30; Saturday morning at 07:30.
    expect(stateAt(at(16, 6, 45), split)).toBe('wake')
    expect(stateAt(at(17, 6, 45), split)).toBe('night')
    expect(stateAt(at(17, 7, 45), split)).toBe('wake')
  })

  it('skips story time entirely with a zero wind-down', () => {
    const noWindDown = makeSettings({ windDownMinutes: 0 })
    expect(stateAt(at(16, 19, 29), noWindDown)).toBe('inactive')
    expect(stateAt(at(16, 19, 30), noWindDown)).toBe('night')
  })

  it('lets the later night win where an awake hold overlaps the next wind-down', () => {
    const overlap = makeSettings({
      schedule: createDefaultSchedule('12:00', '15:00'),
      wakeDuration: 60,
      awakeHoldMinutes: 120,
      windDownMinutes: 30
    })
    // Last night's green runs 13:00–15:00; tonight's story time starts 14:30.
    expect(stateAt(at(17, 14, 0), overlap)).toBe('awake')
    expect(stateAt(at(17, 14, 30), overlap)).toBe('bedtime')
    expect(stateAt(at(17, 15, 0), overlap)).toBe('night')
  })

  it('is always inactive with autoSchedule off', () => {
    const manual = makeSettings({ autoSchedule: false })
    for (const date of [at(16, 19, 15), at(16, 23), at(17, 6, 45), at(17, 7, 15)]) {
      expect(stateAt(date, manual)).toBe('inactive')
    }
  })

  it('clamps progress to [0, 1] and tracks the wake window', () => {
    expect(resolvePhase(at(17, 6, 30), settings, null).progress).toBe(0)
    expect(resolvePhase(at(17, 6, 45), settings, null).progress).toBeCloseTo(0.5, 5)
    const idle = resolvePhase(at(17, 12), settings, null)
    expect(idle.progress).toBeGreaterThanOrEqual(0)
    expect(idle.progress).toBeLessThanOrEqual(1)
  })
})

describe('resolvePhase: DST', () => {
  const settings = makeSettings()

  it('spring-forward night (2026-03-08) is an hour shorter but lands on the same wall-clock wake', () => {
    const phase = resolvePhase(at(8, 2, 30, 2), settings, null)
    expect(phase.state).toBe('night')
    expect(new Date(phase.phaseEnd!).getHours()).toBe(6)
    expect(new Date(phase.phaseEnd!).getMinutes()).toBe(30)
    expect(phase.phaseEnd! - phase.phaseStart!).toBe((11 * 60 - 60) * MIN)
    expect(stateAt(at(8, 6, 30, 2), settings)).toBe('wake')
  })

  it('fall-back night (2026-11-01) is an hour longer but lands on the same wall-clock wake', () => {
    const phase = resolvePhase(at(1, 1, 30, 10), settings, null)
    expect(phase.state).toBe('night')
    expect(phase.phaseEnd! - phase.phaseStart!).toBe((11 * 60 + 60) * MIN)
    expect(stateAt(at(1, 6, 30, 10), settings)).toBe('wake')
    expect(stateAt(at(1, 6, 29, 10), settings)).toBe('night')
  })
})

describe('overrides: on', () => {
  it('runs night → wake → awake from an early start, then ends at the hold', () => {
    const settings = makeSettings({ autoSchedule: false })
    const on: Override = { kind: 'on', start: at(16, 18).getTime() }

    expect(stateAt(at(16, 18, 30), settings, on)).toBe('night')
    expect(stateAt(at(17, 6, 30), settings, on)).toBe('wake')
    expect(stateAt(at(17, 7), settings, on)).toBe('awake')
    expect(overrideEnd(on, settings)).toBe(at(17, 8).getTime())
    expect(stateAt(at(17, 8), settings, on)).toBe('inactive')
  })

  it('moves its end when the wake time is edited', () => {
    const settings = makeSettings({ autoSchedule: false })
    const on: Override = { kind: 'on', start: at(16, 21).getTime() }
    expect(stateAt(at(17, 6, 40), settings, on)).toBe('wake')

    settings.schedule = createDefaultSchedule('07:30')
    expect(stateAt(at(17, 6, 40), settings, on)).toBe('night')
    expect(overrideEnd(on, settings)).toBe(at(17, 9).getTime())
  })

  it('started inside today’s wake window shows almost-time, not a whole extra night', () => {
    const settings = makeSettings({ autoSchedule: false })
    const on: Override = { kind: 'on', start: at(17, 6, 40).getTime() }
    expect(stateAt(at(17, 6, 41), settings, on)).toBe('wake')
  })
})

describe('overrides: nap', () => {
  it('daytime nap: night, a short ramp, then 15 minutes of green', () => {
    const settings = makeSettings()
    const nap: Override = { kind: 'nap', start: at(16, 13).getTime(), minutes: 30 }

    expect(stateAt(at(16, 13, 10), settings, nap)).toBe('night')
    expect(stateAt(at(16, 13, 25), settings, nap)).toBe('wake')
    expect(stateAt(at(16, 13, 30), settings, nap)).toBe('awake')
    expect(stateAt(at(16, 13, 44), settings, nap)).toBe('awake')
    expect(stateAt(at(16, 13, 45), settings, nap)).toBe('inactive')
    expect(resolvePhase(at(16, 13, 10), settings, nap).okayAt).toBe(at(16, 13, 30).getTime())
  })

  it('caps the ramp at the wake window when it is shorter than 5 minutes', () => {
    const settings = makeSettings({ wakeDuration: 2 })
    const nap: Override = { kind: 'nap', start: at(16, 13).getTime(), minutes: 30 }
    expect(stateAt(at(16, 13, 27), settings, nap)).toBe('night')
    expect(stateAt(at(16, 13, 28), settings, nap)).toBe('wake')
  })

  it('a nap ending inside bedtime or night shows no ramp and no green', () => {
    const settings = makeSettings()
    const evening: Override = { kind: 'nap', start: at(16, 21).getTime(), minutes: 60 }
    expect(stateAt(at(16, 21, 58), settings, evening)).toBe('night')
    expect(overrideEnd(evening, settings)).toBe(at(16, 22).getTime())
    // Hands straight back to the schedule's night.
    expect(resolvePhase(at(16, 22), settings, evening).override).toBeNull()
    expect(stateAt(at(16, 22), settings, evening)).toBe('night')

    const intoStoryTime: Override = { kind: 'nap', start: at(16, 18, 20).getTime(), minutes: 60 }
    expect(stateAt(at(16, 19, 18), settings, intoStoryTime)).toBe('night')
    expect(stateAt(at(16, 19, 20), settings, intoStoryTime)).toBe('bedtime')
  })
})

describe('overrides: off', () => {
  const settings = makeSettings()

  it('during story time: dark through lights-out, then the morning ramp still comes', () => {
    const off: Override = { kind: 'off', start: at(16, 19, 15).getTime(), fromPhase: 'bedtime' }
    expect(stateAt(at(16, 19, 20), settings, off)).toBe('inactive')
    expect(stateAt(at(17, 3), settings, off)).toBe('inactive')
    expect(stateAt(at(17, 6, 30), settings, off)).toBe('wake')
    expect(overrideEnd(off, settings)).toBe(at(17, 6, 30).getTime())
  })

  it('during the night (after midnight): dark until that morning’s ramp', () => {
    const off: Override = { kind: 'off', start: at(17, 2).getTime(), fromPhase: 'night' }
    expect(stateAt(at(17, 6, 29), settings, off)).toBe('inactive')
    expect(stateAt(at(17, 6, 30), settings, off)).toBe('wake')
  })

  it('during wake or awake: dark until the hold would have ended', () => {
    const fromWake: Override = { kind: 'off', start: at(17, 6, 40).getTime(), fromPhase: 'wake' }
    expect(stateAt(at(17, 7, 10), settings, fromWake)).toBe('inactive')
    expect(overrideEnd(fromWake, settings)).toBe(at(17, 8).getTime())

    const fromAwake: Override = { kind: 'off', start: at(17, 7, 30).getTime(), fromPhase: 'awake' }
    expect(overrideEnd(fromAwake, settings)).toBe(at(17, 8).getTime())
    // Tonight's routine is untouched.
    expect(stateAt(at(17, 19, 15), settings, fromAwake)).toBe('bedtime')
  })

  it('pressed while inactive is a no-op (never active)', () => {
    const off: Override = { kind: 'off', start: at(17, 12).getTime(), fromPhase: 'inactive' }
    expect(isOverrideActive(off, at(17, 12, 1).getTime(), settings)).toBe(false)
  })
})

describe('override expiry', () => {
  it('ignores an override whose derived end has passed', () => {
    const settings = makeSettings({ autoSchedule: false })
    const stale: Override = { kind: 'on', start: at(10, 21).getTime() }
    const phase = resolvePhase(at(16, 22), settings, stale)
    expect(phase.state).toBe('inactive')
    expect(phase.override).toBeNull()
  })

  it('ignores an override that starts in the future', () => {
    const settings = makeSettings({ autoSchedule: false })
    const future: Override = { kind: 'on', start: at(16, 23).getTime() }
    expect(stateAt(at(16, 22), settings, future)).toBe('inactive')
  })
})

describe('phaseDisplay', () => {
  const settings = makeSettings()

  it('crossfades story time into the night colour over its last 3 minutes', () => {
    const early = phaseDisplay(resolvePhase(at(16, 19, 20), settings, null), settings, at(16, 19, 20))
    expect(early.color).toBe(settings.colors.bedtime)
    expect(early.brightness).toBe(settings.brightness.bedtime / 100)

    const mid = at(16, 19, 28, 9)
    mid.setSeconds(30)
    const fading = phaseDisplay(resolvePhase(mid, settings, null), settings, mid)
    expect(fading.color).not.toBe(settings.colors.bedtime)
    expect(fading.color).not.toBe(settings.colors.night)

    const lightsOut = phaseDisplay(resolvePhase(at(16, 19, 30), settings, null), settings, at(16, 19, 30))
    expect(lightsOut.color).toBe(settings.colors.night)
  })

  it('ramps through the wake keyframe mid-window and is dark when inactive', () => {
    const mid = phaseDisplay(resolvePhase(at(17, 6, 45), settings, null), settings, at(17, 6, 45))
    expect(mid.color).toBe(settings.colors.wake)
    expect(mid.brightness).toBeCloseTo(settings.brightness.wake / 100, 5)
    expect(phaseDisplay(resolvePhase(at(17, 12), settings, null), settings, at(17, 12)).brightness).toBe(0)
  })
})

describe('upcomingOkayToWake', () => {
  it('lists the next week of okay-to-get-up instants from each day’s row', () => {
    const settings = makeSettings({
      schedule: buildSplitSchedule(
        { wakeTime: '06:30', bedtime: '19:30' },
        { wakeTime: '07:30', bedtime: '20:30' }
      )
    })
    const times = upcomingOkayToWake(at(16, 12), settings, null, 7)
    expect(times).toHaveLength(7)
    expect(times.map(date => `${date.getDate()} ${date.getHours()}:${date.getMinutes()}`)).toEqual([
      '17 8:0', // Saturday
      '18 8:0', // Sunday
      '19 7:0',
      '20 7:0',
      '21 7:0',
      '22 7:0',
      '23 7:0'
    ])
  })

  it('drops a morning switched off from wake, and adds a nap’s green', () => {
    const settings = makeSettings()
    const off: Override = { kind: 'off', start: at(17, 6, 40).getTime(), fromPhase: 'wake' }
    const times = upcomingOkayToWake(at(17, 6, 41), settings, off, 2)
    expect(times[0].getTime()).toBe(at(18, 7).getTime())

    const nap: Override = { kind: 'nap', start: at(17, 13).getTime(), minutes: 30 }
    const withNap = upcomingOkayToWake(at(17, 13, 1), settings, nap, 2)
    expect(withNap[0].getTime()).toBe(at(17, 13, 30).getTime())
    expect(withNap[1].getTime()).toBe(at(18, 7).getTime())
  })

  it('returns only override wakes when autoSchedule is off', () => {
    const settings = makeSettings({ autoSchedule: false })
    expect(upcomingOkayToWake(at(16, 21), settings, null, 7)).toEqual([])
    const on: Override = { kind: 'on', start: at(16, 21).getTime() }
    expect(upcomingOkayToWake(at(16, 21, 1), settings, on, 7).map(date => date.getTime())).toEqual([at(17, 7).getTime()])
  })
})

describe('upcomingNight', () => {
  it('is tonight in the evening and last night before the morning’s okay time', () => {
    const settings = makeSettings()
    expect(upcomingNight(at(16, 12), settings).bedtime.getTime()).toBe(at(16, 19, 30).getTime())
    expect(upcomingNight(at(17, 6), settings).okayAt.getTime()).toBe(at(17, 7).getTime())
  })
})
