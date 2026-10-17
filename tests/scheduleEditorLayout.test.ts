import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// There is no DOM layout in vitest, so this guards the CSS that keeps the
// Custom grid inside a 390px phone. A bare `1fr` track can't shrink below its
// time input's intrinsic width, which pushed the Bedtime column ~32px past
// the settings panel's edge.
const source = readFileSync(new URL('../components/ScheduleEditor.vue', import.meta.url), 'utf8')

describe('ScheduleEditor layout', () => {
  it('lets every fractional grid track shrink below its content', () => {
    const templates = [...source.matchAll(/grid-cols-\[([^\]]+)\]/g)].map(match => match[1])
    expect(templates.length).toBeGreaterThan(0)
    for (const template of templates) {
      for (const track of template.split('_').filter(track => track.includes('fr'))) {
        expect(track, template).toMatch(/^minmax\(0,\d*\.?\d*fr\)$/)
      }
    }
  })

  it('lets time inputs shrink to their grid track', () => {
    const rule = source.match(/\.time-input \{([^}]+)\}/)?.[1] ?? ''
    expect(rule).toMatch(/\bmin-w-0\b/)
  })
})
