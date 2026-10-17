import { describe, expect, it } from 'vitest'
import { useSettings } from '../composables/useSettings'
import {
  scheduleTimeError,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  buildSplitSchedule,
  createDefaultSchedule,
  createDefaultSettings,
  detectSchedulePreset,
  isValidBedtime,
  isValidOkayTime,
  loadSettingsFromStorage,
  parseSettingsJson,
  serializeSettings,
  saveSettingsToStorage
} from '../utils/settings'
import { OVERRIDE_STORAGE_KEY, readOverride } from '../utils/override'
import { overrideEnd, resolvePhase, upcomingOkayToWake } from '../utils/routine'
import { MemoryStorage } from './helpers/memoryStorage'

describe('settings persistence', () => {
  it('round-trips valid zero brightness in the versioned schema', () => {
    const storage = new MemoryStorage()
    const settings = createDefaultSettings()
    settings.brightness.night = 0

    expect(saveSettingsToStorage(storage, settings)).toBe(true)
    expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').version).toBe(SETTINGS_SCHEMA_VERSION)
    expect(loadSettingsFromStorage(storage).brightness.night).toBe(0)
  })

  it('falls back safely for malformed JSON and storage failures', () => {
    const malformed = new MemoryStorage({ [SETTINGS_STORAGE_KEY]: '{not-json' })
    const blockedReads = new MemoryStorage({}, true)
    const blockedWrites = new MemoryStorage({}, false, true)

    expect(loadSettingsFromStorage(malformed)).toEqual(createDefaultSettings())
    expect(loadSettingsFromStorage(blockedReads)).toEqual(createDefaultSettings())
    expect(() => saveSettingsToStorage(blockedWrites, createDefaultSettings())).not.toThrow()
    expect(saveSettingsToStorage(blockedWrites, createDefaultSettings())).toBe(false)
  })

  it('validates partial stored data field by field and clamps finite numbers', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        wakeTime: '7:05',
        wakeDuration: 999,
        brightness: {
          night: 0,
          wake: -4,
          awake: 140
        },
        colors: {
          night: '#112233',
          wake: 'yellow'
        },
        soundEnabled: 'yes'
      })
    })

    const settings = loadSettingsFromStorage(storage)

    expect(settings).toEqual({
      ...createDefaultSettings(),
      // Legacy sunrise 7:05 + the clamped 60-minute window → green at 08:05.
      schedule: createDefaultSchedule('08:05'),
      wakeDuration: 60,
      brightness: {
        bedtime: 35,
        night: 0,
        wake: 0,
        awake: 100
      },
      colors: {
        bedtime: '#ffb347',
        night: '#112233',
        wake: '#ff9500',
        awake: '#34c759'
      }
    })
  })

  it('replaces invalid scalar fields without discarding valid siblings', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        wakeTime: '25:90',
        wakeDuration: null,
        brightness: {
          night: Number.NaN,
          wake: 35
        },
        colors: {
          night: '#abcdef',
          wake: '#12345g',
          awake: '#123456'
        },
        soundEnabled: true
      })
    })

    const settings = loadSettingsFromStorage(storage)

    expect(settings.schedule).toEqual(createDefaultSchedule('07:00'))
    expect(settings.wakeDuration).toBe(30)
    expect(settings.brightness).toEqual({ bedtime: 35, night: 20, wake: 35, awake: 65 })
    expect(settings.colors).toEqual({ bedtime: '#ffb347', night: '#abcdef', wake: '#ff9500', awake: '#123456' })
  })

  it('migrates legacy white/blue/pink brightness without losing zero', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        wakeTime: '05:45',
        wakeDuration: 20,
        brightness: {
          white: 0,
          blue: 65,
          pink: 90
        },
        soundEnabled: true
      })
    })

    expect(loadSettingsFromStorage(storage)).toEqual({
      ...createDefaultSettings(),
      schedule: createDefaultSchedule('06:05'),
      wakeDuration: 20,
      brightness: {
        bedtime: 35,
        night: 0,
        wake: 65,
        awake: 90
      },
      colors: {
        bedtime: '#ffb347',
        night: '#ffffff',
        wake: '#3b82f6',
        awake: '#ec4899'
      }
    })
  })

  it('round-trips the chime toggle and defaults it off for legacy data', () => {
    const withChime = new MemoryStorage()
    const on = createDefaultSettings()
    on.chimeEnabled = true
    saveSettingsToStorage(withChime, on)
    expect(loadSettingsFromStorage(withChime).chimeEnabled).toBe(true)

    // Legacy record predating the flag → stays off.
    const legacy = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ wakeTime: '06:00', wakeDuration: 15 })
    })
    expect(loadSettingsFromStorage(legacy).chimeEnabled).toBe(false)

    // A non-boolean value is ignored rather than coerced.
    const bogus = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ chimeEnabled: 'yes' })
    })
    expect(loadSettingsFromStorage(bogus).chimeEnabled).toBe(false)
  })

  it('defaults the ambient fields and keeps them off for legacy data', () => {
    const defaults = createDefaultSettings()
    expect(defaults.ambientSound).toBe(null)
    expect(defaults.ambientVolume).toBe(50)
    expect(defaults.sleepTimerMinutes).toBe(0)

    // A record predating ambient sound → defaults, no version bump needed.
    const legacy = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ wakeTime: '06:00', wakeDuration: 15 })
    })
    const loaded = loadSettingsFromStorage(legacy)
    expect(loaded.ambientSound).toBe(null)
    expect(loaded.ambientVolume).toBe(50)
    expect(loaded.sleepTimerMinutes).toBe(0)
  })

  it('validates, clamps, and round-trips the ambient fields', () => {
    const round = new MemoryStorage()
    const custom = createDefaultSettings()
    custom.ambientSound = 'rain'
    custom.ambientVolume = 80
    custom.sleepTimerMinutes = 45
    saveSettingsToStorage(round, custom)
    const reloaded = loadSettingsFromStorage(round)
    expect(reloaded.ambientSound).toBe('rain')
    expect(reloaded.ambientVolume).toBe(80)
    expect(reloaded.sleepTimerMinutes).toBe(45)

    // Invalid ids drop to null; volume clamps; non-integer/out-of-range timer resets.
    const invalid = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        ambientSound: 'thunderstorm',
        ambientVolume: 250,
        sleepTimerMinutes: 999
      })
    })
    const cleaned = loadSettingsFromStorage(invalid)
    expect(cleaned.ambientSound).toBe(null)
    expect(cleaned.ambientVolume).toBe(100)
    expect(cleaned.sleepTimerMinutes).toBe(0)
  })
})

