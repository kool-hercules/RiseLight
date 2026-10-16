<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LightMode } from '../types'
import { NAP_OPTIONS } from '../types'
import type { ModeIconName } from '../utils/modes'
import ModeIcon from './ModeIcon.vue'
import { parentIdleMs } from '../utils/parentLayer'

// Everything a parent needs, kept off the kid screen: start/stop, nap, sound,
// settings, help, and tonight's plan. Opened by the child-lock hold (or any tap
// with the lock off); hides itself after 15 seconds of no interaction (two
// minutes while pinned for first run).

interface PlanPhase {
  key: LightMode
  label: string
  time: string
  color: string
  icon: ModeIconName
}

const props = defineProps<{
  headline: string
  detail: string
  icon: ModeIconName
  isLit: boolean
  canNap: boolean
  lastNapMinutes: number
  plan: PlanPhase[]
  hasSound: boolean
  isSoundPlaying: boolean
  screenMaySleep: boolean
  pinned: boolean
  childLock: boolean
}>()

const emit = defineEmits<{
  'toggle-light': []
  'start-nap': [minutes: number]
  'toggle-sound': []
  'open-settings': []
  'open-help': []
  close: []
}>()

let idleTimer: ReturnType<typeof setTimeout> | null = null

const resetIdle = (): void => {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  idleTimer = setTimeout(() => emit('close'), parentIdleMs(props.pinned))
}

watch(() => props.pinned, resetIdle)

// Nap duration sheet.
const napSheetOpen = ref(false)
const napMinutes = ref(props.lastNapMinutes)

const openNapSheet = (): void => {
  napMinutes.value = props.lastNapMinutes
  napSheetOpen.value = true
}

const confirmNap = (): void => {
  napSheetOpen.value = false
  emit('start-nap', napMinutes.value)
}

watch(() => props.canNap, canNap => {
  if (!canNap) {
    napSheetOpen.value = false
  }
})

const panelRef = ref<HTMLElement | null>(null)

onMounted(() => {
  resetIdle()
  window.addEventListener('pointerdown', resetIdle, true)
  window.addEventListener('keydown', resetIdle, true)
  // Focus the region, not a button: the hold that opened this may still be a
  // held Enter key, whose repeats would otherwise "click" Off for now.
  panelRef.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  window.removeEventListener('pointerdown', resetIdle, true)
  window.removeEventListener('keydown', resetIdle, true)
})
</script>

