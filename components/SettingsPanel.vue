<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { LightMode, Settings } from '../types'
import { MODE_ORDER, MODE_PRESENTATION } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'

interface Props {
  isOpen: boolean
  settings: Settings
  previewMode: LightMode | null
  saveFailed?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'update-wake-time': [time: string]
  'update-wake-duration': [duration: number]
  'update-brightness': [state: keyof Settings['brightness'], value: number]
  'update-color': [state: keyof Settings['colors'], color: string]
  'update-chime': [enabled: boolean]
  'preview-mode': [mode: LightMode]
  'stop-preview': []
  'reset-settings': []
  'restart-intro': []
}>()

const modes = MODE_ORDER.map(key => ({ key, ...MODE_PRESENTATION[key] }))

// Move focus into the preview dock when it opens so keyboard users land on its
// controls instead of being stranded behind the full-screen preview.
const previewDock = ref<HTMLElement | null>(null)
watch(
  () => props.previewMode,
  mode => {
    if (mode) {
      void nextTick(() => {
        previewDock.value?.querySelector<HTMLButtonElement>('button')?.focus()
      })
    }
  }
)

// Confirmation gate so the destructive reset can't be triggered with one stray
// tap next to "Done". Reset the gate whenever the panel's view changes.
const confirmingReset = ref(false)
watch(
  () => [props.isOpen, props.previewMode] as const,
  () => {
    confirmingReset.value = false
  }
)

const previewLabel = computed(() =>
  props.previewMode ? MODE_PRESENTATION[props.previewMode].label : ''
)
const previewBrightness = computed(() =>
  props.previewMode ? props.settings.brightness[props.previewMode] : 0
)
const previewColor = computed(() =>
  props.previewMode ? props.settings.colors[props.previewMode] : '#000000'
)

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

const updatePreviewBrightness = (event: Event) => {
  if (props.previewMode) {
    updateBrightness(props.previewMode, event)
  }
}

const updatePreviewColor = (event: Event) => {
  if (props.previewMode) {
    updateColor(props.previewMode, event)
  }
}

const onChimeToggle = (event: Event) => {
  emit('update-chime', (event.target as HTMLInputElement).checked)
}

const confirmReset = () => {
  emit('reset-settings')
  confirmingReset.value = false
}
</script>

