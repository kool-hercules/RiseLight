// A frozen copy of the v2 routine engine (utils/routine.ts at 1b49348), where
// each day stored the sunrise *start* as `wakeTime`. The migration property
// test runs it side by side with the v3 engine, so it carries the same three
// override fixes as v3 (marked "ported") and differs only in the schedule's
// meaning. Do not edit otherwise.
import type { LightState, Settings as V3Settings } from '../../types'
import { mixHex, rampBrightness, rampColor } from '../../utils/ramp'

export type V2DaySchedule = { wakeTime: string; bedtime: string }
type Settings = Omit<V3Settings, 'schedule'> & { schedule: readonly V2DaySchedule[] }
export type { Settings as V2Settings }

// The daily routine, as a pure function of (now, settings, override). Nothing
// here stores derived state: every tick re-derives the phase from the current
// settings, so editing the schedule (or reloading mid-night) always lands on the
// right phase with no anchors to re-sync.
//
// Night D (the evening of calendar day D) runs in segments:
//   bedtime  bedtime(D) − windDown → bedtime(D)   ("Story time")
//   night    bedtime(D) → wakeTime(D+1)            ("Stay in bed")
//   wake     wakeTime(D+1) → + wakeDuration        ("Almost time", sunrise ramp)
//   awake    → + awakeHoldMinutes                  ("Okay to get up!")
// and is inactive (daytime idle) otherwise. Settings validation bounds bedtime
// to 15:00–23:59 and wake to 04:00–12:00, so each night crosses midnight once
// and only nights D−1 and D can cover any instant. Where they overlap, the
// later night wins. Times are built on local calendar dates with setHours, so
// DST is handled by Date itself.

export type Override =
  | { kind: 'on'; start: number }
  | { kind: 'nap'; start: number; minutes: number }
  | { kind: 'off'; start: number; fromPhase: LightState }

export type ResolvedPhase = {
  state: LightState
  phaseStart: number | null
  phaseEnd: number | null
  progress: number // 0..1 through the current phase
  base: LightState // the schedule-only state, ignoring any override
  override: Override | null // the override in effect, if any
  overrideEnd: number | null
  okayAt: number | null // the "okay to get up" instant this phase is heading to
}

type Segment = { state: LightState; start: number; end: number }

type Night = {
  windStart: number
  bedtime: number
  wakeAt: number
  okayAt: number
  idleAt: number
}

const MINUTE = 60_000
const BEDTIME_CROSSFADE_MS = 3 * MINUTE
const NAP_AWAKE_MS = 15 * MINUTE

const dayStart = (ms: number, offsetDays = 0): Date => {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays)
}

const atTime = (day: Date, time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  const at = new Date(day.getTime())
  at.setHours(hours, minutes, 0, 0)
  return at.getTime()
}

const wakeOn = (day: Date, settings: Settings): number =>
  atTime(day, settings.schedule[day.getDay()].wakeTime)

const nightOf = (evening: Date, settings: Settings): Night => {
  const bedtime = atTime(evening, settings.schedule[evening.getDay()].bedtime)
  const morning = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate() + 1)
  const wakeAt = wakeOn(morning, settings)
  const okayAt = wakeAt + settings.wakeDuration * MINUTE
  return {
    windStart: bedtime - settings.windDownMinutes * MINUTE,
    bedtime,
    wakeAt,
    okayAt,
    idleAt: okayAt + settings.awakeHoldMinutes * MINUTE
  }
}

const nightSegments = (night: Night): Segment[] => [
  { state: 'bedtime', start: night.windStart, end: night.bedtime },
  { state: 'night', start: night.bedtime, end: night.wakeAt },
  { state: 'wake', start: night.wakeAt, end: night.okayAt },
  { state: 'awake', start: night.okayAt, end: night.idleAt }
]

const findSegment = (segments: Segment[], at: number): Segment | null =>
  segments.find(segment => segment.start <= at && at < segment.end) ?? null

const progressOf = (start: number | null, end: number | null, at: number): number => {
  if (start === null || end === null || end <= start) {
    return 0
  }
  return Math.min(1, Math.max(0, (at - start) / (end - start)))
}

type BasePhase = { segment: Segment | null; night: Night | null; idleStart: number | null; idleEnd: number | null }

// The schedule-only phase at `at`.
const resolveBase = (at: number, settings: Settings): BasePhase => {
  if (!settings.autoSchedule) {
    return { segment: null, night: null, idleStart: null, idleEnd: null }
  }

  const tonight = nightOf(dayStart(at), settings)
  const lastNight = nightOf(dayStart(at, -1), settings)

  // Later night wins where spans overlap.
  for (const night of [tonight, lastNight]) {
    const segment = findSegment(nightSegments(night), at)
    if (segment) {
      return { segment, night, idleStart: null, idleEnd: null }
    }
  }

  // Daytime idle: between last night's hold and tonight's wind-down. (Last
  // night's span is contiguous and today has started, so nothing else fits.)
  return { segment: null, night: null, idleStart: lastNight.idleAt, idleEnd: tonight.windStart }
}

