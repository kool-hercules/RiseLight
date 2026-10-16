import { describe, expect, it } from 'vitest'
import { useSettings } from '../composables/useSettings'
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  buildSplitSchedule,
  createDefaultSchedule,
  createDefaultSettings,
  detectSchedulePreset,
  isValidBedtime,
  isValidMorningWake,
  loadSettingsFromStorage,
  parseSettingsJson,
  serializeSettings,
  saveSettingsToStorage
} from '../utils/settings'
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
      schedule: createDefaultSchedule('07:05'),
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

    expect(settings.schedule).toEqual(createDefaultSchedule('06:30'))
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
      schedule: createDefaultSchedule('05:45'),
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

describe('settings schema v2 migration', () => {
  it('copies a v1 wakeTime to all seven days with the default bedtime', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        settings: { wakeTime: '07:15', wakeDuration: 20, chimeEnabled: true }
      })
    })
    const loaded = loadSettingsFromStorage(storage)

    expect(loaded.schedule).toHaveLength(7)
    expect(loaded.schedule.every(day => day.wakeTime === '07:15' && day.bedtime === '19:30')).toBe(true)
    expect(loaded.wakeDuration).toBe(20)
    expect(loaded.chimeEnabled).toBe(true)
    expect(loaded.autoSchedule).toBe(true)
    expect(loaded.windDownMinutes).toBe(20)
    expect('wakeTime' in loaded).toBe(false)
  })

  it('replaces an out-of-range v1 wakeTime with the default 06:30', () => {
    const storage = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ version: 1, settings: { wakeTime: '13:00' } })
    })
    expect(loadSettingsFromStorage(storage).schedule).toEqual(createDefaultSchedule('06:30'))

    const earlyUnversioned = new MemoryStorage({
      [SETTINGS_STORAGE_KEY]: JSON.stringify({ wakeTime: '03:00' })
    })
    expect(loadSettingsFromStorage(earlyUnversioned).schedule[0].wakeTime).toBe('06:30')
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
    const parsed = parseSettingsJson(JSON.stringify({ version: 2, settings }))
    expect(parsed?.schedule).toEqual(createDefaultSchedule())
  })

  it('falls back per entry for bad schedule rows', () => {
    const schedule = createDefaultSchedule('07:00', '20:00')
    const raw = [...schedule] as unknown[]
    raw[2] = { wakeTime: '14:00', bedtime: '20:15' }
    raw[3] = 'nope'
    raw[4] = { wakeTime: '5:45', bedtime: '02:00' }
    const parsed = parseSettingsJson(JSON.stringify({
      version: 2,
      settings: { ...createDefaultSettings(), schedule: raw }
    }))!

    expect(parsed.schedule[1]).toEqual({ wakeTime: '07:00', bedtime: '20:00' })
    expect(parsed.schedule[2]).toEqual({ wakeTime: '06:30', bedtime: '20:15' })
    expect(parsed.schedule[3]).toEqual({ wakeTime: '06:30', bedtime: '19:30' })
    expect(parsed.schedule[4]).toEqual({ wakeTime: '05:45', bedtime: '19:30' })
  })

  it('round-trips every v2 field through serialize/parse', () => {
    const custom = createDefaultSettings()
    custom.schedule = buildSplitSchedule(
      { wakeTime: '06:15', bedtime: '19:00' },
      { wakeTime: '07:30', bedtime: '20:00' }
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
    expect(JSON.parse(json).version).toBe(2)
    expect(parseSettingsJson(json)).toEqual(custom)
  })

  it('treats unknown future versions as unreadable', () => {
    expect(parseSettingsJson(JSON.stringify({ version: 3, settings: {} }))).toBeNull()
  })

  it('rejects out-of-range numeric v2 fields individually', () => {
    const parsed = parseSettingsJson(JSON.stringify({
      version: 2,
      settings: { windDownMinutes: -5, awakeHoldMinutes: 0, lastNapMinutes: 2.5, childLock: 'no' }
    }))!
    expect(parsed.windDownMinutes).toBe(20)
    expect(parsed.awakeHoldMinutes).toBe(60)
    expect(parsed.lastNapMinutes).toBe(60)
    expect(parsed.childLock).toBe(true)
  })
})

describe('schedule validation and presets', () => {
  it('bounds morning wake to 04:00–12:00 and bedtime to 15:00–23:59', () => {
    expect(isValidMorningWake('04:00')).toBe(true)
    expect(isValidMorningWake('12:00')).toBe(true)
    expect(isValidMorningWake('03:59')).toBe(false)
    expect(isValidMorningWake('12:01')).toBe(false)
    expect(isValidBedtime('15:00')).toBe(true)
    expect(isValidBedtime('23:59')).toBe(true)
    expect(isValidBedtime('14:59')).toBe(false)
    expect(isValidBedtime('00:30')).toBe(false)
  })

  it('builds weekday/weekend splits around the nights before the weekend', () => {
    const weekday = { wakeTime: '06:30', bedtime: '19:30' }
    const weekend = { wakeTime: '07:30', bedtime: '20:30' }
    const schedule = buildSplitSchedule(weekday, weekend)

    // Friday (5) and Saturday (6) evenings get the weekend bedtime…
    expect(schedule.map(day => day.bedtime)).toEqual([
      '19:30', '19:30', '19:30', '19:30', '19:30', '20:30', '20:30'
    ])
    // …and Saturday (6) and Sunday (0) mornings get the weekend wake.
    expect(schedule.map(day => day.wakeTime)).toEqual([
      '07:30', '06:30', '06:30', '06:30', '06:30', '06:30', '07:30'
    ])
    expect(detectSchedulePreset(schedule)).toBe('split')
    expect(detectSchedulePreset(createDefaultSchedule())).toBe('same')

    schedule[3] = { wakeTime: '05:00', bedtime: '19:30' }
    expect(detectSchedulePreset(schedule)).toBe('custom')
  })

  it('ignores out-of-range day edits through the store', () => {
    const store = useSettings()
    store.resetSettings()
    store.updateDaySchedule(2, { wakeTime: '13:00', bedtime: '20:45' })
    expect(store.settings.value.schedule[2]).toEqual({ wakeTime: '06:30', bedtime: '20:45' })
    store.updateDaySchedule(9, { wakeTime: '07:00' })
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
