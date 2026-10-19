import { describe, expect, it } from 'vitest'
import { ALARM_IDS, planAlarms } from '../utils/alarm'
import { createDefaultSchedule, createDefaultSettings, parseSettingsJson } from '../utils/settings'

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

  it('targets the green time, whatever the wake-up window', () => {
    for (const wakeDuration of [1, 30, 60]) {
      const settings = { ...createDefaultSettings(), schedule: createDefaultSchedule('06:45'), wakeDuration }
      expect(planAlarms(at(16, 12), settings, null)[0].at.getTime()).toBe(at(17, 6, 45).getTime())
    }
  })

  it('keeps a migrated v2 schedule’s alarms on the same green minutes', () => {
    const v2 = {
      version: 2,
      settings: { schedule: Array.from({ length: 7 }, () => ({ wakeTime: '06:10', bedtime: '19:30' })), wakeDuration: 25 }
    }
    const plan = planAlarms(at(16, 12), parseSettingsJson(JSON.stringify(v2))!, null)
    expect(plan.map(alarm => `${alarm.at.getHours()}:${alarm.at.getMinutes()}`)).toEqual(Array(7).fill('6:35'))
  })
})
