import type { AmbientSoundId, DaySchedule, LightMode, Settings } from '../types'
import { AMBIENT_SOUND_IDS } from '../types'

export const SETTINGS_STORAGE_KEY = 'nightlight-settings'
export const SETTINGS_SCHEMA_VERSION = 2 as const

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type UnknownRecord = Record<string, unknown>

type StoredSettingsV2 = {
  version: typeof SETTINGS_SCHEMA_VERSION
  settings: Settings
}

const modeKeys: LightMode[] = ['bedtime', 'night', 'wake', 'awake']

// The pre-v1 white/blue/pink keys predate story time, so bedtime has no legacy
// counterpart and always comes from current or default values.
const legacyModeKeys: Partial<Record<LightMode, 'white' | 'blue' | 'pink'>> = {
  night: 'white',
  wake: 'blue',
  awake: 'pink'
}

const legacyColors: Partial<Record<LightMode, string>> = {
  night: '#ffffff',
  wake: '#3b82f6',
  awake: '#ec4899'
}

// Bedroom-tuned defaults: a dim warm red for "stay in bed" (low blue light),
// easing to amber during the wake window, then a gentle green for "okay to get
// up". Brightness climbs with the cycle but stays low enough not to light up a
// dark room.
export const DEFAULT_WAKE_TIME = '06:30'
export const DEFAULT_BEDTIME = '19:30'

export const createDefaultSchedule = (
  wakeTime = DEFAULT_WAKE_TIME,
  bedtime = DEFAULT_BEDTIME
): DaySchedule[] => Array.from({ length: 7 }, () => ({ wakeTime, bedtime }))

export const createDefaultSettings = (): Settings => ({
  schedule: createDefaultSchedule(),
  wakeDuration: 30,
  windDownMinutes: 20,
  awakeHoldMinutes: 60,
  autoSchedule: true,
  lastNapMinutes: 60,
  ambientAutoStart: true,
  childLock: true,
  sceneEnabled: true,
  chimeEnabled: false,
  ambientSound: null,
  ambientVolume: 50,
  sleepTimerMinutes: 0,
  brightness: {
    bedtime: 35,
    night: 20,
    wake: 45,
    awake: 65
  },
  colors: {
    bedtime: '#ffb347',
    night: '#ff3b30',
    wake: '#ff9500',
    awake: '#34c759'
  }
})

export const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const isValidWakeTime = (time: unknown): time is string => {
  return typeof time === 'string' && /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(time)
}

const minutesOfDay = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Morning wake bounds (04:00–12:00) and bedtime bounds (15:00–23:59) guarantee
// that every night crosses midnight exactly once, which keeps the routine
// engine's day arithmetic simple.
export const isValidMorningWake = (time: unknown): time is string => {
  if (!isValidWakeTime(time)) {
    return false
  }
  const minutes = minutesOfDay(time)
  return minutes >= 4 * 60 && minutes <= 12 * 60
}

export const isValidBedtime = (time: unknown): time is string => {
  if (!isValidWakeTime(time)) {
    return false
  }
  const minutes = minutesOfDay(time)
  return minutes >= 15 * 60 && minutes <= 23 * 60 + 59
}

export const WIND_DOWN_MAX = 60
export const AWAKE_HOLD_MAX = 240
export const NAP_MAX = 180

export const isValidWindDown = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= WIND_DOWN_MAX

export const isValidAwakeHold = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= AWAKE_HOLD_MAX

export const isValidNapMinutes = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 10 && value <= NAP_MAX

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

// Accepts the current v2 shape, the v1 shape (single top-level wakeTime), and
// the unversioned legacy shape. parseSettings migrates whatever it finds.
const settingsPayload = (stored: unknown): UnknownRecord | null => {
  if (!isRecord(stored)) {
    return null
  }

  if (!('version' in stored)) {
    return stored
  }

  if ((stored.version === SETTINGS_SCHEMA_VERSION || stored.version === 1) && isRecord(stored.settings)) {
    return stored.settings
  }

  // Unknown versioned shapes are not safe to interpret as the current schema.
  return null
}

