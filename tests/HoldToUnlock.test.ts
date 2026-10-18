// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import HoldToUnlock from '../components/HoldToUnlock.vue'

const mountHold = (locked = true) => mount(HoldToUnlock, {
  props: { locked },
  slots: { default: '9:41 PM' },
  attachTo: document.body
})

const down = (wrapper: ReturnType<typeof mountHold>, x = 100, y = 100) =>
  wrapper.trigger('pointerdown', { clientX: x, clientY: y, pointerId: 1 })

// Unmount every wrapper after each test so its document/window listeners and
// timers never react to the next test's events.
enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HoldToUnlock (child lock on)', () => {
  it('unlocks after a 3 s pointer hold', async () => {
    const wrapper = mountHold()
    await down(wrapper)
    vi.advanceTimersByTime(2_999)
    expect(wrapper.emitted('unlock')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('does not unlock when released at 2.9 s', async () => {
    const wrapper = mountHold()
    await down(wrapper)
    vi.advanceTimersByTime(2_900)
    await wrapper.trigger('pointerup')
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('cancels when the pointer moves more than 10 px', async () => {
    const wrapper = mountHold()
    await down(wrapper, 100, 100)
    vi.advanceTimersByTime(1_000)
    await wrapper.trigger('pointermove', { clientX: 100, clientY: 111, pointerId: 1 })
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('tolerates a wobble of up to 10 px', async () => {
    const wrapper = mountHold()
    await down(wrapper, 100, 100)
    await wrapper.trigger('pointermove', { clientX: 106, clientY: 108, pointerId: 1 })
    vi.advanceTimersByTime(3_000)
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('cancels on pointercancel and on blur', async () => {
    const wrapper = mountHold()
    await down(wrapper)
    await wrapper.trigger('pointercancel')
    await down(wrapper)
    await wrapper.trigger('blur')
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('unlocks after holding Enter for 3 s', async () => {
    const wrapper = mountHold()
    await wrapper.trigger('keydown', { key: 'Enter' })
    vi.advanceTimersByTime(3_000)
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('unlocks after holding Space for 3 s', async () => {
    const wrapper = mountHold()
    await wrapper.trigger('keydown', { key: ' ' })
    vi.advanceTimersByTime(3_000)
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('does not restart the hold on key repeats', async () => {
    const wrapper = mountHold()
    await wrapper.trigger('keydown', { key: 'Enter' })
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(500)
      await wrapper.trigger('keydown', { key: 'Enter', repeat: true })
    }
    // 2.5 s in: repeats must not have pushed the deadline out or started a new hold.
    vi.advanceTimersByTime(500)
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('does not unlock when the key is released early', async () => {
    const wrapper = mountHold()
    await wrapper.trigger('keydown', { key: ' ' })
    vi.advanceTimersByTime(1_500)
    await wrapper.trigger('keyup', { key: ' ' })
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('ignores a plain click (a toddler tap)', async () => {
    const wrapper = mountHold()
    await wrapper.trigger('click')
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })

  it('does not keep a timer after unmounting mid-hold', async () => {
    const wrapper = mountHold()
    await down(wrapper)
    wrapper.unmount()
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })
})

describe('HoldToUnlock (child lock off)', () => {
  it('a click unlocks immediately', async () => {
    const wrapper = mountHold(false)
    await wrapper.trigger('click')
    expect(wrapper.emitted('unlock')).toHaveLength(1)
  })

  it('does not start a hold on pointerdown', async () => {
    const wrapper = mountHold(false)
    await down(wrapper)
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('unlock')).toBeUndefined()
  })
})
