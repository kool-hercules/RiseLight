import { readonly, ref, watch } from 'vue'
import type { AmbientSoundId, DaySchedule, Settings } from '../types'
import {
  createDefaultSettings,
  getBrowserStorage,
  isValidAmbientSound,
  isValidAwakeHold,
  isValidBedtime,
  isValidBrightness,
  isValidColor,
  isValidDaySchedule,
  isValidDuration,
  isValidMorningWake,
  isValidNapMinutes,
  isValidSleepTimer,
  isValidWindDown,
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

// Edit one day's wake time or bedtime. Out-of-range values are ignored so the
// routine engine's "every night crosses midnight once" invariant always holds.
const updateDaySchedule = (day: number, patch: Partial<DaySchedule>): void => {
  const entry = settingsState.value.schedule[day]
  if (!entry) {
    return
  }
  if (patch.wakeTime !== undefined && isValidMorningWake(patch.wakeTime)) {
    entry.wakeTime = normalizeWakeTime(patch.wakeTime)
  }
  if (patch.bedtime !== undefined && isValidBedtime(patch.bedtime)) {
    entry.bedtime = normalizeWakeTime(patch.bedtime)
  }
}

// Replace the whole week (used by the presets). All-or-nothing.
const updateSchedule = (schedule: readonly DaySchedule[]): void => {
  if (schedule.length !== 7 || !schedule.every(isValidDaySchedule)) {
    return
  }
  settingsState.value.schedule = schedule.map(day => ({
    wakeTime: normalizeWakeTime(day.wakeTime),
    bedtime: normalizeWakeTime(day.bedtime)
  }))
}

const updateWindDownMinutes = (minutes: number): void => {
  if (isValidWindDown(minutes)) {
    settingsState.value.windDownMinutes = minutes
  }
}

const updateAwakeHoldMinutes = (minutes: number): void => {
  if (isValidAwakeHold(minutes)) {
    settingsState.value.awakeHoldMinutes = minutes
  }
}

const updateLastNapMinutes = (minutes: number): void => {
  if (isValidNapMinutes(minutes)) {
    settingsState.value.lastNapMinutes = minutes
  }
}

type ToggleKey = 'autoSchedule' | 'ambientAutoStart' | 'childLock' | 'sceneEnabled'

const updateToggle = (key: ToggleKey, enabled: boolean): void => {
  settingsState.value[key] = Boolean(enabled)
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

const updateChimeEnabled = (enabled: boolean): void => {
  settingsState.value.chimeEnabled = Boolean(enabled)
}

const updateAmbientSound = (sound: AmbientSoundId | null): void => {
  if (isValidAmbientSound(sound)) {
    settingsState.value.ambientSound = sound
  }
}

const updateAmbientVolume = (value: number): void => {
  if (isValidBrightness(value)) {
    settingsState.value.ambientVolume = value
  }
}

const updateSleepTimerMinutes = (minutes: number): void => {
  if (isValidSleepTimer(minutes)) {
    settingsState.value.sleepTimerMinutes = minutes
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
  updateDaySchedule,
  updateSchedule,
  updateWakeDuration,
  updateWindDownMinutes,
  updateAwakeHoldMinutes,
  updateLastNapMinutes,
  updateToggle,
  updateBrightness,
  updateColor,
  updateChimeEnabled,
  updateAmbientSound,
  updateAmbientVolume,
  updateSleepTimerMinutes,
  toggleSettings,
  resetSettings,
  exportSettings,
  importSettings,
  isValidMorningWake,
  isValidBedtime,
  isValidDuration,
  isValidBrightness,
  isValidColor,
  isValidAmbientSound,
  isValidSleepTimer
}

export const useSettings = () => {
  if (!hasInitialized && typeof window !== 'undefined') {
    loadSettings()
  }

  return settingsApi
}
