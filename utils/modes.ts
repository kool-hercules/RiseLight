import type { LightMode, LightState } from '../types'

// One source of truth for how each light state is described to a human. Kills
// the "night / wake / awake mode" jargon at every surface (main screen,
// settings, onboarding) so the copy can never drift between them.
export type ModeIconName = 'moon' | 'sunrise' | 'sun' | 'power'

export interface ModePresentation {
  label: string // kid-friendly meaning, e.g. "Stay in bed"
  blurb: string // one-line explanation for onboarding
  settingHelp: string // helper text shown under the control in settings
  icon: ModeIconName
}

export const MODE_ORDER: LightMode[] = ['night', 'wake', 'awake']

export const MODE_PRESENTATION: Record<LightMode, ModePresentation> = {
  night: {
    label: 'Stay in bed',
    blurb: 'A calm light through the night.',
    settingHelp: 'Shows through the night until the wake-up window begins.',
    icon: 'moon'
  },
  wake: {
    label: 'Almost time',
    blurb: 'Morning is coming — keep resting.',
    settingHelp: 'Eases in during the wake-up window as morning approaches.',
    icon: 'sunrise'
  },
  awake: {
    label: 'Okay to get up!',
    blurb: 'Time to rise and shine.',
    settingHelp: 'Shows once it’s okay to get up.',
    icon: 'sun'
  }
}

export const stateHeadline = (state: LightState): string =>
  state === 'inactive' ? 'Light is off' : MODE_PRESENTATION[state].label

export const stateIcon = (state: LightState): ModeIconName =>
  state === 'inactive' ? 'power' : MODE_PRESENTATION[state].icon
