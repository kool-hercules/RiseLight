<template>
  <div class="app-container">
    <NightLight
      :current-color="displayColor"
      :brightness="displayBrightness"
      :is-lit="isLit"
      :is-preview="previewMode !== null"
      :current-time="currentTime"
      :child-lock="settings.childLock"
      :announcement="announcement"
      :needs-audio-unlock="needsAudioUnlock"
      :screen-may-sleep="screenMaySleep"
      @reveal="openParent"
    >
      <template #scene>
        <KidScene
          v-if="settings.sceneEnabled"
          :state="currentState"
          :progress="progress"
          :color="displayColor"
          :brightness="displayBrightness"
          :preview-mode="previewMode"
          :muted="parentVisible"
          :friend="settings.friend"
          :star-shape="settings.starShape"
          :child-initial="settings.childInitial"
        />
      </template>
    </NightLight>

    <ParentControls
      v-if="parentVisible"
      :headline="copy.headline"
      :detail="copy.detail"
      :icon="isLit ? stateIcon(currentState) : 'power'"
      :is-lit="isLit"
      :can-nap="canNap"
      :last-nap-minutes="settings.lastNapMinutes"
      :plan="plan"
      :has-sound="settings.ambientSound !== null"
      :is-sound-playing="isSoundPlaying"
      :screen-may-sleep="screenMaySleep"
      :pinned="showFirstRunHint"
      :child-lock="settings.childLock"
      :brightness="isLit ? settings.brightness[currentState as LightMode] : null"
      :volume="settings.ambientVolume"
      :sound-icon="playingSoundIcon"
      @update-brightness="value => isLit && updateBrightness(currentState as LightMode, value)"
      @update-volume="ambient.setVolume"
      @toggle-light="handleToggleNightLight"
      @start-nap="handleStartNap"
      @toggle-sound="handleToggleSound"
      @open-settings="handleToggleSettings"
      @open-help="openHelp"
      @close="closeParent"
    />

    <SettingsPanel
      :is-open="isSettingsOpen"
      :settings="settings"
      :preview-mode="previewMode"
      :save-failed="saveFailed"
      :active-sound-id="activeSoundId"
      :is-sound-playing="isSoundPlaying"
      @close="closeSettings"
      @update-schedule="updateSchedule"
      @update-day="updateDaySchedule"
      @update-wake-duration="updateWakeDuration"
      @update-wind-down="updateWindDownMinutes"
      @update-awake-hold="updateAwakeHoldMinutes"
      @update-toggle="updateToggle"
      @update-brightness="updateBrightness"
      @update-color="updateColor"
      @update-chime="updateChimeEnabled"
      @update-ambient-sound="ambient.selectSound"
      @update-ambient-volume="ambient.setVolume"
      @update-sleep-timer="ambient.setSleepTimer"
      @update-friend="updateFriend"
      @update-star-shape="updateStarShape"
      @update-child-initial="updateChildInitial"
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
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { LightMode } from '../types'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'
import { useOnboarding } from '../composables/useOnboarding'
import { useWakeLock } from '../composables/useWakeLock'
import { useKeepAwake } from '../composables/useKeepAwake'
import { useChime } from '../composables/useChime'
import { useAmbient } from '../composables/useAmbient'
import { useWakeAlarm } from '../composables/useWakeAlarm'
import { MODE_PRESENTATION, describePhase, isSleepPhase, stateIcon } from '../utils/modes'
import { formatClockTime } from '../utils/time'
import { AMBIENT_SOUNDS } from '../utils/ambient'
import { useRoutineAudio } from '../composables/useRoutineAudio'
import { useParentLayer } from '../composables/useParentLayer'

const {
  settings,
  isSettingsOpen,
  saveFailed,
  toggleSettings,
  updateSchedule,
  updateDaySchedule,
  updateWakeDuration,
  updateWindDownMinutes,
  updateAwakeHoldMinutes,
  updateToggle,
  updateBrightness,
  updateColor,
  updateChimeEnabled,
  updateLastNapMinutes,
  updateFriend,
  updateStarShape,
  updateChildInitial,
  resetSettings
} = useSettings()

const runtime = useNightLight(settings)
const {
  currentTime,
  phase,
  activeOverride,
  isLit,
  isArmed,
  displayColor,
  displayBrightness,
  currentState,
  progress,
  previewMode,
  humanTimeRemaining,
  okayTimeLabel,
  startNow,
  startNap,
  turnOffForNow,
  startPreview,
  stopPreview
} = runtime

