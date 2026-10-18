import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { LightState, Settings } from '../types'
import { createDefaultSettings, parseSettingsJson } from '../utils/settings'
import {
  isOverrideActive,
  overrideEnd,
  resolvePhase,
  upcomingNight,
  upcomingOkayToWake,
  type Override,
  type ResolvedPhase
} from '../utils/routine'

// Property tests for the routine engine. vitest pins TZ=America/New_York, and
// instants are drawn from two 10-day windows, one around each 2026 DST change
// (spring forward 2026-03-08, fall back 2026-11-01).

const MIN = 60_000
const DAY_MINUTES = 24 * 60
const WINDOW_STARTS = [new Date(2026, 2, 3).getTime(), new Date(2026, 9, 27).getTime()]

const pad = (value: number): string => String(value).padStart(2, '0')
const hhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

const minutesBetween = (earliest: number, latest: number): fc.Arbitrary<string> =>
  fc.integer({ min: earliest, max: latest }).map(hhmm)

const weekOf = <T>(day: fc.Arbitrary<T>): fc.Arbitrary<T[]> => fc.array(day, { minLength: 7, maxLength: 7 })

const okayTimeArb = minutesBetween(4 * 60, 13 * 60)
const bedtimeArb = minutesBetween(15 * 60, 23 * 60 + 59)
const dayArb = fc.record({ okayTime: okayTimeArb, bedtime: bedtimeArb })
// A late green, a long hold and an early bedtime: the corner where the
// morning's green meets the next story time. Every override bug found so far
// lives there, and uniform draws rarely reach it.
const tightDayArb = fc.record({ okayTime: minutesBetween(11 * 60 + 30, 13 * 60), bedtime: minutesBetween(15 * 60, 17 * 60) })

const settingsArb = (autoSchedule: fc.Arbitrary<boolean> = fc.boolean()): fc.Arbitrary<Settings> =>
  fc.oneof(
    fc.record({
      schedule: weekOf(dayArb),
      wakeDuration: fc.integer({ min: 1, max: 60 }),
      windDownMinutes: fc.integer({ min: 0, max: 60 }),
      awakeHoldMinutes: fc.integer({ min: 1, max: 240 }),
      autoSchedule
    }),
    fc.record({
      schedule: weekOf(tightDayArb),
      wakeDuration: fc.integer({ min: 1, max: 60 }),
      windDownMinutes: fc.integer({ min: 0, max: 60 }),
      awakeHoldMinutes: fc.integer({ min: 180, max: 240 }),
      autoSchedule
    })
  ).map(patch => ({ ...createDefaultSettings(), ...patch }))

// An instant inside one of the DST windows.
const instantArb = fc.tuple(fc.constantFrom(...WINDOW_STARTS), fc.integer({ min: 0, max: 10 * DAY_MINUTES - 1 }))
  .map(([start, minutes]) => start + minutes * MIN)

// Where an override starts: anywhere relative to the anchor instant, or a few
// minutes either side of one of the schedule's landmarks around it (for a nap,
// so that it *ends* there). Boundaries are where overrides go wrong.
const LANDMARKS = ['windStart', 'bedtime', 'wakeAt', 'okayAt', 'idleAt', 'nextWindStart'] as const

type OverrideSpec = {
  kind: Override['kind']
  startOffset: number
  minutes: number
  landmark: (typeof LANDMARKS)[number] | null
  delta: number
}

const overrideSpecArb: fc.Arbitrary<OverrideSpec> = fc.record({
  kind: fc.constantFrom<Override['kind']>('on', 'nap', 'off'),
  // Relative to the anchor, so it may already be running, start mid-walk,
  // or be long expired.
  startOffset: fc.integer({ min: -2 * DAY_MINUTES, max: DAY_MINUTES }),
  minutes: fc.integer({ min: 10, max: 180 }),
  landmark: fc.option(fc.constantFrom(...LANDMARKS), { nil: null }),
  delta: fc.integer({ min: -15, max: 15 })
})

const landmarkAt = (landmark: (typeof LANDMARKS)[number], anchor: number, settings: Settings): number => {
  const night = upcomingNight(new Date(anchor), settings)
  const idleAt = night.okayAt.getTime() + settings.awakeHoldMinutes * MIN
  switch (landmark) {
    case 'idleAt':
      return idleAt
    case 'nextWindStart':
      return upcomingNight(new Date(idleAt), settings).windStart.getTime()
    default:
      return night[landmark].getTime()
  }
}