describe('settings schema migration', () => {
  it('copies a v1 wakeTime to all seven days as a green time, with the default bedtime', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        settings: { wakeTime: '07:15', wakeDuration: 20, chimeEnabled: true }
      })
    })
    const loaded = loadSettingsFromStorage(storage)

    expect(loaded.schedule).toHaveLength(7)
    expect(loaded.schedule.every(day => day.okayTime === '07:35' && day.bedtime === '19:30')).toBe(true)
    expect(loaded.schedule.every(day => !('wakeTime' in day))).toBe(true)
    expect(loaded.wakeDuration).toBe(20)
    expect(loaded.chimeEnabled).toBe(true)
    expect(loaded.autoSchedule).toBe(true)
    expect(loaded.windDownMinutes).toBe(20)
    expect('wakeTime' in loaded).toBe(false)
  })

  it('replaces an out-of-range v1 wakeTime with the default green time 07:00', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, settings: { wakeTime: '13:00' } })
    })
    expect(loadSettingsFromStorage(storage).schedule).toEqual(createDefaultSchedule('07:00'))

    const earlyUnversioned = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ wakeTime: '03:00' })
    })
    expect(loadSettingsFromStorage(earlyUnversioned).schedule[0].okayTime).toBe('07:00')
  })

  it('migrates a v2 week exactly: okayTime = wakeTime + wakeDuration, per day', () => {
    const wakeTimes = ['07:30', '06:30', '6:05', '04:00', '11:45', '12:00', '05:59']
    for (const wakeDuration of [1, 20, 45, 60]) {
      const parsed = parseSettingsJson(JSON.stringify({
        version: 2,
        settings: {
          ...createDefaultSettings(),
          schedule: wakeTimes.map(wakeTime => ({ wakeTime, bedtime: '19:45' })),
          wakeDuration
        }
      }))!
      const expected = wakeTimes.map(wakeTime => {
        const [hours, minutes] = wakeTime.split(':').map(Number)
        const total = hours * 60 + minutes + wakeDuration
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      })
      expect(parsed.schedule.map(day => day.okayTime)).toEqual(expected)
      expect(parsed.schedule.every(day => day.bedtime === '19:45')).toBe(true)
      expect(parsed.wakeDuration).toBe(wakeDuration)
    }
  })

  it('migrates a v2 default week to the same 07:00 green, and bad v2 rows to the default green', () => {
    const v2Default = { ...createDefaultSettings(), schedule: Array.from({ length: 7 }, () => ({ wakeTime: '06:30', bedtime: '19:30' })) }
    expect(parseSettingsJson(JSON.stringify({ version: 2, settings: v2Default }))).toEqual(createDefaultSettings())

    const schedule: unknown[] = [...v2Default.schedule]
    schedule[1] = { wakeTime: '12:30', bedtime: '20:00' }
    schedule[2] = { okayTime: '08:00', bedtime: '20:00' } // not a v2 field
    const parsed = parseSettingsJson(JSON.stringify({ version: 2, settings: { ...v2Default, wakeDuration: 10, schedule } }))!
    expect(parsed.schedule[0]).toEqual({ okayTime: '06:40', bedtime: '19:30' })
    expect(parsed.schedule[1]).toEqual({ okayTime: '07:00', bedtime: '20:00' })
    expect(parsed.schedule[2]).toEqual({ okayTime: '07:00', bedtime: '20:00' })
  })

  it('saves a migrated v2 blob back as v3', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 2,
        settings: { schedule: Array.from({ length: 7 }, () => ({ wakeTime: '06:15', bedtime: '19:00' })), wakeDuration: 20 }
      })
    })
    saveSettingsToStorage(storage, loadSettingsFromStorage(storage))
    const stored = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)!)
    expect(stored.version).toBe(3)
    expect(stored.settings.schedule[0]).toEqual({ okayTime: '06:35', bedtime: '19:00' })
    expect(loadSettingsFromStorage(storage).schedule[0].okayTime).toBe('06:35')
  })

  it('keeps bedtime colour and brightness at defaults when migrating legacy colours', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        colors: { white: '#010203' },
        brightness: { white: 5 }
      })
    })
    const loaded = loadSettingsFromStorage(storage)

    expect(loaded.colors.night).toBe('#010203')
    expect(loaded.colors.wake).toBe('#3b82f6')
    expect(loaded.colors.bedtime).toBe('#ffb347')
    expect(loaded.brightness.bedtime).toBe(35)
    expect(loaded.brightness.night).toBe(5)
  })

  it('falls back to the default week for a schedule of the wrong length', () => {
    const settings = { ...createDefaultSettings(), schedule: createDefaultSchedule('07:00').slice(0, 6) }
    const parsed = parseSettingsJson(JSON.stringify({ version: 3, settings }))
    expect(parsed?.schedule).toEqual(createDefaultSchedule())

    const v2 = { ...settings, schedule: Array.from({ length: 6 }, () => ({ wakeTime: '06:00', bedtime: '19:00' })) }
    expect(parseSettingsJson(JSON.stringify({ version: 2, settings: v2 }))?.schedule).toEqual(createDefaultSchedule())
  })

  it('falls back per entry for bad schedule rows', () => {
    const schedule = createDefaultSchedule('07:00', '20:00')
    const raw = [...schedule] as unknown[]
    raw[2] = { okayTime: '13:01', bedtime: '20:15' }
    raw[3] = 'nope'
    raw[4] = { okayTime: '5:45', bedtime: '02:00' }
    raw[5] = { wakeTime: '06:00', bedtime: '20:00' } // a v2 field in a v3 record is not read
    const parsed = parseSettingsJson(JSON.stringify({
      version: 3,
      settings: { ...createDefaultSettings(), schedule: raw }
    }))!

    expect(parsed.schedule[1]).toEqual({ okayTime: '07:00', bedtime: '20:00' })
    expect(parsed.schedule[2]).toEqual({ okayTime: '07:00', bedtime: '20:15' })
    expect(parsed.schedule[3]).toEqual({ okayTime: '07:00', bedtime: '19:30' })
    expect(parsed.schedule[4]).toEqual({ okayTime: '05:45', bedtime: '19:30' })
    expect(parsed.schedule[5]).toEqual({ okayTime: '07:00', bedtime: '20:00' })
  })

  it('round-trips every v3 field through serialize/parse', () => {
    const custom = createDefaultSettings()
    custom.schedule = buildSplitSchedule(
      { okayTime: '06:45', bedtime: '19:00' },
      { okayTime: '13:00', bedtime: '20:00' }
    )
    custom.windDownMinutes = 0
    custom.awakeHoldMinutes = 120
    custom.autoSchedule = false
    custom.lastNapMinutes = 45
    custom.ambientAutoStart = false
    custom.childLock = false
    custom.sceneEnabled = false
    custom.colors.bedtime = '#aa5500'
    custom.brightness.bedtime = 10

    const json = serializeSettings(custom)
    expect(JSON.parse(json).version).toBe(3)
    expect(parseSettingsJson(json)).toEqual(custom)
  })

  it('treats unknown future versions as unreadable', () => {
    expect(parseSettingsJson(JSON.stringify({ version: 4, settings: {} }))).toBeNull()
    expect(parseSettingsJson(JSON.stringify({ version: 3, settings: 'nope' }))).toBeNull()
  })

  it('rejects out-of-range numeric v3 fields individually', () => {
    const parsed = parseSettingsJson(JSON.stringify({
      version: 3,
      settings: { windDownMinutes: -5, awakeHoldMinutes: 0, lastNapMinutes: 2.5, childLock: 'no' }
    }))!
    expect(parsed.windDownMinutes).toBe(20)
    expect(parsed.awakeHoldMinutes).toBe(60)
    expect(parsed.lastNapMinutes).toBe(60)
    expect(parsed.childLock).toBe(true)
  })
})

