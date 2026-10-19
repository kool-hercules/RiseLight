<script setup lang="ts">
import { computed } from 'vue'
import type { FriendId, LightMode, LightState, StarShape } from '../types'
import { drawnEdgeCount, resolveConstellation } from '../utils/constellations'
import NightFriend from './NightFriend.vue'
import type { FriendPose } from './NightFriend.vue'

// The kid-readable picture: an inline SVG drawn in code (no assets), painted
// only in the current light colour so it never adds white or blue light at
// night. A night friend is the main character; the sky tells the time.
//   story time  the friend reads; stars join, one faint line at a time, into a
//               shape (the friend, the child's initial, or a heart) that is
//               finished just before lights out
//   stay in bed the friend sleeps; the lines fade to a hint and the moon
//               crosses the sky over the night
//   almost time the friend peeks with one eye; the sun climbs over the hill
//   okay to get up  the friend sits up and stretches under a full sun
//   idle        nothing
//
// Calm budget: the friend's breathing (10 s) is the only steady motion. The
// moon and sun move with the routine's own progress, far too slowly to see
// from moment to moment. No twinkles, sparkles, bounces or spinning rays.

const props = withDefaults(defineProps<{
  state: LightState
  progress: number
  color: string
  brightness: number // 0..1
  previewMode: LightMode | null
  muted?: boolean // parent controls are open: step back so their text stays legible
  friend?: FriendId
  starShape?: StarShape
  childInitial?: string
}>(), {
  muted: false,
  friend: 'bo',
  starShape: 'friend',
  childInitial: ''
})

const scene = computed<LightState>(() => props.previewMode ?? props.state)
// A preview shows the scene mid-phase so every element is visible.
const p = computed(() => (props.previewMode ? 0.5 : Math.min(1, Math.max(0, props.progress))))

// Dim with the light; never fully invisible while lit, never glaring.
const sceneOpacity = computed(() =>
  props.muted ? 0.06 : Math.min(0.85, Math.max(0.18, props.brightness * 1.6))
)

const pose = computed<FriendPose>(() => {
  switch (scene.value) {
    case 'bedtime':
      return 'reading'
    case 'wake':
      return 'peeking'
    case 'awake':
      return 'awake'
    default:
      return 'asleep'
  }
})

// Faint background stars, fixed in place.
const STARS = [
  [36, 44, 1.4], [84, 92, 1.1], [112, 30, 1.2], [300, 40, 1.3], [352, 74, 1.1],
  [376, 30, 1.2], [60, 150, 1], [330, 130, 1.1], [270, 100, 1], [20, 100, 1]
] as const

const backgroundStarOpacity = computed(() => {
  switch (scene.value) {
    case 'bedtime':
    case 'night':
      return 0.35
    case 'wake':
      return 0.12
    default:
      return 0
  }
})

// ── Constellation ──────────────────────────────────────────────────────────
// Placed above the friend; the shape's 100x80 box is scaled to 120x96.
const CONSTELLATION_X = 140
const CONSTELLATION_Y = 18
const CONSTELLATION_SCALE = 1.2

const constellation = computed(() => resolveConstellation(props.starShape, props.friend, props.childInitial))

const toScene = ([x, y]: readonly [number, number]) => ({
  x: CONSTELLATION_X + x * CONSTELLATION_SCALE,
  y: CONSTELLATION_Y + y * CONSTELLATION_SCALE
})

// Story time draws the lines as it goes; afterwards the shape stays complete.
const drawnCount = computed(() =>
  scene.value === 'bedtime'
    ? drawnEdgeCount(p.value, constellation.value.edges.length)
    : constellation.value.edges.length
)
const isComplete = computed(() => drawnCount.value === constellation.value.edges.length)

const lines = computed(() =>
  constellation.value.edges.slice(0, drawnCount.value).map(([a, b]) => {
    const from = toScene(constellation.value.points[a])
    const to = toScene(constellation.value.points[b])
    return { x1: from.x, y1: from.y, x2: to.x, y2: to.y }
  })
)

const stars = computed(() => {
  const lit = new Set(constellation.value.edges.slice(0, drawnCount.value).flat())
  return constellation.value.points.map((point, index) => ({ ...toScene(point), lit: lit.has(index) }))
})

const extras = computed(() => constellation.value.extras.map(toScene))

// The lines are the countdown, so they are clearest during story time and
// fade to a hint once the child should be asleep.
const lineOpacity = computed(() => (scene.value === 'bedtime' ? 0.4 : scene.value === 'night' ? 0.08 : 0))
const constellationOpacity = computed(() => {
  switch (scene.value) {
    case 'bedtime':
      return 1
    case 'night':
      return 0.6
    case 'wake':
      return 0.2
    default:
      return 0
  }
})

