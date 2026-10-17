<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DaySchedule, Settings } from '../types'
import { formatClockTime } from '../utils/time'
import {
  OKAY_TIME_EARLIEST,
  OKAY_TIME_LATEST,
  buildSameSchedule,
  buildSplitSchedule,
  detectSchedulePreset,
  scheduleTimeError,
  splitScheduleParts,
  type SchedulePreset
} from '../utils/settings'

const props = defineProps<{ settings: Settings }>()

const emit = defineEmits<{
  'update-schedule': [schedule: DaySchedule[]]
  'update-day': [day: number, patch: Partial<DaySchedule>]
  'update-wake-duration': [minutes: number]
  'update-wind-down': [minutes: number]
  'update-awake-hold': [minutes: number]
  'update-auto-schedule': [enabled: boolean]
}>()

const WIND_DOWN_OPTIONS = [0, 10, 20, 30]
const HOLD_OPTIONS = [30, 60, 120]
// Monday-first, the way parents think about a week; values are Date.getDay().
const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' }
]

// Weekday okay times cover Mon–Fri mornings and weekday bedtimes Sun–Thu
// evenings: the nights before school days.
const SPLIT_GROUPS = [
  { key: 'weekday', title: 'School nights', days: '(okay Mon–Fri, bedtime Sun–Thu)' },
  { key: 'weekend', title: 'Weekend', days: '(okay Sat–Sun, bedtime Fri–Sat)' }
] as const

const presets: { key: SchedulePreset; label: string }[] = [
  { key: 'same', label: 'Same every day' },
  { key: 'split', label: 'Weekdays & weekends' },
  { key: 'custom', label: 'Custom' }
]

const timeError = ref<string | null>(null)

// The picked preset is local UI state: "Custom" keeps the per-day rows open
// even while every day still matches, and "Weekdays & weekends" survives both
// halves being set equal. Only widen when the data no longer fits the pick.
const preset = ref<SchedulePreset>(detectSchedulePreset(props.settings.schedule))
watch(
  () => props.settings.schedule,
  schedule => {
    const detected = detectSchedulePreset(schedule)
    if (detected === 'custom' || (detected === 'split' && preset.value === 'same')) {
      preset.value = detected
    }
  },
  { deep: true }
)

const choosePreset = (next: SchedulePreset) => {
  timeError.value = null
  const { weekday, weekend } = splitScheduleParts(props.settings.schedule)
  if (next === 'same') {
    emit('update-schedule', buildSameSchedule(weekday))
  } else if (next === 'split') {
    emit('update-schedule', buildSplitSchedule(weekday, weekend))
  }
  preset.value = next
}

const parts = computed(() => splitScheduleParts(props.settings.schedule))

// The schedule stores the green time, the number parents think in. The sunrise
// starts one wake-up window before it; show that as a hint.
const sunriseAt = (okayTime: string): string => {
  const [hours, minutes] = okayTime.split(':').map(Number)
  return formatClockTime(new Date(2000, 0, 1, hours, minutes - props.settings.wakeDuration))
}

const sunriseHint = (okayTime: string): string =>
  `Sunrise starts at ${sunriseAt(okayTime)} (${props.settings.wakeDuration} min window)`

// The typed time, or null when it's empty or out of range. A rejected value is
// put back to the saved one and the reason shown, so the input never displays
// a time the routine isn't using.
const acceptTime = (field: keyof DaySchedule, event: Event, saved: string): string | null => {
  const input = event.target as HTMLInputElement
  const value = input.value
  if (!value) {
    return null
  }
  const error = scheduleTimeError(field, value)
  timeError.value = error
  if (error) {
    input.value = saved
    return null
  }
  return value
}

const setSame = (field: keyof DaySchedule, event: Event) => {
  const value = acceptTime(field, event, parts.value.weekday[field])
  if (value) {
    emit('update-schedule', buildSameSchedule({ ...parts.value.weekday, [field]: value }))
  }
}

const setSplit = (group: 'weekday' | 'weekend', field: keyof DaySchedule, event: Event) => {
  const value = acceptTime(field, event, parts.value[group][field])
  if (value) {
    const next = { ...parts.value, [group]: { ...parts.value[group], [field]: value } }
    emit('update-schedule', buildSplitSchedule(next.weekday, next.weekend))
  }
}

const setDay = (day: number, field: keyof DaySchedule, event: Event) => {
  const value = acceptTime(field, event, props.settings.schedule[day][field])
  if (value) {
    emit('update-day', day, { [field]: value })
  }
}

const onWakeDuration = (event: Event) => {
  const minutes = parseInt((event.target as HTMLInputElement).value)
  if (!isNaN(minutes)) {
    emit('update-wake-duration', minutes)
  }
}
</script>