describe('schedule validation and presets', () => {
  it('bounds okay-to-get-up to 04:00–13:00 and bedtime to 15:00–23:59', () => {
    expect(isValidOkayTime('04:00')).toBe(true)
    expect(isValidOkayTime('13:00')).toBe(true)
    expect(isValidOkayTime('03:59')).toBe(false)
    expect(isValidOkayTime('13:01')).toBe(false)
    expect(isValidBedtime('15:00')).toBe(true)
    expect(isValidBedtime('23:59')).toBe(true)
    expect(isValidBedtime('14:59')).toBe(false)
    expect(isValidBedtime('00:30')).toBe(false)
  })

  it('builds weekday/weekend splits around the nights before the weekend', () => {
    const weekday = { okayTime: '07:00', bedtime: '19:30' }
    const weekend = { okayTime: '08:00', bedtime: '20:30' }
    const schedule = buildSplitSchedule(weekday, weekend)

    // Friday (5) and Saturday (6) evenings get the weekend bedtime…
    expect(schedule.map(day => day.bedtime)).toEqual([
      '19:30', '19:30', '19:30', '19:30', '19:30', '20:30', '20:30'
    ])
    // …and Saturday (6) and Sunday (0) mornings get the weekend okay time.
    expect(schedule.map(day => day.okayTime)).toEqual([
      '08:00', '07:00', '07:00', '07:00', '07:00', '07:00', '08:00'
    ])
    expect(detectSchedulePreset(schedule)).toBe('split')
    expect(detectSchedulePreset(createDefaultSchedule())).toBe('same')

    schedule[3] = { okayTime: '05:00', bedtime: '19:30' }
    expect(detectSchedulePreset(schedule)).toBe('custom')
  })

  it('ignores out-of-range day edits through the store', () => {
    const store = useSettings()
    store.resetSettings()
    store.updateDaySchedule(2, { okayTime: '13:01', bedtime: '20:45' })
    expect(store.settings.value.schedule[2]).toEqual({ okayTime: '07:00', bedtime: '20:45' })
    store.updateDaySchedule(2, { okayTime: '13:00' })
    expect(store.settings.value.schedule[2].okayTime).toBe('13:00')
    store.updateDaySchedule(9, { okayTime: '07:00' })
    store.updateSchedule(createDefaultSchedule('07:00').slice(0, 3))
    expect(store.settings.value.schedule).toHaveLength(7)
  })
})

