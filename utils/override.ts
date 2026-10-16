import type { LightState } from '../types'
import type { Override } from './routine'
import type { StorageLike } from './settings'
import { isValidNapMinutes } from './settings'

export const OVERRIDE_STORAGE_KEY = 'riselight-override'
export const OVERRIDE_SCHEMA_VERSION = 1 as const

// The pre-routine "Turn On" session. A valid one is migrated once into an `on`
// override so a light that was on before the update stays on after it.
export const LEGACY_SESSION_STORAGE_KEY = 'nightlight-active-session'
const LEGACY_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LEGACY_MAX_FUTURE_MS = 26 * 60 * 60 * 1000

type StoredOverrideV1 = {
  version: typeof OVERRIDE_SCHEMA_VERSION
  override: Override
}

const LIGHT_STATES: readonly LightState[] = ['inactive', 'bedtime', 'night', 'wake', 'awake']

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const parseOverride = (value: unknown): Override | null => {
  if (!isRecord(value) || !isFiniteNumber(value.start)) {
    return null
  }

  switch (value.kind) {
    case 'on':
      return { kind: 'on', start: value.start }
    case 'nap':
      return isValidNapMinutes(value.minutes)
        ? { kind: 'nap', start: value.start, minutes: value.minutes }
        : null
    case 'off':
      return LIGHT_STATES.includes(value.fromPhase as LightState)
        ? { kind: 'off', start: value.start, fromPhase: value.fromPhase as LightState }
        : null
    default:
      return null
  }
}

const removeQuietly = (storage: StorageLike, key: string): void => {
  try {
    storage.removeItem(key)
  } catch {
    // A blocked storage API is equivalent to having nothing stored.
  }
}

export const saveOverride = (storage: StorageLike | null, override: Override | null): boolean => {
  if (!storage) {
    return false
  }

  try {
    if (override === null) {
      storage.removeItem(OVERRIDE_STORAGE_KEY)
    } else {
      const stored: StoredOverrideV1 = { version: OVERRIDE_SCHEMA_VERSION, override }
      storage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(stored))
    }
    return true
  } catch {
    return false
  }
}

// One-time: a still-relevant legacy session becomes `{kind: 'on', start: now}`
// (the routine engine re-derives the rest). The legacy key is always removed.
const migrateLegacySession = (storage: StorageLike, now: Date): Override | null => {
  let raw: string | null = null
  try {
    raw = storage.getItem(LEGACY_SESSION_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) {
    return null
  }

  removeQuietly(storage, LEGACY_SESSION_STORAGE_KEY)

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isFiniteNumber(parsed.wakeAt)) {
      return null
    }
    const nowMs = now.getTime()
    if (parsed.wakeAt < nowMs - LEGACY_MAX_AGE_MS || parsed.wakeAt > nowMs + LEGACY_MAX_FUTURE_MS) {
      return null
    }
  } catch {
    return null
  }

  const override: Override = { kind: 'on', start: now.getTime() }
  saveOverride(storage, override)
  return override
}

/**
 * Read the persisted override. Malformed records are cleared and read as none.
 * Whether it is still *active* is the routine engine's call (its end is derived
 * from current settings), so expiry is not checked here.
 */
export const readOverride = (storage: StorageLike | null, now: Date): Override | null => {
  if (!storage) {
    return null
  }

  const legacy = migrateLegacySession(storage, now)
  if (legacy) {
    return legacy
  }

  try {
    const raw = storage.getItem(OVERRIDE_STORAGE_KEY)
    if (raw === null) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    const override = isRecord(parsed) && parsed.version === OVERRIDE_SCHEMA_VERSION
      ? parseOverride(parsed.override)
      : null
    if (!override) {
      removeQuietly(storage, OVERRIDE_STORAGE_KEY)
    }
    return override
  } catch (error) {
    console.warn('RiseLight: unable to restore override; following the schedule.', error)
    removeQuietly(storage, OVERRIDE_STORAGE_KEY)
    return null
  }
}
