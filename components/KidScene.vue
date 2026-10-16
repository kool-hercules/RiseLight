<script setup lang="ts">
import { computed } from 'vue'
import type { LightMode, LightState } from '../types'

// The kid-readable picture: an inline SVG drawn in code (no assets), painted
// only in the current light colour so it never adds white or blue light at
// night. Driven by the phase and its progress:
//   story time  a lamp, an open book, stars appearing one by one
//   stay in bed the moon arcs across and sets; a sleeping friend; stars twinkle
//   almost time the sun rises over the hills (the countdown a toddler can read)
//   okay to get up  full sun, friend awake with a gentle bounce
//   idle        nothing

const props = defineProps<{
  state: LightState
  progress: number
  color: string
  brightness: number // 0..1
  previewMode: LightMode | null
  muted?: boolean // parent controls are open: step back so their text stays legible
}>()

const scene = computed<LightState>(() => props.previewMode ?? props.state)
// A preview shows the scene mid-phase so every element is visible.
const p = computed(() => (props.previewMode ? 0.5 : Math.min(1, Math.max(0, props.progress))))

// Dim with the light; never fully invisible while lit, never glaring.
const sceneOpacity = computed(() =>
  props.muted ? 0.06 : Math.min(0.85, Math.max(0.18, props.brightness * 1.6))
)

const STARS = [
  [48, 40, 2.2], [92, 72, 1.6], [140, 30, 2], [188, 62, 1.4], [236, 26, 2.4],
  [282, 58, 1.6], [330, 34, 2], [362, 80, 1.5], [70, 110, 1.4], [312, 112, 1.8],
  [160, 100, 1.3], [250, 96, 1.5]
] as const

// Story time: stars appear one by one as wind-down progresses.
const visibleStars = computed(() =>
  scene.value === 'bedtime' ? Math.ceil(p.value * STARS.length) : STARS.length
)

// Night: the moon rises on the left and sets on the right.
const moon = computed(() => ({
  x: 60 + 280 * p.value,
  y: 170 - Math.sin(Math.PI * p.value) * 120
}))

// Wake: the sun climbs from behind the hills.
const HORIZON = 232
const sunY = computed(() => HORIZON + 30 - 120 * p.value)
</script>

