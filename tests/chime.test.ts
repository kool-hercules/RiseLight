import { describe, expect, it, vi } from 'vitest'
import { createChimePlayer } from '../utils/chime'

// A minimal fake of the slice of Web Audio the chime uses, so the unlock/play
// state machine can be exercised without a real AudioContext.
class FakeParam {
  setValueAtTime = vi.fn()
  linearRampToValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
}

class FakeOscillator {
  type = 'sine'
  frequency = new FakeParam()
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGain {
  gain = new FakeParam()
  connect = vi.fn()
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  oscillators: FakeOscillator[] = []

  constructor(public state: 'suspended' | 'running' | 'closed' = 'suspended') {}

  createOscillator() {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc as unknown as OscillatorNode
  }

  createGain() {
    return new FakeGain() as unknown as GainNode
  }
}

describe('chime player unlock state machine', () => {
  it('starts unprimed and primes by resuming the context inside the gesture', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createChimePlayer(() => ctx as never)

    expect(player.isPrimed()).toBe(false)
    await player.prime()

    expect(ctx.resume).toHaveBeenCalledTimes(1)
    expect(player.isPrimed()).toBe(true)
    // The inaudible unlock blip schedules exactly one oscillator.
    expect(ctx.oscillators).toHaveLength(1)
  })

  it('reuses a single context across prime and play', async () => {
    const factory = vi.fn(() => new FakeAudioContext('suspended') as never)
    const player = createChimePlayer(factory)

    await player.prime()
    await player.play()

    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('plays the three-note chime once the context is running', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createChimePlayer(() => ctx as never)

    await player.prime()
    await player.play()

    // 1 unlock blip + 3 chime notes.
    expect(ctx.oscillators).toHaveLength(4)
  })

  it('no-ops without throwing when Web Audio is unavailable', async () => {
    const player = createChimePlayer(() => null)

    await expect(player.prime()).resolves.toBeUndefined()
    await expect(player.play()).resolves.toBeUndefined()
    expect(player.isPrimed()).toBe(false)
  })

  it('does not sound when autoplay stays blocked (resume fails to run it)', async () => {
    const ctx = new FakeAudioContext('suspended')
    ctx.resume = vi.fn(async () => {
      // Simulate a browser that refuses to resume outside a gesture.
    })
    const player = createChimePlayer(() => ctx as never)

    await player.play()
    expect(ctx.oscillators).toHaveLength(0)
  })

  it('closes and resets on dispose', async () => {
    const ctx = new FakeAudioContext('suspended')
    const player = createChimePlayer(() => ctx as never)

    await player.prime()
    await player.dispose()

    expect(ctx.close).toHaveBeenCalledTimes(1)
    expect(player.isPrimed()).toBe(false)
  })
})
