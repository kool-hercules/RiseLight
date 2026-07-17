<template>
  <div class="app-container">
    <NightLight
      :current-color="displayColor"
      :brightness="displayBrightness"
      :is-active="isActive"
      :current-state="currentState"
      :format-time-remaining="formatTimeRemaining"
      :format-okay-to-rise="formatOkayToRiseTime"
      :current-time="currentTime"
      @toggle-nightlight="handleToggleNightLight"
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
      @update-chime="updateChimeEnabled"
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
import { computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'
import { useOnboarding } from '../composables/useOnboarding'
import { useWakeLock } from '../composables/useWakeLock'
import { useChime } from '../composables/useChime'

const {
  settings,
  isSettingsOpen,
  saveFailed,
  toggleSettings,
  updateWakeTime,
  updateWakeDuration,
  updateBrightness,
  updateColor,
  updateChimeEnabled,
  resetSettings
} = useSettings()

const {
  currentTime,
  isActive,
  displayColor,
  displayBrightness,
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

// Optional "okay to get up" chime. Priming happens inside the Turn On tap so the
// autonomous transition hours later can still play audio on iOS.
const chime = useChime(computed(() => settings.value.chimeEnabled))

// Turning on is the one guaranteed user gesture, so unlock audio there.
const handleToggleNightLight = () => {
  if (!isActive.value) {
    chime.prime()
  }
  toggleNightLight()
}

// Sound the chime only when the schedule autonomously crosses into "okay to get
// up" from an active earlier state. Restores (inactive → awake) and turning on
// into an already-awake window don't chime.
watch(currentState, (state, previous) => {
  if (
    state === 'awake'
    && (previous === 'night' || previous === 'wake')
    && isActive.value
  ) {
    chime.play()
  }
})

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
        handleToggleNightLight()
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
