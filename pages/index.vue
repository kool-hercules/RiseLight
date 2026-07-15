<template>
  <div class="app-container">
    <NightLight
      :current-color="currentColor"
      :brightness="getCurrentBrightness"
      :is-active="isActive"
      :status-message="statusMessage"
      :format-time-remaining="formatTimeRemaining"
      :current-time="currentTime"
      @toggle-nightlight="handleToggleNightLight"
      @toggle-settings="toggleSettings"
    />
    
    <SettingsPanel
      :is-open="isSettingsOpen"
      :settings="settings"
      @close="toggleSettings"
      @update-wake-time="handleUpdateWakeTime"
      @update-wake-duration="handleUpdateWakeDuration"
      @update-brightness="handleUpdateBrightness"
      @update-color="handleUpdateColor"
      @preview-mode="handlePreviewMode"
      @stop-preview="handleStopPreview"
      @reset-settings="handleResetSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import type { LightMode, Settings } from '../types'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'

// Page meta
useHead({
  title: 'RiseLight',
  meta: [
    { name: 'description', content: 'A color-changing light that helps kids know when it’s time to stay in bed –– and when it’s okay to rise.' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover' }
  ]
})

// Import composables
const settingsComposable = useSettings()

// Extract reactive refs from composables
const {
  settings,
  isSettingsOpen,
  toggleSettings,
  updateWakeTime,
  updateWakeDuration,
  updateBrightness,
  updateColor,
  resetSettings
} = settingsComposable

const nightLightComposable = useNightLight(settings)

const {
  currentTime,
  isActive,
  currentColor,
  formatTimeRemaining,
  getCurrentBrightness,
  statusMessage,
  startNightLight,
  stopNightLight,
  toggleNightLight,
  startPreview,
  stopPreview
} = nightLightComposable

// Event handlers
const handleToggleNightLight = () => {
  toggleNightLight()
}

const handleUpdateWakeTime = (time: string) => {
  updateWakeTime(time)
}

const handleUpdateWakeDuration = (duration: number) => {
  updateWakeDuration(duration)
}

const handleUpdateBrightness = (state: keyof Settings['brightness'], value: number) => {
  updateBrightness(state, value)
}

const handleUpdateColor = (state: keyof Settings['colors'], color: string) => {
  updateColor(state, color)
}

const handlePreviewMode = (mode: LightMode) => {
  startPreview(mode)
}

const handleStopPreview = () => {
  stopPreview()
}

const handleResetSettings = () => {
  resetSettings()
}

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case ' ':
      event.preventDefault()
      handleToggleNightLight()
      break
    case 'Escape':
      if (isSettingsOpen.value) {
        toggleSettings()
      }
      break
    case 's':
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault()
        toggleSettings()
      }
      break
  }
}

// Prevent context menu on long press (for mobile)
const handleContextMenu = (event: Event) => {
  event.preventDefault()
}

// Lifecycle
onMounted(() => {
  // Add event listeners
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('contextmenu', handleContextMenu)
})

// Cleanup on unmount
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('contextmenu', handleContextMenu)
})
</script>

<style scoped>
.app-container {
  @apply w-full h-full relative overflow-hidden;
}
</style>
