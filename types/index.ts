export type LightColor = 'white' | 'blue' | 'pink'

export type LightState = 'inactive' | 'night' | 'wake' | 'awake'

export type Settings = {
  wakeTime: string // HH:MM format
  wakeDuration: number // minutes
  brightness: {
    white: number
    blue: number
    pink: number
  }
  soundEnabled: boolean
}

export type TimerInfo = {
  currentTime: Date
  nextWakeTime: Date
  timeRemaining: number // milliseconds
  currentState: LightState
  currentColor: LightColor
  isActive: boolean
}

export type NightLightStore = {
  settings: Settings
  timerInfo: TimerInfo
  isSettingsOpen: boolean
  isPreviewMode: boolean
} 