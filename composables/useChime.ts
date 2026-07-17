import { onBeforeUnmount, type Ref } from 'vue'
import { createChimePlayer } from '../utils/chime'

// Thin Vue wrapper around the chime engine. Priming is always allowed (it must
// run inside the Turn On gesture regardless of the current toggle, so enabling
// the chime mid-session still works), but the chime only sounds when enabled.
export const useChime = (enabled: Readonly<Ref<boolean>>) => {
  const player = createChimePlayer()

  // Call inside the Turn On tap so the AudioContext unlocks under a real gesture.
  const prime = (): void => {
    void player.prime()
  }

  const play = (): void => {
    if (enabled.value) {
      void player.play()
    }
  }

  onBeforeUnmount(() => {
    void player.dispose()
  })

  return { prime, play, isPrimed: player.isPrimed }
}
