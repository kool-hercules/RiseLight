<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { AmbientSoundId, DaySchedule, FriendId, LightMode, Settings, StarShape } from '../types'
import { SLEEP_TIMER_OPTIONS } from '../types'
import { useSoundLevels } from '../composables/useSoundLevels'
import { FRIENDS, STAR_SHAPE_OPTIONS, friendName } from '../utils/friends'
import NightFriend from './NightFriend.vue'
import { MODE_ORDER, MODE_PRESENTATION } from '../utils/modes'
import { AMBIENT_SOUNDS } from '../utils/ambient'
import ModeIcon from './ModeIcon.vue'
import SoundIcon from './SoundIcon.vue'
import ScheduleEditor from './ScheduleEditor.vue'

interface Props {
  isOpen: boolean
  settings: Settings
  previewMode: LightMode | null
  saveFailed?: boolean
  activeSoundId?: AmbientSoundId | null
  isSoundPlaying?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'update-schedule': [schedule: DaySchedule[]]
  'update-day': [day: number, patch: Partial<DaySchedule>]
  'update-wake-duration': [duration: number]
  'update-wind-down': [minutes: number]
  'update-awake-hold': [minutes: number]
  'update-toggle': [key: 'autoSchedule' | 'ambientAutoStart' | 'childLock' | 'sceneEnabled', enabled: boolean]
  'update-brightness': [state: keyof Settings['brightness'], value: number]
  'update-color': [state: keyof Settings['colors'], color: string]
  'update-chime': [enabled: boolean]
  'update-ambient-sound': [id: AmbientSoundId]
  'update-ambient-volume': [value: number]
  'update-sleep-timer': [minutes: number]
  'update-friend': [friend: FriendId]
  'update-star-shape': [shape: StarShape]
  'update-child-initial': [initial: string]
  'stop-sound': []
  'preview-mode': [mode: LightMode]
  'stop-preview': []
  'reset-settings': []
  'show-help': []
}>()

const modes = MODE_ORDER.map(key => ({ key, ...MODE_PRESENTATION[key] }))
const ambientSounds = AMBIENT_SOUNDS
const sleepOptions = SLEEP_TIMER_OPTIONS
const friends = FRIENDS
const starShapes = STAR_SHAPE_OPTIONS

// The playing sound's tile moves with the audio, but only while the panel is
// actually open (the meter stops otherwise).
const soundLevels = useSoundLevels(computed(() => props.isOpen && !props.previewMode && Boolean(props.isSoundPlaying)))

// Keep only the last letter typed; anything that isn't A-Z clears it.
const onInitialInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const letter = target.value.replace(/[^a-z]/gi, '').slice(-1).toUpperCase()
  target.value = letter
  emit('update-child-initial', letter)
}

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

const checked = (event: Event): boolean => (event.target as HTMLInputElement).checked

// Tapping the sound that's currently playing stops it; any other tile selects
// and starts that sound. The "Off" tile always stops.
const onSoundTile = (id: AmbientSoundId) => {
  if (props.activeSoundId === id && props.isSoundPlaying) {
    emit('stop-sound')
  } else {
    emit('update-ambient-sound', id)
  }
}

