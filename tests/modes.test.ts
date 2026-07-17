import { describe, expect, it } from 'vitest'
import { MODE_ORDER, MODE_PRESENTATION, stateHeadline, stateIcon } from '../utils/modes'

describe('mode presentation', () => {
  it('describes every mode in order with a label, blurb and icon', () => {
    expect(MODE_ORDER).toEqual(['night', 'wake', 'awake'])

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
  })
})
