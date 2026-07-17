import { describe, expect, it } from 'vitest'
import { mixHex, rampBrightness, rampColor } from '../utils/ramp'
import { createDefaultSettings } from '../utils/settings'

describe('mixHex', () => {
  it('returns the endpoints at t=0 and t=1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('interpolates the midpoint', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('clamps t outside [0, 1]', () => {
    expect(mixHex('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff')
  })

  it('falls back to the nearer endpoint for invalid input', () => {
    expect(mixHex('nope', '#ffffff', 0.2)).toBe('nope')
    expect(mixHex('nope', '#ffffff', 0.8)).toBe('#ffffff')
  })
})

describe('ramp keyframes', () => {
  const { colors, brightness } = createDefaultSettings()

  it('lands exactly on night at the window start (no seam from night)', () => {
    expect(rampColor(0, colors)).toBe(colors.night)
    expect(rampBrightness(0, brightness)).toBe(brightness.night)
  })

  it('passes through the wake keyframe at the midpoint', () => {
    expect(rampColor(0.5, colors)).toBe(colors.wake)
    expect(rampBrightness(0.5, brightness)).toBe(brightness.wake)
  })

  it('lands exactly on awake at the window end (no seam into awake)', () => {
    expect(rampColor(1, colors)).toBe(colors.awake)
    expect(rampBrightness(1, brightness)).toBe(brightness.awake)
  })

  it('brightness increases monotonically across the default window', () => {
    const samples = [0, 0.25, 0.5, 0.75, 1].map(p => rampBrightness(p, brightness))
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1])
    }
  })
})
