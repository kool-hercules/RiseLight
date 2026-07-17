// A QA-only accelerated clock, wired through the runtime's existing `now()`
// seam. The night → almost → okay cycle is driven by the real wall clock, so it
// is otherwise impossible to observe a full sequence in a test or a screenshot
// without waiting real minutes. This lets a URL opt a session into a simulated
// start time and/or a time-multiplier so the whole cycle can be exercised in
// seconds:
//
//   ?clock=06:29          start the simulated clock at 06:29 local (real speed)
//   ?clock=06:29&rate=120 …and run 120× faster, so a 30-min window elapses in 15s
//   ?rate=600             keep the real start time but fast-forward 600×
//
// It is inert unless one of those params is present, so a normal visitor is
// never affected. It only shifts the clock the runtime reads; nothing else in
// the app knows the difference.

const RATE_MIN = 0
const RATE_MAX = 100_000

const parseRate = (raw: string | null): number => {
  if (raw === null) {
    return 1
  }

  const rate = Number(raw)
  if (!Number.isFinite(rate) || rate <= 0) {
    return 1
  }

  return Math.min(RATE_MAX, Math.max(RATE_MIN, rate))
}

// Resolve the simulated wall-clock time at t0. A bare `clock` (or `clock=now`)
// anchors to the real moment; `HH:MM` anchors to that time on the real "today".
const parseStart = (raw: string | null, originMs: number): number => {
  if (raw === null || raw === '' || raw === 'now') {
    return originMs
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match) {
    return originMs
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) {
    return originMs
  }

  const start = new Date(originMs)
  start.setHours(hours, minutes, 0, 0)
  return start.getTime()
}

/**
 * Build a `now()` function from a URL query string, or return `null` when no
 * dev-clock params are present (the common case). `realNow` is injectable so the
 * math can be unit-tested without touching the wall clock.
 */
export const createDevClock = (
  search: string,
  realNow: () => number = () => Date.now()
): (() => Date) | null => {
  const params = new URLSearchParams(search)
  if (!params.has('clock') && !params.has('rate')) {
    return null
  }

  const originMs = realNow()
  const startMs = parseStart(params.get('clock'), originMs)
  const rate = parseRate(params.get('rate'))

  return () => new Date(startMs + (realNow() - originMs) * rate)
}
