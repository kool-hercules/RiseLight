import { readonly, ref, watch } from 'vue'
import type { Settings } from '../types'
import {
  createDefaultSettings,
  getBrowserStorage,
  isValidBrightness,
  isValidColor,
  isValidDuration,
  isValidWakeTime,
  loadSettingsFromStorage,
  normalizeWakeTime,
  parseSettingsJson,
  saveSettingsToStorage,
  serializeSettings
} from '../utils/settings'

// RiseLight is client-only, so a module singleton is the smallest shared store.
// Every consumer receives this same ref and mutations stay behind this API.
const settingsState = ref<Settings>(createDefaultSettings())
const isSettingsOpen = ref(false)
const sharedSettings = readonly(settingsState)
// True when storage exists but the last write was rejected (private mode / full
// quota) so the UI can warn that customizations may not survive a reload.
const saveFailed = ref(false)
let hasInitialized = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

const saveSettings = (): boolean => {
  const storage = getBrowserStorage()
  if (!storage) {
    return false
  }

  const ok = saveSettingsToStorage(storage, settingsState.value)
  saveFailed.value = !ok
  return ok
}

// Slider drags emit a burst of mutations; debounce so we serialize and hit
// localStorage once the value settles instead of on every intermediate step.
const scheduleSave = (): void => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(saveSettings, 150)
}

const loadSettings = (): void => {
  settingsState.value = loadSettingsFromStorage(getBrowserStorage())
  hasInitialized = true
}

watch(settingsState, scheduleSave, { deep: true })

const updateWakeTime = (time: string): void => {
  if (isValidWakeTime(time)) {
    settingsState.value.wakeTime = normalizeWakeTime(time)
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
    console.warn('RiseLight: failed to import settings; input was not valid.')
    return false
  }

  settingsState.value = parsed
  return true
}

const settingsApi = {
  settings: sharedSettings,
  isSettingsOpen,
  saveFailed: readonly(saveFailed),
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