// v2 stores a 7-day `schedule`; v1/unversioned stored one top-level wakeTime
// (any HH:MM). Copy that to every day, replacing anything outside the morning
// bounds with the default. Bad v2 entries fall back individually.
const parseSchedule = (source: UnknownRecord): DaySchedule[] => {
  const fallback = createDefaultSchedule()

  if (Array.isArray(source.schedule)) {
    if (source.schedule.length !== 7) {
      return fallback
    }

    return source.schedule.map((entry: unknown, day) => {
      const record = isRecord(entry) ? entry : {}
      return {
        wakeTime: isValidMorningWake(record.wakeTime)
          ? normalizeWakeTime(record.wakeTime)
          : fallback[day].wakeTime,
        bedtime: isValidBedtime(record.bedtime)
          ? normalizeWakeTime(record.bedtime)
          : fallback[day].bedtime
      }
    })
  }

  const legacyWake = isValidMorningWake(source.wakeTime)
    ? normalizeWakeTime(source.wakeTime)
    : DEFAULT_WAKE_TIME
  return createDefaultSchedule(legacyWake)
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
    const brightnessValue = mode in brightnessSource || !legacyMode
      ? brightnessSource[mode]
      : brightnessSource[legacyMode]
    const colorValue = mode in colorSource || !legacyMode
      ? colorSource[mode]
      : colorSource[legacyMode]

    brightness[mode] = boundedNumber(brightnessValue, defaults.brightness[mode], 0, 100)
    colors[mode] = isValidColor(colorValue)
      ? colorValue
      : (hasLegacyModes && legacyColors[mode]) || defaults.colors[mode]
  }

  const wakeDuration = boundedNumber(source.wakeDuration, defaults.wakeDuration, 1, 60)
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback

  return {
    schedule: parseSchedule(source),
    wakeDuration: Math.round(wakeDuration),
    windDownMinutes: isValidWindDown(source.windDownMinutes)
      ? source.windDownMinutes
      : defaults.windDownMinutes,
    awakeHoldMinutes: isValidAwakeHold(source.awakeHoldMinutes)
      ? source.awakeHoldMinutes
      : defaults.awakeHoldMinutes,
    autoSchedule: bool(source.autoSchedule, defaults.autoSchedule),
    lastNapMinutes: isValidNapMinutes(source.lastNapMinutes)
      ? source.lastNapMinutes
      : defaults.lastNapMinutes,
    ambientAutoStart: bool(source.ambientAutoStart, defaults.ambientAutoStart),
    childLock: bool(source.childLock, defaults.childLock),
    sceneEnabled: bool(source.sceneEnabled, defaults.sceneEnabled),
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
  const stored: StoredSettingsV2 = {
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

// Schedule presets. "Weekdays & weekends" follows the night structure: the
// weekend *wake* rows are Saturday and Sunday mornings, and the weekend
// *bedtime* rows are Friday and Saturday evenings (the nights before them).
export type SchedulePreset = 'same' | 'split' | 'custom'

const WEEKEND_WAKE_DAYS = new Set([0, 6])
const WEEKEND_BEDTIME_DAYS = new Set([5, 6])

export const buildSameSchedule = (day: DaySchedule): DaySchedule[] =>
  createDefaultSchedule(day.wakeTime, day.bedtime)

export const buildSplitSchedule = (weekday: DaySchedule, weekend: DaySchedule): DaySchedule[] =>
  Array.from({ length: 7 }, (_, day) => ({
    wakeTime: WEEKEND_WAKE_DAYS.has(day) ? weekend.wakeTime : weekday.wakeTime,
    bedtime: WEEKEND_BEDTIME_DAYS.has(day) ? weekend.bedtime : weekday.bedtime
  }))

// The weekday/weekend pair a schedule implies: Monday's wake + Monday's bedtime
// for weekdays, Saturday's wake + Saturday's bedtime for weekends.
export const splitScheduleParts = (schedule: readonly DaySchedule[]): { weekday: DaySchedule; weekend: DaySchedule } => ({
  weekday: { wakeTime: schedule[1].wakeTime, bedtime: schedule[1].bedtime },
  weekend: { wakeTime: schedule[6].wakeTime, bedtime: schedule[6].bedtime }
})

const sameSchedule = (a: readonly DaySchedule[], b: readonly DaySchedule[]): boolean =>
  a.every((day, index) => day.wakeTime === b[index].wakeTime && day.bedtime === b[index].bedtime)

export const detectSchedulePreset = (schedule: readonly DaySchedule[]): SchedulePreset => {
  if (sameSchedule(schedule, buildSameSchedule(schedule[0]))) {
    return 'same'
  }
  const { weekday, weekend } = splitScheduleParts(schedule)
  return sameSchedule(schedule, buildSplitSchedule(weekday, weekend)) ? 'split' : 'custom'
}

export const isValidDaySchedule = (day: unknown): day is DaySchedule =>
  isRecord(day) && isValidMorningWake(day.wakeTime) && isValidBedtime(day.bedtime)
