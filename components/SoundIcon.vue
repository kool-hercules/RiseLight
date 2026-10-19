<script setup lang="ts">
import { computed, useId } from 'vue'
import type { SoundIconName } from '../utils/ambient'
import type { SoundLevels } from '../utils/soundLevels'

// Sound glyphs. Given live `levels` (useSoundLevels) they move with the actual
// audio: noise bars follow the spectrum, rain falls as fast as the hiss, the
// waves drift and swell with the ocean, the fan spins with its whir, gusts
// stream with the wind, the heart swells on each real thump. Without levels,
// or in silence, they hold perfectly still.

const props = defineProps<{
  name: SoundIconName
  levels?: SoundLevels | null
}>()

const live = computed(() => props.levels ?? null)
// The drifting waves are longer than the glyph; clip them to its usual width.
const waveClipId = `sound-wave-clip-${useId()}`

// Noise: five bars, resting heights from the static glyph. The byte spectrum
// is dB-scaled, so steady noise sits around 0.4-0.8; stretch that range to
// the bar's height instead of pinning every bar at full.
const BAR_X = [5, 9, 13, 17, 21]
const BAR_REST = [4, 10, 6, 12, 2]
const BAND_FLOOR = 0.35
const BAND_RANGE = 0.62
const bars = computed(() =>
  BAR_X.map((x, i) => {
    const level = live.value ? Math.min(1, Math.max(0, (live.value.bands[i] - BAND_FLOOR) / BAND_RANGE)) : 0
    const height = live.value ? 2 + level * 14 : BAR_REST[i]
    return `M${x} ${12 + height / 2}V${12 - height / 2}`
  })
)

// Rain: drops slide down a few units and fade, looping on sound time.
const DROP_X = [8, 12, 16]
const drops = computed(() =>
  DROP_X.map((x, i) => {
    if (!live.value) {
      return { d: `M${x} 16l-1 2`, opacity: 1 }
    }
    const fall = (live.value.clock * 2.4 + i * 0.37) % 1
    const y = 14.5 + fall * 5
    return { d: `M${x + 0.5 - fall} ${y}l-1 2`, opacity: (1 - fall) * Math.min(1, 0.3 + live.value.high * 3) }
  })
)

// Ocean: three waves drifting sideways (one 12-unit period = seamless) and
// bobbing with the swell.
const WAVE = 'c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0 4-2 6 0 4 2 6 0 4-2 6 0 4 2 6 0'
const waves = computed(() =>
  [9, 14, 19].map((y, i) => {
    if (!live.value) {
      return { d: `M-10 ${y}${WAVE}`, transform: '' }
    }
    const shift = -((live.value.clock * (3 + i) * 2) % 12)
    const bob = Math.sin(live.value.clock * 1.5 + i) * live.value.rms * 1.2
    return { d: `M-10 ${y}${WAVE}`, transform: `translate(${shift.toFixed(2)} ${bob.toFixed(2)})` }
  })
)

const fanRotation = computed(() => (live.value ? `rotate(${((live.value.clock * 300) % 360).toFixed(1)} 12 12)` : ''))

const windOffset = computed(() => (live.value ? (-live.value.clock * 18).toFixed(2) : '0'))
const windOpacity = computed(() => (live.value ? 0.45 + live.value.rms * 0.55 : 1))

const heartScale = computed(() => (live.value ? 1 + live.value.low * 0.18 : 1))
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
      <path v-for="(d, index) in bars" :key="index" :d="d" />
    </template>

    <!-- Rain: cloud with drops -->
    <template v-else-if="name === 'rain'">
      <path d="M6 12a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 0117 12" />
      <path v-for="(drop, index) in drops" :key="index" :d="drop.d" :opacity="drop.opacity" />
    </template>

    <!-- Ocean: rolling waves -->
    <template v-else-if="name === 'ocean'">
      <clipPath :id="waveClipId">
        <rect x="1" y="0" width="22" height="24" />
      </clipPath>
      <g :clip-path="`url(#${waveClipId})`">
        <path v-for="(wave, index) in waves" :key="index" :d="wave.d" :transform="wave.transform" />
      </g>
    </template>

    <!-- Fan: blades around a hub -->
    <template v-else-if="name === 'fan'">
      <circle cx="12" cy="12" r="1.4" />
      <g :transform="fanRotation">
        <path d="M12 12c0-4 .5-6 2-6s2.5 2 1 4-3 2-3 2z" />
        <path d="M12 12c4 0 6 .5 6 2s-2 2.5-4 1-2-3-2-3z" />
        <path d="M12 12c0 4-.5 6-2 6s-2.5-2-1-4 3-2 3-2z" />
        <path d="M12 12c-4 0-6-.5-6-2s2-2.5 4-1 2 3 2 3z" />
      </g>
    </template>

    <!-- Wind: gusts -->
    <template v-else-if="name === 'wind'">
      <g :opacity="windOpacity" :stroke-dasharray="levels ? '9 3' : undefined" :stroke-dashoffset="windOffset">
        <path d="M3 8h10a2.5 2.5 0 10-2.5-2.5" />
        <path d="M3 12h15a2.5 2.5 0 11-2.5 2.5" />
        <path d="M3 16h8a2.5 2.5 0 112.5 2.5" />
      </g>
    </template>

    <!-- Heart -->
    <template v-else>
      <path
        d="M12 20s-7-4.35-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5C19 15.65 12 20 12 20z"
        :transform="heartScale === 1 ? undefined : `translate(12 13.5) scale(${heartScale.toFixed(3)}) translate(-12 -13.5)`"
      />
    </template>
  </svg>
</template>
