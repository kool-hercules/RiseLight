<script setup lang="ts">
import type { ModeIconName } from '../utils/modes'

defineProps<{ name: ModeIconName }>()
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
    <!-- Story time: open book -->
    <template v-if="name === 'book'">
      <path d="M12 6.5C10.2 5.2 7.7 4.6 4 4.8v12.6c3.7-.2 6.2.4 8 1.7" />
      <path d="M12 6.5c1.8-1.3 4.3-1.9 8-1.7v12.6c-3.7-.2-6.2.4-8 1.7" />
      <path d="M12 6.5v12.6" />
    </template>

    <!-- Stay in bed: moon -->
    <path
      v-else-if="name === 'moon'"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
    />

    <!-- Almost time: sun rising over the horizon -->
    <template v-else-if="name === 'sunrise'">
      <path d="M3 18h18" />
      <path d="M7 18a5 5 0 0110 0" />
      <path d="M12 3v3" />
      <path d="M4.8 8.8l1.4 1.4" />
      <path d="M19.2 8.8l-1.4 1.4" />
      <path d="M9 12l3-3 3 3" />
    </template>

    <!-- Okay to get up: sun -->
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M19.1 4.9l-1.4 1.4" />
      <path d="M6.3 17.7l-1.4 1.4" />
    </template>

    <!-- Off: power -->
    <template v-else>
      <path d="M12 3v9" />
      <path d="M6.4 6.4a8 8 0 1011.2 0" />
    </template>
  </svg>
</template>
