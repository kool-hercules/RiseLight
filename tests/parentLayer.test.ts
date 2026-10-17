import { describe, expect, it } from 'vitest'
import { parentIdleMs } from '../utils/parentLayer'

describe('parent controls idle hand-off', () => {
  it('hides after 15 seconds normally', () => {
    expect(parentIdleMs(false)).toBe(15_000)
  })

  it('lets go of the first-run pin after two quiet minutes instead of staying lit all night', () => {
    expect(parentIdleMs(true)).toBe(120_000)
    expect(Number.isFinite(parentIdleMs(true))).toBe(true)
  })
})
