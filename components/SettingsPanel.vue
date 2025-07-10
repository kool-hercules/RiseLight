<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    @click="$emit('close')"
  >
    <div
      class="settings-panel max-w-md w-full max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Night Light Settings</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-white transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Wake Time Setting -->
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">Wake Time</label>
        <input
          type="time"
          :value="settings.wakeTime"
          @input="updateWakeTime"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
      </div>

      <!-- Wake Duration Setting -->
      <div class="mb-6">
        <label class="block text-sm font-medium mb-2">
          Wake Duration: {{ settings.wakeDuration }} minutes
        </label>
        <input
          type="range"
          min="1"
          max="60"
          step="1"
          :value="settings.wakeDuration"
          @input="updateWakeDuration"
          class="slider w-full"
        >
        <div class="flex justify-between text-xs text-gray-400 mt-1">
          <span>1 min</span>
          <span>60 min</span>
        </div>
      </div>

      <!-- Brightness Controls -->
      <div class="mb-6">
        <h3 class="text-sm font-medium mb-3">Brightness</h3>
        
        <!-- White Light Brightness -->
        <div class="mb-4">
          <label class="block text-sm text-gray-300 mb-2">
            White Light: {{ settings.brightness.white }}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="settings.brightness.white"
            @input="updateBrightness('white', $event)"
            class="slider w-full"
          >
        </div>

        <!-- Blue Light Brightness -->
        <div class="mb-4">
          <label class="block text-sm text-gray-300 mb-2">
            Blue Light: {{ settings.brightness.blue }}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="settings.brightness.blue"
            @input="updateBrightness('blue', $event)"
            class="slider w-full"
          >
        </div>

        <!-- Pink Light Brightness -->
        <div class="mb-4">
          <label class="block text-sm text-gray-300 mb-2">
            Pink Light: {{ settings.brightness.pink }}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="settings.brightness.pink"
            @input="updateBrightness('pink', $event)"
            class="slider w-full"
          >
        </div>
      </div>

      <!-- Preview Buttons -->
      <div class="mb-6">
        <h3 class="text-sm font-medium mb-3">Preview Colors</h3>
        <div class="flex gap-2">
          <button
            @click="$emit('preview-color', 'white')"
            class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            White
          </button>
          <button
            @click="$emit('preview-color', 'blue')"
            class="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Blue
          </button>
          <button
            @click="$emit('preview-color', 'pink')"
            class="flex-1 bg-pink-600 hover:bg-pink-500 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Pink
          </button>
        </div>
        <button
          @click="$emit('stop-preview')"
          class="w-full mt-2 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Stop Preview
        </button>
      </div>

      <!-- Reset Button -->
      <div class="flex gap-2">
        <button
          @click="$emit('reset-settings')"
          class="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg transition-colors"
        >
          Reset to Default
        </button>
        <button
          @click="$emit('close')"
          class="flex-1 control-button"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Settings, LightColor } from '../types'

interface Props {
  isOpen: boolean
  settings: Settings
}

defineProps<Props>()

// Event handlers
const emit = defineEmits<{
  'close': []
  'update-wake-time': [time: string]
  'update-wake-duration': [duration: number]
  'update-brightness': [color: keyof Settings['brightness'], value: number]
  'preview-color': [color: LightColor]
  'stop-preview': []
  'reset-settings': []
}>()

const updateWakeTime = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.value) {
    emit('update-wake-time', target.value)
  }
}

const updateWakeDuration = (event: Event) => {
  const target = event.target as HTMLInputElement
  const duration = parseInt(target.value)
  if (!isNaN(duration)) {
    emit('update-wake-duration', duration)
  }
}

const updateBrightness = (color: keyof Settings['brightness'], event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value)
  if (!isNaN(value)) {
    emit('update-brightness', color, value)
  }
}
</script>

<style scoped>
/* Custom scrollbar for settings panel */
.settings-panel::-webkit-scrollbar {
  width: 6px;
}

.settings-panel::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 3px;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 3px;
}

.settings-panel::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Ensure inputs are touch-friendly on mobile */
input[type="time"],
input[type="range"] {
  touch-action: manipulation;
}
</style> 