// "Tonight's plan": each phase with its time, reactive to settings and the
// weekly schedule, so the routine is visible at a glance.
const plan = computed(() => {
  const night = runtime.plan.value
  const auto = settings.value.autoSchedule
  const rows: { key: 'bedtime' | 'night' | 'wake' | 'awake'; at: Date | null }[] = [
    { key: 'bedtime', at: night.windStart },
    { key: 'night', at: auto ? night.bedtime : null },
    { key: 'wake', at: night.wakeAt },
    { key: 'awake', at: night.okayAt }
  ]
  return rows
    .filter(row => row.key !== 'bedtime' || (auto && settings.value.windDownMinutes > 0))
    .map(row => ({
      key: row.key,
      label: MODE_PRESENTATION[row.key].label,
      icon: MODE_PRESENTATION[row.key].icon,
      color: settings.value.colors[row.key],
      time: row.at ? formatClockTime(row.at) : 'Now'
    }))
})

const copy = computed(() => describePhase({
  state: currentState.value,
  previewMode: previewMode.value,
  overrideKind: activeOverride.value?.kind ?? null,
  autoSchedule: settings.value.autoSchedule,
  storyTimeLabel: formatClockTime(runtime.plan.value.windStart),
  bedtimeLabel: formatClockTime(runtime.plan.value.bedtime),
  okayLabel: okayTimeLabel.value,
  humanTimeRemaining: humanTimeRemaining.value
}))

const announcement = computed(() => {
  const { headline, detail } = copy.value
  return `${/[.!?]$/.test(headline) ? headline : `${headline}.`} ${detail}`
})

// A nap makes no sense once the evening routine is under way.
const canNap = computed(() => !isSleepPhase(phase.value.base) && !isSleepPhase(currentState.value))

// First run pins the parent layer open until the first interaction.
const { showOnboarding: showFirstRunPin, completeOnboarding: dismissFirstRunHint } = useOnboarding()

// Keep the screen awake while the routine is armed — a night light that sleeps
// is useless. useWakeLock covers the web; useKeepAwake is its native
// counterpart (no-op on web).
const wakeLock = useWakeLock(isArmed)
const keepAwake = useKeepAwake(isArmed)

// Warn when armed but nothing is holding the screen on. Debounced so the brief
// gap while the lock is being acquired never flashes the warning.
const screenMaySleep = refDebounced(
  computed(() => isArmed.value && !keepAwake.supported && (!wakeLock.supported.value || !wakeLock.held.value)),
  2000
)

// Native-only: schedule the next week of "okay to get up" notifications so
// they fire even if the app is closed/backgrounded. No-op on the web PWA.
useWakeAlarm(runtime, settings)

// Optional "okay to get up" chime, and ambient sound (white noise, rain, etc).
const chime = useChime(computed(() => settings.value.chimeEnabled))
const ambient = useAmbient()
const activeSoundId = ambient.activeSoundId
const isSoundPlaying = ambient.isPlaying
const playingSoundIcon = computed(() =>
  AMBIENT_SOUNDS.find(sound => sound.id === activeSoundId.value)?.icon ?? null
)

const { needsAudioUnlock, startAmbient, primeAudio } = useRoutineAudio({
  currentState,
  settings,
  isArmed,
  chime,
  ambient
})

// "Start now" / "Off for now". Starting is a guaranteed gesture, so unlock
// audio there too.
const handleToggleNightLight = () => {
  dismissFirstRunHint()
  if (isLit.value) {
    turnOffForNow()
  } else {
    void primeAudio()
    startNow()
  }
}

const handleStartNap = (minutes: number) => {
  dismissFirstRunHint()
  void primeAudio()
  updateLastNapMinutes(minutes)
  startNap(minutes)
}

// Main-screen speaker button: start the saved sound (this tap unlocks audio) or
// stop it if it's already playing.
const handleToggleSound = () => {
  if (isSoundPlaying.value) {
    ambient.stopPlayback()
  } else if (settings.value.ambientSound) {
    void ambient.prime()
    void startAmbient(settings.value.ambientSound)
  }
}

const {
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
} = useParentLayer({
  childLock: computed(() => settings.value.childLock),
  isSettingsOpen,
  toggleSettings,
  stopPreview,
  firstRun: { pinned: showFirstRunPin, dismiss: dismissFirstRunHint },
  toggleLight: handleToggleNightLight
})

// Prevent context menu on long press (for mobile)
const handleContextMenu = (event: Event) => {
  event.preventDefault()
}

onMounted(() => document.addEventListener('contextmenu', handleContextMenu))
onBeforeUnmount(() => document.removeEventListener('contextmenu', handleContextMenu))
</script>

<style scoped>
.app-container {
  @apply w-full h-full relative overflow-hidden;
}
</style>
