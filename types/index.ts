export type LightColor = string

export type LightMode = 'night' | 'wake' | 'awake'

export type LightState = 'inactive' | LightMode

// The ambient sounds RiseLight can play. Defined here (not in utils/ambient) so
// both the settings layer and the audio engine import the same source of truth
// without creating a utils↔utils dependency cycle.
export type AmbientSoundId =
  | 'white'
  | 'pink'
  | 'brown'
  | 'rain'
  | 'ocean'
  | 'fan'
  | 'wind'
  | 'heartbeat'

export const AMBIENT_SOUND_IDS: readonly AmbientSoundId[] = [
  'white',
  'pink',
  'brown',
  'rain',
  'ocean',
  'fan',
  'wind',
  'heartbeat'
]

// The sleep-timer options the UI offers, in minutes. 0 means "no timer". Parsing
// accepts any 0–480 for forward-compatibility, but the picker uses this list.
export const SLEEP_TIMER_OPTIONS: readonly number[] = [0, 15, 30, 45, 60, 90, 120]

export type Settings = {
  wakeTime: string // HH:MM format
  wakeDuration: number // minutes
  chimeEnabled: boolean // play a gentle chime when it becomes okay to get up
  ambientSound: AmbientSoundId | null // last-selected ambient sound, null = none
  ambientVolume: number // 0..100, master volume for ambient sound
  sleepTimerMinutes: number // 0 = off; otherwise fade out the sound after N minutes
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
