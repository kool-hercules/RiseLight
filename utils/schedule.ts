import type { LightMode } from '../types'
import { isValidWakeTime } from './settings'

export type ScheduleState = {
  mode: LightMode
  timeRemaining: number
}

export const calculateNextWakeTime = (
  now: Date,
  wakeTime: string,
  wakeDurationMinutes = 0
): Date => {
  if (!isValidWakeTime(wakeTime)) {
    throw new RangeError(`Invalid wake time: ${wakeTime}`)
  }

  const [hours, minutes] = wakeTime.split(':').map(Number)
  const nextWakeTime = new Date(now)
  nextWakeTime.setHours(hours, minutes, 0, 0)

  // Anchor to today whenever the current instant is still inside today's wake
  // window (from the configured minute through wakeDuration). Only once today's
  // window has fully elapsed do we roll the anchor forward to tomorrow, so a
  // light started or edited mid-window shows "wake" instead of skipping to
  // "night" for the next ~24 hours.
  const windowEnd = nextWakeTime.getTime() + wakeDurationMinutes * 60 * 1000
  if (windowEnd <= now.getTime()) {
    nextWakeTime.setDate(nextWakeTime.getDate() + 1)
  }

  return nextWakeTime
}

export const calculateScheduleState = (
  now: Date,
  wakeTime: Date,
  wakeDurationMinutes: number
): ScheduleState => {
  const nowTime = now.getTime()
  const wakeTimeValue = wakeTime.getTime()
  const wakeEndTime = wakeTimeValue + wakeDurationMinutes * 60 * 1000

  if (nowTime < wakeTimeValue) {
    return {
      mode: 'night',
      timeRemaining: wakeTimeValue - nowTime
    }
  }

  if (nowTime < wakeEndTime) {
    return {
      mode: 'wake',
      timeRemaining: wakeEndTime - nowTime
    }
  }

  return {
    mode: 'awake',
    timeRemaining: 0
  }
}
