import { describe, expect, it, vi } from 'vitest'
import { BAND_COUNT, bandEnergy, measureLevels, silentLevels, smoothLevels } from '../utils/soundLevels'
import { createLevelMeter } from '../composables/useSoundLevels'

const SAMPLE_RATE = 44_100
const BINS = 256 // fftSize 512
const binFor = (hz: number) => Math.floor(hz / (SAMPLE_RATE / (BINS * 2)))

const spectrumWith = (fromHz: number, toHz: number, value = 255) => {
  const frequency = new Uint8Array(BINS)
  for (let i = binFor(fromHz); i <= binFor(toHz); i++) {
    frequency[i] = value
  }
  return frequency
}

describe('measureLevels', () => {
  it('is silent for silence', () => {
    const levels = measureLevels(new Uint8Array(BINS), new Float32Array(512), SAMPLE_RATE)
    expect(levels.rms).toBe(0)
    expect(levels.low).toBe(0)
    expect(levels.high).toBe(0)
    expect(levels.bands).toEqual(new Array(BAND_COUNT).fill(0))
  })

  it('separates a low thump from a high hiss', () => {
    const thump = measureLevels(spectrumWith(30, 250), new Float32Array(512), SAMPLE_RATE)
    const hiss = measureLevels(spectrumWith(2000, 8000), new Float32Array(512), SAMPLE_RATE)
    expect(thump.low).toBeGreaterThan(0.9)
    expect(thump.high).toBe(0)
    expect(hiss.high).toBeGreaterThan(0.9)
    expect(hiss.low).toBe(0)
    expect(hiss.bands[BAND_COUNT - 1]).toBeGreaterThan(hiss.bands[0])
  })

  it('maps waveform loudness to 0..1 and clamps', () => {
    const quiet = new Float32Array(512).fill(0.1)
    const loud = new Float32Array(512).fill(0.9)
    expect(measureLevels(new Uint8Array(BINS), quiet, SAMPLE_RATE).rms).toBeCloseTo(0.3, 5)
    expect(measureLevels(new Uint8Array(BINS), loud, SAMPLE_RATE).rms).toBe(1)
  })

  it('handles empty input without dividing by zero', () => {
    expect(bandEnergy(new Uint8Array(0), SAMPLE_RATE, 0, 100)).toBe(0)
    expect(measureLevels(new Uint8Array(0), new Float32Array(0), SAMPLE_RATE).rms).toBe(0)
  })
})

describe('smoothLevels', () => {
  const loud = { rms: 1, low: 1, high: 1, bands: new Array(BAND_COUNT).fill(1) }

  it('eases toward the target instead of jumping', () => {
    const next = smoothLevels(silentLevels(), loud, 0.05)
    expect(next.rms).toBeGreaterThan(0)
    expect(next.rms).toBeLessThan(0.5)
    expect(next.bands[0]).toBeLessThan(0.5)
  })

  it('lets the low band land on a thump faster than the rest', () => {
    const next = smoothLevels(silentLevels(), loud, 0.05)
    expect(next.low).toBeGreaterThan(next.rms)
    expect(next.low).toBeGreaterThan(0.5)
  })

  it('advances sound time by loudness, and not at all in silence', () => {
    let levels = silentLevels()
    for (let i = 0; i < 100; i++) levels = smoothLevels(levels, silentLevels(), 0.05)
    expect(levels.clock).toBe(0)
    for (let i = 0; i < 100; i++) levels = smoothLevels(levels, loud, 0.05)
    expect(levels.clock).toBeGreaterThan(3)
    expect(levels.clock).toBeLessThan(5)
  })

  it('ignores negative time steps', () => {
    const next = smoothLevels(silentLevels(), loud, -1)
    expect(next).toEqual(silentLevels())
  })
})

describe('createLevelMeter', () => {
  const setup = (reduced = false) => {
    const frames: Array<(time: number) => void> = []
    const deps = {
      requestFrame: vi.fn((callback: (time: number) => void) => { frames.push(callback); return frames.length }),
      cancelFrame: vi.fn(),
      reducedMotion: () => reduced
    }
    const source = {
      readAudio: vi.fn((frequency: Uint8Array, timeDomain: Float32Array) => {
        frequency.fill(200)
        timeDomain.fill(0.2)
        return true
      }),
      sampleRate: () => SAMPLE_RATE
    }
    const meter = createLevelMeter(source, deps)
    const runFrame = (time: number) => frames.shift()?.(time)
    return { meter, deps, source, runFrame }
  }

  it('runs only while subscribed, and reads the audio each frame', () => {
    const { meter, deps, source, runFrame } = setup()
    expect(deps.requestFrame).not.toHaveBeenCalled()

    const release = meter.subscribe()
    runFrame(0)
    runFrame(50)
    expect(source.readAudio).toHaveBeenCalledTimes(2)
    expect(meter.levels.value.rms).toBeGreaterThan(0)

    release()
    expect(deps.cancelFrame).toHaveBeenCalled()
    expect(meter.levels.value).toEqual(silentLevels())
  })

  it('keeps running until the last subscriber leaves, and tolerates double release', () => {
    const { meter, deps } = setup()
    const a = meter.subscribe()
    const b = meter.subscribe()
    expect(deps.requestFrame).toHaveBeenCalledTimes(1)
    a()
    a()
    expect(deps.cancelFrame).not.toHaveBeenCalled()
    b()
    expect(deps.cancelFrame).toHaveBeenCalledTimes(1)
  })

  it('never starts with reduced motion, so the icons hold still', () => {
    const { meter, deps } = setup(true)
    meter.subscribe()
    expect(deps.requestFrame).not.toHaveBeenCalled()
    expect(meter.levels.value).toEqual(silentLevels())
  })

  it('decays to silence when nothing is playing', () => {
    const { meter, source, runFrame } = setup()
    meter.subscribe()
    runFrame(0)
    for (let t = 50; t <= 1000; t += 50) runFrame(t)
    const playing = meter.levels.value.rms
    source.readAudio.mockReturnValue(false)
    for (let t = 1050; t <= 6000; t += 50) runFrame(t)
    expect(playing).toBeGreaterThan(0.3)
    expect(meter.levels.value.rms).toBeLessThan(0.01)
  })
})
