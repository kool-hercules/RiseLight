import { describe, expect, it } from 'vitest'
import { formatClockTime, humanizeCountdown } from '../utils/time'

const minutes = (n: number) => n * 60 * 1000
const seconds = (n: number) => n * 1000

describe('humanizeCountdown', () => {
  it('rounds up to whole minutes so the number ticks once a minute', () => {
    expect(humanizeCountdown(minutes(15))).toBe('in about 15 minutes')
    // 14m52s still reads as "about 15 minutes" (ceil), not a jittery 14.
    expect(humanizeCountdown(minutes(14) + seconds(52))).toBe('in about 15 minutes')
    expect(humanizeCountdown(minutes(13) + seconds(1))).toBe('in about 14 minutes')
  })

  it('uses the singular for one minute', () => {
    expect(humanizeCountdown(minutes(1))).toBe('in about 1 minute')
    expect(humanizeCountdown(seconds(61))).toBe('in about 2 minutes')
  })

  it('softens the final minute and the boundary', () => {
    expect(humanizeCountdown(seconds(59))).toBe('in less than a minute')
    expect(humanizeCountdown(seconds(1))).toBe('in less than a minute')
    expect(humanizeCountdown(0)).toBe('any moment now')
    expect(humanizeCountdown(-1000)).toBe('any moment now')
  })
})

describe('formatClockTime', () => {
  it('formats a 12-hour clock label', () => {
    const label = formatClockTime(new Date(2026, 0, 15, 7, 5))
    expect(label).toMatch(/^0?7:05\s?[AP]M$/i)
  })
})
