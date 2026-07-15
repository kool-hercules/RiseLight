import type { LightMode } from '../types'
import { isValidWakeTime } from './settings'

export type ScheduleState = {
  mode: LightMode
  timeRemaining: number
}

export const calculateNextWakeTime = (now: Date, wakeTime: string): Date => {
  if (!isValidWakeTime(wakeTime)) {
    throw new RangeError(`Invalid wake time: ${wakeTime}`)
  }

  const [hours, minutes] = wakeTime.split(':').map(Number)
  const nextWakeTime = new Date(now)
  nextWakeTime.setHours(hours, minutes, 0, 0)

  // Exactly at the configured minute is the start of the wake window.
  if (nextWakeTime.getTime() < now.getTime()) {
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
