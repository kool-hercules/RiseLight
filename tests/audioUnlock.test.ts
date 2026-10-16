import { describe, expect, it } from 'vitest'
import { AUDIO_UNLOCK_EVENTS, createAudioUnlocker } from '../utils/audioUnlock'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

describe('audio unlock', () => {
  it('listens for the events that carry user activation on touch screens', () => {
    expect(AUDIO_UNLOCK_EVENTS).toContain('pointerup')
    expect(AUDIO_UNLOCK_EVENTS).toContain('touchend')
    expect(AUDIO_UNLOCK_EVENTS).toContain('keydown')
  })

  it('a slow failed attempt from pointerdown never overrides the pointerup success', async () => {
    const down = deferred<boolean>()
    const up = deferred<boolean>()
    const attempts = [down.promise, up.promise]
    const unlock = createAudioUnlocker(() => attempts.shift()!)
    const results: boolean[] = []

    const first = unlock(ok => { results.push(ok) })
    const second = unlock(ok => { results.push(ok) })
    up.resolve(true)
    await second
    down.resolve(false)
    await first

    expect(results).toEqual([true])
  })
})
