export type LightColor = string

// 'bedtime' is the wind-down "Story time" phase before lights out.
export type LightMode = 'bedtime' | 'night' | 'wake' | 'awake'

// 'inactive' means daytime idle (or switched off for now).
export type LightState = 'inactive' | LightMode

// One day's routine. `bedtime` is that evening's lights-out; `wakeTime` is that
// day's morning. Night D runs from bedtime(D) to wakeTime(D+1).
export type DaySchedule = {
  wakeTime: string // HH:MM, 04:00–12:00
  bedtime: string // HH:MM, 15:00–23:59
}

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

// One-tap nap durations, in minutes.
export const NAP_OPTIONS: readonly number[] = [30, 45, 60, 90, 120]

export type Settings = {
  // Indexed by Date.getDay() (0 = Sunday). An array, not a Record, so JSON keys
  // never turn into strings.
  schedule: readonly DaySchedule[]
  wakeDuration: number // minutes
  windDownMinutes: number // story-time length before bedtime; 0 = off
  awakeHoldMinutes: number // how long "okay to get up" shows before going idle
  autoSchedule: boolean // run the routine automatically every day
  lastNapMinutes: number // the nap length offered by default
  ambientAutoStart: boolean // start the saved sound at bedtime
  childLock: boolean // parent controls behind a 3-second hold
  sceneEnabled: boolean // show the kid picture over the glow
  chimeEnabled: boolean // play a gentle chime when it becomes okay to get up
  ambientSound: AmbientSoundId | null // last-selected ambient sound, null = none
  ambientVolume: number // 0..100, master volume for ambient sound
  sleepTimerMinutes: number // 0 = off; otherwise fade out the sound after N minutes
  brightness: Record<LightMode, number>
  colors: Record<LightMode, string>
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
