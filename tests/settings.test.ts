import { describe, expect, it } from 'vitest'
import { useSettings } from '../composables/useSettings'
import {
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  loadSettingsFromStorage,
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
      wakeTime: '07:05',
      wakeDuration: 60,
      chimeEnabled: false,
      brightness: {
        night: 0,
        wake: 0,
        awake: 100
      },
      colors: {
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

    expect(settings.wakeTime).toBe('06:30')
    expect(settings.wakeDuration).toBe(30)
    expect(settings.brightness).toEqual({ night: 20, wake: 35, awake: 65 })
    expect(settings.colors).toEqual({ night: '#abcdef', wake: '#ff9500', awake: '#123456' })
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
      wakeTime: '05:45',
      wakeDuration: 20,
      chimeEnabled: false,
      brightness: {
        night: 0,
        wake: 65,
        awake: 90
      },
      colors: {
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

    store.updateBrightness('night', 0)
    store.updateColor('night', '#123456')
    store.resetSettings()

    expect(store.settings.value).not.toBe(firstSettings)
    expect(store.settings.value.brightness).not.toBe(firstBrightness)
    expect(store.settings.value.colors).not.toBe(firstColors)
    expect(store.settings.value).toEqual(createDefaultSettings())
  })
})