// The first scheduled morning wake instant W after `after` for which `keep(W)`
// holds. Scans a few days forward; validation keeps every day's wake set.
const firstWake = (after: number, settings: Settings, keep: (wakeAt: number) => boolean): number => {
  for (let offset = -1; offset <= 3; offset++) {
    const wakeAt = wakeOn(dayStart(after, offset), settings)
    if (keep(wakeAt)) {
      return wakeAt
    }
  }
  return after
}

// The first scheduled story-time start after `after`, or Infinity when the
// schedule isn't running. Overrides that end in daytime must not spill into it.
const nextWindStart = (after: number, settings: Settings): number => {
  if (!settings.autoSchedule) {
    return Infinity
  }
  for (let offset = 0; offset <= 2; offset++) {
    const windStart = nightOf(dayStart(after, offset), settings).windStart
    if (windStart > after) {
      return windStart
    }
  }
  return Infinity
}

// An override's own segments, derived from the *current* settings so editing
// the schedule moves it. Empty means the override has nothing to show.
const overrideSegments = (override: Override, settings: Settings): Segment[] => {
  const durationMs = settings.wakeDuration * MINUTE
  const holdMs = settings.awakeHoldMinutes * MINUTE

  switch (override.kind) {
    case 'on': {
      // Night until the next wake whose window hasn't already ended (so starting
      // mid-window shows "almost time", not a whole extra night). The ramp keeps
      // its real start, so starting mid-window picks it up where it is.
      const wakeAt = firstWake(override.start, settings, wake => wake + durationMs > override.start)
      const okayAt = wakeAt + durationMs
      return [
        { state: 'night', start: override.start, end: Math.max(override.start, wakeAt) },
        { state: 'wake', start: wakeAt, end: okayAt },
        { state: 'awake', start: okayAt, end: Math.min(okayAt + holdMs, nextWindStart(okayAt, settings)) } // ported
      ]
    }
    case 'nap': {
      const end = override.start + override.minutes * MINUTE
      const baseSegmentAtEnd = resolveBase(end, settings).segment
      const baseAtEnd = baseSegmentAtEnd?.state
      // A nap that runs into the evening routine — or whose 15-minute green
      // tail would — never shows green: stay dark until it ends and hand
      // straight back to the schedule.
      if (
        baseAtEnd === 'bedtime'
        || baseAtEnd === 'night'
        || nextWindStart(end, settings) < end + NAP_AWAKE_MS // ported
      ) {
        return [{ state: 'night', start: override.start, end }]
      }
      const rampStart = Math.max(override.start, end - Math.min(settings.wakeDuration, 5) * MINUTE)
      // Ending inside the morning's wake window: stay green until the schedule
      // turns green too, so the light never goes back from green to amber.
      const greenEnd = baseAtEnd === 'wake' && baseSegmentAtEnd
        ? Math.max(end + NAP_AWAKE_MS, baseSegmentAtEnd.end)
        : end + NAP_AWAKE_MS
      return [
        { state: 'night', start: override.start, end: rampStart },
        { state: 'wake', start: rampStart, end },
        { state: 'awake', start: end, end: greenEnd }
      ]
    }
    case 'off': {
      let end = override.start
      if (override.fromPhase === 'bedtime' || override.fromPhase === 'night') {
        // Dark until the next wake ramp, so the morning cue still happens.
        end = firstWake(override.start, settings, wake => wake > override.start)
      } else if (override.fromPhase === 'wake' || override.fromPhase === 'awake') {
        // Dark until the morning's hold would have ended (daytime idle), but
        // never past tonight's story time, which must still start on time.
        const tail = durationMs + holdMs
        end = Math.min(
          firstWake(override.start, settings, wake => wake + tail > override.start) + tail,
          nextWindStart(override.start, settings)
        )
      }
      return end > override.start ? [{ state: 'inactive', start: override.start, end }] : []
    }
  }
}

const endOfSegments = (override: Override, segments: Segment[]): number => {
  const shown = segments.filter(segment => segment.end > segment.start)
  return shown.length > 0 ? shown[shown.length - 1].end : override.start
}

export const overrideEnd = (override: Override, settings: Settings): number =>
  endOfSegments(override, overrideSegments(override, settings))

// Active iff it has started and its derived end is still ahead.
export const isOverrideActive = (override: Override | null, at: number, settings: Settings): override is Override =>
  override !== null && override.start <= at && at < overrideEnd(override, settings)

