// Browsers only let audio start under user activation, and for touch input
// `pointerdown` does not grant it: activation comes with `pointerup` /
// `touchend` (and `keydown`, or `pointerdown` for a mouse). Listening on all of
// them means one tap unlocks on a tablet as well as with a mouse.
export const AUDIO_UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const

// One tap fires several of those events, so attempts overlap. A failed attempt
// that settles late (resume() is raced against a timeout) must not overwrite
// the success of a later one, so only the newest attempt reports.
export const createAudioUnlocker = (attempt: () => Promise<boolean>) => {
  let latest = 0

  return async (onResult: (unlocked: boolean) => void | Promise<void>): Promise<void> => {
    const token = ++latest
    const unlocked = await attempt()
    if (token === latest) {
      await onResult(unlocked)
    }
  }
}
