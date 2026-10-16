import { describe, expect, it } from 'vitest'
import { MODE_ORDER, MODE_PRESENTATION, describePhase, stateHeadline, stateIcon } from '../utils/modes'

describe('mode presentation', () => {
  it('describes every mode in order with a label, blurb and icon', () => {
    expect(MODE_ORDER).toEqual(['bedtime', 'night', 'wake', 'awake'])

    for (const mode of MODE_ORDER) {
      expect(MODE_PRESENTATION[mode].label.length).toBeGreaterThan(0)
      expect(MODE_PRESENTATION[mode].blurb.length).toBeGreaterThan(0)
      expect(MODE_PRESENTATION[mode].icon).toBeTruthy()
    }
  })

  it('maps runtime state to a plain-language headline and icon, including off', () => {
    expect(stateHeadline('inactive')).toBe('Light is off')
    expect(stateHeadline('night')).toBe('Stay in bed')
    expect(stateHeadline('awake')).toBe('Okay to get up!')

    expect(stateIcon('inactive')).toBe('power')
    expect(stateIcon('night')).toBe('moon')
    expect(stateIcon('wake')).toBe('sunrise')
    expect(stateHeadline('bedtime')).toBe('Story time')
    expect(stateIcon('bedtime')).toBe('book')
  })
})

describe('describePhase', () => {
  const base = {
    state: 'inactive' as const,
    previewMode: null,
    overrideKind: null,
    autoSchedule: true,
    storyTimeLabel: '07:10 PM',
    bedtimeLabel: '07:30 PM',
    okayLabel: '07:00 AM',
    humanTimeRemaining: 'in about 5 minutes'
  }

  it('describes each phase in plain language', () => {
    expect(describePhase(base)).toEqual({ headline: 'Resting', detail: 'Tonight starts at 07:10 PM' })
    expect(describePhase({ ...base, state: 'bedtime' }).detail).toBe('Lights out at 07:30 PM')
    expect(describePhase({ ...base, state: 'night' }).detail).toBe('Okay to get up at 07:00 AM')
    expect(describePhase({ ...base, state: 'night', overrideKind: 'nap' }).headline).toBe('Nap time')
    expect(describePhase({ ...base, state: 'wake' }).detail).toBe('Okay to get up in about 5 minutes')
    expect(describePhase({ ...base, state: 'awake' }).headline).toBe('Okay to get up!')
  })

  it('distinguishes off-for-now, manual mode and previews', () => {
    expect(describePhase({ ...base, overrideKind: 'off' }).headline).toBe('Off for now')
    expect(describePhase({ ...base, autoSchedule: false }).headline).toBe('Light is off')
    expect(describePhase({ ...base, state: 'night', previewMode: 'bedtime' })).toEqual({ headline: 'Story time', detail: 'Preview' })
  })
})
