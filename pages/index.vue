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
import { refDebounced } from '@vueuse/core'
import type { AmbientSoundId, LightState } from '../types'
import { useSettings } from '../composables/useSettings'
import { useNightLight } from '../composables/useNightLight'
import { useOnboarding } from '../composables/useOnboarding'
import { useWakeLock } from '../composables/useWakeLock'
import { useKeepAwake } from '../composables/useKeepAwake'
import { useChime } from '../composables/useChime'
import { useAmbient } from '../composables/useAmbient'
import { useWakeAlarm } from '../composables/useWakeAlarm'
import { MODE_PRESENTATION, describePhase, stateIcon } from '../utils/modes'
import { formatClockTime } from '../utils/time'

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

const isSleepPhase = (state: LightState): boolean => state === 'bedtime' || state === 'night'

// A nap makes no sense once the evening routine is under way.
const canNap = computed(() => !isSleepPhase(phase.value.base) && !isSleepPhase(currentState.value))

// Kid screen vs parent layer. Until first-run onboarding completes, the parent
// layer is pinned open (exempt from the lock and auto-hide); after that it
// opens via the child-lock hold (or any tap with the lock off) and hides itself.
const { showOnboarding: showFirstRunHint, completeOnboarding: dismissFirstRunHint } = useOnboarding()
const showHelp = ref(false)
const parentOpen = ref(false)
const parentVisible = computed(() =>
  (parentOpen.value || showFirstRunHint.value) && !isSettingsOpen.value && !showHelp.value
)

const openParent = () => {
  parentOpen.value = true
}
const closeParent = () => {
  dismissFirstRunHint()
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
  dismissFirstRunHint()
  showHelp.value = true
}
const closeHelp = () => {
  showHelp.value = false
}

// Any of these first interactions retires the first-run pin.
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

// Browsers only let audio start under a user gesture. The routine now runs by
// itself (no nightly tap), so when a scheduled sound or chime is blocked we
// raise one flag; the kid screen shows a tiny dim speaker badge and the next
// tap anywhere unlocks both players and retries the pending sound.
const needsAudioUnlock = ref(false)
let pendingSound: AmbientSoundId | null = null

const startAmbient = async (id: AmbientSoundId): Promise<void> => {
  if (!(await ambient.selectSound(id))) {
    pendingSound = id
    needsAudioUnlock.value = true
  }
}

const autoStartAmbient = (): void => {
  const saved = settings.value.ambientSound
  if (settings.value.ambientAutoStart && saved) {
    void startAmbient(saved)
  }
}

// Must run synchronously inside the gesture: both prime() calls start before
// any await.
const primeAudio = async (): Promise<boolean> => {
  const [chimeOk, ambientOk] = await Promise.all([chime.prime(), ambient.prime()])
  return chimeOk && ambientOk
}

const unlockAudio = async (): Promise<void> => {
  if (!needsAudioUnlock.value) {
    return
  }
  const unlocked = await primeAudio()
  const retry = pendingSound
  pendingSound = null
  if (retry && isSleepPhase(currentState.value)) {
    await startAmbient(retry)
  }
  needsAudioUnlock.value = !unlocked || pendingSound !== null
}

// Story time (or lights-out with no wind-down, a manual start, or a nap)
// starts the saved sound; morning and "off for now" stop it.
watch(currentState, (state, previous) => {
  if (
    (state === 'bedtime' && previous !== 'bedtime')
    || (state === 'night' && !isSleepPhase(previous))
  ) {
    autoStartAmbient()
  }

  if (state === 'awake' || (state === 'inactive' && previous !== 'awake')) {
    pendingSound = null
    if (isSoundPlaying.value) {
      ambient.stopPlayback()
    }
  }

  // Sound the chime only when the routine crosses into "okay to get up" from
  // an earlier lit phase. Reloads into an already-green morning don't chime.
  if (state === 'awake' && (previous === 'night' || previous === 'wake')) {
    void chime.play().then(played => {
      if (!played) {
        needsAudioUnlock.value = true
      }
    })
  }
})

// Turning the chime on is a tap, so try to unlock right away.
watch(() => settings.value.chimeEnabled, enabled => {
  if (enabled) {
    void chime.prime().then(ok => {
      if (!ok) {
        needsAudioUnlock.value = true
      }
    })
  }
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
const PANEL_IDLE_MS = 60_000
let panelIdleTimer: ReturnType<typeof setTimeout> | null = null

const clearPanelIdle = () => {
  if (panelIdleTimer) {
    clearTimeout(panelIdleTimer)
    panelIdleTimer = null
  }
}

const armPanelIdle = () => {
  clearPanelIdle()
  if (settings.value.childLock && (isSettingsOpen.value || showHelp.value)) {
    panelIdleTimer = setTimeout(() => {
      closeHelp()
      closeSettings()
      parentOpen.value = false
    }, PANEL_IDLE_MS)
  }
}

watch(
  () => [isSettingsOpen.value, showHelp.value, settings.value.childLock] as const,
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
        handleToggleNightLight()
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

// Prevent context menu on long press (for mobile)
const handleContextMenu = (event: Event) => {
  event.preventDefault()
}

const handleUnlockGesture = () => {
  armPanelIdle()
  void unlockAudio()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('contextmenu', handleContextMenu)
  document.addEventListener('pointerdown', handleUnlockGesture, true)
  document.addEventListener('keydown', handleUnlockGesture, true)

  // A reload mid-routine: try to resume the bedtime sound and pre-unlock the
  // chime. Without a gesture these usually come back blocked, which raises the
  // unlock badge so one tap restores both.
  if (isSleepPhase(currentState.value)) {
    autoStartAmbient()
  }
  if (settings.value.chimeEnabled && isArmed.value) {
    void chime.prime().then(ok => {
      if (!ok) {
        needsAudioUnlock.value = true
      }
    })
  }
})

onBeforeUnmount(() => {
  clearPanelIdle()
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('contextmenu', handleContextMenu)
  document.removeEventListener('pointerdown', handleUnlockGesture, true)
  document.removeEventListener('keydown', handleUnlockGesture, true)
})
</script>

<style scoped>
.app-container {
  @apply w-full h-full relative overflow-hidden;
}
</style>
