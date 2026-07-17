<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Settings } from '../types'
import { MODE_ORDER, MODE_PRESENTATION } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'

defineProps<{ settings: Settings }>()

const emit = defineEmits<{
  'update-wake-time': [time: string]
  'complete': []
}>()

const modes = MODE_ORDER.map(key => ({ key, ...MODE_PRESENTATION[key] }))

const titleRef = ref<HTMLElement | null>(null)

// Move focus into the dialog so keyboard users start inside it and VoiceOver
// announces the intro title rather than leaving focus on the page behind.
onMounted(() => {
  titleRef.value?.focus()
})

const onWakeTimeInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.value) {
    emit('update-wake-time', target.value)
  }
}
</script>

<template>
  <div
    class="onboarding-scrim fixed inset-0 z-[60] bg-gray-950 flex items-center justify-center overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
  >
    <div class="w-full max-w-md py-8">
      <div class="text-center mb-8">
        <h1
          id="onboarding-title"
          ref="titleRef"
          tabindex="-1"
          class="text-3xl font-semibold mb-2 outline-none"
        >Welcome to RiseLight</h1>
        <p class="text-sm text-gray-400 leading-relaxed">
          A gentle light that tells little ones — at a glance — when to stay in
          bed and when it’s okay to get up.
        </p>
      </div>

      <ul class="space-y-3 mb-8">
        <li
          v-for="mode in modes"
          :key="mode.key"
          class="flex items-center gap-4 bg-gray-900/70 border border-gray-800 rounded-xl p-4"
        >
          <span
            class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            :style="{ backgroundColor: settings.colors[mode.key] }"
          >
            <ModeIcon :name="mode.icon" class="w-6 h-6 text-black/70" />
          </span>
          <div>
            <div class="font-medium">{{ mode.label }}</div>
            <div class="text-xs text-gray-400">{{ mode.blurb }}</div>
          </div>
        </li>
      </ul>

      <div class="mb-8">
        <label for="onboarding-wake-time" class="block text-sm font-medium mb-2">
          What time is wake-up?
        </label>
        <input
          id="onboarding-wake-time"
          type="time"
          :value="settings.wakeTime"
          @input="onWakeTimeInput"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
        <p class="text-xs text-gray-500 mt-2">
          The light eases toward your “okay to get up” color around this time
          each morning. You can fine-tune everything later in settings.
        </p>
      </div>

      <button
        @click="emit('complete')"
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-lg transition-colors mb-3"
      >
        Get started
      </button>
      <button
        @click="emit('complete')"
        class="w-full text-sm text-gray-400 hover:text-white transition-colors py-2"
      >
        Skip intro
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Keep the intro clear of the notch and home indicator in both orientations. */
.onboarding-scrim {
  padding: 1rem;
  padding-top: max(1rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
</style>
