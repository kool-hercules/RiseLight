<script setup lang="ts">
import { computed } from 'vue'
import type { FriendId } from '../types'

// The kid screen's night friend, drawn in code in the current light colour
// (currentColor at a few strengths) so it never adds white or blue light.
// Calm by design: the only steady motion is breathing at 6 breaths a minute;
// a blink, a peek or a stretch comes at most every 11-12 seconds. Nothing
// bounces, nothing talks.
//
// Poses follow the routine:
//   reading   story time, sitting up with a book, sleepy eyes
//   asleep    stay in bed, lying down under a blanket
//   peeking   almost time, still lying down, one eye opening now and then
//   awake     okay to get up, sitting up with a slow stretch

export type FriendPose = 'reading' | 'asleep' | 'peeking' | 'awake'

const props = defineProps<{
  friend: FriendId
  pose: FriendPose
}>()

const sitting = computed(() => props.pose === 'reading' || props.pose === 'awake')
</script>

<template>
  <svg viewBox="0 0 200 160" fill="currentColor" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- ───────────── Sitting: story time and okay to get up ───────────── -->
    <template v-if="sitting">
      <ellipse cx="100" cy="153" rx="56" ry="5" opacity="0.08" stroke="none" />
      <g class="friend-breathe" style="transform-origin: 100px 152px" stroke="none">
        <!-- Bo, a bear cub -->
        <template v-if="friend === 'bo'">
          <ellipse cx="100" cy="116" rx="40" ry="36" fill-opacity="0.2" />
          <ellipse cx="100" cy="124" rx="22" ry="20" fill-opacity="0.12" />
          <ellipse cx="80" cy="148" rx="13" ry="7" fill-opacity="0.3" />
          <ellipse cx="120" cy="148" rx="13" ry="7" fill-opacity="0.3" />
          <circle cx="76" cy="44" r="10" fill-opacity="0.3" />
          <circle cx="124" cy="44" r="10" fill-opacity="0.3" />
          <circle cx="76" cy="44" r="4" fill-opacity="0.45" />
          <circle cx="124" cy="44" r="4" fill-opacity="0.45" />
          <circle cx="100" cy="68" r="30" fill-opacity="0.3" />
          <ellipse cx="100" cy="78" rx="11" ry="8" fill-opacity="0.42" />
          <ellipse cx="100" cy="74" rx="3.6" ry="2.6" />
        </template>

        <!-- Pip, a bunny -->
        <template v-else-if="friend === 'pip'">
          <ellipse cx="100" cy="118" rx="36" ry="33" fill-opacity="0.2" />
          <ellipse cx="100" cy="126" rx="19" ry="18" fill-opacity="0.12" />
          <ellipse cx="82" cy="148" rx="13" ry="6.5" fill-opacity="0.3" />
          <ellipse cx="118" cy="148" rx="13" ry="6.5" fill-opacity="0.3" />
          <ellipse cx="88" cy="30" rx="8" ry="24" transform="rotate(-8 88 30)" fill-opacity="0.3" />
          <ellipse cx="112" cy="30" rx="8" ry="24" transform="rotate(8 112 30)" fill-opacity="0.3" />
          <ellipse cx="88" cy="32" rx="3.5" ry="16" transform="rotate(-8 88 32)" fill-opacity="0.45" />
          <ellipse cx="112" cy="32" rx="3.5" ry="16" transform="rotate(8 112 32)" fill-opacity="0.45" />
          <circle cx="100" cy="72" r="26" fill-opacity="0.3" />
          <circle cx="93" cy="82" r="6" fill-opacity="0.2" />
          <circle cx="107" cy="82" r="6" fill-opacity="0.2" />
          <ellipse cx="100" cy="78" rx="3" ry="2.2" />
        </template>

        <!-- Puff, a little cloud -->
        <template v-else>
          <path d="M48 150a24 24 0 0 1-2-47A32 32 0 0 1 106 86a28 28 0 0 1 48 26 22 22 0 0 1-8 38Z" fill-opacity="0.26" />
          <circle cx="76" cy="118" r="5" fill-opacity="0.22" />
          <circle cx="124" cy="118" r="5" fill-opacity="0.22" />
        </template>
      </g>

      <!-- Face (moves with the breath) -->
      <g class="friend-breathe" style="transform-origin: 100px 152px" fill="none" stroke-width="2.6">
        <template v-if="pose === 'awake'">
          <g stroke="none" fill="currentColor">
            <circle class="friend-blink" :cx="88" :cy="friend === 'puff' ? 108 : friend === 'pip' ? 68 : 62" r="3.2" />
            <circle class="friend-blink" :cx="112" :cy="friend === 'puff' ? 108 : friend === 'pip' ? 68 : 62" r="3.2" />
          </g>
          <path :d="friend === 'puff' ? 'M94 120q6 5 12 0' : friend === 'pip' ? 'M95 88q5 4 10 0' : 'M94 84q6 5 12 0'" />
        </template>
        <template v-else>
          <path :d="friend === 'puff' ? 'M82 108q5 4 10 0M108 108q5 4 10 0' : friend === 'pip' ? 'M84 68q4.5 4 9 0M107 68q4.5 4 9 0' : 'M82 63q5 4 10 0M108 63q5 4 10 0'" />
        </template>
      </g>

      <!-- Story time: a book held in both paws -->
      <g v-if="pose === 'reading'" class="friend-breathe" style="transform-origin: 100px 152px">
        <path :transform="friend === 'puff' ? 'translate(0 18)' : ''" d="M76 104l24 5 24-5v22l-24 5-24-5Z" fill-opacity="0.5" stroke="none" />
        <path :transform="friend === 'puff' ? 'translate(0 18)' : ''" d="M100 109v22" stroke-width="1.6" opacity="0.6" fill="none" />
        <g :transform="friend === 'puff' ? 'translate(0 18)' : ''" stroke="none" fill-opacity="0.34">
          <ellipse cx="76" cy="114" rx="8" ry="10" />
          <ellipse cx="124" cy="114" rx="8" ry="10" />
        </g>
      </g>

      <!-- Okay to get up: arms up in one slow stretch -->
      <g v-else stroke="none" fill-opacity="0.3">
        <g class="friend-stretch" style="--stretch-tilt: -6deg; transform-origin: 80px 104px">
          <ellipse :cx="friend === 'puff' ? 58 : 66" :cy="friend === 'puff' ? 100 : 80" rx="9" ry="19" :transform="`rotate(-28 ${friend === 'puff' ? 58 : 66} ${friend === 'puff' ? 100 : 80})`" />
        </g>
        <g class="friend-stretch" style="--stretch-tilt: 6deg; transform-origin: 120px 104px">
          <ellipse :cx="friend === 'puff' ? 142 : 134" :cy="friend === 'puff' ? 100 : 80" rx="9" ry="19" :transform="`rotate(28 ${friend === 'puff' ? 142 : 134} ${friend === 'puff' ? 100 : 80})`" />
        </g>
      </g>
    </template>

    <!-- ───────────── Lying down: stay in bed and almost time ───────────── -->
    <template v-else>
      <ellipse cx="54" cy="138" rx="38" ry="9" fill-opacity="0.14" stroke="none" />

      <!-- Body and blanket rise and fall together -->
      <g class="friend-breathe" style="transform-origin: 112px 150px" stroke="none">
        <path v-if="friend === 'puff'" d="M40 148a18 18 0 0 1 0-36 28 28 0 0 1 52-10 26 26 0 0 1 50 4 20 20 0 0 1 4 42Z" fill-opacity="0.24" />
        <ellipse v-else cx="112" cy="122" :rx="friend === 'pip' ? 54 : 58" :ry="friend === 'pip' ? 26 : 28" fill-opacity="0.2" />
        <path
          :d="friend === 'puff'
            ? 'M98 118c18-10 44-8 52 6 4 12 0 20-6 22H100c-6-8-8-20-2-28Z'
            : 'M72 106C92 94 150 92 172 110c4 20-4 36-22 38H78c-12-8-14-30-6-42Z'"
          fill-opacity="0.34"
        />
        <g fill-opacity="0.55">
          <path d="M120 120q0 4 4 4-4 0-4 4 0-4-4-4 4 0 4-4Z" />
          <path d="M146 114q0 3 3 3-3 0-3 3 0-3-3-3 3 0 3-3Z" opacity="0.8" />
          <path d="M134 134q0 3 3 3-3 0-3 3 0-3-3-3 3 0 3-3Z" opacity="0.8" />
        </g>
      </g>

      <!-- Head resting on the pillow (still; only the body breathes) -->
      <g stroke="none">
        <template v-if="friend === 'bo'">
          <circle cx="40" cy="88" r="9" fill-opacity="0.3" />
          <circle cx="63" cy="83" r="9" fill-opacity="0.3" />
          <circle cx="56" cy="108" r="26" fill-opacity="0.3" />
          <ellipse cx="48" cy="117" rx="10" ry="7" fill-opacity="0.42" />
          <ellipse cx="44" cy="114" rx="3" ry="2.2" />
        </template>
        <template v-else-if="friend === 'pip'">
          <ellipse cx="80" cy="80" rx="8" ry="26" transform="rotate(58 80 80)" fill-opacity="0.3" />
          <ellipse cx="74" cy="94" rx="7" ry="22" transform="rotate(72 74 94)" fill-opacity="0.24" />
          <circle cx="54" cy="110" r="23" fill-opacity="0.3" />
          <ellipse cx="46" cy="118" rx="2.8" ry="2" />
        </template>
      </g>

      <!-- Eyes: closed, or one peeking open during almost time -->
      <g fill="none" stroke-width="2.4">
        <template v-if="friend === 'puff'">
          <path d="M60 126q4 3 8 0" />
          <path v-if="pose === 'asleep'" d="M80 124q4 3 8 0" />
          <circle v-else class="friend-peek" cx="84" cy="124" r="3" fill="currentColor" stroke="none" />
        </template>
        <template v-else>
          <path :d="friend === 'pip' ? 'M42 106q4 3 8 0' : 'M44 102q4 3 8 0'" />
          <path v-if="pose === 'asleep'" :d="friend === 'pip' ? 'M56 105q4 3 8 0' : 'M60 101q4 3 8 0'" />
          <circle v-else class="friend-peek" :cx="friend === 'pip' ? 60 : 66" :cy="friend === 'pip' ? 105 : 102" r="3" fill="currentColor" stroke="none" />
        </template>
      </g>
    </template>
  </svg>
