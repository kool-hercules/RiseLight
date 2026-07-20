<script setup lang="ts">
import type { SoundIconName } from '../utils/ambient'

defineProps<{ name: SoundIconName }>()
</script>

<template>
  <svg
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Noise: stacked signal bars -->
    <template v-if="name === 'noise'">
      <path d="M5 14v-4" />
      <path d="M9 17V7" />
      <path d="M13 15V9" />
      <path d="M17 18V6" />
      <path d="M21 13v-2" />
    </template>

    <!-- Rain: cloud with drops -->
    <template v-else-if="name === 'rain'">
      <path d="M6 12a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 0117 12" />
      <path d="M8 16l-1 2" />
      <path d="M12 16l-1 2" />
      <path d="M16 16l-1 2" />
    </template>

    <!-- Ocean: rolling waves -->
    <template v-else-if="name === 'ocean'">
      <path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </template>

    <!-- Fan: blades around a hub -->
    <template v-else-if="name === 'fan'">
      <circle cx="12" cy="12" r="1.4" />
      <path d="M12 12c0-4 .5-6 2-6s2.5 2 1 4-3 2-3 2z" />
      <path d="M12 12c4 0 6 .5 6 2s-2 2.5-4 1-2-3-2-3z" />
      <path d="M12 12c0 4-.5 6-2 6s-2.5-2-1-4 3-2 3-2z" />
      <path d="M12 12c-4 0-6-.5-6-2s2-2.5 4-1 2 3 2 3z" />
    </template>

    <!-- Wind: gusts -->
    <template v-else-if="name === 'wind'">
      <path d="M3 8h10a2.5 2.5 0 10-2.5-2.5" />
      <path d="M3 12h15a2.5 2.5 0 11-2.5 2.5" />
      <path d="M3 16h8a2.5 2.5 0 112.5 2.5" />
    </template>

    <!-- Heart -->
    <template v-else>
      <path d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5C19 15.65 12 20 12 20z" />
    </template>
  </svg>
</template>
