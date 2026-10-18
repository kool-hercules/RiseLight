import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { AUDIO_UNLOCK_EVENTS } from '../utils/audioUnlock'

export const PANEL_IDLE_MS = 60_000

// Kid screen vs parent layer: when the layer is visible, how first run pins it,
// how it and the panels (settings, help) close, and the keyboard rules.
export const useParentLayer = (options: {
  childLock: Readonly<Ref<boolean>>
  isSettingsOpen: Readonly<Ref<boolean>>
  toggleSettings: () => void
  stopPreview: () => void
  firstRun: { pinned: Readonly<Ref<boolean>>; dismiss: () => void }
  toggleLight: () => void
}) => {
  const { childLock, isSettingsOpen, toggleSettings, stopPreview, firstRun, toggleLight } = options
  const showFirstRunHint = firstRun.pinned

  // Until first-run onboarding completes, the parent layer is pinned open
  // (exempt from the lock and auto-hide); after that it opens via the
  // child-lock hold (or any tap with the lock off) and hides itself.
  const showHelp = ref(false)
  const parentOpen = ref(false)
  const parentVisible = computed(() =>
    (parentOpen.value || showFirstRunHint.value) && !isSettingsOpen.value && !showHelp.value
  )

  const openParent = () => {
    parentOpen.value = true
  }
  const closeParent = () => {
    firstRun.dismiss()
    parentOpen.value = false
  }

  // The moment first run completes, hand the open layer over to the auto-hide
  // timer instead of letting it vanish under the user's finger.
  // Sync, so closeParent (which also completes first run) can still close it.
  watch(showFirstRunHint, (pinned, wasPinned) => {
    if (wasPinned && !pinned) {
      parentOpen.value = true
    }
  }, { flush: 'sync' })

  const openHelp = () => {
    firstRun.dismiss()
    showHelp.value = true
  }
  const closeHelp = () => {
    showHelp.value = false
  }

  // Any of these first interactions retires the first-run pin.
  const handleToggleSettings = () => {
    firstRun.dismiss()
    toggleSettings()
  }

  // "How it works" from Settings: close the panel, then show the help popover.
  const handleShowHelp = () => {
    if (isSettingsOpen.value) {
      toggleSettings()
    }
    openHelp()
  }

  // Closing settings always ends any active preview so the light never gets
  // stuck overriding the real schedule after the panel is dismissed.
  const closeSettings = () => {
    stopPreview()
    if (isSettingsOpen.value) {
      toggleSettings()
    }
  }

  // Settings and help auto-close after a minute untouched while the child lock is
  // on, so a panel left open can't become the kid's toy. Closing settings also
  // stops any preview. They return to the kid screen, not the parent layer.
  let panelIdleTimer: ReturnType<typeof setTimeout> | null = null

  const clearPanelIdle = () => {
    if (panelIdleTimer) {
      clearTimeout(panelIdleTimer)
      panelIdleTimer = null
    }
  }

  const armPanelIdle = () => {
    clearPanelIdle()
    if (childLock.value && (isSettingsOpen.value || showHelp.value)) {
      panelIdleTimer = setTimeout(() => {
        closeHelp()
        closeSettings()
        parentOpen.value = false
      }, PANEL_IDLE_MS)
    }
  }

  watch(
    () => [isSettingsOpen.value, showHelp.value, childLock.value] as const,
    armPanelIdle
  )

  // Keyboard shortcuts act only while the parent layer (or a panel) is open, so a
  // keyboard in reach of a child does nothing. Esc always works.
  const handleKeyDown = (event: KeyboardEvent) => {
    armPanelIdle()
    if (event.key === 'Escape') {
      if (showHelp.value) {
        closeHelp()
      } else if (isSettingsOpen.value) {
        closeSettings()
      } else if (parentVisible.value) {
        closeParent()
      }
      return
    }

    if (!parentVisible.value) {
      return
    }

    switch (event.key) {
      case ' ':
        // Ignore repeats: a Space still held from the unlock must not toggle.
        if (!event.repeat && !(event.target instanceof HTMLButtonElement) && !(event.target instanceof HTMLInputElement)) {
          event.preventDefault()
          toggleLight()
        }
        break
      case 's':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault()
          handleToggleSettings()
        }
        break
    }
  }

  // Any touch or key counts as activity for the panel idle timer.
  const handleActivity = () => {
    armPanelIdle()
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown)
    for (const type of AUDIO_UNLOCK_EVENTS) {
      document.addEventListener(type, handleActivity, true)
    }
  })

  onBeforeUnmount(() => {
    clearPanelIdle()
    document.removeEventListener('keydown', handleKeyDown)
    for (const type of AUDIO_UNLOCK_EVENTS) {
      document.removeEventListener(type, handleActivity, true)
    }
  })

  return {
    showHelp,
    showFirstRunHint,
    parentVisible,
    openParent,
    closeParent,
    openHelp,
    closeHelp,
    closeSettings,
    handleToggleSettings,
    handleShowHelp
  }
}
