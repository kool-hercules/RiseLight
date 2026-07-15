<script setup lang="ts">
import type { LightMode, Settings } from '../types'

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
  'update-brightness': [state: keyof Settings['brightness'], value: number]
  'update-color': [state: keyof Settings['colors'], color: string]
  'preview-mode': [mode: LightMode]
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

const updateBrightness = (state: keyof Settings['brightness'], event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value)
  if (!isNaN(value)) {
    emit('update-brightness', state, value)
  }
}

const updateColor = (state: keyof Settings['colors'], event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.value) {
    emit('update-color', state, target.value)
  }
}
</script>

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

      <!-- Colors and Brightness -->
      <div class="mb-6">
        <h3 class="text-sm font-medium mb-3">Colors & Brightness</h3>
        
        <!-- Night Mode -->
        <div class="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-200">Night Mode</label>
            <input
              type="color"
              :value="settings.colors.night"
              @input="updateColor('night', $event)"
              class="bg-transparent border-0 w-8 h-8 cursor-pointer"
            >
          </div>
          <div class="mb-2">
            <label class="block text-xs text-gray-400 mb-1">
              Brightness: {{ settings.brightness.night }}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="settings.brightness.night"
              @input="updateBrightness('night', $event)"
              class="slider w-full"
            >
          </div>
          <button
            @click="$emit('preview-mode', 'night')"
            class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Preview
          </button>
        </div>

        <!-- Wake Mode -->
        <div class="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-200">Wake Mode</label>
            <input
              type="color"
              :value="settings.colors.wake"
              @input="updateColor('wake', $event)"
              class="bg-transparent border-0 w-8 h-8 cursor-pointer"
            >
          </div>
          <div class="mb-2">
            <label class="block text-xs text-gray-400 mb-1">
              Brightness: {{ settings.brightness.wake }}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="settings.brightness.wake"
              @input="updateBrightness('wake', $event)"
              class="slider w-full"
            >
          </div>
          <button
            @click="$emit('preview-mode', 'wake')"
            class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Preview
          </button>
        </div>

        <!-- Awake Mode -->
        <div class="mb-4 p-4 bg-gray-800/50 rounded-lg">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-200">Awake Mode</label>
            <input
              type="color"
              :value="settings.colors.awake"
              @input="updateColor('awake', $event)"
              class="bg-transparent border-0 w-8 h-8 cursor-pointer"
            >
          </div>
          <div class="mb-2">
            <label class="block text-xs text-gray-400 mb-1">
              Brightness: {{ settings.brightness.awake }}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="settings.brightness.awake"
              @input="updateBrightness('awake', $event)"
              class="slider w-full"
            >
          </div>
          <button
            @click="$emit('preview-mode', 'awake')"
            class="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Preview
          </button>
        </div>
      </div>

      <!-- Preview Control -->
      <div class="mb-6">
        <button
          @click="$emit('stop-preview')"
          class="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
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
