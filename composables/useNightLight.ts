import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'
import type { LightState, LightColor, TimerInfo } from '../types'
import { useSettings } from './useSettings'

export const useNightLight = () => {
  const currentTime = ref(new Date())
  const isActive = ref(false)
  const currentState = ref<LightState>('inactive')
  const currentColor = ref<LightColor>('white')
  const timeRemaining = ref(0)
  const nextWakeTime = ref(new Date())
  const isPreviewMode = ref(false)
  const previewColor = ref<LightColor>('white')

  // Timer for updating current time
  let timerInterval: NodeJS.Timeout | null = null

  const startTimer = () => {
    timerInterval = setInterval(() => {
      currentTime.value = new Date()
      if (isActive.value && !isPreviewMode.value) {
        updateLightState()
      }
    }, 1000)
  }

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  // Calculate next wake time based on current time and settings
  const calculateNextWakeTime = (wakeTimeStr: string): Date => {
    const now = new Date()
    const [hours, minutes] = wakeTimeStr.split(':').map(Number)
    
    const wakeTime = new Date(now)
    wakeTime.setHours(hours, minutes, 0, 0)
    
    // If wake time is in the past today, set it for tomorrow
    if (wakeTime <= now) {
      wakeTime.setDate(wakeTime.getDate() + 1)
    }
    
    return wakeTime
  }

  // Update light state based on current time and settings
  const updateLightState = () => {
    const { settings } = useSettings()
    const now = currentTime.value
    const wakeTime = nextWakeTime.value
    const wakeEndTime = new Date(wakeTime.getTime() + settings.value.wakeDuration * 60 * 1000)
    
    if (now < wakeTime) {
      // Night mode - white light
      currentState.value = 'night'
      currentColor.value = 'white'
      timeRemaining.value = wakeTime.getTime() - now.getTime()
    } else if (now >= wakeTime && now < wakeEndTime) {
      // Wake mode - blue light
      currentState.value = 'wake'
      currentColor.value = 'blue'
      timeRemaining.value = wakeEndTime.getTime() - now.getTime()
    } else {
      // Awake mode - pink light
      currentState.value = 'awake'
      currentColor.value = 'pink'
      timeRemaining.value = 0
    }
  }

  // Start the night light
  const startNightLight = (wakeTimeStr: string) => {
    isActive.value = true
    nextWakeTime.value = calculateNextWakeTime(wakeTimeStr)
    updateLightState()
    startTimer()
  }

  // Stop the night light
  const stopNightLight = () => {
    isActive.value = false
    currentState.value = 'inactive'
    currentColor.value = 'white'
    timeRemaining.value = 0
    stopTimer()
  }

  // Toggle the night light
  const toggleNightLight = (wakeTimeStr: string) => {
    if (isActive.value) {
      stopNightLight()
    } else {
      startNightLight(wakeTimeStr)
    }
  }

  // Preview mode for testing colors
  const startPreview = (color: LightColor) => {
    isPreviewMode.value = true
    previewColor.value = color
    currentColor.value = color
    currentState.value = 'night' // Use night state for preview
  }

  const stopPreview = () => {
    isPreviewMode.value = false
    if (isActive.value) {
      updateLightState()
    } else {
      currentColor.value = 'white'
      currentState.value = 'inactive'
    }
  }

  // Format time remaining as human-readable string
  const formatTimeRemaining = computed(() => {
    if (timeRemaining.value <= 0) return '00:00:00'
    
    const totalSeconds = Math.floor(timeRemaining.value / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  // Get current brightness based on color
  const getCurrentBrightness = computed(() => {
    const { settings } = useSettings()
    return settings.value.brightness[currentColor.value] / 100
  })

  // Format next wake time
  const formatNextWakeTime = computed(() => {
    if (!isActive.value) return ''
    
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
    
    return nextWakeTime.value.toLocaleTimeString([], options)
  })

  // Get status message
  const statusMessage = computed(() => {
    if (isPreviewMode.value) {
      return `Preview: ${previewColor.value} light`
    }
    
    if (!isActive.value) {
      return 'Night light is off'
    }
    
    switch (currentState.value) {
      case 'night':
        return `Night mode until ${formatNextWakeTime.value}`
      case 'wake':
        return `Wake mode - ${formatTimeRemaining.value} remaining`
      case 'awake':
        return 'Awake mode - ready to start your day!'
      default:
        return 'Night light is off'
    }
  })

  // Timer info object
  const timerInfo = computed<TimerInfo>(() => ({
    currentTime: currentTime.value,
    nextWakeTime: nextWakeTime.value,
    timeRemaining: timeRemaining.value,
    currentState: currentState.value,
    currentColor: currentColor.value,
    isActive: isActive.value
  }))

  // Initialize timer on mount
  onMounted(() => {
    currentTime.value = new Date()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopTimer()
  })

  return {
    // State
    currentTime: readonly(currentTime),
    isActive: readonly(isActive),
    currentState: readonly(currentState),
    currentColor: readonly(currentColor),
    timeRemaining: readonly(timeRemaining),
    nextWakeTime: readonly(nextWakeTime),
    isPreviewMode: readonly(isPreviewMode),
    timerInfo,
    
    // Computed
    formatTimeRemaining,
    getCurrentBrightness,
    formatNextWakeTime,
    statusMessage,
    
    // Methods
    startNightLight,
    stopNightLight,
    toggleNightLight,
    startPreview,
    stopPreview,
    updateLightState
  }
} 