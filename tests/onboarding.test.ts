import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_STORAGE_KEY,
  readOnboardingComplete,
  writeOnboardingComplete
} from '../utils/onboarding'
import { MemoryStorage } from './helpers/memoryStorage'

describe('onboarding persistence', () => {
  it('starts incomplete and marks complete when finished or skipped', () => {
    const storage = new MemoryStorage()

    expect(readOnboardingComplete(storage)).toBe(false)
    expect(writeOnboardingComplete(storage, true)).toBe(true)
    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBe('1')
    expect(readOnboardingComplete(storage)).toBe(true)
  })

  it('can be reset so the intro replays', () => {
    const storage = new MemoryStorage({ [ONBOARDING_STORAGE_KEY]: '1' })

    expect(readOnboardingComplete(storage)).toBe(true)
    expect(writeOnboardingComplete(storage, false)).toBe(true)
    expect(readOnboardingComplete(storage)).toBe(false)
  })

  it('degrades safely with no storage or when storage is blocked', () => {
    const blocked = new MemoryStorage({}, true, true)

    expect(readOnboardingComplete(null)).toBe(false)
    expect(writeOnboardingComplete(null, true)).toBe(false)
    expect(readOnboardingComplete(blocked)).toBe(false)
    expect(writeOnboardingComplete(blocked, true)).toBe(false)
  })
})