<template>
  <template v-if="isOpen">
    <!-- Preview bar: no dark backdrop, so the full-screen preview is visible.
         A slim control sits at the bottom to adjust or exit the preview. -->
    <div
      v-if="previewMode"
      class="preview-dock fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
    >
      <div ref="previewDock" class="settings-panel w-full max-w-md pointer-events-auto">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-medium">Previewing “{{ previewLabel }}”</span>
          <input
            type="color"
            :value="previewColor"
            @input="updatePreviewColor"
            class="color-swatch"
            aria-label="Preview color"
          >
        </div>
        <label class="block text-xs text-gray-400 mb-1">
          Brightness: {{ previewBrightness }}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          :value="previewBrightness"
          @input="updatePreviewBrightness"
          class="slider w-full mb-4"
          aria-label="Preview brightness"
        >
        <div class="flex gap-2">
          <button
            @click="$emit('stop-preview')"
            class="flex-1 control-button"
          >
            Adjust settings
          </button>
          <button
            @click="$emit('close')"
            class="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>

    <!-- Full settings panel -->
    <div
      v-else
      class="settings-scrim fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click="$emit('close')"
    >
      <div
        class="settings-panel max-w-md w-full max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold">Settings</h2>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          v-if="saveFailed"
          class="mb-6 text-xs text-amber-300 bg-amber-900/30 border border-amber-700/50 rounded-lg p-3"
        >
          Settings may not be saved on this device — storage looks unavailable
          (for example, private browsing). Changes will apply now but may not
          survive a reload.
        </div>

        <!-- Wake Time Setting -->
        <div class="mb-6">
          <label class="block text-sm font-medium mb-2">Wake-up time</label>
          <input
            type="time"
            :value="settings.wakeTime"
            @input="updateWakeTime"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
          <p class="text-xs text-gray-500 mt-1">When the morning wake-up window begins.</p>
        </div>

        <!-- Wake Duration Setting -->
        <div class="mb-6">
          <label class="block text-sm font-medium mb-2">
            Wake-up window: {{ settings.wakeDuration }} minutes
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
          <p class="text-xs text-gray-500 mt-1">
            How long the “almost time” color shows before it becomes “okay to get up”.
          </p>
        </div>

        <!-- Okay-to-get-up chime -->
        <div class="mb-6">
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span class="block text-sm font-medium">Okay-to-get-up chime</span>
              <span class="block text-xs text-gray-500 mt-1">
                A gentle sound when it becomes okay to get up. Off by default.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              :checked="settings.chimeEnabled"
              @change="onChimeToggle"
              class="chime-toggle shrink-0"
              aria-label="Play a chime when it becomes okay to get up"
            >
          </label>
        </div>

        <!-- Colors and Brightness -->
        <div class="mb-6">
          <h3 class="text-sm font-medium mb-1">Colors &amp; brightness</h3>
          <p class="text-xs text-gray-500 mb-3">Tap Preview to see any color fill the screen.</p>

          <div
            v-for="mode in modes"
            :key="mode.key"
            class="mb-4 p-4 bg-gray-800/50 rounded-lg"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="flex items-center gap-2 text-sm font-medium text-gray-200">
                <ModeIcon :name="mode.icon" class="w-5 h-5 text-gray-300" />
                {{ mode.label }}
              </span>
              <input
                type="color"
                :value="settings.colors[mode.key]"
                @input="updateColor(mode.key, $event)"
                class="color-swatch"
                :aria-label="`${mode.label} color`"
              >
            </div>
            <p class="text-xs text-gray-500 mb-2">{{ mode.settingHelp }}</p>
            <div class="mb-3">
              <label class="block text-xs text-gray-400 mb-1">
                Brightness: {{ settings.brightness[mode.key] }}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                :value="settings.brightness[mode.key]"
                @input="updateBrightness(mode.key, $event)"
                class="slider w-full"
              >
            </div>
            <button
              @click="$emit('preview-mode', mode.key)"
              class="preview-button"
            >
              Preview
            </button>
          </div>
        </div>

        <!-- Replay intro -->
        <button
          @click="$emit('restart-intro')"
          class="w-full text-sm text-gray-400 hover:text-white transition-colors py-2 mb-4"
        >
          Show intro again
        </button>

        <!-- Reset / Done -->
        <div class="flex gap-2">
          <template v-if="!confirmingReset">
            <button
              @click="confirmingReset = true"
              class="flex-1 bg-red-600/80 hover:bg-red-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Reset to Default
            </button>
            <button
              @click="$emit('close')"
              class="flex-1 control-button"
            >
              Done
            </button>
          </template>
          <template v-else>
            <button
              @click="confirmReset"
              class="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Confirm reset
            </button>
            <button
              @click="confirmingReset = false"
              class="flex-1 control-button"
            >
              Cancel
            </button>
          </template>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* Keep the preview dock and settings panel clear of the notch and home
   indicator in both orientations. */
.preview-dock {
  padding: 1rem;
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

.settings-scrim {
  padding: 1rem;
  padding-top: max(1rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

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

/* Touch-friendly color swatch (>= 44px hit area) */
.color-swatch {
  @apply bg-transparent border-0 rounded cursor-pointer;
  width: 44px;
  height: 44px;
}

/* Preview as a real, tappable button rather than a tiny text link */
.preview-button {
  @apply w-full bg-gray-700/60 hover:bg-gray-600 text-blue-200 text-sm rounded-lg transition-colors;
  min-height: 44px;
}

/* Ensure inputs are touch-friendly on mobile */
input[type="time"],
input[type="range"] {
  touch-action: manipulation;
}

/* iOS-style toggle switch with a comfortable touch target */
.chime-toggle {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 52px;
  height: 32px;
  border-radius: 9999px;
  background: #4b5563;
  cursor: pointer;
  transition: background-color 0.2s ease;
  touch-action: manipulation;
}

.chime-toggle::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 9999px;
  background: #fff;
  transition: transform 0.2s ease;
}

.chime-toggle:checked {
  background: #34c759;
}

.chime-toggle:checked::after {
  transform: translateX(20px);
}

.chime-toggle:focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .chime-toggle,
  .chime-toggle::after {
    transition: none;
  }
}
</style>
