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
        <button
          @click.stop="$emit('toggle-nightlight')"
          class="control-button text-xl min-w-[140px]"
        >
          {{ isActive ? 'Turn Off' : 'Turn On' }}
        </button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LightColor, LightState } from '../types'
import { stateHeadline, stateIcon } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'

interface Props {
  currentColor: LightColor
  brightness: number
  isActive: boolean
  currentState: LightState
  formatTimeRemaining: string
  formatOkayToRise: string
  currentTime: Date
}

const props = defineProps<Props>()

defineEmits<{
  'toggle-nightlight': []
  'toggle-settings': []
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

const displayIcon = computed(() => (props.isActive ? stateIcon(props.currentState) : 'power'))

const headline = computed(() => (props.isActive ? stateHeadline(props.currentState) : 'Sleep light'))

const detail = computed(() => {
  if (!props.isActive) {
    return 'Tap Turn On to start tonight’s light.'
  }

  switch (props.currentState) {
    case 'night':
      return props.formatOkayToRise
        ? `Okay to get up at ${props.formatOkayToRise}`
        : 'Rest until morning.'
    case 'wake':
      return `Okay to get up in ${props.formatTimeRemaining}`
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
