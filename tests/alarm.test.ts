import { describe, expect, it } from 'vitest'
import { ALARM_IDS, planAlarms } from '../utils/alarm'
import { createDefaultSettings } from '../utils/settings'

// 2026-10-16 is a Friday.
const at = (day: number, hours: number, minutes = 0): Date => new Date(2026, 9, day, hours, minutes)

describe('planAlarms', () => {
  it('schedules the next seven okay-to-get-up times with stable IDs', () => {
    const plan = planAlarms(at(16, 12), createDefaultSettings(), null)
    expect(plan.map(alarm => alarm.id)).toEqual([...ALARM_IDS])
    expect(plan[0].at.getTime()).toBe(at(17, 7).getTime())
    expect(plan[6].at.getTime()).toBe(at(23, 7).getTime())
  })

  it('schedules nothing with auto-schedule off and no override', () => {
    const settings = { ...createDefaultSettings(), autoSchedule: false }
    expect(planAlarms(at(16, 12), settings, null)).toEqual([])
  })

  it('includes a manual night when auto-schedule is off', () => {
    const settings = { ...createDefaultSettings(), autoSchedule: false }
    const plan = planAlarms(at(16, 21, 1), settings, { kind: 'on', start: at(16, 21).getTime() })
    expect(plan).toEqual([{ id: 1001, at: at(17, 7) }])
  })
})
