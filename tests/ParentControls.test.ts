// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import ParentControls from '../components/ParentControls.vue'

const baseProps = {
  headline: 'Lights out',
  detail: 'Stay in bed',
  icon: 'moon' as const,
  isLit: true,
  canNap: true,
  lastNapMinutes: 60,
  plan: [],
  hasSound: true,
  isSoundPlaying: false,
  screenMaySleep: false,
  pinned: false,
  childLock: true,
  brightness: 40 as number | null,
  volume: 50
}

const mountControls = (props: Partial<typeof baseProps> = {}) =>
  mount(ParentControls, { props: { ...baseProps, ...props }, attachTo: document.body })

const buttonByText = (wrapper: ReturnType<typeof mountControls>, text: string) =>
  wrapper.findAll('button').find(button => button.text() === text)

// Unmount every wrapper after each test so its document/window listeners and
// timers never react to the next test's events.
enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ParentControls idle hide', () => {
  it('closes after 15 s untouched', () => {
    const wrapper = mountControls()
    vi.advanceTimersByTime(14_999)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('a pointerdown anywhere restarts the 15 s', () => {
    const wrapper = mountControls()
    vi.advanceTimersByTime(10_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(10_000)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(5_000)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('a keydown restarts the 15 s', () => {
    const wrapper = mountControls()
    vi.advanceTimersByTime(10_000)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    vi.advanceTimersByTime(14_000)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1_000)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('pinned first-run layer waits 120 s, not 15', () => {
    const wrapper = mountControls({ pinned: true })
    vi.advanceTimersByTime(119_999)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('once the pin is released the 15 s timer takes over from then', async () => {
    const wrapper = mountControls({ pinned: true })
    vi.advanceTimersByTime(60_000)
    await wrapper.setProps({ pinned: false })
    vi.advanceTimersByTime(14_999)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stops listening and timing once unmounted', () => {
    const wrapper = mountControls()
    wrapper.unmount()
    vi.advanceTimersByTime(60_000)
    window.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(60_000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('ParentControls nap sheet', () => {
  it('opens from Nap and starts the chosen length', async () => {
    const wrapper = mountControls()
    await buttonByText(wrapper, 'Nap')!.trigger('click')
    expect(wrapper.find('[aria-label="Nap length"]').exists()).toBe(true)
    await buttonByText(wrapper, '1h 30m')!.trigger('click')
    await buttonByText(wrapper, 'Start nap')!.trigger('click')
    expect(wrapper.emitted('start-nap')).toEqual([[90]])
    expect(wrapper.find('[aria-label="Nap length"]').exists()).toBe(false)
  })

  it('closes when naps stop making sense (canNap goes false)', async () => {
    const wrapper = mountControls()
    await buttonByText(wrapper, 'Nap')!.trigger('click')
    expect(wrapper.find('[aria-label="Nap length"]').exists()).toBe(true)
    await wrapper.setProps({ canNap: false })
    expect(wrapper.find('[aria-label="Nap length"]').exists()).toBe(false)
    expect(buttonByText(wrapper, 'Nap')).toBeUndefined()
  })

  it('has no Nap button while naps are not allowed', () => {
    expect(buttonByText(mountControls({ canNap: false }), 'Nap')).toBeUndefined()
  })
})

describe('ParentControls light toggle', () => {
  it('says Off for now while lit', () => {
    const wrapper = mountControls({ isLit: true })
    expect(buttonByText(wrapper, 'Off for now')).toBeDefined()
    expect(buttonByText(wrapper, 'Start now')).toBeUndefined()
  })

  it('says Start now while dark, and follows isLit live', async () => {
    const wrapper = mountControls({ isLit: false })
    expect(buttonByText(wrapper, 'Start now')).toBeDefined()
    await wrapper.setProps({ isLit: true })
    expect(buttonByText(wrapper, 'Off for now')).toBeDefined()
  })

  it('emits toggle-light', async () => {
    const wrapper = mountControls()
    await buttonByText(wrapper, 'Off for now')!.trigger('click')
    expect(wrapper.emitted('toggle-light')).toHaveLength(1)
  })
})

describe('ParentControls quick sliders', () => {
  const brightness = '[aria-label="Brightness for this part of the routine"]'
  const volume = '[aria-label="Sound volume"]'

  it('hides the brightness slider while dark', () => {
    expect(mountControls({ brightness: null }).find(brightness).exists()).toBe(false)
  })

  it('shows the brightness slider while lit and reports changes', async () => {
    const wrapper = mountControls({ brightness: 40 })
    const slider = wrapper.find(brightness)
    expect((slider.element as HTMLInputElement).value).toBe('40')
    await slider.setValue('25')
    expect(wrapper.emitted('update-brightness')).toEqual([[25]])
  })

  it('shows the volume slider only while sound plays', async () => {
    const wrapper = mountControls({ isSoundPlaying: false })
    expect(wrapper.find(volume).exists()).toBe(false)
    await wrapper.setProps({ isSoundPlaying: true })
    expect(wrapper.find(volume).exists()).toBe(true)
    await wrapper.find(volume).setValue('70')
    expect(wrapper.emitted('update-volume')).toEqual([[70]])
  })

  it('shows neither block while dark and silent', () => {
    expect(mountControls({ brightness: null, isSoundPlaying: false }).find('.quick-adjust').exists()).toBe(false)
  })
})

describe('ParentControls first-run chrome', () => {
  it('labels the close button Got it while pinned, Done otherwise', async () => {
    const wrapper = mountControls({ pinned: true })
    expect(buttonByText(wrapper, 'Got it')).toBeDefined()
    await wrapper.setProps({ pinned: false })
    expect(buttonByText(wrapper, 'Done')).toBeDefined()
  })

  it('tapping the backdrop closes only when not pinned', async () => {
    const free = mountControls()
    await free.find('.parent-layer').trigger('click')
    expect(free.emitted('close')).toHaveLength(1)

    const pinned = mountControls({ pinned: true })
    await pinned.find('.parent-layer').trigger('click')
    expect(pinned.emitted('close')).toBeUndefined()
  })
})
