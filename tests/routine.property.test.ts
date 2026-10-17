import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { LightState, Settings } from '../types'
import { createDefaultSettings, parseSettingsJson } from '../utils/settings'
import {
  isOverrideActive,
  overrideEnd,
  resolvePhase,
  upcomingOkayToWake,
  type Override,
  type ResolvedPhase
} from '../utils/routine'
import { resolvePhase as resolvePhaseV2, type V2Settings } from './fixtures/routineV2'

// Property tests for the routine engine. vitest pins TZ=America/New_York, and
// instants are drawn from two 10-day windows, one around each 2026 DST change
// (spring forward 2026-03-08, fall back 2026-11-01).

const MIN = 60_000
const DAY_MINUTES = 24 * 60
const WINDOW_STARTS = [new Date(2026, 2, 3).getTime(), new Date(2026, 9, 27).getTime()]

const pad = (value: number): string => String(value).padStart(2, '0')
const hhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

const okayTimeArb = fc.integer({ min: 4 * 60, max: 13 * 60 }).map(hhmm)
const bedtimeArb = fc.integer({ min: 15 * 60, max: 23 * 60 + 59 }).map(hhmm)

const settingsArb = (autoSchedule: fc.Arbitrary<boolean> = fc.boolean()): fc.Arbitrary<Settings> =>
  fc.record({
    schedule: fc.array(fc.record({ okayTime: okayTimeArb, bedtime: bedtimeArb }), { minLength: 7, maxLength: 7 }),
    wakeDuration: fc.integer({ min: 1, max: 60 }),
    windDownMinutes: fc.integer({ min: 0, max: 60 }),
    awakeHoldMinutes: fc.integer({ min: 1, max: 240 }),
    autoSchedule
  }).map(patch => ({ ...createDefaultSettings(), ...patch }))

// An instant inside one of the DST windows.
const instantArb = fc.tuple(fc.constantFrom(...WINDOW_STARTS), fc.integer({ min: 0, max: 10 * DAY_MINUTES - 1 }))
  .map(([start, minutes]) => start + minutes * MIN)

type OverrideSpec = { kind: Override['kind']; startOffset: number; minutes: number }

const overrideSpecArb: fc.Arbitrary<OverrideSpec> = fc.record({
  kind: fc.constantFrom<Override['kind']>('on', 'nap', 'off'),
  // Relative to the walk start, so it may already be running, start mid-walk,
  // or be long expired.
  startOffset: fc.integer({ min: -2 * DAY_MINUTES, max: DAY_MINUTES }),
  minutes: fc.integer({ min: 10, max: 180 })
})

// `off` remembers the phase it was pressed in, taken from a real resolvePhase.
const buildOverride = (spec: OverrideSpec, anchor: number, settings: Settings): Override => {
  const start = anchor + spec.startOffset * MIN
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

  it('2. without an override, a routine day is a subsequence of inactive → bedtime → night → wake → awake → inactive', () => {
    // A routine day starts at 17:00, when the bounds guarantee last night's
    // hold is over, and runs until the next night (a later okay time) begins.
    const ORDER: LightState[] = ['inactive', 'bedtime', 'night', 'wake', 'awake', 'inactive']
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
        let cursor = 0
        for (const state of sequence) {
          cursor = ORDER.indexOf(state, cursor)
          expect(cursor, `out of order: ${sequence.join(' → ')}`).toBeGreaterThanOrEqual(0)
          cursor++
        }
      }),
      { numRuns: 60 }
    )
  })

  it('3. without an `off` override, scheduled story time is never skipped (on/nap may show night instead)', () => {
    const notOff = overrideSpecArb.filter(spec => spec.kind !== 'off')
    fc.assert(
      fc.property(settingsArb(fc.constant(true)), instantArb, fc.option(notOff, { nil: null }), (settings, from, spec) => {
        const override = spec ? buildOverride(spec, from, settings) : null
        for (const phase of walk(from, DAY_MINUTES, settings, override)) {
          if (phase.base !== 'bedtime') {
            continue
          }
          if (phase.override) {
            // `on` and nap may replace story time with night. Nothing else.
            expect(phase.state).toBe('night')
          } else {
            expect(phase.state).toBe('bedtime')
          }
        }
      }),
      { numRuns: 60 }
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

  it('5. every upcoming okay-to-get-up instant is green, and the minute before it is not', () => {
    // The app only creates overrides at "now", so one may have started already
    // but never lies in the future.
    const started = overrideSpecArb.map(spec => ({ ...spec, startOffset: Math.min(0, spec.startOffset) }))
    fc.assert(
      fc.property(settingsArb(), instantArb, fc.option(started, { nil: null }), (settings, now, spec) => {
        const override = spec ? buildOverride(spec, now, settings) : null
        for (const instant of upcomingOkayToWake(new Date(now), settings, override, 7)) {
          const at = instant.getTime()
          expect(resolvePhase(instant, settings, override).state).toBe('awake')
          expect(resolvePhase(new Date(at - MIN), settings, override).state, `already green before ${instant.toString()}`).not.toBe('awake')
        }
      }),
      { numRuns: 300 }
    )
  })
})

// v2 stored each day's sunrise start (04:00–12:00); a v2 blob is drawn from
// that schema and compared minute by minute against the frozen v2 engine.
const v2SettingsArb: fc.Arbitrary<V2Settings> = fc.record({
  schedule: fc.array(
    fc.record({ wakeTime: fc.integer({ min: 4 * 60, max: 12 * 60 }).map(hhmm), bedtime: bedtimeArb }),
    { minLength: 7, maxLength: 7 }
  ),
  wakeDuration: fc.integer({ min: 1, max: 60 }),
  windDownMinutes: fc.integer({ min: 0, max: 60 }),
  awakeHoldMinutes: fc.integer({ min: 1, max: 240 }),
  autoSchedule: fc.boolean()
}).map(patch => ({ ...createDefaultSettings(), ...patch }))

const addWallMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number)
  return hhmm(hours * 60 + mins + minutes)
}

describe('v2 → v3 migration properties', () => {
  it('6. okayTime = wakeTime + wakeDuration, and the light is identical every minute of a week', () => {
    fc.assert(
      fc.property(
        v2SettingsArb,
        fc.constantFrom(...WINDOW_STARTS),
        fc.option(overrideSpecArb, { nil: null }),
        (v2, from, spec) => {
          const v3 = parseSettingsJson(JSON.stringify({ version: 2, settings: v2 }))!
          expect(v3.schedule.map(day => day.okayTime)).toEqual(v2.schedule.map(day => addWallMinutes(day.wakeTime, v2.wakeDuration)))
          expect(v3.schedule.map(day => day.bedtime)).toEqual(v2.schedule.map(day => day.bedtime))

          const override = spec ? buildOverride(spec, from + DAY_MINUTES * MIN, v3) : null
          for (let minute = 0; minute <= 7 * DAY_MINUTES; minute++) {
            const now = new Date(from + minute * MIN)
            const before = resolvePhaseV2(now, v2, override).state
            const after = resolvePhase(now, v3, override).state
            if (before !== after) {
              expect(after, `differs at ${now.toString()}`).toBe(before)
            }
          }
        }
      ),
      { numRuns: 15 }
    )
  })
})
