<template>
  <div class="app-container">
    <NightLight
      :current-color="currentColor"
      :brightness="getCurrentBrightness"
      :is-active="isActive"
      :current-state="currentState"
      :format-time-remaining="formatTimeRemaining"
      :format-okay-to-rise="formatOkayToRiseTime"
      :current-time="currentTime"
      @toggle-nightlight="toggleNightLight"
      @toggle-settings="toggleSettings"
    />

    <SettingsPanel
      :is-open="isSettingsOpen"
      :settings="settings"
      :preview-mode="previewMode"
      :save-failed="saveFailed"
      @close="closeSettings"
      @update-wake-time="updateWakeTime"
      @update-wake-duration="updateWakeDuration"
      @update-brightness="updateBrightness"
      @update-color="updateColor"
      @preview-mode="startPreview"
      @stop-preview="stopPreview"
      @reset-settings="resetSettings"
      @restart-intro="handleRestartIntro"
    />

    <OnboardingOverlay
      v-if="showOnboarding"
      :settings="settings"
      @update-wake-time="updateWakeTime"
      @complete="completeOnboarding"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'
import { useOnboarding } from '../composables/useOnboarding'
import { useWakeLock } from '../composables/useWakeLock'

// Page meta
useHead({
  title: 'RiseLight',
  meta: [
    { name: 'description', content: 'A color-changing light that helps kids know when it’s time to stay in bed –– and when it’s okay to rise.' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
  ]
})

const {
  settings,
  isSettingsOpen,
  saveFailed,
  toggleSettings,
  updateWakeTime,
  updateWakeDuration,
  updateBrightness,
  updateColor,
  resetSettings
} = useSettings()

const {
  currentTime,
  isActive,
  currentColor,
  currentState,
  previewMode,
  formatTimeRemaining,
  formatOkayToRiseTime,
  getCurrentBrightness,
  toggleNightLight,
  startPreview,
  stopPreview
} = useNightLight(settings)

const { showOnboarding, completeOnboarding, restartOnboarding } = useOnboarding()

// Keep the screen awake while the light is on — a night light that sleeps is
// useless.
useWakeLock(isActive)

// Closing settings always ends any active preview so the light never gets
// stuck overriding the real schedule after the panel is dismissed.
const closeSettings = () => {
  stopPreview()
  if (isSettingsOpen.value) {
    toggleSettings()
  }
}

const handleRestartIntro = () => {
  restartOnboarding()
  if (isSettingsOpen.value) {
    toggleSettings()
  }
}

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  if (showOnboarding.value) {
    return
  }

  switch (event.key) {
    case ' ':
      if (!isSettingsOpen.value) {
        event.preventDefault()
        toggleNightLight()
      }
      break
    case 'Escape':
      if (isSettingsOpen.value) {
        closeSettings()
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

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('contextmenu', handleContextMenu)
})

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
