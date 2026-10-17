<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

// The child lock. With the lock on, the parent controls open only after a
// 3-second press on this target (pointer or Enter/Space), with a progress ring
// so it's discoverable; moving the finger more than 10px cancels, so a toddler
// swiping the screen never gets in. With the lock off, a tap opens them.

const props = defineProps<{ locked: boolean; label?: string }>()
const emit = defineEmits<{ unlock: [] }>()

const HOLD_MS = 3000
const MOVE_TOLERANCE_PX = 10

const holding = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let origin: { x: number; y: number } | null = null

const cancel = (): void => {
  holding.value = false
  origin = null
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

const begin = (): void => {
  cancel()
  holding.value = true
  timer = setTimeout(() => {
    cancel()
    emit('unlock')
  }, HOLD_MS)
}

const onPointerDown = (event: PointerEvent): void => {
  if (!props.locked) {
    return
  }
  event.preventDefault()
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Capture is best-effort; the move/up handlers still work without it.
  }
  begin()
  origin = { x: event.clientX, y: event.clientY }
}

const onPointerMove = (event: PointerEvent): void => {
  if (!origin) {
    return
  }
  if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_TOLERANCE_PX) {
    cancel()
  }
}

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }
  // Stop the page shortcuts (Space = start/stop) from also seeing this key.
  event.stopPropagation()
  if (!props.locked) {
    return
  }
  event.preventDefault()
  if (!event.repeat && !holding.value) {
    begin()
  }
}

const onKeyUp = (event: KeyboardEvent): void => {
  if (props.locked && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    cancel()
  }
}

const onClick = (): void => {
  if (!props.locked) {
    emit('unlock')
  }
}

onBeforeUnmount(cancel)
</script>

<template>
  <button
    type="button"
    class="hold-target"
    :class="{ 'hold-target--holding': holding }"
    :aria-label="label ?? (locked ? 'Hold for 3 seconds to open parent controls' : 'Open parent controls')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="cancel"
    @pointercancel="cancel"
    @lostpointercapture="cancel"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
    @blur="cancel"
    @click="onClick"
    @contextmenu.prevent
  >
    <slot />
    <svg v-if="holding" class="hold-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="16" class="hold-ring__track" />
      <circle cx="18" cy="18" r="16" class="hold-ring__fill" />
    </svg>
  </button>
</template>

<style scoped>
.hold-target {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 0;
  padding: 0.5rem;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}

.hold-ring {
  position: absolute;
  left: 50%;
  top: 100%;
  width: 2.25rem;
  height: 2.25rem;
  transform: translate(-50%, 0.25rem) rotate(-90deg);
  pointer-events: none;
}

.hold-ring__track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.15);
  stroke-width: 3;
}

.hold-ring__fill {
  fill: none;
  stroke: rgba(255, 255, 255, 0.7);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 100.53;
  stroke-dashoffset: 100.53;
  animation: hold-fill 3s linear forwards;
}

@keyframes hold-fill {
  to { stroke-dashoffset: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .hold-ring__fill {
    animation-timing-function: steps(3, end);
  }
}
</style>
