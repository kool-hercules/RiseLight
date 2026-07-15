import type { StorageLike } from './settings'

export const ACTIVE_SESSION_STORAGE_KEY = 'nightlight-active-session'
export const ACTIVE_SESSION_SCHEMA_VERSION = 1 as const

const MAX_RESTORE_AGE_MS = 24 * 60 * 60 * 1000
const MAX_FUTURE_WAKE_MS = 26 * 60 * 60 * 1000

type ActiveSessionV1 = {
  version: typeof ACTIVE_SESSION_SCHEMA_VERSION
  wakeAt: number
}

const clearInvalidSession = (storage: StorageLike): void => {
  try {
    storage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
  } catch {
    // A blocked storage API is equivalent to having no restorable session.
  }
}

/**
 * Restoration policy: Start stores only the schedule anchor (`wakeAt`) and Stop
 * removes it. A reload resumes only when that anchor is valid and close enough
 * to the current night (within 24 hours past or 26 hours future for DST). Any
 * malformed, unavailable, or stale record safely restores to Off.
 */
export const readActiveSession = (storage: StorageLike | null, now: Date): Date | null => {
  if (!storage) {
    return null
  }

  try {
    const stored = storage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (!stored) {
      return null
    }

    const parsed: unknown = JSON.parse(stored)
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('version' in parsed)
      || parsed.version !== ACTIVE_SESSION_SCHEMA_VERSION
      || !('wakeAt' in parsed)
      || typeof parsed.wakeAt !== 'number'
      || !Number.isFinite(parsed.wakeAt)
    ) {
      clearInvalidSession(storage)
      return null
    }

    const earliestSafeWake = now.getTime() - MAX_RESTORE_AGE_MS
    const latestSafeWake = now.getTime() + MAX_FUTURE_WAKE_MS
    if (parsed.wakeAt < earliestSafeWake || parsed.wakeAt > latestSafeWake) {
      clearInvalidSession(storage)
      return null
    }

    return new Date(parsed.wakeAt)
  } catch {
    return null
  }
}

export const saveActiveSession = (storage: StorageLike | null, wakeTime: Date): boolean => {
  if (!storage || !Number.isFinite(wakeTime.getTime())) {
    return false
  }

  const session: ActiveSessionV1 = {
    version: ACTIVE_SESSION_SCHEMA_VERSION,
    wakeAt: wakeTime.getTime()
  }

  try {
    storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session))
    return true
  } catch {
    return false
  }
}

export const clearActiveSession = (storage: StorageLike | null): boolean => {
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
