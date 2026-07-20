// The ambient sound engine: white/pink/brown noise plus rain, ocean, fan, wind
// and a soft heartbeat. Like the chime (utils/chime.ts) the noise family and the
// nature approximations are *synthesized* with the Web Audio API, so they ship no
// audio asset, loop forever without a seam, and work fully offline. Optional CC0
// recordings can be layered in later per sound (see `assetUrl` in SOUND_DEFS): a
// recording is preferred when present and reachable, otherwise the synthesized
// approximation always plays, so a sound is never silent.
//
// The graph is always:  source subgraph → masterGain → destination
// One persistent masterGain owns the user's volume and survives sound switches.
//
// iOS autoplay: playback always *starts* from a user tap (picking a sound), so
// the unlock is the easy case. We still reuse the chime's prime() idea so a later
// programmatic operation (the sleep-timer fade, a resume after backgrounding)
// stays unlocked. Everything degrades to a silent no-op when Web Audio is
// missing or blocked — a bedside app must never throw because a sound failed.

import type { AmbientSoundId } from '../types'

// A wider view of AudioContext than the chime needs. Kept local so the chime's
// narrow type (and its test fake) stay untouched.
export type AmbientAudioContext = Pick<
  AudioContext,
  | 'state'
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'resume'
  | 'close'
  | 'createGain'
  | 'createBufferSource'
  | 'createBuffer'
  | 'createBiquadFilter'
  | 'createOscillator'
  | 'decodeAudioData'
>

export type AmbientContextFactory = () => AmbientAudioContext | null

export const defaultAmbientContextFactory: AmbientContextFactory = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    return null
  }

  try {
    return new Ctor() as AmbientAudioContext
  } catch {
    return null
  }
}

export interface AmbientPlayer {
  prime: () => Promise<void>
  play: (id: AmbientSoundId) => Promise<void>
  stop: () => Promise<void>
  setVolume: (volume: number) => void
  fadeOutAndStop: (seconds: number) => Promise<void>
  isPlaying: () => boolean
  currentId: () => AmbientSoundId | null
  dispose: () => Promise<void>
}

export interface AmbientDeps {
  factory?: AmbientContextFactory
  // Fetch a recording's bytes. Injectable so the recording path is testable.
  loadArrayBuffer?: (url: string) => Promise<ArrayBuffer>
  // Resolve a sound to its recording URL, or undefined for synth-only.
  assetUrlFor?: (id: AmbientSoundId) => string | undefined
}

// ─── UI catalog ──────────────────────────────────────────────────────────────
// Metadata for the sound picker. `icon` maps to SoundIcon.vue glyphs.

export type SoundIconName = 'noise' | 'rain' | 'ocean' | 'fan' | 'wind' | 'heart'

export interface AmbientSoundMeta {
  id: AmbientSoundId
  label: string
  icon: SoundIconName
}

export const AMBIENT_SOUNDS: readonly AmbientSoundMeta[] = [
  { id: 'white', label: 'White noise', icon: 'noise' },
  { id: 'pink', label: 'Pink noise', icon: 'noise' },
  { id: 'brown', label: 'Brown noise', icon: 'noise' },
  { id: 'rain', label: 'Rain', icon: 'rain' },
  { id: 'ocean', label: 'Ocean', icon: 'ocean' },
  { id: 'fan', label: 'Fan', icon: 'fan' },
  { id: 'wind', label: 'Wind', icon: 'wind' },
  { id: 'heartbeat', label: 'Heartbeat', icon: 'heart' }
]

// ─── Noise generation (pure, unit-tested directly) ─────────────────────────────

// Center to remove any DC offset, then scale so the loudest sample sits at ~0.9.
// DC removal is what lets a finite noise buffer loop with no click at the seam.
const finalize = (data: Float32Array): Float32Array => {
  const length = data.length
  if (length === 0) {
    return data
  }

  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += data[i]
  }
  const mean = sum / length

  let peak = 0
  for (let i = 0; i < length; i++) {
    data[i] -= mean
    const magnitude = Math.abs(data[i])
    if (magnitude > peak) {
      peak = magnitude
    }
  }

  if (peak > 0) {
    const scale = 0.9 / peak
    for (let i = 0; i < length; i++) {
      data[i] *= scale
    }
  }

  return data
}

export const generateWhite = (length: number): Float32Array => {
  const data = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return finalize(data)
}

// Paul Kellet's economy pink-noise filter: a good 1/f spectrum for a few adds.
export const generatePink = (length: number): Float32Array => {
  const data = new Float32Array(length)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
    b6 = white * 0.115926
  }
  return finalize(data)
}

// Brown (red) noise: integrated white, gently leaked so it can't wander off.
export const generateBrown = (length: number): Float32Array => {
  const data = new Float32Array(length)
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return finalize(data)
}

