// A gentle "okay to get up" chime, synthesized with the Web Audio API so it
// ships no audio asset. The hard part is not the sound — it is that the chime
// must fire at an *autonomous* schedule transition (the light decides, minutes
// or hours later), while browsers, especially iOS Safari, only allow audio that
// was unlocked inside a real user gesture. So we split the work in two:
//
//   prime()  — called synchronously inside the Turn On tap. Creates and resumes
//              the AudioContext and plays an inaudible blip, which is what iOS
//              actually requires to keep the context playable afterwards.
//   play()   — called later at the night/wake → awake transition. Reuses the
//              already-unlocked context. If anything is blocked it no-ops.
//
// Everything degrades to a silent no-op when Web Audio is missing, the context
// can't be created, or autoplay is still blocked — a night light must never
// throw because a sound didn't play.

type MinimalAudioContext = Pick<
  AudioContext,
  'state' | 'currentTime' | 'destination' | 'resume' | 'createOscillator' | 'createGain' | 'close'
>

export type AudioContextFactory = () => MinimalAudioContext | null

export const defaultAudioContextFactory: AudioContextFactory = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    return null
  }

  try {
    return new Ctor()
  } catch {
    return null
  }
}

export interface ChimePlayer {
  prime: () => Promise<void>
  play: () => Promise<void>
  isPrimed: () => boolean
  dispose: () => Promise<void>
}

// A soft ascending major triad (C5–E5–G5). Sine tones with a quick attack and a
// gentle exponential decay read as calm and bell-like rather than alarming.
const CHIME_NOTES = [523.25, 659.25, 783.99]
const NOTE_SPACING = 0.18
const NOTE_LENGTH = 0.9
const PEAK_GAIN = 0.14

const scheduleTone = (
  context: MinimalAudioContext,
  frequency: number,
  startAt: number,
  peakGain: number
): void => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)

  // Envelope: silent → quick attack → exponential decay to near-silence.
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + NOTE_LENGTH)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + NOTE_LENGTH)
}

export const createChimePlayer = (
  factory: AudioContextFactory = defaultAudioContextFactory
): ChimePlayer => {
  let context: MinimalAudioContext | null = null
  let primed = false

  const ensureContext = (): MinimalAudioContext | null => {
    if (context) {
      return context
    }

    try {
      context = factory()
    } catch {
      context = null
    }

    return context
  }

  const resumeIfNeeded = async (ctx: MinimalAudioContext): Promise<void> => {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // Autoplay still blocked — leave the context as-is; play() will bail.
      }
    }
  }

  const prime = async (): Promise<void> => {
    const ctx = ensureContext()
    if (!ctx) {
      return
    }

    await resumeIfNeeded(ctx)

    // An inaudible blip inside the gesture is what keeps iOS audio unlocked.
    try {
      scheduleTone(ctx, 1, ctx.currentTime, 0.0001)
      primed = true
    } catch {
      // Scheduling failed — not primed, but never surface an error.
    }
  }

  const play = async (): Promise<void> => {
    const ctx = ensureContext()
    if (!ctx) {
      return
    }

    await resumeIfNeeded(ctx)
    if (ctx.state !== 'running') {
      return
    }

    try {
      CHIME_NOTES.forEach((frequency, index) => {
        scheduleTone(ctx, frequency, ctx.currentTime + index * NOTE_SPACING, PEAK_GAIN)
      })
    } catch {
      // Never let a failed chime break the light.
    }
  }

  const dispose = async (): Promise<void> => {
    const ctx = context
    context = null
    primed = false
    if (ctx) {
      try {
        await ctx.close()
      } catch {
        // Already closed.
      }
    }
  }

  return {
    prime,
    play,
    isPrimed: () => primed,
    dispose
  }
}
