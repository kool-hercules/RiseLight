<template>
  <div class="night-light" @click="!childLock && $emit('reveal')">
    <!-- Glow layer: opacity-controlled, sits behind and never blocks taps -->
    <div class="light-layer" :style="lightStyles"></div>

    <!-- The kid picture, slotted in by the page (tinted from the light). -->
    <slot name="scene" />

    <!-- Screen-reader announcement of the current meaning; the kid screen
         itself carries no text. -->
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>

    <!-- Dim clock, doubling as the child-lock target. Tinted by the light at
         night (no added white/blue), near-invisible and slowly drifting while
         idle so a plugged-in screen never burns in. -->
    <div class="clock-corner" :style="clockStyle">
      <HoldToUnlock :locked="childLock" @unlock="$emit('reveal')">
        <span class="time-display">{{ currentTimeDisplay }}</span>
      </HoldToUnlock>
    </div>

    <!-- Status badges: tiny and dim so they never wake anyone. -->
    <div class="status-badges">
      <span v-if="needsAudioUnlock" class="status-badge" role="status" aria-label="Tap anywhere to turn sound on">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 010 7" />
        </svg>
      </span>
      <span v-if="screenMaySleep" class="status-badge" role="status" aria-label="The screen may go to sleep">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LightColor } from '../types'
import HoldToUnlock from './HoldToUnlock.vue'

interface Props {
  currentColor: LightColor
  brightness: number
  isLit: boolean
  isPreview: boolean
  currentTime: Date
  childLock: boolean
  announcement: string
  needsAudioUnlock: boolean
  screenMaySleep: boolean
}

const props = defineProps<Props>()

defineEmits<{
  reveal: []
}>()

const DRIFT_PERIOD_MS = 10 * 60 * 1000
const DRIFT_PX = 6

// A deterministic few-pixel offset that changes every 10 minutes.
const drift = computed(() => {
  const step = Math.floor(props.currentTime.getTime() / DRIFT_PERIOD_MS)
  const wobble = (seed: number) => Math.round(Math.sin(step * seed) * DRIFT_PX)
  return { x: wobble(12.9898), y: wobble(78.233) }
})

const clockStyle = computed(() => {
  if (props.isLit || props.isPreview) {
    return {
      color: props.currentColor,
      opacity: String(Math.min(0.6, 0.25 + props.brightness * 0.5))
    }
  }
  return {
    color: '#ffffff',
    opacity: '0.18',
    transform: `translate(${drift.value.x}px, ${drift.value.y}px)`
  }
})

const lightStyles = computed(() => ({
  '--light-color': props.currentColor,
  '--light-opacity': props.brightness.toString()
}))

const currentTimeDisplay = computed(() =>
  props.currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
)
</script>

<style scoped>
.clock-corner {
  position: absolute;
  z-index: 10;
  top: max(0.5rem, env(safe-area-inset-top, 0.5rem));
  right: max(0.5rem, env(safe-area-inset-right, 0.5rem));
  transition: transform 2s ease, opacity 1s ease, color 1s ease;
}

.time-display {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin: 0;
}

.status-badges {
  position: absolute;
  z-index: 10;
  top: max(1rem, env(safe-area-inset-top, 1rem));
  left: max(1rem, env(safe-area-inset-left, 1rem));
  display: flex;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.28);
  pointer-events: none;
}

@media (orientation: landscape) {
  .time-display {
    @apply text-3xl;
  }
}

@media (orientation: portrait) {
  .time-display {
    @apply text-4xl;
  }
}

@media (prefers-reduced-motion: reduce) {
  .clock-corner {
    transition: none;
  }
}
</style>