<template>
  <div v-if="scene !== 'inactive'" class="kid-scene" :style="{ color, opacity: sceneOpacity }" aria-hidden="true">
    <svg viewBox="0 0 400 300" class="kid-scene__svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <clipPath id="kid-sky">
          <rect x="0" y="0" width="400" :height="HORIZON" />
        </clipPath>
        <!-- Ground fades out at the picture's edges so it melts into the glow
             instead of ending in a hard-edged box. -->
        <radialGradient id="kid-ground-fade-gradient" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(200 236) scale(195 66)">
          <stop offset="0.3" stop-color="white" />
          <stop offset="1" stop-color="black" />
        </radialGradient>
        <mask id="kid-ground-fade">
          <rect x="0" y="0" width="400" height="300" fill="url(#kid-ground-fade-gradient)" stroke="none" />
        </mask>
        <mask id="kid-crescent">
          <rect x="0" y="0" width="400" height="300" fill="white" stroke="none" />
          <circle :cx="moon.x + 11" :cy="moon.y - 7" r="22" fill="black" stroke="none" />
        </mask>
      </defs>

      <!-- Stars: story time and night -->
      <g v-if="scene === 'bedtime' || scene === 'night'" fill="currentColor" stroke="none">
        <circle
          v-for="(star, index) in STARS"
          v-show="index < visibleStars"
          :key="index"
          :cx="star[0]"
          :cy="star[1]"
          :r="star[2]"
          class="kid-star"
          :class="{ 'kid-star--twinkle': scene === 'night' }"
          :style="{ animationDelay: `${(index * 0.73) % 4}s` }"
          opacity="0.6"
        />
      </g>

      <!-- Story time: lamp and open book -->
      <g v-if="scene === 'bedtime'" stroke-width="3">
        <circle cx="96" cy="150" r="46" fill="currentColor" stroke="none" opacity="0.12" />
        <path d="M74 150 L118 150 L106 118 L86 118 Z" fill="currentColor" fill-opacity="0.35" />
        <path d="M96 150 V214" />
        <path d="M78 216 H114" />
        <path d="M200 236 C178 222 152 220 128 224 V180 C152 176 178 178 200 192 Z" fill="currentColor" fill-opacity="0.2" />
        <path d="M200 236 C222 222 248 220 272 224 V180 C248 176 222 178 200 192 Z" fill="currentColor" fill-opacity="0.2" />
        <path d="M200 192 V236" />
        <path d="M148 196 C162 194 176 196 186 200 M148 208 C162 206 176 208 186 212 M214 200 C224 196 238 194 252 196 M214 212 C224 208 238 206 252 208" stroke-width="2" opacity="0.6" />
      </g>

      <!-- Night: crescent moon arcing across, a friend asleep under a blanket -->
      <g v-if="scene === 'night'" stroke-width="3">
        <circle :cx="moon.x" :cy="moon.y" r="24" fill="currentColor" stroke="none" mask="url(#kid-crescent)" opacity="0.8" />
        <path d="M110 262 C110 236 140 226 200 226 C260 226 300 236 300 262 Z" fill="currentColor" fill-opacity="0.18" />
        <circle cx="132" cy="226" r="20" fill="currentColor" fill-opacity="0.25" />
        <path d="M122 226 q4 4 8 0 M136 226 q4 4 8 0" stroke-width="2.5" />
        <g class="kid-zzz" stroke-width="2.5">
          <path d="M158 196 h10 l-10 12 h10" />
          <path d="M176 178 h7 l-7 9 h7" opacity="0.7" />
        </g>
      </g>

      <!-- Almost time: the sun rises over the hills -->
      <g v-if="scene === 'wake'" stroke-width="3">
        <g clip-path="url(#kid-sky)">
          <circle cx="200" :cy="sunY" r="34" fill="currentColor" fill-opacity="0.55" stroke="none" />
          <g v-if="p > 0.45" :opacity="(p - 0.45) * 1.8">
            <path
              v-for="angle in [-60, -30, 0, 30, 60]"
              :key="angle"
              :transform="`rotate(${angle} 200 ${sunY})`"
              :d="`M200 ${sunY - 46} V${sunY - 60}`"
            />
          </g>
        </g>
        <path :d="`M0 ${HORIZON} C70 200 130 206 200 ${HORIZON} C270 206 330 200 400 ${HORIZON} V300 H0 Z`" fill="currentColor" fill-opacity="0.22" stroke="none" mask="url(#kid-ground-fade)" />
        <path :d="`M0 ${HORIZON} C70 200 130 206 200 ${HORIZON} C270 206 330 200 400 ${HORIZON}`" mask="url(#kid-ground-fade)" />
      </g>

      <!-- Okay to get up: full sun, friend awake -->
      <g v-if="scene === 'awake'" stroke-width="3">
        <g class="kid-sun">
          <circle cx="200" cy="86" r="38" fill="currentColor" fill-opacity="0.6" stroke="none" />
          <path
            v-for="angle in [0, 45, 90, 135, 180, 225, 270, 315]"
            :key="angle"
            :transform="`rotate(${angle} 200 86)`"
            d="M200 30 V14"
          />
        </g>
        <path :d="`M0 ${HORIZON + 20} C90 220 310 220 400 ${HORIZON + 20} V300 H0 Z`" fill="currentColor" fill-opacity="0.18" stroke="none" mask="url(#kid-ground-fade)" />
        <path :d="`M0 ${HORIZON + 20} C90 220 310 220 400 ${HORIZON + 20}`" mask="url(#kid-ground-fade)" />
        <g class="kid-bounce">
          <circle cx="200" cy="196" r="22" fill="currentColor" fill-opacity="0.3" />
          <circle cx="192" cy="192" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="208" cy="192" r="2.5" fill="currentColor" stroke="none" />
          <path d="M191 202 q9 8 18 0" stroke-width="2.5" />
          <path d="M200 218 V244 M200 226 L180 210 M200 226 L220 210 M200 244 L188 262 M200 244 L212 262" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.kid-scene {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: opacity 0.4s ease, color 1s ease;
}

.kid-scene__svg {
  width: min(78vw, 70vh * 4 / 3);
  height: auto;
}

.kid-star--twinkle {
  animation: kid-twinkle 4s ease-in-out infinite;
}

.kid-zzz {
  animation: kid-float 5s ease-in-out infinite;
}

.kid-sun {
  transform-origin: 200px 86px;
  animation: kid-spin 60s linear infinite;
}

.kid-bounce {
  animation: kid-bounce 1.6s ease-in-out infinite;
}

@keyframes kid-twinkle {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.2; }
}

@keyframes kid-float {
  0%, 100% { transform: translateY(0); opacity: 0.9; }
  50% { transform: translateY(-6px); opacity: 0.5; }
}

@keyframes kid-spin {
  to { transform: rotate(360deg); }
}

@keyframes kid-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@media (prefers-reduced-motion: reduce) {
  .kid-scene,
  .kid-star--twinkle,
  .kid-zzz,
  .kid-sun,
  .kid-bounce {
    animation: none;
    transition: none;
  }
}
</style>
