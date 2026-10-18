// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useParentLayer } from '../composables/useParentLayer'

const mountLayer = ({ pinned = false, childLock = true } = {}) => {
  const lock = ref(childLock)
  const isSettingsOpen = ref(false)
  const pin = ref(pinned)
  const toggleSettings = vi.fn(() => { isSettingsOpen.value = !isSettingsOpen.value })
  const stopPreview = vi.fn()
  const dismiss = vi.fn(() => { pin.value = false })
  const toggleLight = vi.fn()

  let layer!: ReturnType<typeof useParentLayer>
  const wrapper = mount(defineComponent({
    setup() {
      layer = useParentLayer({
        childLock: lock,
        isSettingsOpen,
        toggleSettings,
        stopPreview,
        firstRun: { pinned: pin, dismiss },
        toggleLight
      })
      return () => null
    }
  }))

  return { wrapper, layer, lock, isSettingsOpen, pin, toggleSettings, stopPreview, dismiss, toggleLight }
}

const press = (key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  document.dispatchEvent(event)
  return event
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

describe('useParentLayer keyboard', () => {
  it('Space does nothing while the layer is closed', () => {
    const { toggleLight } = mountLayer()
    const event = press(' ')
    expect(toggleLight).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('Space toggles the light while the layer is open, ignoring key repeats', () => {
    const { layer, toggleLight } = mountLayer()
    layer.openParent()
    press(' ')
    press(' ', { repeat: true })
    expect(toggleLight).toHaveBeenCalledTimes(1)
  })

  it('Space on a focused button is left to the button', () => {
    const { layer, toggleLight } = mountLayer()
    layer.openParent()
    const button = document.body.appendChild(document.createElement('button'))
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    button.remove()
    expect(toggleLight).not.toHaveBeenCalled()
  })

  it('Ctrl+S opens settings only while the layer is open', () => {
    const { layer, toggleSettings } = mountLayer()
    press('s', { ctrlKey: true })
    expect(toggleSettings).not.toHaveBeenCalled()
    layer.openParent()
    press('s', { ctrlKey: true })
    expect(toggleSettings).toHaveBeenCalledTimes(1)
  })

  it('Esc closes help, then settings, then the layer', async () => {
    const { layer, isSettingsOpen, stopPreview } = mountLayer()
    layer.openParent()
    // Help and settings can't both show at once in the UI, but the order still
    // has to hold if state ever overlaps.
    layer.showHelp.value = true
    isSettingsOpen.value = true
    await nextTick()

    press('Escape')
    expect(layer.showHelp.value).toBe(false)
    expect(isSettingsOpen.value).toBe(true)

    press('Escape')
    expect(isSettingsOpen.value).toBe(false)
    expect(stopPreview).toHaveBeenCalledTimes(1)
    await nextTick()
    expect(layer.parentVisible.value).toBe(true)

    press('Escape')
    expect(layer.parentVisible.value).toBe(false)
  })

  it('Esc with everything closed does nothing', () => {
    const { layer, dismiss } = mountLayer()
    press('Escape')
    expect(layer.parentVisible.value).toBe(false)
    expect(dismiss).not.toHaveBeenCalled()
  })
})

describe('useParentLayer visibility', () => {
  it('is pinned open on first run, and a panel hides it', async () => {
    const { layer, isSettingsOpen } = mountLayer({ pinned: true })
    expect(layer.parentVisible.value).toBe(true)
    isSettingsOpen.value = true
    await nextTick()
    expect(layer.parentVisible.value).toBe(false)
  })

  it('hands the pinned layer to the auto-hide timer when first run completes', () => {
    const { layer, dismiss, pin } = mountLayer({ pinned: true })
    pin.value = false
    expect(dismiss).not.toHaveBeenCalled()
    expect(layer.parentVisible.value).toBe(true)
  })

  it('"Got it" on the pinned layer closes it for good', async () => {
    const { layer, dismiss } = mountLayer({ pinned: true })
    layer.closeParent()
    expect(dismiss).toHaveBeenCalled()
    expect(layer.parentVisible.value).toBe(false)
    // A deferred hand-off watcher would reopen it here.
    await nextTick()
    expect(layer.parentVisible.value).toBe(false)
  })

  it('opening help retires the pin and shows help instead of the layer', () => {
    const { layer, dismiss } = mountLayer({ pinned: true })
    layer.openHelp()
    expect(dismiss).toHaveBeenCalled()
    expect(layer.showHelp.value).toBe(true)
    expect(layer.parentVisible.value).toBe(false)
  })

  it('"How it works" from settings closes settings then shows help', async () => {
    const { layer, isSettingsOpen } = mountLayer()
    isSettingsOpen.value = true
    layer.handleShowHelp()
    expect(isSettingsOpen.value).toBe(false)
    expect(layer.showHelp.value).toBe(true)
  })
})

describe('useParentLayer panel auto-close', () => {
  it('closes settings and the layer after 60 s while the child lock is on', async () => {
    const { layer, isSettingsOpen, stopPreview } = mountLayer({ childLock: true })
    layer.openParent()
    isSettingsOpen.value = true
    await nextTick()

    vi.advanceTimersByTime(59_999)
    expect(isSettingsOpen.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isSettingsOpen.value).toBe(false)
    expect(stopPreview).toHaveBeenCalled()
    await nextTick()
    expect(layer.parentVisible.value).toBe(false)
  })

  it('closes help after 60 s while the child lock is on', async () => {
    const { layer } = mountLayer({ childLock: true })
    layer.openHelp()
    await nextTick()
    vi.advanceTimersByTime(60_000)
    expect(layer.showHelp.value).toBe(false)
  })

  it('never auto-closes while the child lock is off', async () => {
    const { isSettingsOpen } = mountLayer({ childLock: false })
    isSettingsOpen.value = true
    await nextTick()
    vi.advanceTimersByTime(10 * 60_000)
    expect(isSettingsOpen.value).toBe(true)
  })

  it('turning the lock on arms the timer for a panel already open', async () => {
    const { isSettingsOpen, lock } = mountLayer({ childLock: false })
    isSettingsOpen.value = true
    await nextTick()
    lock.value = true
    await nextTick()
    vi.advanceTimersByTime(60_000)
    expect(isSettingsOpen.value).toBe(false)
  })

  it('any touch or key restarts the 60 s', async () => {
    const { isSettingsOpen } = mountLayer({ childLock: true })
    isSettingsOpen.value = true
    await nextTick()
    vi.advanceTimersByTime(45_000)
    document.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(45_000)
    expect(isSettingsOpen.value).toBe(true)
    press('a')
    vi.advanceTimersByTime(59_000)
    expect(isSettingsOpen.value).toBe(true)
    vi.advanceTimersByTime(1_000)
    expect(isSettingsOpen.value).toBe(false)
  })

  it('stops the timer and the keyboard once unmounted', async () => {
    const { wrapper, isSettingsOpen, stopPreview } = mountLayer({ childLock: true })
    isSettingsOpen.value = true
    await nextTick()
    wrapper.unmount()
    vi.advanceTimersByTime(120_000)
    expect(isSettingsOpen.value).toBe(true)
    press('Escape')
    expect(isSettingsOpen.value).toBe(true)
    expect(stopPreview).not.toHaveBeenCalled()
  })
})
