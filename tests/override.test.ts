import { describe, expect, it } from 'vitest'
import {
  LEGACY_SESSION_STORAGE_KEY,
  OVERRIDE_STORAGE_KEY,
  readOverride,
  saveOverride
} from '../utils/override'
import { MemoryStorage } from './helpers/memoryStorage'

const now = new Date(2026, 9, 16, 22, 0)

describe('override persistence', () => {
  it('round-trips each override kind', () => {
    const storage = new MemoryStorage()
    for (const override of [
      { kind: 'on' as const, start: 1 },
      { kind: 'nap' as const, start: 2, minutes: 45 },
      { kind: 'off' as const, start: 3, fromPhase: 'bedtime' as const }
    ]) {
      expect(saveOverride(storage, override)).toBe(true)
      expect(JSON.parse(storage.getItem(OVERRIDE_STORAGE_KEY)!).version).toBe(1)
      expect(readOverride(storage, now)).toEqual(override)
    }

    saveOverride(storage, null)
    expect(storage.getItem(OVERRIDE_STORAGE_KEY)).toBeNull()
  })

  it('clears malformed or invalid records', () => {
    for (const raw of [
      '{bad-json',
      JSON.stringify({ version: 2, override: { kind: 'on', start: 1 } }),
      JSON.stringify({ version: 1, override: { kind: 'nap', start: 1, minutes: 5000 } }),
      JSON.stringify({ version: 1, override: { kind: 'off', start: 1, fromPhase: 'disco' } }),
      JSON.stringify({ version: 1, override: { kind: 'on', start: 'soon' } })
    ]) {
      const storage = new MemoryStorage({ [OVERRIDE_STORAGE_KEY]: raw })
      expect(readOverride(storage, now)).toBeNull()
      expect(storage.getItem(OVERRIDE_STORAGE_KEY)).toBeNull()
    }
  })

  it('survives blocked storage', () => {
    expect(readOverride(new MemoryStorage({}, true), now)).toBeNull()
    expect(saveOverride(new MemoryStorage({}, false, true), { kind: 'on', start: 1 })).toBe(false)
    expect(readOverride(null, now)).toBeNull()
  })
})

describe('legacy active-session migration', () => {
  it('turns a valid legacy session into an on override starting now, once', () => {
    const wakeAt = new Date(2026, 9, 17, 6, 30).getTime()
    const storage = new MemoryStorage({
      [LEGACY_SESSION_STORAGE_KEY]: JSON.stringify({ version: 1, wakeAt })
    })

    expect(readOverride(storage, now)).toEqual({ kind: 'on', start: now.getTime() })
    expect(storage.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(storage.getItem(OVERRIDE_STORAGE_KEY)!).override.kind).toBe('on')
  })

  it('drops a stale or malformed legacy session', () => {
    const stale = new MemoryStorage({
      [LEGACY_SESSION_STORAGE_KEY]: JSON.stringify({ version: 1, wakeAt: new Date(2026, 9, 1).getTime() })
    })
    expect(readOverride(stale, now)).toBeNull()
    expect(stale.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull()

    // Old sessions stayed stored past their wake until Stop: don't relight them.
    const pastWake = new MemoryStorage({
      [LEGACY_SESSION_STORAGE_KEY]: JSON.stringify({ version: 1, wakeAt: now.getTime() - 60_000 })
    })
    expect(readOverride(pastWake, now)).toBeNull()
    expect(pastWake.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull()

    const malformed = new MemoryStorage({ [LEGACY_SESSION_STORAGE_KEY]: '{nope' })
    expect(readOverride(malformed, now)).toBeNull()
    expect(malformed.getItem(LEGACY_SESSION_STORAGE_KEY)).toBeNull()
  })
})
