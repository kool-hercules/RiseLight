import { readonly, ref } from 'vue'
import { getBrowserStorage } from '../utils/settings'
import { readOnboardingComplete, writeOnboardingComplete } from '../utils/onboarding'

// Module singleton, mirroring useSettings: the intro shows once on first run,
// is dismissed for good when finished or skipped, and can be replayed on demand
// from settings.
const showOnboarding = ref(false)
let hasInitialized = false

const initialize = (): void => {
  if (hasInitialized || typeof window === 'undefined') {
    return
  }

  showOnboarding.value = !readOnboardingComplete(getBrowserStorage())
  hasInitialized = true
}

const completeOnboarding = (): void => {
  showOnboarding.value = false
  writeOnboardingComplete(getBrowserStorage(), true)
}

const restartOnboarding = (): void => {
  writeOnboardingComplete(getBrowserStorage(), false)
  showOnboarding.value = true
}

export const useOnboarding = () => {
  initialize()

  return {
    showOnboarding: readonly(showOnboarding),
    completeOnboarding,
    restartOnboarding
  }
}
