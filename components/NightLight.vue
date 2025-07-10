<template>
  <div
    class="night-light"
    :class="lightClasses"
    :style="lightStyles"
    @click="$emit('toggle-settings')"
  >
    <!-- Status overlay -->
    <div class="absolute top-4 left-4 z-10">
      <div class="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
        <div class="flex items-center mb-2">
          <div :class="['status-indicator', statusIndicatorClass]"></div>
          <span class="text-sm font-medium">{{ statusMessage }}</span>
        </div>
        <div v-if="isActive" class="text-xs text-gray-300">
          {{ formatTimeRemaining }}
        </div>
      </div>
    </div>

    <!-- Time display -->
    <div class="absolute top-4 right-4 z-10">
      <div class="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
        <div class="time-display text-right text-white/90">
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
          Tap to start night light
        </div>
      </div>
    </div>

    <!-- Settings indicator -->
    <div class="absolute bottom-4 left-4 z-10">
      <button
        @click.stop="$emit('toggle-settings')"
        class="bg-black/50 hover:bg-black/70 rounded-full p-3 backdrop-blur-sm transition-colors"
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
import { computed } from 'vue'
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

// Computed properties
const lightClasses = computed(() => ({
  'night-light-white': props.currentColor === 'white',
  'night-light-blue': props.currentColor === 'blue',
  'night-light-pink': props.currentColor === 'pink'
}))

const lightStyles = computed(() => ({
  '--light-opacity': props.brightness.toString()
}))

const statusIndicatorClass = computed(() => ({
  'status-white': props.currentColor === 'white',
  'status-blue': props.currentColor === 'blue',
  'status-pink': props.currentColor === 'pink'
}))

const currentTimeDisplay = computed(() => {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }
  return props.currentTime.toLocaleTimeString([], options)
})
</script>

<style scoped>
.night-light {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

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