import { describe, expect, it, vi } from 'vitest'
import {
  createAmbientPlayer,
  generateBrown,
  generatePink,
  generateWhite
} from '../utils/ambient'

// A fake of the slice of Web Audio the ambient engine uses, so its play/switch/
// fade state machine can be exercised without a real AudioContext.
class FakeParam {
  value = 0
  setValueAtTime = vi.fn((v: number) => { this.value = v })
  linearRampToValueAtTime = vi.fn()
  setTargetAtTime = vi.fn((v: number) => { this.value = v })
  cancelScheduledValues = vi.fn()
}

class FakeGain {
  gain = new FakeParam()
  connect = vi.fn()
}

class FakeBufferSource {
  buffer: unknown = null
  loop = false
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeOscillator {
  type = 'sine'
  frequency = new FakeParam()
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeFilter {
  type = 'lowpass'
  frequency = new FakeParam()
  Q = new FakeParam()
  connect = vi.fn()
}

class FakeBuffer {
  private channel: Float32Array
  constructor(length: number) {
    this.channel = new Float32Array(length)
  }
  getChannelData() {
    return this.channel
  }
}

class FakeAudioContext {
  currentTime = 0
  sampleRate = 44_100
  destination = {}
  bufferSources: FakeBufferSource[] = []
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  decodeAudioData: (bytes: ArrayBuffer) => Promise<unknown>

  constructor(
    public state: 'suspended' | 'running' | 'closed' = 'suspended',
    decode?: (bytes: ArrayBuffer) => Promise<unknown>
  ) {
    this.decodeAudioData = decode ?? (async () => new FakeBuffer(1024))
  }

  resume = vi.fn(async () => { this.state = 'running' })
  close = vi.fn(async () => { this.state = 'closed' })

  createGain() {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }
  createBufferSource() {
    const src = new FakeBufferSource()
    this.bufferSources.push(src)
    return src as unknown as AudioBufferSourceNode
  }
  createBuffer(_channels: number, length: number) {
    return new FakeBuffer(length) as unknown as AudioBuffer
  }
  createBiquadFilter() {
    return new FakeFilter() as unknown as BiquadFilterNode
  }
  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc as unknown as OscillatorNode
  }
}

describe('ambient noise generators', () => {
  const cases: Array<[string, (n: number) => Float32Array]> = [
    ['white', generateWhite],
    ['pink', generatePink],
    ['brown', generateBrown]
  ]

  for (const [name, generate] of cases) {
    it(`${name} produces finite in-range samples with no DC offset`, () => {
      const data = generate(4096)
      expect(data).toHaveLength(4096)

      let sum = 0
      for (const sample of data) {
        expect(Number.isFinite(sample)).toBe(true)
        expect(Math.abs(sample)).toBeLessThanOrEqual(1)
        sum += sample
      }
      expect(Math.abs(sum / data.length)).toBeLessThan(1e-6)
    })
  }
})

describe('ambient player', () => {
  it('plays a looping buffer source through a master gain', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createAmbientPlayer({ factory: () => ctx as never })

    await player.play('white')

    expect(ctx.resume).toHaveBeenCalled()
    expect(player.isPlaying()).toBe(true)
    expect(player.currentId()).toBe('white')
    expect(ctx.bufferSources).toHaveLength(1)
    expect(ctx.bufferSources[0].loop).toBe(true)
    expect(ctx.bufferSources[0].start).toHaveBeenCalledTimes(1)
  })

  it('stops the previous source before starting a new one on switch', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createAmbientPlayer({ factory: () => ctx as never })

    await player.play('white')
    const first = ctx.bufferSources[0]
    await player.play('pink')

    expect(first.stop).toHaveBeenCalledTimes(1)
    expect(player.currentId()).toBe('pink')
    expect(ctx.bufferSources.length).toBeGreaterThanOrEqual(2)
  })

  it('clamps volume to 0..1 on the master gain', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createAmbientPlayer({ factory: () => ctx as never })

    await player.prime()
    player.setVolume(2)

    const master = ctx.gains[0]
    expect(master.gain.setTargetAtTime).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number))

    player.setVolume(-1)
    expect(master.gain.value).toBe(0)
  })

  it('fades out and stops', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createAmbientPlayer({ factory: () => ctx as never })

    await player.play('ocean')
    const source = ctx.bufferSources[0]
    await player.fadeOutAndStop(20)

    expect(source.stop).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(false)
    expect(player.currentId()).toBe(null)
  })

  it('no-ops without throwing when Web Audio is unavailable', async () => {
    const player = createAmbientPlayer({ factory: () => null })

    await expect(player.prime()).resolves.toBeUndefined()
    await expect(player.play('white')).resolves.toBeUndefined()
    expect(player.isPlaying()).toBe(false)
    player.setVolume(0.5)
    await expect(player.fadeOutAndStop(5)).resolves.toBeUndefined()
  })

  it('falls back to the synth approximation when a recording fails to decode', async () => {
    const decode = vi.fn(async () => { throw new Error('bad audio') })
    const ctx = new FakeAudioContext('suspended', decode)
    const player = createAmbientPlayer({
      factory: () => ctx as never,
      assetUrlFor: () => '/sounds/rain.m4a',
      loadArrayBuffer: async () => new ArrayBuffer(8)
    })

    await player.play('rain')

    expect(decode).toHaveBeenCalledTimes(1)
    // Despite the failed recording, the synth voice plays.
    expect(player.isPlaying()).toBe(true)
    expect(player.currentId()).toBe('rain')
    expect(ctx.bufferSources.length).toBeGreaterThanOrEqual(1)
  })

  it('uses a decoded recording when one is available', async () => {
    const decode = vi.fn(async () => new FakeBuffer(2048))
    const ctx = new FakeAudioContext('suspended', decode)
    const load = vi.fn(async () => new ArrayBuffer(8))
    const player = createAmbientPlayer({
      factory: () => ctx as never,
      assetUrlFor: () => '/sounds/rain.m4a',
      loadArrayBuffer: load
    })

    await player.play('rain')
    // Re-selecting the same recording reuses the decoded buffer (cache).
    await player.play('rain')

    expect(load).toHaveBeenCalledTimes(1)
    expect(decode).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(true)
  })

  it('closes and resets on dispose', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createAmbientPlayer({ factory: () => ctx as never })

    await player.play('white')
    await player.dispose()

    expect(ctx.close).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(false)
  })
})
