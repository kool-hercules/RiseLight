import { describe, expect, it } from 'vitest'
import { calculateNextWakeTime, calculateScheduleState } from '../utils/schedule'

const localDate = (day: number, hours: number, minutes: number, seconds = 0, milliseconds = 0): Date => {
  return new Date(2026, 0, day, hours, minutes, seconds, milliseconds)
}

describe('calculateNextWakeTime', () => {
  it('calculates an overnight wake time on the next local day', () => {
    const now = localDate(15, 22, 0)

    expect(calculateNextWakeTime(now, '06:30', 30)).toEqual(localDate(16, 6, 30))
  })

  it('uses the current instant when it is exactly the configured wake minute', () => {
    const now = localDate(15, 6, 30)

    expect(calculateNextWakeTime(now, '06:30', 30)).toEqual(now)
  })

  it('keeps today\'s anchor when started inside the wake window', () => {
    const now = localDate(15, 6, 45)

    expect(calculateNextWakeTime(now, '06:30', 30)).toEqual(localDate(15, 6, 30))
  })

  it('rolls to tomorrow once today\'s wake window has fully elapsed', () => {
    const now = localDate(15, 7, 0)

    expect(calculateNextWakeTime(now, '06:30', 30)).toEqual(localDate(16, 6, 30))
  })
})

describe('calculateScheduleState', () => {
  const wakeTime = localDate(15, 6, 30)

  it.each([
    ['before wake time', localDate(15, 6, 29, 59, 999), 'night', 1],
    ['exactly at wake time', localDate(15, 6, 30), 'wake', 30 * 60 * 1000],
    ['during the wake window', localDate(15, 6, 45), 'wake', 15 * 60 * 1000],
    ['exactly at the wake-window end', localDate(15, 7, 0), 'awake', 0],
    ['after the wake window', localDate(15, 8, 0), 'awake', 0]
  ])('returns the correct state %s', (_label, now, mode, timeRemaining) => {
    expect(calculateScheduleState(now as Date, wakeTime, 30)).toEqual({
      mode,
      timeRemaining
    })
  })
})
