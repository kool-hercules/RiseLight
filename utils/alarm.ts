import type { Settings } from '../types'
import { upcomingOkayToWake, type Override } from './routine'

// Native "okay to get up" notifications: one per upcoming okay-to-wake instant
// for the next week, IDs 1001–1007. Every re-sync cancels all seven and
// reschedules, so an edited schedule never double-fires.
export const ALARM_BASE_ID = 1001
export const ALARM_COUNT = 7

export const ALARM_IDS: readonly number[] = Array.from({ length: ALARM_COUNT }, (_, index) => ALARM_BASE_ID + index)

export type AlarmPlan = { id: number; at: Date }[]

// Pure so it can be unit-tested without the native notifications plugin.
export const planAlarms = (now: Date, settings: Settings, override: Override | null): AlarmPlan =>
  upcomingOkayToWake(now, settings, override, ALARM_COUNT)
    .map((at, index) => ({ id: ALARM_BASE_ID + index, at }))