describe('settings reset', () => {
  it('returns the same authoritative settings ref to every consumer', () => {
    expect(useSettings().settings).toBe(useSettings().settings)
  })

  it('replaces every nested object with a fresh isolated default', () => {
    const store = useSettings()
    store.resetSettings()
    const firstSettings = store.settings.value
    const firstBrightness = firstSettings.brightness
    const firstColors = firstSettings.colors
    const firstSchedule = firstSettings.schedule

    store.updateBrightness('night', 0)
    store.updateColor('night', '#123456')
    store.resetSettings()

    expect(store.settings.value).not.toBe(firstSettings)
    expect(store.settings.value.brightness).not.toBe(firstBrightness)
    expect(store.settings.value.colors).not.toBe(firstColors)
    expect(store.settings.value.schedule).not.toBe(firstSchedule)
    expect(store.settings.value).toEqual(createDefaultSettings())
  })
})

describe('scheduleTimeError', () => {
  it('explains out-of-range times instead of dropping them silently', () => {
    expect(scheduleTimeError('okayTime', '02:00')).toMatch(/4:00 AM/)
    expect(scheduleTimeError('okayTime', '13:30')).toMatch(/1:00 PM/)
    expect(scheduleTimeError('bedtime', '00:30')).toMatch(/3:00 PM/)
    expect(scheduleTimeError('okayTime', '06:30')).toBeNull()
    expect(scheduleTimeError('bedtime', '19:30')).toBeNull()
  })
})

