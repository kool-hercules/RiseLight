import type { Settings } from '../types'

// The wake window is a sunrise, not a switch. Rather than hard-swapping from the
// "stay in bed" color to "almost time" to "okay to get up", we treat the three
// configured colors as keyframes and interpolate continuously across the window:
// night at the start, wake at the midpoint, awake at the end. Because the ramp
// lands exactly on the configured night/awake colors at the window's edges, the
// night → wake and wake → awake boundaries have no visible seam.

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const parseHex = (hex: string): [number, number, number] | null => {
  const match = HEX.exec(hex)
  if (!match) {
    return null
  }

  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16)
  ]
}

const toHex = (channel: number): string =>
  Math.round(clamp01(channel / 255) * 255)
    .toString(16)
    .padStart(2, '0')

/**
 * Linearly interpolate two `#rrggbb` colors. `t` is clamped to [0, 1]. If either
 * input is not a valid hex color we fall back to the nearer endpoint so the
 * display never renders an empty color.
 */
export const mixHex = (from: string, to: string, t: number): string => {
  const clamped = clamp01(t)
  const a = parseHex(from)
  const b = parseHex(to)

  if (!a || !b) {
    return clamped < 0.5 ? from : to
  }

  const r = a[0] + (b[0] - a[0]) * clamped
  const g = a[1] + (b[1] - a[1]) * clamped
  const bl = a[2] + (b[2] - a[2]) * clamped
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * clamp01(t)

// Split the window at its midpoint: the first half eases night → wake, the
// second half eases wake → awake. `progress` is 0 at the window's start and 1 at
// its end.
const rampSegment = (progress: number): { from: 'night' | 'wake'; to: 'wake' | 'awake'; t: number } => {
  const p = clamp01(progress)
  if (p < 0.5) {
    return { from: 'night', to: 'wake', t: p * 2 }
  }
  return { from: 'wake', to: 'awake', t: (p - 0.5) * 2 }
}

export const rampColor = (progress: number, colors: Settings['colors']): string => {
  const { from, to, t } = rampSegment(progress)
  return mixHex(colors[from], colors[to], t)
}

// Returns 0..100, matching the stored brightness scale.
export const rampBrightness = (progress: number, brightness: Settings['brightness']): number => {
  const { from, to, t } = rampSegment(progress)
  return lerp(brightness[from], brightness[to], t)
}
