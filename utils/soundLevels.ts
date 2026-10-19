// Turns the ambient engine's live audio into a few calm numbers the sound
// icons move with: how loud it is overall, how much low thump (heartbeat,
// ocean swell), how much high hiss (rain), and a five-band spectrum (noise).
// Pure functions, no Web Audio, so they are unit-tested directly.

export const BAND_COUNT = 5

export interface SoundLevels {
  rms: number // 0..1 overall loudness
  low: number // 0..1 energy below ~250 Hz
  high: number // 0..1 energy from ~2 to ~8 kHz
  bands: readonly number[] // BAND_COUNT values, 0..1, low to high
  // Seconds of "sound time": advances by dt x loudness, so motion driven by it
  // (fan spin, wave drift, falling drops) slows with the sound and stops in
  // silence instead of looping on its own.
  clock: number
}

export const silentLevels = (): SoundLevels => ({
  rms: 0,
  low: 0,
  high: 0,
  bands: new Array(BAND_COUNT).fill(0),
  clock: 0
})

const BAND_EDGES_HZ = [60, 150, 400, 1000, 2500, 6000]

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

// Mean of byte-spectrum bins covering [fromHz, toHz), normalised to 0..1.
export const bandEnergy = (
  frequency: ArrayLike<number>,
  sampleRate: number,
  fromHz: number,
  toHz: number
): number => {
  if (frequency.length === 0 || sampleRate <= 0) {
    return 0
  }
  const binHz = sampleRate / (frequency.length * 2)
  const start = Math.max(0, Math.floor(fromHz / binHz))
  const end = Math.min(frequency.length, Math.max(start + 1, Math.ceil(toHz / binHz)))
  let sum = 0
  for (let i = start; i < end; i++) {
    sum += frequency[i]
  }
  return clamp01(sum / (end - start) / 255)
}

// One instant's raw levels, before smoothing.
export const measureLevels = (
  frequency: ArrayLike<number>,
  timeDomain: ArrayLike<number>,
  sampleRate: number
): Omit<SoundLevels, 'clock'> => {
  let sumSquares = 0
  for (let i = 0; i < timeDomain.length; i++) {
    sumSquares += timeDomain[i] * timeDomain[i]
  }
  const rms = timeDomain.length ? Math.sqrt(sumSquares / timeDomain.length) : 0

  return {
    // Ambient sound sits well below full scale; x3 maps a typical level to ~0.5-0.8.
    rms: clamp01(rms * 3),
    low: bandEnergy(frequency, sampleRate, 30, 250),
    high: bandEnergy(frequency, sampleRate, 2000, 8000),
    bands: BAND_EDGES_HZ.slice(0, -1).map((from, i) => bandEnergy(frequency, sampleRate, from, BAND_EDGES_HZ[i + 1]))
  }
}

// Exponential smoothing with separate rise and fall times. The low band rises
// fast so a heartbeat icon lands on the thump; everything else eases slowly so
// nothing flickers.
const RISE_SECONDS = { rms: 0.4, low: 0.05, high: 0.3, bands: 0.5 }
const FALL_SECONDS = { rms: 0.6, low: 0.25, high: 0.5, bands: 0.8 }

const ease = (previous: number, target: number, dt: number, rise: number, fall: number): number => {
  const tau = target > previous ? rise : fall
  const k = 1 - Math.exp(-Math.max(0, dt) / tau)
  return previous + (target - previous) * k
}

export const smoothLevels = (
  previous: SoundLevels,
  target: Omit<SoundLevels, 'clock'>,
  dt: number
): SoundLevels => {
  const rms = ease(previous.rms, target.rms, dt, RISE_SECONDS.rms, FALL_SECONDS.rms)
  return {
    rms,
    low: ease(previous.low, target.low, dt, RISE_SECONDS.low, FALL_SECONDS.low),
    high: ease(previous.high, target.high, dt, RISE_SECONDS.high, FALL_SECONDS.high),
    bands: previous.bands.map((band, i) =>
      ease(band, target.bands[i] ?? 0, dt, RISE_SECONDS.bands, FALL_SECONDS.bands)
    ),
    clock: previous.clock + Math.max(0, dt) * rms
  }
}
