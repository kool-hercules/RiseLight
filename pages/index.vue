<template>
  <div class="app-container">
    <NightLight
      :current-color="displayColor"
      :brightness="displayBrightness"
      :is-active="isActive"
      :current-state="currentState"
      :preview-mode="previewMode"
      :human-time-remaining="humanTimeRemaining"
      :okay-to-rise-label="okayTimeLabel"
      :plan="plan"
      :current-time="currentTime"
      :has-sound="settings.ambientSound !== null"
      :is-sound-playing="isSoundPlaying"
      :show-hint="showFirstRunHint"
      @toggle-nightlight="handleToggleNightLight"
      @toggle-settings="handleToggleSettings"
      @toggle-sound="handleToggleSound"
      @toggle-help="toggleHelp"
    />

    <SettingsPanel
      :is-open="isSettingsOpen"
      :settings="settings"
      :preview-mode="previewMode"
      :save-failed="saveFailed"
      :active-sound-id="activeSoundId"
      :is-sound-playing="isSoundPlaying"
      @close="closeSettings"
      @update-wake-time="updateWakeTime"
      @update-wake-duration="updateWakeDuration"
      @update-brightness="updateBrightness"
      @update-color="updateColor"
      @update-chime="updateChimeEnabled"
      @update-ambient-sound="ambient.selectSound"
      @update-ambient-volume="ambient.setVolume"
      @update-sleep-timer="ambient.setSleepTimer"
      @stop-sound="ambient.stopSound"
      @preview-mode="startPreview"
      @stop-preview="stopPreview"
      @reset-settings="resetSettings"
      @show-help="handleShowHelp"
    />

    <HelpPopover
      v-if="showHelp"
      :settings="settings"
      @close="closeHelp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'
import { useOnboarding } from '../composables/useOnboarding'
import { useWakeLock } from '../composables/useWakeLock'
import { useKeepAwake } from '../composables/useKeepAwake'
import { useChime } from '../composables/useChime'
import { useAmbient } from '../composables/useAmbient'
import { useWakeAlarm } from '../composables/useWakeAlarm'
import { MODE_ORDER, MODE_PRESENTATION } from '../utils/modes'

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
  humanTimeRemaining,
  almostTimeLabel,
  okayTimeLabel,
  nextWakeTime,
  toggleNightLight,
  startPreview,
  stopPreview
} = useNightLight(settings)

// "Tonight's plan": the three phases with their times, reactive to settings, so
// the mental model is reinforced on the home screen before the light is on.
const plan = computed(() =>
  MODE_ORDER.map(key => ({
    key,
    label: MODE_PRESENTATION[key].label,
    icon: MODE_PRESENTATION[key].icon,
    color: settings.value.colors[key],
    time: key === 'night' ? 'Now' : key === 'wake' ? almostTimeLabel.value : okayTimeLabel.value
  }))
)

// On-demand help replaces the old full-screen intro. The one-time first-run
// "hint" reuses the onboarding flag: it shows a subtle nudge on the "?" until
// the user's first meaningful interaction, then never returns.
const { showOnboarding: showFirstRunHint, completeOnboarding: dismissFirstRunHint } = useOnboarding()
const showHelp = ref(false)

const openHelp = () => {
  dismissFirstRunHint()
  showHelp.value = true
}
const closeHelp = () => {
  showHelp.value = false
}
const toggleHelp = () => {
  if (showHelp.value) {
    closeHelp()
  } else {
    openHelp()
  }
}

// Any of these first interactions retires the first-run hint.
const handleToggleSettings = () => {
  dismissFirstRunHint()
  toggleSettings()
}

// "How it works" from Settings: close the panel, then show the help popover.
const handleShowHelp = () => {
  if (isSettingsOpen.value) {
    toggleSettings()
  }
  openHelp()
}

// Keep the screen awake while the light is on — a night light that sleeps is
// useless. useWakeLock covers the web; useKeepAwake is its native counterpart
// (no-op on web).
useWakeLock(isActive)
useKeepAwake(isActive)

// Native-only: fire an "okay to get up" local notification at the wake
// transition even if the app is closed/backgrounded. No-op on the web PWA.
useWakeAlarm(isActive, nextWakeTime, settings)

// Optional "okay to get up" chime. Priming happens inside the Turn On tap so the
// autonomous transition hours later can still play audio on iOS.
const chime = useChime(computed(() => settings.value.chimeEnabled))

// Ambient sound (white noise, rain, etc). Its runtime playback state feeds the
// settings picker so it can show which sound is currently playing.
const ambient = useAmbient()
const activeSoundId = ambient.activeSoundId
const isSoundPlaying = ambient.isPlaying

// Turning on is a guaranteed user gesture, so unlock audio there. Turning off
// silences the ambient sound too (the device goes dark and quiet together),
// while keeping the saved sound choice for next time.
const handleToggleNightLight = () => {
  dismissFirstRunHint()
  if (!isActive.value) {
    chime.prime()
    ambient.prime()
  } else {
    ambient.stopPlayback()
  }
  toggleNightLight()
}

// Main-screen speaker button: start the saved sound (this tap unlocks audio) or
// stop it if it's already playing.
const handleToggleSound = () => {
  if (isSoundPlaying.value) {
    ambient.stopPlayback()
  } else if (settings.value.ambientSound) {
    ambient.prime()
    void ambient.selectSound(settings.value.ambientSound)
  }
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

// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case ' ':
      if (!isSettingsOpen.value && !showHelp.value) {
        event.preventDefault()
        handleToggleNightLight()
      }
      break
    case 'Escape':
      if (showHelp.value) {
        closeHelp()
      } else if (isSettingsOpen.value) {
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
