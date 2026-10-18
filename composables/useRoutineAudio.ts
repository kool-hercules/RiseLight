import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { AmbientSoundId, LightState, Settings } from '../types'
import { isSleepPhase } from '../utils/modes'
import { AUDIO_UNLOCK_EVENTS, createAudioUnlocker } from '../utils/audioUnlock'

// The players are injected (the page passes the real useChime/useAmbient) so
// tests can drive the routine's sound logic with fakes.
export interface RoutineChime {
  prime: () => Promise<boolean>
  play: () => Promise<boolean>
}

export interface RoutineAmbient {
  prime: () => Promise<boolean>
  selectSound: (id: AmbientSoundId) => Promise<boolean>
  stopPlayback: () => void
  isPlaying: Readonly<Ref<boolean>>
}

// Everything the routine does with sound: auto-start at story time or
// lights-out, stop at morning or "off for now", the "okay to get up" chime, and
// the one-tap unlock for browsers that block audio until a gesture.
export const useRoutineAudio = (options: {
  currentState: Readonly<Ref<LightState>>
  settings: Readonly<Ref<Settings>>
  isArmed: Readonly<Ref<boolean>>
  chime: RoutineChime
  ambient: RoutineAmbient
}) => {
  const { currentState, settings, isArmed, chime, ambient } = options

  // Browsers only let audio start under a user gesture. The routine now runs by
  // itself (no nightly tap), so when a scheduled sound or chime is blocked we
  // raise one flag; the kid screen shows a tiny dim speaker badge and the next
  // tap anywhere unlocks both players and retries the pending sound.
  const needsAudioUnlock = ref(false)
  let pendingSound: AmbientSoundId | null = null

  const startAmbient = async (id: AmbientSoundId): Promise<void> => {
    if (!(await ambient.selectSound(id))) {
      pendingSound = id
      needsAudioUnlock.value = true
    }
  }

  const autoStartAmbient = (): void => {
    const saved = settings.value.ambientSound
    if (settings.value.ambientAutoStart && saved) {
      void startAmbient(saved)
    }
  }

  const primeChime = (): void => {
    void chime.prime().then(ok => {
      if (!ok) {
        needsAudioUnlock.value = true
      }
    })
  }

  // Must run synchronously inside the gesture: both prime() calls start before
  // any await.
  const primeAudio = async (): Promise<boolean> => {
    const [chimeOk, ambientOk] = await Promise.all([chime.prime(), ambient.prime()])
    return chimeOk && ambientOk
  }

  const unlocker = createAudioUnlocker(primeAudio)

  const unlockAudio = async (): Promise<void> => {
    if (!needsAudioUnlock.value) {
      return
    }
    await unlocker(async unlocked => {
      const retry = pendingSound
      pendingSound = null
      if (retry && isSleepPhase(currentState.value)) {
        await startAmbient(retry)
      }
      needsAudioUnlock.value = !unlocked || pendingSound !== null
    })
  }

  // Story time (or lights-out with no wind-down, a manual start, or a nap)
  // starts the saved sound; morning and "off for now" stop it.
  watch(currentState, (state, previous) => {
    if (
      (state === 'bedtime' && previous !== 'bedtime')
      || (state === 'night' && !isSleepPhase(previous))
    ) {
      autoStartAmbient()
    }

    if (state === 'awake' || (state === 'inactive' && previous !== 'awake')) {
      pendingSound = null
      if (ambient.isPlaying.value) {
        ambient.stopPlayback()
      }
    }

    // Sound the chime only when the routine crosses into "okay to get up" from
    // an earlier lit phase. Reloads into an already-green morning don't chime.
    if (state === 'awake' && (previous === 'night' || previous === 'wake')) {
      void chime.play().then(played => {
        if (!played) {
          needsAudioUnlock.value = true
        }
      })
    }
  })

  // Turning the chime on is a tap, so try to unlock right away.
  watch(() => settings.value.chimeEnabled, enabled => {
    if (enabled) {
      primeChime()
    }
  })

  const handleUnlockGesture = (): void => {
    void unlockAudio()
  }

  onMounted(() => {
    for (const type of AUDIO_UNLOCK_EVENTS) {
      document.addEventListener(type, handleUnlockGesture, true)
    }

    // A reload mid-routine: try to resume the bedtime sound and pre-unlock the
    // chime. Without a gesture these usually come back blocked, which raises the
    // unlock badge so one tap restores both.
    if (isSleepPhase(currentState.value)) {
      autoStartAmbient()
    }
    if (settings.value.chimeEnabled && isArmed.value) {
      primeChime()
    }
  })

  onBeforeUnmount(() => {
    for (const type of AUDIO_UNLOCK_EVENTS) {
      document.removeEventListener(type, handleUnlockGesture, true)
    }
  })

  return { needsAudioUnlock, startAmbient, primeAudio }
}
