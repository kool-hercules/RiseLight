// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { createFakePlayers, mountRoutineAudio } from './helpers/audioHarness'

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
  await nextTick()
}

const tap = async () => {
  document.dispatchEvent(new Event('pointerup'))
  await flush()
}

// Unmount every wrapper after each test so its document/window listeners and
// timers never react to the next test's events.
enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRoutineAudio', () => {
  it('starts the saved sound when story time begins', async () => {
    const { currentState, ambient } = mountRoutineAudio('inactive')
    currentState.value = 'bedtime'
    await flush()
    expect(ambient.selectSound).toHaveBeenCalledWith('white')
  })

  it('starts the saved sound at lights-out when there was no story time', async () => {
    const { currentState, ambient } = mountRoutineAudio('inactive')
    currentState.value = 'night'
    await flush()
    expect(ambient.selectSound).toHaveBeenCalledTimes(1)
  })

  it('does not restart the sound on the bedtime to night hand-off', async () => {
    const { currentState, ambient } = mountRoutineAudio('inactive')
    currentState.value = 'bedtime'
    await flush()
    currentState.value = 'night'
    await flush()
    expect(ambient.selectSound).toHaveBeenCalledTimes(1)
  })

  it('stays silent when auto-start is off or no sound is saved', async () => {
    const off = mountRoutineAudio('inactive', { ambientAutoStart: false })
    off.currentState.value = 'bedtime'
    const none = mountRoutineAudio('inactive', { ambientSound: null })
    none.currentState.value = 'bedtime'
    await flush()
    expect(off.ambient.selectSound).not.toHaveBeenCalled()
    expect(none.ambient.selectSound).not.toHaveBeenCalled()
  })

  it('raises the badge when the browser blocks the start', async () => {
    const players = createFakePlayers()
    players.ambient.selectSound.mockResolvedValue(false)
    const { currentState, api } = mountRoutineAudio('inactive', {}, players)
    currentState.value = 'bedtime'
    await flush()
    expect(api.needsAudioUnlock.value).toBe(true)
  })

  describe('after a blocked start', () => {
    const blocked = async (state: 'bedtime' | 'night' = 'bedtime') => {
      const players = createFakePlayers()
      players.ambient.selectSound.mockResolvedValueOnce(false)
      const mounted = mountRoutineAudio('inactive', {}, players)
      mounted.currentState.value = state
      await flush()
      players.ambient.prime.mockResolvedValue(true)
      players.chime.prime.mockResolvedValue(true)
      return mounted
    }

    it('one pointerup clears the badge and retries the sound', async () => {
      const { api, ambient } = await blocked()
      expect(api.needsAudioUnlock.value).toBe(true)
      await tap()
      expect(ambient.selectSound).toHaveBeenCalledTimes(2)
      expect(api.needsAudioUnlock.value).toBe(false)
    })

    it('keeps the badge when the prime still fails', async () => {
      const { api, ambient } = await blocked()
      ambient.prime.mockResolvedValue(false)
      await tap()
      expect(api.needsAudioUnlock.value).toBe(true)
    })

    it('does not retry once the routine has left the sleep phases', async () => {
      const { api, ambient, currentState } = await blocked()
      currentState.value = 'wake'
      await flush()
      await tap()
      expect(ambient.selectSound).toHaveBeenCalledTimes(1)
      expect(api.needsAudioUnlock.value).toBe(false)
    })

    it('does not retry after morning dropped the pending sound', async () => {
      const { ambient, currentState } = await blocked()
      currentState.value = 'awake'
      await flush()
      currentState.value = 'night'
      await flush()
      // lights-out starts the saved sound afresh (the second call); the stale
      // pending one from story time must not add a third on top of that.
      expect(ambient.selectSound).toHaveBeenCalledTimes(2)
      await tap()
      expect(ambient.selectSound).toHaveBeenCalledTimes(2)
    })

    it.each(['pointerup', 'touchend', 'keydown'])('a %s alone unlocks (touch taps carry activation only on release)', async type => {
      const { api, ambient } = await blocked()
      document.dispatchEvent(new Event(type))
      await flush()
      expect(ambient.selectSound).toHaveBeenCalledTimes(2)
      expect(api.needsAudioUnlock.value).toBe(false)
    })

    it('a slow failed attempt from pointerdown does not bring the badge back after pointerup unlocked', async () => {
      const { api, ambient } = await blocked()
      // pointerdown on touch has no activation, so its resume() hangs until the
      // timeout and fails; the pointerup a moment later succeeds at once.
      let failDown!: (ok: boolean) => void
      ambient.prime
        .mockImplementationOnce(() => new Promise<boolean>(resolve => { failDown = resolve }))
        .mockImplementationOnce(async () => true)
      document.dispatchEvent(new Event('pointerdown'))
      document.dispatchEvent(new Event('pointerup'))
      await flush()
      expect(api.needsAudioUnlock.value).toBe(false)
      expect(ambient.selectSound).toHaveBeenCalledTimes(2)

      failDown(false)
      await flush()
      expect(api.needsAudioUnlock.value).toBe(false)
    })

    it('unlocks on a key whose propagation a component stops (the clock stops Enter/Space)', async () => {
      const { api } = await blocked()
      const clock = document.body.appendChild(document.createElement('button'))
      clock.addEventListener('keydown', event => event.stopPropagation())
      clock.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      clock.remove()
      await flush()
      expect(api.needsAudioUnlock.value).toBe(false)
    })

    it('ignores gestures while nothing is blocked', async () => {
      const { ambient } = mountRoutineAudio('inactive')
      await tap()
      expect(ambient.prime).not.toHaveBeenCalled()
    })
  })

  describe('okay to get up', () => {
    it('stops the sound and chimes when coming from night', async () => {
      const { currentState, ambient, chime } = mountRoutineAudio('night')
      await flush()
      currentState.value = 'awake'
      await flush()
      expect(ambient.stopPlayback).toHaveBeenCalledTimes(1)
      expect(chime.play).toHaveBeenCalledTimes(1)
    })

    it('chimes when coming from wake', async () => {
      const { currentState, chime } = mountRoutineAudio('wake')
      currentState.value = 'awake'
      await flush()
      expect(chime.play).toHaveBeenCalledTimes(1)
    })

    it('does not chime for a reload straight into awake', async () => {
      const { currentState, chime } = mountRoutineAudio('awake')
      await flush()
      expect(chime.play).not.toHaveBeenCalled()
      currentState.value = 'inactive'
      await flush()
      expect(chime.play).not.toHaveBeenCalled()
    })

    it('does not chime when a manual start lands straight in awake', async () => {
      const { currentState, chime } = mountRoutineAudio('inactive')
      currentState.value = 'awake'
      await flush()
      expect(chime.play).not.toHaveBeenCalled()
    })

    it('raises the badge when the chime is blocked', async () => {
      const players = createFakePlayers()
      players.chime.play.mockResolvedValue(false)
      const { currentState, api } = mountRoutineAudio('wake', {}, players)
      currentState.value = 'awake'
      await flush()
      expect(api.needsAudioUnlock.value).toBe(true)
    })
  })

  describe('off for now', () => {
    it('stops the sound from story time', async () => {
      const { currentState, ambient } = mountRoutineAudio('inactive')
      currentState.value = 'bedtime'
      await flush()
      expect(ambient.isPlaying.value).toBe(true)
      currentState.value = 'inactive'
      await flush()
      expect(ambient.stopPlayback).toHaveBeenCalledTimes(1)
    })

    it('does not touch a sound the parent started by hand while the light is idle after morning', async () => {
      const { currentState, ambient } = mountRoutineAudio('awake')
      // The parent's speaker tap: without it nothing is playing and the stop
      // would be skipped whatever the rule says.
      ambient.isPlaying.value = true
      currentState.value = 'inactive'
      await flush()
      expect(ambient.stopPlayback).not.toHaveBeenCalled()
    })
  })

  describe('reload mid-routine', () => {
    it('resumes the bedtime sound', async () => {
      const { ambient } = mountRoutineAudio('night')
      await flush()
      expect(ambient.selectSound).toHaveBeenCalledWith('white')
    })

    it('does not start sound on a reload into the morning', async () => {
      const { ambient } = mountRoutineAudio('awake')
      await flush()
      expect(ambient.selectSound).not.toHaveBeenCalled()
    })

    it('pre-unlocks the chime when armed, raising the badge if blocked', async () => {
      const { chime, api } = mountRoutineAudio('wake', { chimeEnabled: true })
      await flush()
      expect(chime.prime).toHaveBeenCalledTimes(1)
      expect(api.needsAudioUnlock.value).toBe(true)
    })

    it('leaves the chime alone when disarmed', async () => {
      const { chime } = mountRoutineAudio('inactive', { chimeEnabled: true }, createFakePlayers(), false)
      await flush()
      expect(chime.prime).not.toHaveBeenCalled()
    })
  })

  it('primes the chime right away when it is switched on', async () => {
    const { settings, chime } = mountRoutineAudio('inactive', { chimeEnabled: false })
    settings.value = { ...settings.value, chimeEnabled: true }
    await flush()
    expect(chime.prime).toHaveBeenCalledTimes(1)
  })

  it('stops listening for gestures once unmounted', async () => {
    // Blocked first: with no badge up a gesture is ignored anyway, which would
    // hide a listener left behind.
    const players = createFakePlayers()
    players.ambient.selectSound.mockResolvedValue(false)
    const { wrapper, currentState, api } = mountRoutineAudio('inactive', {}, players)
    currentState.value = 'bedtime'
    await flush()
    expect(api.needsAudioUnlock.value).toBe(true)
    wrapper.unmount()
    await tap()
    expect(players.ambient.prime).not.toHaveBeenCalled()
  })
})
