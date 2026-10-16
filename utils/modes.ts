import type { LightMode, LightState } from '../types'

// One source of truth for how each light state is described to a human. Kills
// the "night / wake / awake mode" jargon at every surface (main screen,
// settings, onboarding) so the copy can never drift between them.
export type ModeIconName = 'book' | 'moon' | 'sunrise' | 'sun' | 'power'

export interface ModePresentation {
  label: string // kid-friendly meaning, e.g. "Stay in bed"
  blurb: string // one-line explanation for onboarding
  settingHelp: string // helper text shown under the control in settings
  icon: ModeIconName
}

export const MODE_ORDER: LightMode[] = ['bedtime', 'night', 'wake', 'awake']

export const MODE_PRESENTATION: Record<LightMode, ModePresentation> = {
  bedtime: {
    label: 'Story time',
    blurb: 'A warm, soft light to wind down before lights out.',
    settingHelp: 'Shows for the wind-down before bedtime.',
    icon: 'book'
  },
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

export type PhaseCopyInput = {
  state: LightState
  previewMode: LightMode | null
  overrideKind: 'on' | 'nap' | 'off' | null
  autoSchedule: boolean
  storyTimeLabel: string // when tonight's routine starts (story time, or lights out)
  bedtimeLabel: string
  okayLabel: string
  humanTimeRemaining: string
}

// The parent-facing headline and detail for the current phase. One function so
// the visible copy and the screen-reader announcement never drift.
export const describePhase = (input: PhaseCopyInput): { headline: string; detail: string } => {
  if (input.previewMode) {
    return { headline: MODE_PRESENTATION[input.previewMode].label, detail: 'Preview' }
  }

  const napping = input.overrideKind === 'nap'

  switch (input.state) {
    case 'bedtime':
      return { headline: 'Story time', detail: `Lights out at ${input.bedtimeLabel}` }
    case 'night':
      return {
        headline: napping ? 'Nap time' : 'Stay in bed',
        detail: `Okay to get up at ${input.okayLabel}`
      }
    case 'wake':
      return { headline: 'Almost time', detail: `Okay to get up ${input.humanTimeRemaining}` }
    case 'awake':
      return { headline: 'Okay to get up!', detail: napping ? 'Nap’s over!' : 'Good morning!' }
    default:
      if (input.overrideKind === 'off') {
        return { headline: 'Off for now', detail: 'The routine picks up again on its own.' }
      }
      if (!input.autoSchedule) {
        return { headline: 'Light is off', detail: 'Tap Start now at bedtime.' }
      }
      return { headline: 'Resting', detail: `Tonight starts at ${input.storyTimeLabel}` }
  }
}
