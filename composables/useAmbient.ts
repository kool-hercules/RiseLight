import { readonly, ref, watch } from 'vue'
import type { AmbientSoundId } from '../types'
import { createAmbientPlayer } from '../utils/ambient'
import { useSettings } from './useSettings'

// Stateful, module-singleton wrapper around the ambient engine — mirrors the
// useSettings convention so a home-screen quick control and the settings picker
// share one player and one view of what's playing. It owns the sleep timer and
// keeps the engine's volume in sync with the persisted setting.
//
// Persistence split: `settings.ambientSound` is the last-selected sound (the
// picker highlight, survives reload); `activeSoundId`/`isPlaying` are the live
// runtime state. We never auto-start audio on reload — playback needs a fresh
// user gesture, and auto-sound on a bedside reload would be jarring.

const SLEEP_FADE_SECONDS = 25

const player = createAmbientPlayer()

const activeSoundId = ref<AmbientSoundId | null>(null)
const isPlaying = ref(false)
const sleepTimerEndsAt = ref<number | null>(null)

let sleepHandle: ReturnType<typeof setTimeout> | null = null
let hasInitialized = false

const clearSleepTimer = (): void => {
  if (sleepHandle) {
    clearTimeout(sleepHandle)
    sleepHandle = null
  }
  sleepTimerEndsAt.value = null
}

const fireSleepTimer = (): void => {
  sleepHandle = null
  sleepTimerEndsAt.value = null
  void player.fadeOutAndStop(SLEEP_FADE_SECONDS)
  activeSoundId.value = null
  isPlaying.value = false
  // Keep the persisted selection so the picker still shows the user's choice.
}

const armSleepTimer = (minutes: number): void => {
  clearSleepTimer()
  if (minutes <= 0 || !isPlaying.value || typeof window === 'undefined') {
    return
  }
  const ms = minutes * 60_000
  sleepTimerEndsAt.value = Date.now() + ms
  sleepHandle = setTimeout(fireSleepTimer, ms)
}

export const useAmbient = () => {
  const settings = useSettings()

  if (!hasInitialized && typeof window !== 'undefined') {
    hasInitialized = true

    // Keep the engine's master volume synced to the persisted setting.
    watch(
      () => settings.settings.value.ambientVolume,
      volume => player.setVolume(volume / 100),
      { immediate: true }
    )

    // A reset/import that clears the selection should also stop playback.
    watch(
      () => settings.settings.value.ambientSound,
      sound => {
        if (sound === null && isPlaying.value) {
          void player.stop()
          activeSoundId.value = null
          isPlaying.value = false
          clearSleepTimer()
        }
      }
    )

    // A backgrounded tab throttles setTimeout, so reconcile the sleep timer
    // against the wall clock when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || sleepTimerEndsAt.value === null) {
        return
      }
      const remaining = sleepTimerEndsAt.value - Date.now()
      if (remaining <= 0) {
        fireSleepTimer()
      } else if (sleepHandle) {
        clearTimeout(sleepHandle)
        sleepHandle = setTimeout(fireSleepTimer, remaining)
      }
    })
  }

  // Call inside a user gesture (the Turn On tap) so a later programmatic
  // operation stays unlocked. Applies the current volume.
  const prime = (): void => {
    void player.prime()
    player.setVolume(settings.settings.value.ambientVolume / 100)
  }

  const selectSound = async (id: AmbientSoundId): Promise<void> => {
    settings.updateAmbientSound(id)
    await player.play(id)
    activeSoundId.value = id
    isPlaying.value = player.isPlaying()
    armSleepTimer(settings.settings.value.sleepTimerMinutes)
  }

  // Stop playback but keep the saved selection (used when the light is turned
  // off — the device goes quiet, but the user's sound choice is remembered).
  const stopPlayback = (): void => {
    void player.stop()
    activeSoundId.value = null
    isPlaying.value = false
    clearSleepTimer()
  }

  // Explicitly turn sound off in the picker: stop and forget the selection.
  const stopSound = (): void => {
    stopPlayback()
    settings.updateAmbientSound(null)
  }

  const setVolume = (value: number): void => {
    settings.updateAmbientVolume(value)
    player.setVolume(value / 100)
  }

  const setSleepTimer = (minutes: number): void => {
    settings.updateSleepTimerMinutes(minutes)
    armSleepTimer(minutes)
  }

  return {
    activeSoundId: readonly(activeSoundId),
    isPlaying: readonly(isPlaying),
    sleepTimerEndsAt: readonly(sleepTimerEndsAt),
    prime,
    selectSound,
    stopSound,
    stopPlayback,
    setVolume,
    setSleepTimer
  }
}
