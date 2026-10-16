import { onBeforeUnmount, type Ref } from 'vue'
import { createChimePlayer } from '../utils/chime'

// Thin Vue wrapper around the chime engine. Priming is always allowed (it must
// run inside a user gesture regardless of the current toggle, so enabling the
// chime mid-session still works), but the chime only sounds when enabled.
// Both resolve false when audio is blocked pending a tap.
export const useChime = (enabled: Readonly<Ref<boolean>>) => {
  const player = createChimePlayer()

  // Call inside a tap so the AudioContext unlocks under a real gesture.
  const prime = (): Promise<boolean> => player.prime()

  const play = async (): Promise<boolean> => {
    if (!enabled.value) {
      return true
    }
    return player.play()
  }

  onBeforeUnmount(() => {
    void player.dispose()
  })

  return { prime, play, isPrimed: player.isPrimed }
}