describe('a v2 blob with an override stored mid-night', () => {
  // Overrides store only {kind, start, …}; their segments are re-derived each
  // tick from the current settings, so they need no migration of their own.
  const v2Storage = (overrideJson: string) => new MemoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      version: 2,
      settings: {
        schedule: Array.from({ length: 7 }, () => ({ wakeTime: '06:15', bedtime: '19:00' })),
        wakeDuration: 20,
        awakeHoldMinutes: 30,
        windDownMinutes: 20,
        autoSchedule: true
      }
    }),
    [OVERRIDE_STORAGE_KEY]: overrideJson
  })
  // Friday 2026-10-16 → Saturday morning, TZ pinned to America/New_York.
  const at = (day: number, hours: number, minutes = 0) => new Date(2026, 9, day, hours, minutes)

  it('an `on` started before bedtime still ramps at the v2 sunrise and turns green on the same minute', () => {
    const storage = v2Storage(JSON.stringify({ version: 1, override: { kind: 'on', start: at(16, 18).getTime() } }))
    const settings = loadSettingsFromStorage(storage)
    const override = readOverride(storage, at(16, 23))
    expect(settings.schedule[6].okayTime).toBe('06:35')

    const state = (date: Date) => resolvePhase(date, settings, override).state
    expect(state(at(16, 18, 30))).toBe('night')
    expect(state(at(17, 6, 14))).toBe('night')
    expect(state(at(17, 6, 15))).toBe('wake')
    expect(state(at(17, 6, 34))).toBe('wake')
    expect(state(at(17, 6, 35))).toBe('awake')
    expect(overrideEnd(override!, settings)).toBe(at(17, 7, 5).getTime())
    expect(upcomingOkayToWake(at(16, 23), settings, override, 1)[0].getTime()).toBe(at(17, 6, 35).getTime())
  })

  it('an `off` from night stays dark until the v2 sunrise start', () => {
    const storage = v2Storage(JSON.stringify({ version: 1, override: { kind: 'off', start: at(17, 1).getTime(), fromPhase: 'night' } }))
    const settings = loadSettingsFromStorage(storage)
    const override = readOverride(storage, at(17, 2))
    expect(resolvePhase(at(17, 6, 14), settings, override).state).toBe('inactive')
    expect(resolvePhase(at(17, 6, 15), settings, override).state).toBe('wake')
    expect(resolvePhase(at(17, 6, 35), settings, override).state).toBe('awake')
  })
})