// A looping heartbeat: a "lub-dub" of two low sine thumps per ~1.05s beat, baked
// into a buffer so it needs no JS timer and stays in the unified graph.
const generateHeartbeat = (length: number, sampleRate: number): Float32Array => {
  const data = new Float32Array(length)
  const thump = (startSec: number, freq: number, amp: number): void => {
    const start = Math.floor(startSec * sampleRate)
    const durationSamples = Math.floor(0.18 * sampleRate)
    for (let i = 0; i < durationSamples && start + i < length; i++) {
      const t = i / sampleRate
      const envelope = Math.exp(-t * 22)
      data[start + i] += Math.sin(2 * Math.PI * freq * t) * amp * envelope
    }
  }
  // One beat per buffer (buffer length defines the tempo when looped).
  thump(0.0, 58, 0.9) // lub
  thump(0.17, 46, 0.6) // dub
  return data
}

type NoiseKind = 'white' | 'pink' | 'brown'

const generateNoise = (kind: NoiseKind, length: number): Float32Array => {
  switch (kind) {
    case 'white':
      return generateWhite(length)
    case 'pink':
      return generatePink(length)
    case 'brown':
      return generateBrown(length)
  }
}

// ─── Voice building ────────────────────────────────────────────────────────────

// An active sound: its own local gain (for declick / fade), the scheduled source
// nodes (buffer sources + any LFO oscillators), and the base gain we ramp from.
interface Voice {
  gain: GainNode
  sources: Array<AudioBufferSourceNode | OscillatorNode>
  baseGain: number
}

interface FilterConfig {
  type: BiquadFilterType
  frequency: number
  Q?: number
}

interface LfoConfig {
  target: 'gain' | 'frequency'
  rate: number // Hz
  depth: number
}

const NOISE_SECONDS = 6
const HEARTBEAT_SECONDS = 1.05