const onVolumeInput = (event: Event) => {
  const value = parseInt((event.target as HTMLInputElement).value)
  if (!isNaN(value)) {
    emit('update-ambient-volume', value)
  }
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

        <!-- Routine -->
        <div class="mb-6">
          <h3 class="text-sm font-medium mb-3">Routine</h3>
          <ScheduleEditor
            :settings="settings"
            @update-schedule="schedule => emit('update-schedule', schedule)"
            @update-day="(day, patch) => emit('update-day', day, patch)"
            @update-wake-duration="minutes => emit('update-wake-duration', minutes)"
            @update-wind-down="minutes => emit('update-wind-down', minutes)"
            @update-awake-hold="minutes => emit('update-awake-hold', minutes)"
            @update-auto-schedule="enabled => emit('update-toggle', 'autoSchedule', enabled)"
          />
        </div>

        <!-- Child lock -->
        <div class="mb-6">
          <label class="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span class="block text-sm font-medium">Child lock</span>
              <span class="block text-xs text-gray-500 mt-1">
                Hold the clock for 3 seconds to open controls. Off: any tap opens them.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              :checked="settings.childLock"
              @change="emit('update-toggle', 'childLock', checked($event))"
              class="chime-toggle shrink-0"
              aria-label="Child lock"
            >
          </label>
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

        <!-- Ambient sounds -->
        <div class="mb-6">
          <h3 class="text-sm font-medium mb-1">Sounds</h3>
          <p class="text-xs text-gray-500 mb-3">
            Ambient sound to play while the light is on. Tap to start, tap again to stop.
          </p>

          <div class="sound-grid">
            <button
              v-for="sound in ambientSounds"
              :key="sound.id"
              @click="onSoundTile(sound.id)"
              :aria-pressed="settings.ambientSound === sound.id"
              class="sound-tile"
              :class="{ 'sound-tile--active': settings.ambientSound === sound.id }"
            >
              <SoundIcon
                :name="sound.icon"
                :levels="activeSoundId === sound.id && isSoundPlaying ? soundLevels : null"
                class="w-6 h-6"
              />
              <span class="sound-label">{{ sound.label }}</span>
              <span
                v-if="activeSoundId === sound.id && isSoundPlaying"
                class="sound-playing"
                aria-label="Playing"
              />
            </button>

            <button
              @click="$emit('stop-sound')"
              :aria-pressed="settings.ambientSound === null"
              class="sound-tile"
              :class="{ 'sound-tile--active': settings.ambientSound === null }"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M22 9l-6 6" />
                <path d="M16 9l6 6" />
              </svg>
              <span class="sound-label">Off</span>
            </button>
          </div>

          <label class="block text-xs text-gray-400 mt-4 mb-1">
            Volume: {{ settings.ambientVolume }}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            :value="settings.ambientVolume"
            @input="onVolumeInput"
            class="slider w-full"
            aria-label="Ambient sound volume"
          >

          <label class="block text-xs text-gray-400 mt-4 mb-1">Sleep timer</label>
          <div class="timer-row">
            <button
              v-for="minutes in sleepOptions"
              :key="minutes"
              @click="$emit('update-sleep-timer', minutes)"
              :aria-pressed="settings.sleepTimerMinutes === minutes"
              class="timer-chip"
              :class="{ 'timer-chip--active': settings.sleepTimerMinutes === minutes }"
            >
              {{ minutes === 0 ? 'Off' : `${minutes}m` }}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            Fades the sound out after this long. The light keeps running.
          </p>

          <label class="flex items-center justify-between gap-4 cursor-pointer mt-4">
            <span>
              <span class="block text-sm font-medium">Start sound at bedtime</span>
              <span class="block text-xs text-gray-500 mt-1">
                Plays the chosen sound when story time begins; stops at “okay to get up”.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              :checked="settings.ambientAutoStart"
              @change="emit('update-toggle', 'ambientAutoStart', checked($event))"
              class="chime-toggle shrink-0"
              aria-label="Start sound at bedtime"
            >
          </label>
        </div>

        <!-- Kid screen: the picture, the night friend and the story-time stars -->
        <div class="mb-6">
          <h3 class="text-sm font-medium mb-3">Kid screen</h3>
          <label class="flex items-center justify-between gap-4 cursor-pointer mb-4">
            <span>
              <span class="block text-sm font-medium">Show picture</span>
              <span class="block text-xs text-gray-500 mt-1">
                A night friend under a moon-and-sun sky little ones can read. Off: just the glow.
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              :checked="settings.sceneEnabled"
              @change="emit('update-toggle', 'sceneEnabled', checked($event))"
              class="chime-toggle shrink-0"
              aria-label="Show picture"
            >
          </label>

          <template v-if="settings.sceneEnabled">
            <p class="block text-sm font-medium mb-1">Night friend</p>
            <p class="text-xs text-gray-500 mb-2">
              Reads at story time, sleeps through the night, peeks when morning is near and stretches when it’s okay to get up.
            </p>
            <div class="friend-grid mb-4" role="radiogroup" aria-label="Night friend">
              <button
                v-for="friend in friends"
                :key="friend.id"
                role="radio"
                :aria-checked="settings.friend === friend.id"
                class="friend-tile"
                :class="{ 'friend-tile--active': settings.friend === friend.id }"
                @click="emit('update-friend', friend.id)"
              >
                <NightFriend :friend="friend.id" pose="asleep" class="friend-portrait" />
                <span class="text-sm font-medium">{{ friend.name }}</span>
                <span class="text-xs text-gray-400 leading-tight">{{ friend.description }}</span>
              </button>
            </div>

            <p class="block text-sm font-medium mb-1">Story-time stars</p>
            <p class="text-xs text-gray-500 mb-2">
              During story time the stars join up, one line at a time, and finish just before lights out.
            </p>
            <div class="timer-row" role="radiogroup" aria-label="Story-time stars">
              <button
                v-for="shape in starShapes"
                :key="shape.id"
                role="radio"
                :aria-checked="settings.starShape === shape.id"
                class="timer-chip"
                :class="{ 'timer-chip--active': settings.starShape === shape.id }"
                @click="emit('update-star-shape', shape.id)"
              >
                {{ shape.id === 'friend' ? friendName(settings.friend) : shape.label }}
              </button>
            </div>
            <label v-if="settings.starShape === 'initial'" class="flex items-center justify-between gap-4 mt-3">
              <span>
                <span class="block text-sm font-medium">Initial</span>
                <span class="block text-xs text-gray-500 mt-1">One letter, A to Z. Until it’s set, the stars draw {{ friendName(settings.friend) }}.</span>
              </span>
              <input
                type="text"
                inputmode="text"
                autocapitalize="characters"
                autocomplete="off"
                maxlength="2"
                :value="settings.childInitial"
                class="initial-input"
                aria-label="Child’s initial"
                @input="onInitialInput"
              >
            </label>
          </template>
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

        <!-- How it works -->
        <button
          @click="$emit('show-help')"
          class="w-full text-sm text-gray-400 hover:text-white transition-colors py-2 mb-4"
        >
          How it works
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

/* Sound picker: a responsive grid of tap targets, each ≥ 44px tall. */
.sound-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.sound-tile {
  @apply relative flex flex-col items-center justify-center gap-1 bg-gray-800/60 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors;
  min-height: 68px;
  padding: 0.5rem 0.25rem;
  touch-action: manipulation;
}

.sound-tile--active {
  @apply bg-blue-600/30 text-white;
  box-shadow: inset 0 0 0 1.5px #3b82f6;
}

.sound-label {
  @apply text-xs text-center leading-tight;
}

/* A small pulsing dot marking the sound that is actually playing right now. */
.sound-playing {
  @apply absolute rounded-full bg-green-400;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  animation: sound-pulse 1.6s ease-in-out infinite;
}

@keyframes sound-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .sound-playing {
    animation: none;
  }
}

/* Night friend picker: three portrait tiles. */
.friend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.friend-tile {
  @apply flex flex-col items-center gap-0.5 bg-gray-800/60 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors text-center;
  padding: 0.5rem 0.375rem 0.625rem;
  touch-action: manipulation;
}

.friend-tile--active {
  @apply bg-blue-600/30 text-white;
  box-shadow: inset 0 0 0 1.5px #3b82f6;
}

.friend-portrait {
  width: 100%;
  max-width: 96px;
  height: auto;
  color: #fbbf77;
}

.initial-input {
  @apply bg-gray-800 text-white text-center text-xl font-semibold rounded-lg border border-gray-600 shrink-0;
  width: 52px;
  height: 52px;
  text-transform: uppercase;
}

/* Ensure inputs are touch-friendly on mobile */
input[type="time"],
input[type="range"] {
  touch-action: manipulation;
}

</style>