</template>

<style scoped>
/* 6 breaths a minute: a calming pace a child can breathe along with. */
.friend-breathe {
  animation: friend-breathe 10s ease-in-out infinite;
}

.friend-blink {
  transform-box: fill-box;
  transform-origin: center;
  animation: friend-blink 11s infinite;
}

.friend-peek {
  transform-box: fill-box;
  transform-origin: center;
  animation: friend-peek 12s ease-in-out infinite;
}

.friend-stretch {
  animation: friend-stretch 12s ease-in-out infinite;
}

@keyframes friend-breathe {
  0%, 100% { transform: scaleY(1); }
  45% { transform: scaleY(1.04); }
}

@keyframes friend-blink {
  0%, 95%, 100% { transform: scaleY(1); }
  97% { transform: scaleY(0.1); }
}

@keyframes friend-peek {
  0%, 35%, 100% { transform: scaleY(0.15); }
  50%, 85% { transform: scaleY(1); }
}

@keyframes friend-stretch {
  0%, 25%, 75%, 100% { transform: translateY(0) rotate(0deg); }
  45%, 55% { transform: translateY(-5px) rotate(var(--stretch-tilt)); }
}

@media (prefers-reduced-motion: reduce) {
  .friend-breathe,
  .friend-blink,
  .friend-peek,
  .friend-stretch {
    animation: none;
  }

  /* Hold the peeking eye open rather than half-shut. */
  .friend-peek {
    transform: none;
  }
}
</style>