<template>
  <div class="parent-layer" @click.self="!pinned && emit('close')">
    <div ref="panelRef" class="parent-center legible outline-none" role="region" aria-label="Parent controls" tabindex="-1">
      <ModeIcon :name="icon" class="w-12 h-12 mx-auto mb-3 text-white/90" />
      <div class="text-3xl font-semibold mb-1">{{ headline }}</div>
      <div class="text-sm text-white/80 mb-6 min-h-[1.25rem]">{{ detail }}</div>

      <div v-if="screenMaySleep" class="screen-warning mb-5" role="alert">
        Keep RiseLight open, on screen and plugged in — this browser may let the screen sleep.
      </div>

      <template v-if="!napSheetOpen">
        <div class="flex flex-wrap justify-center gap-3">
          <button class="control-button text-lg min-w-[150px]" @click="emit('toggle-light')">
            {{ isLit ? 'Off for now' : 'Start now' }}
          </button>
          <button v-if="canNap" class="control-button text-lg min-w-[110px]" @click="openNapSheet">
            Nap
          </button>
        </div>
      </template>

      <div v-else class="nap-sheet" role="dialog" aria-label="Nap length">
        <p class="text-sm text-white/80 mb-3">How long is the nap?</p>
        <div class="timer-row justify-center mb-4">
          <button
            v-for="minutes in NAP_OPTIONS"
            :key="minutes"
            class="timer-chip"
            :class="{ 'timer-chip--active': napMinutes === minutes }"
            :aria-pressed="napMinutes === minutes"
            @click="napMinutes = minutes"
          >
            {{ minutes < 60 ? `${minutes}m` : minutes % 60 === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${minutes % 60}m` }}
          </button>
        </div>
        <div class="flex justify-center gap-3">
          <button class="control-button" @click="confirmNap">Start nap</button>
          <button class="control-button bg-transparent" @click="napSheetOpen = false">Cancel</button>
        </div>
      </div>

      <div v-if="plan.length" class="plan mt-8 mx-auto max-w-[16rem] text-left">
        <p class="text-xs uppercase tracking-wide text-white/50 mb-3 text-center">Tonight’s plan</p>
        <ul class="space-y-2.5">
          <li v-for="phase in plan" :key="phase.key" class="flex items-center gap-3">
            <span
              class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              :style="{ backgroundColor: phase.color }"
            >
              <ModeIcon :name="phase.icon" class="w-4 h-4 text-black/70" />
            </span>
            <span class="flex-1 text-sm text-white/85">{{ phase.label }}</span>
            <span class="text-xs text-white/60 tabular-nums">{{ phase.time }}</span>
          </li>
        </ul>
      </div>

      <p v-if="pinned" class="first-run-hint mt-8" role="status">
        <template v-if="childLock">Hold the clock for 3 seconds to open these controls later.</template>
        <template v-else>Tap anywhere to open these controls later.</template>
      </p>
    </div>

    <div class="corner corner--bottom-left">
      <button class="settings-button" aria-label="Open settings" @click="emit('open-settings')">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
      <button class="settings-button" aria-label="How RiseLight works" @click="emit('open-help')">
        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.2a2.5 2.5 0 015 .1c0 1.6-1.7 2-2.4 2.7-.3.3-.6.7-.6 1.5" />
          <path d="M12 17h.01" />
        </svg>
      </button>
    </div>

    <div class="corner corner--bottom-right">
      <button
        v-if="hasSound"
        class="settings-button"
        :aria-label="isSoundPlaying ? 'Stop sound' : 'Play sound'"
        :aria-pressed="isSoundPlaying"
        @click="emit('toggle-sound')"
      >
        <svg class="w-6 h-6" :class="isSoundPlaying ? 'text-white' : 'text-white/70'" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <template v-if="isSoundPlaying">
            <path d="M15.5 8.5a5 5 0 010 7" />
            <path d="M18.5 5.5a9 9 0 010 13" />
          </template>
          <template v-else>
            <path d="M22 9l-6 6" />
            <path d="M16 9l6 6" />
          </template>
        </svg>
      </button>
      <button class="settings-button px-4 text-sm text-white" @click="emit('close')">
        {{ pinned ? 'Got it' : 'Done' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.parent-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.55);
  padding: max(1.5rem, env(safe-area-inset-top, 0px)) max(1.5rem, env(safe-area-inset-right, 0px))
    max(5rem, env(safe-area-inset-bottom, 0px)) max(1.5rem, env(safe-area-inset-left, 0px));
  animation: parent-in 0.25s ease-out;
}

.parent-center {
  text-align: center;
  max-width: 24rem;
}

.legible {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6), 0 0 2px rgba(0, 0, 0, 0.5);
}

.screen-warning {
  font-size: 0.8rem;
  color: #fcd34d;
  background: rgba(120, 53, 15, 0.35);
  border: 1px solid rgba(180, 83, 9, 0.5);
  border-radius: 0.6rem;
  padding: 0.5rem 0.75rem;
}

.first-run-hint {
  font-size: 0.8rem;
  color: #fff;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 0.6rem;
  padding: 0.5rem 0.75rem;
}

.corner {
  position: absolute;
  display: flex;
  gap: 0.75rem;
  bottom: max(1rem, env(safe-area-inset-bottom, 1rem));
}

.corner--bottom-left {
  left: max(1rem, env(safe-area-inset-left, 1rem));
}

.corner--bottom-right {
  right: max(1rem, env(safe-area-inset-right, 1rem));
}

@keyframes parent-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .parent-layer {
    animation: none;
  }
}
</style>
