import type { AmbientSoundId, DaySchedule, LightMode, Settings } from '../types'
import { AMBIENT_SOUND_IDS } from '../types'

export const SETTINGS_STORAGE_KEY = 'nightlight-settings'
export const SETTINGS_SCHEMA_VERSION = 3 as const

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

type UnknownRecord = Record<string, unknown>

type StoredSettingsV3 = {
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
// The okay-to-get-up time is the one parents set; the sunrise ramp starts one
// wake-up window before it. (v2 stored the ramp start: 06:30 + 30 min, so the
// default green is unchanged.)
export const DEFAULT_OKAY_TIME = '07:00'
export const DEFAULT_BEDTIME = '19:30'

export const createDefaultSchedule = (
  okayTime = DEFAULT_OKAY_TIME,
  bedtime = DEFAULT_BEDTIME
): DaySchedule[] => Array.from({ length: 7 }, () => ({ okayTime, bedtime }))

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

const isTimeBetween = (time: unknown, earliest: number, latest: number): time is string => {
  if (!isValidWakeTime(time)) {
    return false
  }
  const minutes = minutesOfDay(time)
  return minutes >= earliest && minutes <= latest
}

// Okay-to-get-up bounds (04:00–13:00) and bedtime bounds (15:00–23:59), with a
// wake-up window of at most 60 minutes, put every sunrise start at 03:00 or
// later: each night crosses midnight exactly once, which keeps the routine
// engine's day arithmetic simple.
export const OKAY_TIME_EARLIEST = '04:00'
export const OKAY_TIME_LATEST = '13:00'

export const isValidOkayTime = (time: unknown): time is string =>
  isTimeBetween(time, minutesOfDay(OKAY_TIME_EARLIEST), minutesOfDay(OKAY_TIME_LATEST))

// v1/v2 stored the sunrise *start*, bounded to 04:00–12:00, and replaced a
// missing or bad one with a 06:30 sunrise. Only migration reads these.
const isValidLegacyWakeTime = (time: unknown): time is string =>
  isTimeBetween(time, 4 * 60, 12 * 60)
const LEGACY_DEFAULT_WAKE_TIME = '06:30'

// HH:MM plus a few minutes, on the wall clock. Callers keep the result inside
// the same day, so no wrap is needed in practice; wrap anyway for safety.
export const addMinutesToTime = (time: string, minutes: number): string => {
  const total = (((minutesOfDay(time) + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const isValidBedtime = (time: unknown): time is string =>
  isTimeBetween(time, 15 * 60, 23 * 60 + 59)

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

// Which stored shape a payload is in. v3 stores each day's okay-to-get-up
// time; v2 stored each day's sunrise start (`wakeTime`); v1 and the unversioned
// legacy shape stored one top-level sunrise start. An unversioned record with
// a `schedule` array is an in-memory Settings object (serializeSettings
// re-parses its input), so it is read as v3.
type PayloadFormat = 'v3' | 'v2' | 'legacy'

type Payload = { source: UnknownRecord; format: PayloadFormat }

const settingsPayload = (stored: unknown): Payload | null => {
  if (!isRecord(stored)) {
    return null
  }

  if (!('version' in stored)) {
    return { source: stored, format: Array.isArray(stored.schedule) ? 'v3' : 'legacy' }
  }

  if (!isRecord(stored.settings)) {
    return null
  }

  switch (stored.version) {
    case SETTINGS_SCHEMA_VERSION:
      return { source: stored.settings, format: 'v3' }
    case 2:
      return { source: stored.settings, format: 'v2' }
    case 1:
      return { source: stored.settings, format: 'legacy' }
    default:
      // Unknown versioned shapes are not safe to interpret as the current schema.
      return null
  }
}

// A stored sunrise start → the okay-to-get-up time it implied (start + the
// wake-up window), so green lands on exactly the same minute after migration.
// Anything outside the old 04:00–12:00 bounds gets the green v1/v2 showed for
// it: the 06:30 default sunrise + the window.
const migrateWakeTime = (wakeTime: unknown, wakeDuration: number): string =>
  addMinutesToTime(
    normalizeWakeTime(isValidLegacyWakeTime(wakeTime) ? wakeTime : LEGACY_DEFAULT_WAKE_TIME),
    wakeDuration
  )

// v3 and v2 store a 7-day `schedule`; v1/unversioned stored one top-level
// wakeTime, copied to every day. Bad entries fall back individually; a week of
// the wrong length falls back whole.
const parseSchedule = ({ source, format }: Payload, wakeDuration: number): DaySchedule[] => {
  const fallback = createDefaultSchedule()

  if (format === 'legacy') {
    return createDefaultSchedule(migrateWakeTime(source.wakeTime, wakeDuration))
  }

  if (!Array.isArray(source.schedule) || source.schedule.length !== 7) {
    return format === 'v2' ? createDefaultSchedule(migrateWakeTime(undefined, wakeDuration)) : fallback
  }

  return source.schedule.map((entry: unknown, day) => {
    const record = isRecord(entry) ? entry : {}
    const okayTime = format === 'v2'
      ? migrateWakeTime(record.wakeTime, wakeDuration)
      : isValidOkayTime(record.okayTime) ? normalizeWakeTime(record.okayTime) : fallback[day].okayTime
    return {
      okayTime,
      bedtime: isValidBedtime(record.bedtime)
        ? normalizeWakeTime(record.bedtime)
        : fallback[day].bedtime
    }
  })
}

export const parseSettings = (stored: unknown): Settings => {
  const defaults = createDefaultSettings()
  const payload = settingsPayload(stored)

  if (!payload) {
    return defaults
  }

  const { source } = payload

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

  const wakeDuration = Math.round(boundedNumber(source.wakeDuration, defaults.wakeDuration, 1, 60))
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback

  return {
    schedule: parseSchedule(payload, wakeDuration),
    wakeDuration,
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
  const stored: StoredSettingsV3 = {
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
// weekend *okay-to-get-up* rows are Saturday and Sunday mornings, and the weekend
// *bedtime* rows are Friday and Saturday evenings (the nights before them).
export type SchedulePreset = 'same' | 'split' | 'custom'

const WEEKEND_MORNING_DAYS = new Set([0, 6])
const WEEKEND_BEDTIME_DAYS = new Set([5, 6])

export const buildSameSchedule = (day: DaySchedule): DaySchedule[] =>
  createDefaultSchedule(day.okayTime, day.bedtime)

export const buildSplitSchedule = (weekday: DaySchedule, weekend: DaySchedule): DaySchedule[] =>
  Array.from({ length: 7 }, (_, day) => ({
    okayTime: WEEKEND_MORNING_DAYS.has(day) ? weekend.okayTime : weekday.okayTime,
    bedtime: WEEKEND_BEDTIME_DAYS.has(day) ? weekend.bedtime : weekday.bedtime
  }))

// The weekday/weekend pair a schedule implies: Monday's okay time + Monday's
// bedtime for weekdays, Saturday's okay time + Saturday's bedtime for weekends.
export const splitScheduleParts = (schedule: readonly DaySchedule[]): { weekday: DaySchedule; weekend: DaySchedule } => ({
  weekday: { okayTime: schedule[1].okayTime, bedtime: schedule[1].bedtime },
  weekend: { okayTime: schedule[6].okayTime, bedtime: schedule[6].bedtime }
})

const sameSchedule = (a: readonly DaySchedule[], b: readonly DaySchedule[]): boolean =>
  a.every((day, index) => day.okayTime === b[index].okayTime && day.bedtime === b[index].bedtime)

export const detectSchedulePreset = (schedule: readonly DaySchedule[]): SchedulePreset => {
  if (sameSchedule(schedule, buildSameSchedule(schedule[0]))) {
    return 'same'
  }
  const { weekday, weekend } = splitScheduleParts(schedule)
  return sameSchedule(schedule, buildSplitSchedule(weekday, weekend)) ? 'split' : 'custom'
}

export const isValidDaySchedule = (day: unknown): day is DaySchedule =>
  isRecord(day) && isValidOkayTime(day.okayTime) && isValidBedtime(day.bedtime)

// Why a typed schedule time can't be used, or null when it can. Browsers (iOS
// Safari especially) ignore min/max on time inputs, so the editor checks here
// and says so instead of silently keeping the old value.
export const scheduleTimeError = (field: keyof DaySchedule, time: string): string | null => {
  if (field === 'okayTime') {
    return isValidOkayTime(time) ? null : 'Okay to get up needs to be between 4:00 AM and 1:00 PM.'
  }
  return isValidBedtime(time) ? null : 'Bedtime needs to be between 3:00 PM and midnight.'
}
