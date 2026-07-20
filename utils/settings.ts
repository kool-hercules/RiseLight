import type { AmbientSoundId, LightMode, Settings } from '../types'
import { AMBIENT_SOUND_IDS } from '../types'

export const SETTINGS_STORAGE_KEY = 'nightlight-settings'
export const SETTINGS_SCHEMA_VERSION = 1 as const

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type UnknownRecord = Record<string, unknown>

type StoredSettingsV1 = {
  version: typeof SETTINGS_SCHEMA_VERSION
  settings: Settings
}

const modeKeys: LightMode[] = ['night', 'wake', 'awake']

const legacyModeKeys: Record<LightMode, 'white' | 'blue' | 'pink'> = {
  night: 'white',
  wake: 'blue',
  awake: 'pink'
}

const legacyColors: Record<LightMode, string> = {
  night: '#ffffff',
  wake: '#3b82f6',
  awake: '#ec4899'
}

// Bedroom-tuned defaults: a dim warm red for "stay in bed" (low blue light),
// easing to amber during the wake window, then a gentle green for "okay to get
// up". Brightness climbs with the cycle but stays low enough not to light up a
// dark room.
export const createDefaultSettings = (): Settings => ({
  wakeTime: '06:30',
  wakeDuration: 30,
  chimeEnabled: false,
  ambientSound: null,
  ambientVolume: 50,
  sleepTimerMinutes: 0,
  brightness: {
    night: 20,
    wake: 45,
    awake: 65
  },
  colors: {
    night: '#ff3b30',
    wake: '#ff9500',
    awake: '#34c759'
  }
})

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const isValidWakeTime = (time: unknown): time is string => {
  return typeof time === 'string' && /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time)
}

export const isValidColor = (color: unknown): color is string => {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
}

export const isValidDuration = (duration: unknown): duration is number => {
  return typeof duration === 'number' && Number.isFinite(duration) && duration >= 1 && duration <= 60
}

export const isValidBrightness = (brightness: unknown): brightness is number => {
  return typeof brightness === 'number' && Number.isFinite(brightness) && brightness >= 0 && brightness <= 100
}

export const isValidAmbientSound = (value: unknown): value is AmbientSoundId | null => {
  return value === null || (typeof value === 'string' && AMBIENT_SOUND_IDS.includes(value as AmbientSoundId))
}

// A whole number of minutes, 0 (off) through 480 (8h). We accept the full range
// on parse for forward-compat even though the picker only offers a short list.
export const isValidSleepTimer = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 480
}

export const normalizeWakeTime = (time: string): string => {
  const [hours, minutes] = time.split(':')
  return `${hours.padStart(2, '0')}:${minutes}`
}

const boundedNumber = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, value))
}

const settingsPayload = (stored: unknown): UnknownRecord | null => {
  if (!isRecord(stored)) {
    return null
  }

  if (!('version' in stored)) {
    return stored
  }

  if (stored.version === SETTINGS_SCHEMA_VERSION && isRecord(stored.settings)) {
    return stored.settings
  }

  // Unknown versioned shapes are not safe to interpret as the current schema.
  return null
}

export const parseSettings = (stored: unknown): Settings => {
  const defaults = createDefaultSettings()
  const source = settingsPayload(stored)

  if (!source) {
    return defaults
  }

  const brightnessSource = isRecord(source.brightness) ? source.brightness : {}
  const colorSource = isRecord(source.colors) ? source.colors : {}
  const hasLegacyModes = Object.values(legacyModeKeys).some(key => key in brightnessSource || key in colorSource)

  const brightness = { ...defaults.brightness }
  const colors = { ...defaults.colors }

  for (const mode of modeKeys) {
    const legacyMode = legacyModeKeys[mode]
    const brightnessValue = mode in brightnessSource
      ? brightnessSource[mode]
      : brightnessSource[legacyMode]
    const colorValue = mode in colorSource
      ? colorSource[mode]
      : colorSource[legacyMode]

    brightness[mode] = boundedNumber(brightnessValue, defaults.brightness[mode], 0, 100)
    colors[mode] = isValidColor(colorValue)
      ? colorValue
      : hasLegacyModes
        ? legacyColors[mode]
        : defaults.colors[mode]
  }

  const wakeDuration = boundedNumber(source.wakeDuration, defaults.wakeDuration, 1, 60)

  return {
    wakeTime: isValidWakeTime(source.wakeTime)
      ? normalizeWakeTime(source.wakeTime)
      : defaults.wakeTime,
    wakeDuration: Math.round(wakeDuration),
    chimeEnabled: typeof source.chimeEnabled === 'boolean'
      ? source.chimeEnabled
      : defaults.chimeEnabled,
    ambientSound: isValidAmbientSound(source.ambientSound)
      ? source.ambientSound
      : defaults.ambientSound,
    ambientVolume: boundedNumber(source.ambientVolume, defaults.ambientVolume, 0, 100),
    sleepTimerMinutes: isValidSleepTimer(source.sleepTimerMinutes)
      ? source.sleepTimerMinutes
      : defaults.sleepTimerMinutes,
    brightness,
    colors
  }
}

export const parseSettingsJson = (settingsJson: string): Settings | null => {
  try {
    const parsed: unknown = JSON.parse(settingsJson)
    return settingsPayload(parsed) ? parseSettings(parsed) : null
  } catch (error) {
    console.warn('RiseLight: failed to parse stored settings; using defaults.', error)
    return null
  }
}

export const serializeSettings = (settings: Settings, space?: number): string => {
  const stored: StoredSettingsV1 = {
    version: SETTINGS_SCHEMA_VERSION,
    settings: parseSettings(settings)
  }

  return JSON.stringify(stored, null, space)
}

export const getBrowserStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const loadSettingsFromStorage = (storage: StorageLike | null): Settings => {
  if (!storage) {
    return createDefaultSettings()
  }

  try {
    const stored = storage.getItem(SETTINGS_STORAGE_KEY)
    if (stored === null) {
      return createDefaultSettings()
    }

    return parseSettingsJson(stored) ?? createDefaultSettings()
  } catch (error) {
    console.warn('RiseLight: unable to read stored settings; using defaults.', error)
    return createDefaultSettings()
  }
}

export const saveSettingsToStorage = (storage: StorageLike | null, settings: Settings): boolean => {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(settings))
    return true
  } catch {
    return false
  }
}
