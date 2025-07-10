import { ref, computed, watch, readonly } from 'vue'
import type { Settings } from '../types'

const defaultSettings: Settings = {
  wakeTime: '06:30',
  wakeDuration: 30,
  brightness: {
    white: 80,
    blue: 70,
    pink: 60
  },
  soundEnabled: false
}

export const useSettings = () => {
  const settings = ref<Settings>({ ...defaultSettings })
  const isSettingsOpen = ref(false)
  
  // Initialize settings from localStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('nightlight-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        settings.value = { ...defaultSettings, ...parsed }
      } catch (error) {
        console.warn('Failed to parse stored settings:', error)
      }
    }
  }

  // Load settings from localStorage on initialization
  const loadSettings = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nightlight-settings')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          settings.value = { ...defaultSettings, ...parsed }
        } catch (error) {
          console.warn('Failed to parse stored settings:', error)
        }
      }
    }
  }

  // Save settings to localStorage
  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nightlight-settings', JSON.stringify(settings.value))
    }
  }

  // Watch for changes and auto-save
  watch(settings, saveSettings, { deep: true })

  // Computed properties for easier access
  const wakeTimeHour = computed(() => {
    const [hour] = settings.value.wakeTime.split(':')
    return parseInt(hour)
  })

  const wakeTimeMinute = computed(() => {
    const [, minute] = settings.value.wakeTime.split(':')
    return parseInt(minute)
  })

  // Validation functions
  const isValidWakeTime = (time: string): boolean => {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
    return timeRegex.test(time)
  }

  const isValidDuration = (duration: number): boolean => {
    return duration >= 1 && duration <= 60
  }

  const isValidBrightness = (brightness: number): boolean => {
    return brightness >= 0 && brightness <= 100
  }

  // Update functions
  const updateWakeTime = (time: string) => {
    if (isValidWakeTime(time)) {
      settings.value.wakeTime = time
    }
  }

  const updateWakeDuration = (duration: number) => {
    if (isValidDuration(duration)) {
      settings.value.wakeDuration = duration
    }
  }

  const updateBrightness = (color: keyof Settings['brightness'], value: number) => {
    if (isValidBrightness(value)) {
      settings.value.brightness[color] = value
    }
  }

  const toggleSettings = () => {
    isSettingsOpen.value = !isSettingsOpen.value
  }

  const resetSettings = () => {
    settings.value = { ...defaultSettings }
  }

  // Export settings for backup
  const exportSettings = (): string => {
    return JSON.stringify(settings.value, null, 2)
  }

  // Import settings from backup
  const importSettings = (settingsJson: string): boolean => {
    try {
      const parsed = JSON.parse(settingsJson)
      if (parsed && typeof parsed === 'object') {
        settings.value = { ...defaultSettings, ...parsed }
        return true
      }
    } catch (error) {
      console.error('Failed to import settings:', error)
    }
    return false
  }

  return {
    settings: readonly(settings),
    isSettingsOpen,
    wakeTimeHour,
    wakeTimeMinute,
    loadSettings,
    saveSettings,
    updateWakeTime,
    updateWakeDuration,
    updateBrightness,
    toggleSettings,
    resetSettings,
    exportSettings,
    importSettings,
    isValidWakeTime,
    isValidDuration,
    isValidBrightness
  }
} 