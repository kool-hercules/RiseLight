<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Settings } from '../types'
import { MODE_ORDER, MODE_PRESENTATION } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'

defineProps<{ settings: Settings }>()
const emit = defineEmits<{ close: [] }>()

const modes = MODE_ORDER.map(key => ({ key, ...MODE_PRESENTATION[key] }))

// Move focus into the card so keyboard/VoiceOver users land inside it.
const titleRef = ref<HTMLElement | null>(null)
onMounted(() => titleRef.value?.focus())
</script>

<template>
  <div
    class="help-scrim fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    @click="emit('close')"
  >
    <div
      class="settings-panel max-w-sm w-full"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      @click.stop
    >
      <div class="flex items-center justify-between mb-4">
        <h2 id="help-title" ref="titleRef" tabindex="-1" class="text-lg font-semibold outline-none">
          How RiseLight works
        </h2>
        <button
          @click="emit('close')"
          class="text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p class="text-sm text-gray-400 mb-4 leading-relaxed">
        The light shows little ones — at a glance — when to stay in bed and when it’s okay to get up.
      </p>

      <ul class="space-y-3 mb-4">
        <li v-for="mode in modes" :key="mode.key" class="flex items-center gap-3">
          <span
            class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            :style="{ backgroundColor: settings.colors[mode.key] }"
          >
            <ModeIcon :name="mode.icon" class="w-5 h-5 text-black/70" />
          </span>
          <div>
            <div class="text-sm font-medium">{{ mode.label }}</div>
            <div class="text-xs text-gray-400">{{ mode.blurb }}</div>
          </div>
        </li>
      </ul>

      <p class="text-xs text-gray-500 mb-4 leading-relaxed">
        Set the wake-up time, sounds, and colors with the gear icon. Tap Turn On to start tonight’s light.
      </p>

      <button @click="emit('close')" class="w-full control-button">Got it</button>
    </div>
  </div>
</template>

<style scoped>
.help-scrim {
  padding: 1rem;
  padding-top: max(1rem, env(safe-area-inset-top, 0px));
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}
</style>
