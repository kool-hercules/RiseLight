<template>
  <div class="night-light">
    <!-- Glow layer: opacity-controlled, sits behind and never blocks taps -->
    <div class="light-layer" :style="lightStyles"></div>

    <!-- Status overlay -->
    <div class="status-overlay" :style="chromeStyle">
      <div class="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
        <div class="flex items-center mb-2">
          <div class="status-indicator" :style="{ backgroundColor: currentColor }"></div>
          <span class="text-sm font-medium">{{ statusMessage }}</span>
        </div>
        <div v-if="isActive" class="text-xs text-gray-300">
          {{ formatTimeRemaining }}
        </div>
      </div>
    </div>

    <!-- Time display -->
    <div class="time-overlay" :style="chromeStyle">
      <div class="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
        <div class="time-display text-right text-white/80">
          {{ currentTimeDisplay }}
        </div>
      </div>
    </div>

    <!-- Center controls -->
    <div class="absolute inset-0 flex items-center justify-center z-10">
      <div class="text-center">
        <button
          @click.stop="$emit('toggle-nightlight')"
          class="control-button text-xl mb-4 min-w-[120px]"
        >
          {{ isActive ? 'Turn Off' : 'Turn On' }}
        </button>

        <div v-if="!isActive" class="text-white/70 text-sm">
          Tap “Turn On” to start
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LightColor } from '../types'

interface Props {
  currentColor: LightColor
  brightness: number
  isActive: boolean
  statusMessage: string
  formatTimeRemaining: string
  currentTime: Date
}

const props = defineProps<Props>()

defineEmits<{
  'toggle-nightlight': []
  'toggle-settings': []
}>()

// Idle handling: once the light is on and the user has been still for a while,
// fade the status/clock chrome so the device sits quietly in a dark room. Any
// interaction brings it back. The chrome never fully disappears and the
// controls are never dimmed, so nothing becomes unreachable.
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
@media (orientation: landscape) {
  .time-display {
    @apply text-4xl;
  }
}

@media (orientation: portrait) {
  .time-display {
    @apply text-6xl;
  }
}
</style>