export const resolvePhase = (now: Date, settings: Settings, override: Override | null): ResolvedPhase => {
  const at = now.getTime()
  const basePhase = resolveBase(at, settings)
  const base: LightState = basePhase.segment?.state ?? 'inactive'

  const segments = override && override.start <= at ? overrideSegments(override, settings) : []
  const end = override ? endOfSegments(override, segments) : null
  if (override && end !== null && at < end) {
    const segment = findSegment(segments, at)
    if (segment) {
      const okay = segments.find(candidate => candidate.state === 'awake')
      return {
        state: segment.state,
        phaseStart: segment.start,
        phaseEnd: segment.end,
        progress: progressOf(segment.start, segment.end, at),
        base,
        override,
        overrideEnd: end,
        okayAt: override.kind === 'off'
          ? basePhase.night?.okayAt ?? null
          : okay?.start ?? null
      }
    }
  }

  const segment = basePhase.segment
  const phaseStart = segment?.start ?? basePhase.idleStart
  const phaseEnd = segment?.end ?? basePhase.idleEnd
  return {
    state: base,
    phaseStart,
    phaseEnd,
    progress: progressOf(phaseStart, phaseEnd, at),
    base,
    override: null,
    overrideEnd: null,
    okayAt: basePhase.night?.okayAt ?? null
  }
}

export type PhaseDisplay = { color: string; brightness: number } // brightness 0..1

// What actually paints the screen for a resolved phase. The wake window eases
// night → wake → awake; the last 3 minutes of story time crossfade into the
// night colour so lights-out is a fade, not a switch.
export const phaseDisplay = (phase: ResolvedPhase, settings: Settings, now: Date): PhaseDisplay => {
  const { colors, brightness } = settings

  switch (phase.state) {
    case 'inactive':
      return { color: '#ffffff', brightness: 0 }
    case 'wake':
      return {
        color: rampColor(phase.progress, colors),
        brightness: rampBrightness(phase.progress, brightness) / 100
      }
    case 'bedtime': {
      const remaining = phase.phaseEnd === null ? Infinity : phase.phaseEnd - now.getTime()
      if (remaining < BEDTIME_CROSSFADE_MS) {
        const t = 1 - Math.max(0, remaining) / BEDTIME_CROSSFADE_MS
        return {
          color: mixHex(colors.bedtime, colors.night, t),
          brightness: (brightness.bedtime + (brightness.night - brightness.bedtime) * t) / 100
        }
      }
      return { color: colors.bedtime, brightness: brightness.bedtime / 100 }
    }
    default:
      return { color: colors[phase.state], brightness: brightness[phase.state] / 100 }
  }
}

// The next `count` "okay to get up" instants after `now`, honoring the
// override: each candidate (scheduled or override-driven) is kept only if the
// resolved phase at that instant really is "okay to get up". Feeds the native
// alarms.
export const upcomingOkayToWake = (
  now: Date,
  settings: Settings,
  override: Override | null,
  count: number
): Date[] => {
  const at = now.getTime()
  const candidates = new Set<number>()

  if (settings.autoSchedule) {
    for (let offset = -1; offset <= count + 1; offset++) {
      candidates.add(nightOf(dayStart(at, offset), settings).okayAt)
    }
  }

  if (isOverrideActive(override, at, settings)) {
    const okay = overrideSegments(override, settings).find(segment => segment.state === 'awake')
    if (okay) {
      candidates.add(okay.start)
    }
  }

  // An override that is active now only affects instants before its end; past
  // that, resolvePhase at a future instant must ignore it.
  const effectiveOverride = isOverrideActive(override, at, settings) ? override : null

  const isGreen = (instant: number) => resolvePhase(new Date(instant), settings, effectiveOverride).state === 'awake'

  return [...candidates]
    .filter(instant => instant > at)
    .sort((a, b) => a - b)
    .filter(instant => isGreen(instant) && !isGreen(instant - 1)) // ported
    .slice(0, count)
    .map(instant => new Date(instant))
}

export type NightPlan = {
  windStart: Date
  bedtime: Date
  wakeAt: Date
  okayAt: Date
}

// "Tonight's plan": the night currently running, or the next one to start.
export const upcomingNight = (now: Date, settings: Settings): NightPlan => {
  const at = now.getTime()
  const night = [nightOf(dayStart(at, -1), settings), nightOf(dayStart(at), settings), nightOf(dayStart(at, 1), settings)]
    .find(candidate => candidate.okayAt > at) ?? nightOf(dayStart(at, 1), settings)
  return {
    windStart: new Date(night.windStart),
    bedtime: new Date(night.bedtime),
    wakeAt: new Date(night.wakeAt),
    okayAt: new Date(night.okayAt)
  }
}
