import { getCurrentScope, onScopeDispose, shallowReadonly, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'
import { ANALYSER_FFT_SIZE } from '../utils/ambient'
import type { SoundLevels } from '../utils/soundLevels'
import { measureLevels, silentLevels, smoothLevels } from '../utils/soundLevels'
import { useAmbient } from './useAmbient'

// Live, smoothed levels of whatever ambient sound is playing, for the sound
// icons. One shared meter: it runs a frame loop only while at least one visible
// icon wants it, never on the kid screen, and never with reduced motion (the
// icons then hold still).

export interface LevelSource {
  readAudio: (frequency: Uint8Array, timeDomain: Float32Array) => boolean
  sampleRate: () => number
}

export interface MeterDeps {
  requestFrame: (callback: (time: number) => void) => number
  cancelFrame: (handle: number) => void
  reducedMotion: () => boolean
}

export interface LevelMeter {
  levels: Readonly<Ref<SoundLevels>>
  subscribe: () => () => void
}

const browserDeps = (): MeterDeps => ({
  requestFrame: callback => window.requestAnimationFrame(callback),
  cancelFrame: handle => window.cancelAnimationFrame(handle),
  reducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
})

export const createLevelMeter = (source: LevelSource, deps: MeterDeps): LevelMeter => {
  const levels = shallowRef<SoundLevels>(silentLevels())
  const frequency = new Uint8Array(ANALYSER_FFT_SIZE / 2)
  const timeDomain = new Float32Array(ANALYSER_FFT_SIZE)
  let subscribers = 0
  let handle: number | null = null
  let lastTime: number | null = null

  const frame = (time: number): void => {
    const dt = lastTime === null ? 0 : Math.min(0.1, (time - lastTime) / 1000)
    lastTime = time
    const target = source.readAudio(frequency, timeDomain)
      ? measureLevels(frequency, timeDomain, source.sampleRate())
      : silentLevels()
    levels.value = smoothLevels(levels.value, target, dt)
    handle = deps.requestFrame(frame)
  }

  const start = (): void => {
    if (handle === null && !deps.reducedMotion()) {
      lastTime = null
      handle = deps.requestFrame(frame)
    }
  }

  const stop = (): void => {
    if (handle !== null) {
      deps.cancelFrame(handle)
      handle = null
    }
    levels.value = silentLevels()
  }

  const subscribe = (): (() => void) => {
    subscribers++
    start()
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      subscribers--
      if (subscribers === 0) {
        stop()
      }
    }
  }

  return { levels: shallowReadonly(levels), subscribe }
}

let sharedMeter: LevelMeter | null = null

// `active`: whether the calling component currently shows a reacting icon
// (e.g. settings open and a sound playing). The meter runs only while some
// caller is active.
export const useSoundLevels = (active: Ref<boolean>): Readonly<Ref<SoundLevels>> => {
  if (typeof window === 'undefined') {
    return shallowReadonly(shallowRef(silentLevels()))
  }
  if (!sharedMeter) {
    const ambient = useAmbient()
    sharedMeter = createLevelMeter(
      { readAudio: ambient.readAudio, sampleRate: ambient.sampleRate },
      browserDeps()
    )
  }
  const meter = sharedMeter
  let release: (() => void) | null = null

  watch(
    active,
    isActive => {
      if (isActive && !release) {
        release = meter.subscribe()
      } else if (!isActive && release) {
        release()
        release = null
      }
    },
    { immediate: true }
  )

  if (getCurrentScope()) {
    onScopeDispose(() => release?.())
  }

  return meter.levels
}
