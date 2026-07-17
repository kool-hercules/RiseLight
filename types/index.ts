export type LightColor = string

export type LightMode = 'night' | 'wake' | 'awake'

export type LightState = 'inactive' | LightMode

export type Settings = {
  wakeTime: string // HH:MM format
  wakeDuration: number // minutes
  chimeEnabled: boolean // play a gentle chime when it becomes okay to get up
  brightness: {
    night: number
    wake: number
    awake: number
  }
  colors: {
    night: string
    wake: string
    awake: string
  }
}

export type TimerInfo = {
  currentTime: Date
  nextWakeTime: Date | null
  timeRemaining: number // milliseconds
  currentState: LightState
  currentColor: LightColor
  isActive: boolean
}

export type NightLightStore = {
  settings: Settings
  timerInfo: TimerInfo
  isSettingsOpen: boolean
  previewMode: LightMode | null
}