// A small four-point star, centred on (x, y).
const sparkle = (x: number, y: number, s: number): string =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`

// ── Moon and sun ───────────────────────────────────────────────────────────
// Night: the moon rises on the left and sets on the right over the whole night.
const moon = computed(() => ({
  x: 60 + 280 * p.value,
  y: 170 - Math.sin(Math.PI * p.value) * 120
}))

// Wake: the sun climbs from behind the hill, off to the side of the friend.
const HORIZON = 232
const SUN_X = 312
const sunY = computed(() => HORIZON + 30 - 120 * p.value)
const SUN_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]
</script>

<template>
  <div v-if="scene !== 'inactive'" class="kid-scene" :style="{ color, opacity: sceneOpacity }" aria-hidden="true">
    <svg viewBox="0 0 400 300" class="kid-scene__svg" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <defs>
        <!-- Everything above the ground's curve, so the sun rises from behind it -->
        <clipPath id="kid-sky">
          <path :d="`M0 0 H400 V${HORIZON + 8} C310 ${HORIZON - 14} 90 ${HORIZON - 14} 0 ${HORIZON + 8} Z`" />
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

      <!-- Faint background stars -->
      <g fill="currentColor" stroke="none" class="kid-fade" :opacity="backgroundStarOpacity">
        <circle v-for="(star, index) in STARS" :key="index" :cx="star[0]" :cy="star[1]" :r="star[2]" />
      </g>

      <!-- Constellation: joins up during story time, then fades to a hint -->
      <g class="kid-constellation kid-fade" :opacity="constellationOpacity" data-test="constellation">
        <g class="kid-fade" :opacity="lineOpacity" stroke-width="1.2">
          <line
            v-for="(line, index) in lines"
            :key="`${starShape}-${friend}-${childInitial}-${index}`"
            class="kid-line"
            :x1="line.x1"
            :y1="line.y1"
            :x2="line.x2"
            :y2="line.y2"
          />
        </g>
        <g fill="currentColor" stroke="none">
          <template v-for="(star, index) in stars" :key="index">
            <path v-if="star.lit" :d="sparkle(star.x, star.y, 3)" opacity="0.85" />
            <circle v-else :cx="star.x" :cy="star.y" r="1.3" opacity="0.35" />
          </template>
          <circle
            v-for="(star, index) in extras"
            :key="`extra-${index}`"
            :cx="star.x"
            :cy="star.y"
            r="1.5"
            :opacity="isComplete ? 0.7 : 0.25"
            class="kid-fade"
          />
        </g>
      </g>

      <!-- Night: crescent moon arcing across over the whole night -->
      <circle
        v-if="scene === 'night'"
        :cx="moon.x"
        :cy="moon.y"
        r="24"
        fill="currentColor"
        stroke="none"
        mask="url(#kid-crescent)"
        opacity="0.7"
      />

      <!-- Almost time: the sun rises from behind the ground -->
      <g v-if="scene === 'wake'" stroke-width="3">
        <g clip-path="url(#kid-sky)">
          <circle :cx="SUN_X" :cy="sunY" r="30" fill="currentColor" fill-opacity="0.5" stroke="none" />
          <g v-if="p > 0.45" :opacity="(p - 0.45) * 1.8">
            <path
              v-for="angle in [-60, -30, 0, 30, 60]"
              :key="angle"
              :transform="`rotate(${angle} ${SUN_X} ${sunY})`"
              :d="`M${SUN_X} ${sunY - 42} V${sunY - 54}`"
            />
          </g>
        </g>
      </g>

      <!-- Okay to get up: a full, still sun -->
      <g v-if="scene === 'awake'" stroke-width="3">
        <circle :cx="SUN_X" cy="78" r="30" fill="currentColor" fill-opacity="0.55" stroke="none" />
        <path
          v-for="angle in SUN_RAY_ANGLES"
          :key="angle"
          :transform="`rotate(${angle} ${SUN_X} 78)`"
          :d="`M${SUN_X} 34 V22`"
          opacity="0.6"
        />
      </g>

      <!-- Soft ground under the friend -->
      <path
        :d="`M0 ${HORIZON + 8} C90 ${HORIZON - 14} 310 ${HORIZON - 14} 400 ${HORIZON + 8} V300 H0 Z`"
        fill="currentColor"
        fill-opacity="0.14"
        stroke="none"
        mask="url(#kid-ground-fade)"
      />

      <!-- The night friend -->
      <g transform="translate(120 132) scale(0.8)">
        <NightFriend :friend="friend" :pose="pose" width="200" height="160" data-test="friend" :data-pose="pose" :data-friend="friend" />
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

/* Phase changes cross-fade slowly instead of snapping. */
.kid-fade {
  transition: opacity 4s ease;
}

/* Each new constellation line eases in over a few seconds. */
.kid-line {
  animation: kid-line-in 6s ease-out;
}

@keyframes kid-line-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .kid-scene,
  .kid-fade {
    transition: none;
  }

  .kid-line {
    animation: none;
  }
}
</style>
