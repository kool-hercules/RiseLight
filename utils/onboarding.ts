import type { StorageLike } from './settings'

export const ONBOARDING_STORAGE_KEY = 'riselight-onboarded'

// A tiny boolean flag: has the user seen the first-run intro? Kept separate
// from settings so clearing/exporting settings never disturbs it, and behind a
// StorageLike so it can be exercised without a real browser.
export const readOnboardingComplete = (storage: StorageLike | null): boolean => {
  if (!storage) {
    return false
  }

  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const writeOnboardingComplete = (storage: StorageLike | null, complete: boolean): boolean => {
  if (!storage) {
    return false
  }

  try {
    if (complete) {
      storage.setItem(ONBOARDING_STORAGE_KEY, '1')
    } else {
      storage.removeItem(ONBOARDING_STORAGE_KEY)
    }
    return true
  } catch {
    return false
  }
}
