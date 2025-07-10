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
      @preview-color="handlePreviewColor"
      @stop-preview="handleStopPreview"
      @reset-settings="handleResetSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import type { LightColor } from '../types'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'

// Page meta
useHead({
  title: 'Hatch Night Light Simulator',
  meta: [
    { name: 'description', content: 'A digital simulation of the Hatch night light for iPad' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no' }
  ]
})

// Import composables
const settingsComposable = useSettings()
const nightLightComposable = useNightLight()

// Extract reactive refs from composables
const {
  settings,
  isSettingsOpen,
  loadSettings,
  toggleSettings,
  updateWakeTime,
  updateWakeDuration,
  updateBrightness,
  resetSettings
} = settingsComposable

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
  toggleNightLight(settings.value.wakeTime)
}

const handleUpdateWakeTime = (time: string) => {
  updateWakeTime(time)
}

const handleUpdateWakeDuration = (duration: number) => {
  updateWakeDuration(duration)
}

const handleUpdateBrightness = (color: keyof typeof settings.value.brightness, value: number) => {
  updateBrightness(color, value)
}

const handlePreviewColor = (color: LightColor) => {
  startPreview(color)
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
  // Load settings from localStorage
  loadSettings()
  
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