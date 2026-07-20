import { describe, expect, it } from 'vitest'
import { computeAlarmTime } from '../utils/alarm'

describe('computeAlarmTime', () => {
  const now = new Date('2026-07-20T22:00:00Z').getTime()

  it('is the wake anchor plus the wake-up window', () => {
    const wake = new Date('2026-07-21T06:30:00Z')
    const at = computeAlarmTime(wake, 30, now)
    expect(at?.toISOString()).toBe('2026-07-21T07:00:00.000Z')
  })

  it('returns null with no active schedule', () => {
    expect(computeAlarmTime(null, 30, now)).toBe(null)
  })

  it('returns null once the moment has already passed', () => {
    const wake = new Date('2026-07-20T21:00:00Z') // window ended before now
    expect(computeAlarmTime(wake, 30, now)).toBe(null)
  })

  it('handles a zero-length window (fires at the wake time)', () => {
    const wake = new Date('2026-07-21T06:30:00Z')
    expect(computeAlarmTime(wake, 0, now)?.toISOString()).toBe('2026-07-21T06:30:00.000Z')
  })
})
