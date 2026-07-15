import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createNightLightRuntime } from '../composables/useNightLight'
import {
  ACTIVE_SESSION_STORAGE_KEY,
  readActiveSession,
  saveActiveSession
} from '../utils/session'
import { createDefaultSettings } from '../utils/settings'
import { MemoryStorage } from './helpers/memoryStorage'

const localDate = (day: number, hours: number, minutes: number): Date => {
  return new Date(2026, 0, day, hours, minutes)
}

describe('active-session restoration', () => {
  it('stores only the schema version and wake anchor', () => {
    const storage = new MemoryStorage()
    const wakeTime = localDate(16, 6, 30)

    expect(saveActiveSession(storage, wakeTime)).toBe(true)
    expect(JSON.parse(storage.getItem(ACTIVE_SESSION_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      wakeAt: wakeTime.getTime()
    })
  })

  it('restores the current mode from current settings instead of stored derived state', () => {
    const storage = new MemoryStorage()
    const wakeTime = localDate(16, 6, 30)
    saveActiveSession(storage, wakeTime)
    const settings = ref(createDefaultSettings())
    settings.value.wakeDuration = 45
    const runtime = createNightLightRuntime(settings, {
      now: () => localDate(16, 6, 45),
      storage
    })

    expect(runtime.restoreSession()).toBe(true)
    expect(runtime.currentState.value).toBe('wake')
    expect(runtime.timeRemaining.value).toBe(30 * 60 * 1000)
    runtime.dispose()
  })

  it('falls back to off and clears malformed or stale session records', () => {
    const malformed = new MemoryStorage({ [ACTIVE_SESSION_STORAGE_KEY]: '{bad-json' })
    const stale = new MemoryStorage()
    saveActiveSession(stale, localDate(10, 6, 30))
    const now = localDate(16, 5, 0)

    expect(readActiveSession(malformed, now)).toBeNull()
    expect(readActiveSession(stale, now)).toBeNull()
    expect(stale.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
  })
})
