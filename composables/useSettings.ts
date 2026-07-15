import { computed, readonly, ref, watch } from 'vue'
import type { Settings } from '../types'
import {
  createDefaultSettings,
  getBrowserStorage,
  isValidBrightness,
  isValidColor,
  isValidDuration,
  isValidWakeTime,
  loadSettingsFromStorage,
  parseSettingsJson,
  saveSettingsToStorage,
  serializeSettings
} from '../utils/settings'

// RiseLight is client-only, so a module singleton is the smallest shared store.
// Every consumer receives this same ref and mutations stay behind this API.
const settingsState = ref<Settings>(createDefaultSettings())
const isSettingsOpen = ref(false)
const sharedSettings = readonly(settingsState)
let hasInitialized = false

const saveSettings = (): boolean => {
  return saveSettingsToStorage(getBrowserStorage(), settingsState.value)
}

const loadSettings = (): void => {
  settingsState.value = loadSettingsFromStorage(getBrowserStorage())
  hasInitialized = true
}

watch(settingsState, saveSettings, { deep: true })

const wakeTimeHour = computed(() => Number.parseInt(settingsState.value.wakeTime.split(':')[0]))
const wakeTimeMinute = computed(() => Number.parseInt(settingsState.value.wakeTime.split(':')[1]))

const updateWakeTime = (time: string): void => {
  if (isValidWakeTime(time)) {
    const [hours, minutes] = time.split(':')
    settingsState.value.wakeTime = `${hours.padStart(2, '0')}:${minutes}`
  }
}

const updateWakeDuration = (duration: number): void => {
  if (isValidDuration(duration)) {
    settingsState.value.wakeDuration = duration
  }
}

const updateBrightness = (mode: keyof Settings['brightness'], value: number): void => {
  if (isValidBrightness(value)) {
    settingsState.value.brightness[mode] = value
  }
}

const updateColor = (mode: keyof Settings['colors'], color: string): void => {
  if (isValidColor(color)) {
    settingsState.value.colors[mode] = color
  }
}

const toggleSettings = (): void => {
  isSettingsOpen.value = !isSettingsOpen.value
}

const resetSettings = (): void => {
  settingsState.value = createDefaultSettings()
}

const exportSettings = (): string => {
  return serializeSettings(settingsState.value, 2)
}

const importSettings = (settingsJson: string): boolean => {
  const parsed = parseSettingsJson(settingsJson)
  if (!parsed) {
    return false
  }

  settingsState.value = parsed
  return true
}

const settingsApi = {
  settings: sharedSettings,
  isSettingsOpen,
  wakeTimeHour,
  wakeTimeMinute,
  loadSettings,
  saveSettings,
  updateWakeTime,
  updateWakeDuration,
  updateBrightness,
  updateColor,
  toggleSettings,
  resetSettings,
  exportSettings,
  importSettings,
  isValidWakeTime,
  isValidDuration,
  isValidBrightness,
  isValidColor
}

export const useSettings = () => {
  if (!hasInitialized && typeof window !== 'undefined') {
    loadSettings()
  }

  return settingsApi
}