<template>
  <div>
    <label class="flex items-center justify-between gap-4 cursor-pointer mb-4">
      <span>
        <span class="block text-sm font-medium">Run automatically every day</span>
        <span class="block text-xs text-gray-500 mt-1">
          Story time, lights out and wake-up happen on their own. Off: use Start now each night.
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        :checked="settings.autoSchedule"
        @change="emit('update-auto-schedule', ($event.target as HTMLInputElement).checked)"
        class="chime-toggle shrink-0"
        aria-label="Run the routine automatically every day"
      >
    </label>

    <div class="timer-row mb-3" role="radiogroup" aria-label="Schedule pattern">
      <button
        v-for="option in presets"
        :key="option.key"
        role="radio"
        :aria-checked="preset === option.key"
        class="timer-chip"
        :class="{ 'timer-chip--active': preset === option.key }"
        @click="choosePreset(option.key)"
      >
        {{ option.label }}
      </button>
    </div>

    <!-- Same every day -->
    <div v-if="preset === 'same'" class="grid grid-cols-2 gap-3 mb-2">
      <label class="block">
        <span class="okay-label mb-1"><span class="okay-swatch" :style="{ backgroundColor: settings.colors.awake }" />Okay to get up</span>
        <input type="time" :min="OKAY_TIME_EARLIEST" :max="OKAY_TIME_LATEST" :value="parts.weekday.okayTime" @change="setSame('okayTime', $event)" class="time-input">
      </label>
      <label class="block">
        <span class="block text-xs text-gray-400 mb-1">Bedtime</span>
        <input type="time" min="15:00" max="23:59" :value="parts.weekday.bedtime" @change="setSame('bedtime', $event)" class="time-input">
      </label>
      <p class="col-span-2 text-xs text-gray-400">{{ sunriseHint(parts.weekday.okayTime) }}</p>
    </div>

    <!-- Weekdays & weekends -->
    <div v-else-if="preset === 'split'" class="space-y-3 mb-2">
      <div v-for="group in SPLIT_GROUPS" :key="group.key">
        <p class="text-xs text-gray-300 mb-1">{{ group.title }} <span class="text-gray-500">{{ group.days }}</span></p>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="okay-label mb-1"><span class="okay-swatch" :style="{ backgroundColor: settings.colors.awake }" />Okay to get up</span>
            <input type="time" :min="OKAY_TIME_EARLIEST" :max="OKAY_TIME_LATEST" :value="parts[group.key].okayTime" @change="setSplit(group.key, 'okayTime', $event)" class="time-input" :aria-label="`${group.title} okay to get up`">
          </label>
          <label class="block">
            <span class="block text-xs text-gray-400 mb-1">Bedtime</span>
            <input type="time" min="15:00" max="23:59" :value="parts[group.key].bedtime" @change="setSplit(group.key, 'bedtime', $event)" class="time-input" :aria-label="`${group.title} bedtime`">
          </label>
        </div>
        <p class="text-xs text-gray-400 mt-1">{{ sunriseHint(parts[group.key].okayTime) }}</p>
      </div>
    </div>

    <!-- Custom: one row per day -->
    <div v-else class="mb-2">
      <div class="grid grid-cols-[2.5rem_1fr_1fr] gap-x-3 gap-y-2 items-start">
        <span />
        <span class="okay-label"><span class="okay-swatch" :style="{ backgroundColor: settings.colors.awake }" />Okay to get up</span>
        <span class="text-xs text-gray-400">Bedtime</span>
        <template v-for="row in DAYS" :key="row.day">
          <span class="text-sm text-gray-300 pt-2">{{ row.label }}</span>
          <div>
            <input type="time" :min="OKAY_TIME_EARLIEST" :max="OKAY_TIME_LATEST" :value="settings.schedule[row.day].okayTime" @change="setDay(row.day, 'okayTime', $event)" class="time-input" :aria-label="`${row.label} okay to get up`">
            <span class="block text-[11px] text-gray-500 mt-0.5 tabular-nums">Sunrise {{ sunriseAt(settings.schedule[row.day].okayTime) }}</span>
          </div>
          <input type="time" min="15:00" max="23:59" :value="settings.schedule[row.day].bedtime" @change="setDay(row.day, 'bedtime', $event)" class="time-input" :aria-label="`${row.label} bedtime`">
        </template>
      </div>
    </div>
    <p v-if="timeError" class="text-xs text-amber-300 mb-5" role="alert">{{ timeError }}</p>
    <p v-else class="text-xs text-gray-500 mb-5">The sunrise eases in over the wake-up window and turns green right on time. Okay to get up between 4 AM and 1 PM; bedtime between 3 PM and midnight.</p>

    <label class="block text-sm font-medium mb-2">Story time before bed</label>
    <div class="timer-row mb-1">
      <button
        v-for="minutes in WIND_DOWN_OPTIONS"
        :key="minutes"
        @click="emit('update-wind-down', minutes)"
        :aria-pressed="settings.windDownMinutes === minutes"
        class="timer-chip"
        :class="{ 'timer-chip--active': settings.windDownMinutes === minutes }"
      >
        {{ minutes === 0 ? 'Off' : `${minutes}m` }}
      </button>
    </div>
    <p class="text-xs text-gray-500 mb-5">A warm, soft light to wind down before lights out.</p>

    <label class="block text-sm font-medium mb-2">
      Wake-up window: {{ settings.wakeDuration }} minutes
    </label>
    <input
      type="range"
      min="1"
      max="60"
      step="1"
      :value="settings.wakeDuration"
      @input="onWakeDuration"
      class="slider w-full"
      aria-label="Wake-up window in minutes"
    >
    <p class="text-xs text-gray-500 mt-1 mb-5">
      How long the sunrise eases in before “okay to get up”. Green stays at the time you set.
    </p>

    <label class="block text-sm font-medium mb-2">Show “okay to get up” for</label>
    <div class="timer-row mb-1">
      <button
        v-for="minutes in HOLD_OPTIONS"
        :key="minutes"
        @click="emit('update-awake-hold', minutes)"
        :aria-pressed="settings.awakeHoldMinutes === minutes"
        class="timer-chip"
        :class="{ 'timer-chip--active': settings.awakeHoldMinutes === minutes }"
      >
        {{ minutes < 60 ? `${minutes}m` : `${minutes / 60}h` }}
      </button>
    </div>
    <p class="text-xs text-gray-500">Then the screen goes quiet for the day.</p>
  </div>
</template>

<style scoped>
.okay-label {
  @apply flex items-center gap-1.5 text-xs text-gray-400;
}
.okay-swatch {
  @apply inline-block w-2.5 h-2.5 rounded-full shrink-0;
}
.time-input {
  @apply w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500;
  touch-action: manipulation;
}
</style>