export const createAmbientPlayer = (deps: AmbientDeps = {}): AmbientPlayer => {
  const factory = deps.factory ?? defaultAmbientContextFactory
  const loadArrayBuffer = deps.loadArrayBuffer
    ?? (async (url: string) => {
      const response = await fetch(url)
      return response.arrayBuffer()
    })
  const assetUrlFor = deps.assetUrlFor ?? (() => undefined)

  let context: AmbientAudioContext | null = null
  let masterGain: GainNode | null = null
  let current: { id: AmbientSoundId; voice: Voice } | null = null
  let volume = 1
  let playToken = 0

  const noiseBuffers = new Map<NoiseKind, AudioBuffer>()
  const decodedBuffers = new Map<string, AudioBuffer>()

  const ensureContext = (): AmbientAudioContext | null => {
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

  const ensureMaster = (ctx: AmbientAudioContext): GainNode => {
    if (masterGain) {
      return masterGain
    }
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.connect(ctx.destination)
    masterGain = gain
    return gain
  }

  const resumeIfNeeded = async (ctx: AmbientAudioContext): Promise<void> => {
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // Autoplay still blocked — callers check state before scheduling.
      }
    }
  }

  const noiseBuffer = (ctx: AmbientAudioContext, kind: NoiseKind): AudioBuffer => {
    const cached = noiseBuffers.get(kind)
    if (cached) {
      return cached
    }
    const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    buffer.getChannelData(0).set(generateNoise(kind, length))
    noiseBuffers.set(kind, buffer)
    return buffer
  }

  const startBufferVoice = (
    ctx: AmbientAudioContext,
    master: GainNode,
    buffer: AudioBuffer,
    baseGain: number,
    filter?: FilterConfig,
    lfo?: LfoConfig
  ): Voice => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(baseGain, ctx.currentTime)

    const sources: Array<AudioBufferSourceNode | OscillatorNode> = [source]

    if (filter) {
      const node = ctx.createBiquadFilter()
      node.type = filter.type
      node.frequency.setValueAtTime(filter.frequency, ctx.currentTime)
      if (typeof filter.Q === 'number') {
        node.Q.setValueAtTime(filter.Q, ctx.currentTime)
      }
      source.connect(node)
      node.connect(gain)

      if (lfo) {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(lfo.rate, ctx.currentTime)
        const lfoGain = ctx.createGain()
        lfoGain.gain.setValueAtTime(lfo.depth, ctx.currentTime)
        osc.connect(lfoGain)
        lfoGain.connect(lfo.target === 'frequency' ? node.frequency : gain.gain)
        osc.start()
        sources.push(osc)
      }
    } else {
      source.connect(gain)
    }

    gain.connect(master)
    source.start()

    return { gain, sources, baseGain }
  }

  // Synthesized approximation for every sound, so there is always an offline
  // fallback. Nature sounds are filtered/modulated noise; the noise family is
  // flat; heartbeat is a pre-rendered buffer.
  const buildSynthVoice = (
    ctx: AmbientAudioContext,
    master: GainNode,
    id: AmbientSoundId
  ): Voice => {
    switch (id) {
      case 'white':
      case 'pink':
      case 'brown':
        return startBufferVoice(ctx, master, noiseBuffer(ctx, id), 0.6)
      case 'rain':
        return startBufferVoice(ctx, master, noiseBuffer(ctx, 'pink'), 0.7, {
          type: 'highpass',
          frequency: 1200
        }, { target: 'gain', rate: 0.7, depth: 0.12 })
      case 'ocean':
        return startBufferVoice(ctx, master, noiseBuffer(ctx, 'brown'), 0.65, {
          type: 'lowpass',
          frequency: 550,
          Q: 0.7
        }, { target: 'gain', rate: 0.1, depth: 0.35 })
      case 'fan':
        return startBufferVoice(ctx, master, noiseBuffer(ctx, 'pink'), 0.55, {
          type: 'bandpass',
          frequency: 520,
          Q: 1.2
        })
      case 'wind':
        return startBufferVoice(ctx, master, noiseBuffer(ctx, 'pink'), 0.5, {
          type: 'bandpass',
          frequency: 480,
          Q: 0.9
        }, { target: 'frequency', rate: 0.15, depth: 260 })
      case 'heartbeat': {
        const length = Math.max(1, Math.floor(ctx.sampleRate * HEARTBEAT_SECONDS))
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        buffer.getChannelData(0).set(generateHeartbeat(length, ctx.sampleRate))
        return startBufferVoice(ctx, master, buffer, 0.9)
      }
    }
  }

  const loadBuffer = async (ctx: AmbientAudioContext, url: string): Promise<AudioBuffer> => {
    const cached = decodedBuffers.get(url)
    if (cached) {
      return cached
    }
    const bytes = await loadArrayBuffer(url)
    const decoded = await ctx.decodeAudioData(bytes)
    decodedBuffers.set(url, decoded)
    return decoded
  }

  // Ramp a voice to silence over `fadeSeconds`, then stop its sources. A short
  // fade (≈40ms) de-clicks a switch; a long one is the sleep-timer fade-out.
  const stopVoice = (ctx: AmbientAudioContext, voice: Voice, fadeSeconds: number): void => {
    const now = ctx.currentTime
    const endAt = now + Math.max(0.001, fadeSeconds)
    try {
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.baseGain), now)
      voice.gain.gain.linearRampToValueAtTime(0.0001, endAt)
    } catch {
      // Ignore scheduling errors — we still stop the sources below.
    }
    for (const source of voice.sources) {
      try {
        source.stop(endAt)
      } catch {
        // Already stopped.
      }
    }
  }

  const prime = async (): Promise<void> => {
    const ctx = ensureContext()
    if (!ctx) {
      return
    }
    await resumeIfNeeded(ctx)
    ensureMaster(ctx)
  }

  const play = async (id: AmbientSoundId): Promise<void> => {
    const ctx = ensureContext()
    if (!ctx) {
      return
    }

    const token = ++playToken
    await resumeIfNeeded(ctx)
    if (ctx.state !== 'running') {
      return
    }
    // A newer play()/stop() superseded us while awaiting the resume.
    if (token !== playToken) {
      return
    }

    const master = ensureMaster(ctx)

    // Build the new voice first (recording if available, else synth). This may
    // await a fetch/decode, so re-check the token before mutating state.
    let voice: Voice
    const url = assetUrlFor(id)
    if (url) {
      try {
        const buffer = await loadBuffer(ctx, url)
        if (token !== playToken) {
          return
        }
        voice = startBufferVoice(ctx, master, buffer, 0.8)
      } catch {
        if (token !== playToken) {
          return
        }
        voice = buildSynthVoice(ctx, master, id)
      }
    } else {
      voice = buildSynthVoice(ctx, master, id)
    }

    if (current) {
      stopVoice(ctx, current.voice, 0.04)
    }
    current = { id, voice }
  }

  const stop = async (): Promise<void> => {
    playToken++
    if (context && current) {
      stopVoice(context, current.voice, 0.04)
    }
    current = null
  }

  const fadeOutAndStop = async (seconds: number): Promise<void> => {
    playToken++
    if (context && current) {
      stopVoice(context, current.voice, Math.max(0.04, seconds))
    }
    current = null
  }

  const setVolume = (value: number): void => {
    volume = Math.min(1, Math.max(0, value))
    if (!masterGain || !context) {
      return
    }
    const now = context.currentTime
    try {
      // A short glide avoids zipper noise on slider drags.
      masterGain.gain.setTargetAtTime(volume, now, 0.02)
    } catch {
      try {
        masterGain.gain.setValueAtTime(volume, now)
      } catch {
        // Give up silently.
      }
    }
  }

  const dispose = async (): Promise<void> => {
    playToken++
    current = null
    masterGain = null
    noiseBuffers.clear()
    decodedBuffers.clear()
    const ctx = context
    context = null
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
    stop,
    setVolume,
    fadeOutAndStop,
    isPlaying: () => current !== null,
    currentId: () => current?.id ?? null,
    dispose
  }
}