const overrideStart = (spec: OverrideSpec, anchor: number, settings: Settings): number => {
  if (spec.landmark === null) {
    return anchor + spec.startOffset * MIN
  }
  const target = landmarkAt(spec.landmark, anchor, settings) + spec.delta * MIN
  return spec.kind === 'nap' ? target - spec.minutes * MIN : target
}

// `off` remembers the phase it was pressed in, taken from a real resolvePhase.
const buildOverride = (spec: OverrideSpec, anchor: number, settings: Settings): Override => {
  const start = overrideStart(spec, anchor, settings)
  switch (spec.kind) {
    case 'on':
      return { kind: 'on', start }
    case 'nap':
      return { kind: 'nap', start, minutes: spec.minutes }
    case 'off':
      return { kind: 'off', start, fromPhase: resolvePhase(new Date(start), settings, null).state }
  }
}

// One phase per minute for `minutes` minutes from `from`.
const walk = (from: number, minutes: number, settings: Settings, override: Override | null): ResolvedPhase[] =>
  Array.from({ length: minutes + 1 }, (_, step) => resolvePhase(new Date(from + step * MIN), settings, override))

describe('routine properties', () => {
  it('1. never goes awake → wake, or awake → night within one morning', () => {
    fc.assert(
      fc.property(settingsArb(), instantArb, fc.option(overrideSpecArb, { nil: null }), (settings, from, spec) => {
        const override = spec ? buildOverride(spec, from, settings) : null
        const phases = walk(from, DAY_MINUTES, settings, override)
        for (let step = 1; step < phases.length; step++) {
          const at = from + step * MIN
          // Pressing a button is a parent's choice, not a transition.
          if (override && override.start > at - MIN && override.start <= at) {
            continue
          }
          const prev = phases[step - 1]
          const cur = phases[step]
          if (prev.state !== 'awake') {
            continue
          }
          expect(cur.state, `awake → wake at ${new Date(at).toString()}`).not.toBe('wake')
          if (cur.state === 'night') {
            // Only a new night (heading to a later morning) may follow green.
            expect(cur.okayAt, `awake → night at ${new Date(at).toString()}`).toBeGreaterThan(prev.okayAt ?? Infinity)
          }
        }
      }),
      { numRuns: 60 }
    )
  })

  it('2. without an override, any calendar day only steps forward along inactive → bedtime → night → wake → awake → inactive', () => {
    // Taken as a sequence, a calendar day can see two nights' pieces (a late
    // Friday green, then an early Saturday sunrise), so check each step
    // instead. Story time may be off (inactive → night), and a long hold
    // hands straight over to the next night (awake → bedtime / night).
    const STEPS = new Set([
      'inactive→bedtime', 'bedtime→night', 'night→wake', 'wake→awake', 'awake→inactive',
      'awake→bedtime', 'inactive→night', 'awake→night'
    ])
    const midnightArb = fc.tuple(fc.constantFrom(...WINDOW_STARTS), fc.integer({ min: 0, max: 9 }))
      .map(([start, offset]) => {
        const day = new Date(start)
        return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset).getTime()
      })
    fc.assert(
      fc.property(settingsArb(), midnightArb, (settings, midnight) => {
        const phases = walk(midnight, DAY_MINUTES + 60, settings, null)
        for (let step = 1; step < phases.length; step++) {
          const transition = `${phases[step - 1].state}→${phases[step].state}`
          if (phases[step - 1].state === phases[step].state) {
            continue
          }
          expect(STEPS.has(transition), transition).toBe(true)
          if (transition.endsWith('→night') && !transition.startsWith('bedtime')) {
            expect(settings.windDownMinutes, `${transition} with story time on`).toBe(0)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it('2b. without an override, a routine day shows every phase exactly once, in order', () => {
    // A routine day starts at 17:00, when the bounds guarantee last night's
    // hold is over, and runs until the next night (a later okay time) begins.
    // Sunrise and green are never skipped; story time shows iff it is on and
    // hasn't already passed; the day ends idle unless the hold runs into the
    // next story time.
    const dayArb = fc.tuple(fc.constantFrom(...WINDOW_STARTS), fc.integer({ min: 0, max: 9 }))
      .map(([start, offset]) => {
        const day = new Date(start)
        return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, 17).getTime()
      })
    fc.assert(
      fc.property(settingsArb(), dayArb, (settings, from) => {
        const sequence: LightState[] = []
        let okayAt: number | null = null
        for (const phase of walk(from, 2 * DAY_MINUTES, settings, null)) {
          okayAt ??= phase.okayAt
          if (phase.okayAt !== null && okayAt !== null && phase.okayAt > okayAt) {
            break
          }
          if (sequence[sequence.length - 1] !== phase.state) {
            sequence.push(phase.state)
          }
        }

        if (!settings.autoSchedule) {
          expect(sequence).toEqual(['inactive'])
          return
        }
        const night = upcomingNight(new Date(from), settings)
        const idleAt = night.okayAt.getTime() + settings.awakeHoldMinutes * MIN
        const next = upcomingNight(new Date(idleAt), settings)
        const expected: LightState[] = [
          ...(night.windStart.getTime() > from ? ['inactive' as const] : []),
          ...(settings.windDownMinutes > 0 && night.bedtime.getTime() > from ? ['bedtime' as const] : []),
          'night',
          'wake',
          'awake',
          ...(idleAt < next.windStart.getTime() ? ['inactive' as const] : [])
        ]
        expect(sequence).toEqual(expected)
      }),
      { numRuns: 100 }
    )
  })

  it('3. without an `off` override, scheduled story time is never skipped (on/nap may show night instead)', () => {
    // Only story-time minutes can fail, so walk just those of the next two
    // nights. That is cheap enough to run many more cases than a full walk.
    const notOff = overrideSpecArb.filter(spec => spec.kind !== 'off')
    fc.assert(
      fc.property(settingsArb(fc.constant(true)), instantArb, fc.option(notOff, { nil: null }), (settings, from, spec) => {
        const override = spec ? buildOverride(spec, from, settings) : null
        const first = upcomingNight(new Date(from), settings)
        for (const night of [first, upcomingNight(first.okayAt, settings)]) {
          const minutes = (night.bedtime.getTime() - night.windStart.getTime()) / MIN
          for (const phase of walk(night.windStart.getTime(), minutes - 1, settings, override)) {
            expect(phase.base).toBe('bedtime')
            if (phase.override) {
              // `on` and nap may replace story time with night. Nothing else.
              expect(phase.state).toBe('night')
            } else {
              expect(phase.state).toBe('bedtime')
            }
          }
        }
      }),
      { numRuns: 1000 }
    )
  })

  it('4. an override is inactive and ignored at and after its end', () => {
    fc.assert(
      fc.property(
        settingsArb(),
        instantArb,
        overrideSpecArb,
        fc.array(fc.integer({ min: 0, max: 3 * DAY_MINUTES }), { minLength: 1, maxLength: 20 }),
        (settings, anchor, spec, offsets) => {
          const override = buildOverride(spec, anchor, settings)
          const end = overrideEnd(override, settings)
          for (const offset of [0, ...offsets]) {
            const at = end + offset * MIN
            expect(isOverrideActive(override, at, settings)).toBe(false)
            expect(resolvePhase(new Date(at), settings, override)).toEqual(resolvePhase(new Date(at), settings, null))
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  it('5. upcomingOkayToWake lists exactly the instants the light turns green, in order', () => {
    // Native alarms come from this list, so a missing instant is a silent
    // missed alarm and an extra one a false alarm. Compare the next two
    // against a minute walk: every turn to green, and nothing else. 50 hours
    // always holds two scheduled greens, even across a fall-back night.
    const COUNT = 2
    const HORIZON_MINUTES = 50 * 60
    fc.assert(
      fc.property(settingsArb(), instantArb, fc.option(overrideSpecArb, { nil: null }), (settings, anchor, spec) => {
        const override = spec ? buildOverride(spec, anchor, settings) : null
        // The app only creates overrides at "now", so ask after it started.
        const now = Math.max(anchor, override?.start ?? anchor)
        const listed = upcomingOkayToWake(new Date(now), settings, override, COUNT).map(instant => instant.getTime())

        const turnsGreen: number[] = []
        let wasGreen = resolvePhase(new Date(now), settings, override).state === 'awake'
        for (let minute = 1; minute <= HORIZON_MINUTES && turnsGreen.length < COUNT; minute++) {
          const at = now + minute * MIN
          const green = resolvePhase(new Date(at), settings, override).state === 'awake'
          if (green && !wasGreen) {
            turnsGreen.push(at)
          }
          wasGreen = green
        }

        const show = (instants: number[]) => instants.map(instant => new Date(instant).toString())
        expect(show(listed.filter(instant => instant <= now + HORIZON_MINUTES * MIN))).toEqual(show(turnsGreen))
      }),
      { numRuns: 150 }
    )
  }, 15_000)
})

// v2 stored each day's sunrise start (04:00–12:00). The engine reads the
// schedule in exactly two places, nightOf (story time, lights out, sunrise and
// green for each night) and wakeOn (the sunrise that Start now and Off for now
// run to); everything else is derived from those instants. So a migrated blob
// behaves exactly like v2 iff, for every night, those instants are the ones v2
// built from its wakeTime: sunrise = wakeTime by the wall clock, green one
// window of real minutes later.
type V2Settings = Omit<Settings, 'schedule'> & { schedule: { wakeTime: string; bedtime: string }[] }

const v2SettingsArb: fc.Arbitrary<V2Settings> = fc.record({
  schedule: weekOf(fc.record({ wakeTime: minutesBetween(4 * 60, 12 * 60), bedtime: bedtimeArb })),
  wakeDuration: fc.integer({ min: 1, max: 60 }),
  windDownMinutes: fc.integer({ min: 0, max: 60 }),
  awakeHoldMinutes: fc.integer({ min: 1, max: 240 }),
  autoSchedule: fc.constant(true)
}).map(patch => ({ ...createDefaultSettings(), ...patch }))

const addWallMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number)
  return hhmm(hours * 60 + mins + minutes)
}

const atWallTime = (day: Date, time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime()
}

describe('v2 → v3 migration properties', () => {
  it('6. okayTime = wakeTime + wakeDuration, and every night and override lands on v2’s minutes across both DST changes', () => {
    fc.assert(
      fc.property(v2SettingsArb, fc.constantFrom(...WINDOW_STARTS), (v2, windowStart) => {
        const v3 = parseSettingsJson(JSON.stringify({ version: 2, settings: v2 }))!
        expect(v3.schedule.map(day => day.okayTime)).toEqual(v2.schedule.map(day => addWallMinutes(day.wakeTime, v2.wakeDuration)))
        expect(v3.schedule.map(day => day.bedtime)).toEqual(v2.schedule.map(day => day.bedtime))
        const manual = { ...v3, autoSchedule: false }

        for (let offset = 0; offset < 10; offset++) {
          const start = new Date(windowStart)
          const evening = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
          const morning = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate() + 1)
          const bedtime = atWallTime(evening, v2.schedule[evening.getDay()].bedtime)
          const wakeAt = atWallTime(morning, v2.schedule[morning.getDay()].wakeTime)
          const okayAt = wakeAt + v2.wakeDuration * MIN
          const label = evening.toDateString()

          // nightOf, through the schedule.
          const night = upcomingNight(new Date(atWallTime(evening, '14:00')), v3)
          expect(night.windStart.getTime(), label).toBe(bedtime - v2.windDownMinutes * MIN)
          expect(night.bedtime.getTime(), label).toBe(bedtime)
          expect(night.wakeAt.getTime(), label).toBe(wakeAt)
          expect(night.okayAt.getTime(), label).toBe(okayAt)

          // wakeOn, through Start now and Off for now pressed after midnight.
          const afterMidnight = morning.getTime() + MIN
          const on: Override = { kind: 'on', start: afterMidnight }
          expect(resolvePhase(new Date(wakeAt - 1), manual, on).state, label).toBe('night')
          expect(resolvePhase(new Date(wakeAt), manual, on).state, label).toBe('wake')
          expect(resolvePhase(new Date(okayAt), manual, on).state, label).toBe('awake')
          const off: Override = { kind: 'off', start: afterMidnight, fromPhase: 'night' }
          expect(overrideEnd(off, v3), label).toBe(wakeAt)
        }
      }),
      { numRuns: 300 }
    )
  })
})
