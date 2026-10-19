// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SoundIcon from '../components/SoundIcon.vue'
import { BAND_COUNT, silentLevels } from '../utils/soundLevels'
import type { SoundIconName } from '../utils/ambient'

const NAMES: SoundIconName[] = ['noise', 'rain', 'ocean', 'fan', 'wind', 'heart']
const loud = { rms: 0.8, low: 0.9, high: 0.6, bands: new Array(BAND_COUNT).fill(0.7), clock: 2.37 }

describe('SoundIcon', () => {
  it('draws the same still glyph with no levels and with silent levels', () => {
    for (const name of NAMES) {
      const still = mount(SoundIcon, { props: { name } }).html()
      const silent = mount(SoundIcon, { props: { name, levels: null } }).html()
      expect(silent, name).toBe(still)
    }
  })

  it('moves with live levels', () => {
    for (const name of NAMES) {
      const still = mount(SoundIcon, { props: { name, levels: { ...silentLevels() } } }).html()
      const moving = mount(SoundIcon, { props: { name, levels: loud } }).html()
      expect(moving, name).not.toBe(still)
    }
  })

  it('spins the fan with sound time and swells the heart with the low band', () => {
    const fan = mount(SoundIcon, { props: { name: 'fan', levels: loud } })
    expect(fan.find('g').attributes('transform')).toMatch(/^rotate\(/)
    const heart = mount(SoundIcon, { props: { name: 'heart', levels: loud } })
    expect(heart.find('path').attributes('transform')).toContain('scale(1.162)')
  })
})
