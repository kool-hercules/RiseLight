import { describe, expect, it } from 'vitest'
import { createDevClock } from '../utils/devClock'

// A controllable real clock so the accelerated math is deterministic.
const makeRealNow = (start: number) => {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    }
  }
}

const originDate = new Date(2026, 0, 15, 6, 0, 0)

describe('createDevClock', () => {
  it('returns null when no dev-clock params are present', () => {
    expect(createDevClock('')).toBeNull()
    expect(createDevClock('?foo=bar')).toBeNull()
    expect(createDevClock('?onboarded=1')).toBeNull()
  })

  it('anchors the simulated start to HH:MM on the real today', () => {
    const real = makeRealNow(originDate.getTime())
    const now = createDevClock('?clock=06:29', real.now)!

    expect(now().getHours()).toBe(6)
    expect(now().getMinutes()).toBe(29)
    expect(now().getSeconds()).toBe(0)
  })

  it('advances at real speed by default', () => {
    const real = makeRealNow(originDate.getTime())
    const now = createDevClock('?clock=06:29', real.now)!

    real.advance(60_000)
    expect(now().getMinutes()).toBe(30)
  })

  it('multiplies elapsed real time by the rate', () => {
    const real = makeRealNow(originDate.getTime())
    const now = createDevClock('?clock=06:00&rate=120', real.now)!

    // 15 real seconds × 120 = 30 simulated minutes → 06:30.
    real.advance(15_000)
    expect(now().getHours()).toBe(6)
    expect(now().getMinutes()).toBe(30)
  })

  it('keeps the real start when only a rate is given', () => {
    const real = makeRealNow(originDate.getTime())
    const now = createDevClock('?rate=10', real.now)!

    expect(now().getTime()).toBe(originDate.getTime())
    real.advance(1_000)
    expect(now().getTime()).toBe(originDate.getTime() + 10_000)
  })

  it('anchors to the real moment for a bare or now clock', () => {
    const real = makeRealNow(originDate.getTime())
    expect(createDevClock('?clock', real.now)!().getTime()).toBe(originDate.getTime())
    expect(createDevClock('?clock=now', real.now)!().getTime()).toBe(originDate.getTime())
  })

  it('falls back to the real start for malformed or out-of-range times', () => {
    const real = makeRealNow(originDate.getTime())
    expect(createDevClock('?clock=99:99', real.now)!().getTime()).toBe(originDate.getTime())
    expect(createDevClock('?clock=notatime', real.now)!().getTime()).toBe(originDate.getTime())
  })

  it('ignores non-positive or non-finite rates, falling back to real speed', () => {
    const real = makeRealNow(originDate.getTime())
    const now = createDevClock('?rate=-5', real.now)!
    real.advance(1_000)
    expect(now().getTime()).toBe(originDate.getTime() + 1_000)
  })
})
