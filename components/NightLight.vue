<template>
  <div class="night-light">
    <!-- Glow layer: opacity-controlled, sits behind and never blocks taps -->
    <div class="light-layer" :style="lightStyles"></div>

    <!-- Screen-reader announcement of the current meaning -->
    <p class="sr-only" aria-live="polite">{{ headline }}. {{ detail }}</p>

    <!-- Time display -->
    <div class="time-overlay" :style="chromeStyle">
      <div class="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
        <div class="time-display text-right text-white/80">
          {{ currentTimeDisplay }}
        </div>
      </div>
    </div>

    <!-- Center: teaches the current state at a glance, then the control -->
    <div class="center-stage absolute inset-0 flex items-center justify-center z-10">
      <div class="text-center legible">
        <div :style="chromeStyle">
          <ModeIcon :name="displayIcon" class="w-14 h-14 mx-auto mb-4 text-white/90" />
          <div class="text-3xl font-semibold mb-1">{{ headline }}</div>
          <div class="text-sm text-white/80 mb-8 min-h-[1.25rem]">{{ detail }}</div>
        </div>

        <!-- The dock owns exit during a preview, so the toggle only shows in the
             real on/off flow — never contradicting a preview. -->
        <button
          v-if="!previewMode"
          @click.stop="$emit('toggle-nightlight')"
          class="control-button text-xl min-w-[140px]"
        >
          {{ isActive ? 'Turn Off' : 'Turn On' }}
        </button>

        <!-- Tonight's plan: a quiet, at-a-glance reminder of the three phases so
             the model is reinforced every time before the light is turned on. -->
        <div
          v-if="!isActive && !previewMode"
          class="plan legible mt-10 mx-auto max-w-[16rem] text-left"
        >
          <p class="text-xs uppercase tracking-wide text-white/50 mb-3 text-center">Tonight’s plan</p>
          <ul class="space-y-2.5">
            <li v-for="phase in plan" :key="phase.key" class="flex items-center gap-3">
              <span
                class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                :style="{ backgroundColor: phase.color }"
              >
                <ModeIcon :name="phase.icon" class="w-4 h-4 text-black/70" />
              </span>
              <span class="flex-1 text-sm text-white/85">{{ phase.label }}</span>
              <span class="text-xs text-white/60 tabular-nums">{{ phase.time }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Settings indicator -->
    <div class="settings-button-container">
      <button
        @click.stop="$emit('toggle-settings')"
        class="settings-button"
        aria-label="Open settings"
      >
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Help: an always-available "?" explainer, with a subtle one-time nudge on
         first run so a new user isn't lost — no full-screen intro. -->
    <div class="help-button-container">
      <div v-if="showHint" class="help-hint" role="status">
        New here? Tap for a quick guide
      </div>
      <button
        @click.stop="$emit('toggle-help')"
        class="settings-button"
        :class="{ 'help-pulse': showHint }"
        aria-label="How RiseLight works"
      >
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.2a2.5 2.5 0 015 .1c0 1.6-1.7 2-2.4 2.7-.3.3-.6.7-.6 1.5" />
          <path d="M12 17h.01" />
        </svg>
      </button>
    </div>

    <!-- Sound quick-toggle: mirror the gear on the opposite corner so a parent
         can start/stop the chosen sound in a dark room without opening settings.
         Only shown once a sound has been picked. -->
    <div v-if="hasSound" class="sound-button-container">
      <button
        @click.stop="$emit('toggle-sound')"
        class="settings-button"
        :aria-label="isSoundPlaying ? 'Stop sound' : 'Play sound'"
        :aria-pressed="isSoundPlaying"
      >
        <svg
          v-if="isSoundPlaying"
          class="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7" />
          <path d="M18.5 5.5a9 9 0 010 13" />
        </svg>
        <svg
          v-else
          class="w-6 h-6 text-white/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M22 9l-6 6" />
          <path d="M16 9l6 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LightColor, LightMode, LightState } from '../types'
import { MODE_PRESENTATION, type ModeIconName, stateHeadline, stateIcon } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'

interface PlanPhase {
  key: LightMode
  label: string
  time: string
  color: string
  icon: ModeIconName
}

interface Props {
  currentColor: LightColor
  brightness: number
  isActive: boolean
  currentState: LightState
  previewMode: LightMode | null
  humanTimeRemaining: string
  okayToRiseLabel: string
  plan: PlanPhase[]
  currentTime: Date
  hasSound: boolean
  isSoundPlaying: boolean
  showHint: boolean
}

const props = defineProps<Props>()

defineEmits<{
  'toggle-nightlight': []
  'toggle-settings': []
  'toggle-sound': []
  'toggle-help': []
}>()

// Idle handling: once the light is on and the user has been still for a while,
// fade the teaching text and clock so the device sits quietly in a dark room.
// Any interaction brings it back. The Turn Off / gear controls are never
// dimmed, so nothing ever becomes unreachable.
const IDLE_MS = 8000
const idle = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | null = null

const markActive = (): void => {
  idle.value = false
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  idleTimer = setTimeout(() => {
    idle.value = true
  }, IDLE_MS)
}

const chromeStyle = computed(() => ({
  opacity: props.isActive && idle.value ? '0.2' : '1',
  transition: 'opacity 0.8s ease'
}))

const displayIcon = computed(() => {
  if (props.previewMode) {
    return MODE_PRESENTATION[props.previewMode].icon
  }
  return props.isActive ? stateIcon(props.currentState) : 'power'
})

const headline = computed(() => {
  if (props.previewMode) {
    return MODE_PRESENTATION[props.previewMode].label
  }
  return props.isActive ? stateHeadline(props.currentState) : 'Sleep light'
})

const detail = computed(() => {
  // During a preview the screen fills with the previewed color; say exactly that
  // rather than showing the real schedule state, which would contradict it.
  if (props.previewMode) {
    return 'Preview'
  }

  if (!props.isActive) {
    return 'Tap Turn On to start tonight’s light.'
  }

  switch (props.currentState) {
    case 'night':
      return props.okayToRiseLabel
        ? `Okay to get up at ${props.okayToRiseLabel}`
        : 'Rest until morning.'
    case 'wake':
      return `Okay to get up ${props.humanTimeRemaining}`
    case 'awake':
      return 'Good morning!'
    default:
      return ''
  }
})

const lightStyles = computed(() => ({
  '--light-color': props.currentColor,
  '--light-opacity': props.brightness.toString()
}))

const currentTimeDisplay = computed(() => {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
  return props.currentTime.toLocaleTimeString([], options)
})

onMounted(() => {
  markActive()
  window.addEventListener('pointerdown', markActive)
  window.addEventListener('pointermove', markActive)
  window.addEventListener('keydown', markActive)
})

onBeforeUnmount(() => {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  window.removeEventListener('pointerdown', markActive)
  window.removeEventListener('pointermove', markActive)
  window.removeEventListener('keydown', markActive)
})
</script>

<style scoped>
/* Help "?" button: sits just to the right of the gear (bottom-left). */
.help-button-container {
  position: absolute;
  z-index: 10;
  bottom: max(1rem, env(safe-area-inset-bottom, 1rem));
  left: calc(max(1rem, env(safe-area-inset-left, 1rem)) + 3.75rem);
}

/* One-time first-run nudge floating just above the "?". */
.help-hint {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 0;
  width: max-content;
  max-width: 62vw;
  padding: 0.5rem 0.75rem;
  border-radius: 0.6rem;
  font-size: 0.75rem;
  line-height: 1.1rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  animation: help-hint-in 0.4s ease-out;
}

/* A soft expanding ring while the first-run nudge is active. */
.help-pulse {
  position: relative;
}

.help-pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  box-shadow: 0 0 0 0 rgba(147, 197, 253, 0.55);
  animation: help-ring 2s ease-out infinite;
}

@keyframes help-ring {
  0% { box-shadow: 0 0 0 0 rgba(147, 197, 253, 0.5); }
  70% { box-shadow: 0 0 0 14px rgba(147, 197, 253, 0); }
  100% { box-shadow: 0 0 0 0 rgba(147, 197, 253, 0); }
}

@keyframes help-hint-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .help-pulse::after,
  .help-hint {
    animation: none;
  }
}

/* Clear the notch/home-indicator on all sides; extra horizontal room so the
   teaching text and control never sit under a landscape notch. */
.center-stage {
  padding-top: max(1.5rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1.5rem, env(safe-area-inset-left, 0px));
  padding-right: max(1.5rem, env(safe-area-inset-right, 0px));
}

/* Lift the dim teaching text off the colored glow so it stays readable at any
   brightness/color the schedule produces. */
.legible {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), 0 0 2px rgba(0, 0, 0, 0.5);
}

@media (orientation: landscape) {
  .time-display {
    @apply text-3xl;
  }
}

@media (orientation: portrait) {
  .time-display {
    @apply text-5xl;
  }
}
</style>
