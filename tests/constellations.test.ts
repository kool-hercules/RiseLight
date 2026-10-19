import { describe, expect, it } from 'vitest'
import { FRIEND_IDS } from '../types'
import {
  LETTERS,
  drawnEdgeCount,
  friendConstellation,
  fromPolylines,
  letterConstellation,
  resolveConstellation
} from '../utils/constellations'
import type { Constellation } from '../utils/constellations'

const inBox = ({ points, extras }: Constellation) =>
  [...points, ...extras].every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 80)

const edgesValid = ({ points, edges }: Constellation) =>
  edges.every(([a, b]) => a !== b && a >= 0 && b >= 0 && a < points.length && b < points.length)

describe('constellation shapes', () => {
  it('has a closed outline for every friend, inside the 100 x 80 box', () => {
    for (const friend of FRIEND_IDS) {
      const shape = friendConstellation(friend)
      expect(shape.edges.length).toBe(shape.points.length)
      expect(edgesValid(shape)).toBe(true)
      expect(inBox(shape)).toBe(true)
    }
  })

  it('draws every capital letter, inside the box, with every star on a line', () => {
    expect(LETTERS).toHaveLength(26)
    for (const letter of LETTERS) {
      const shape = letterConstellation(letter)
      expect(shape, letter).not.toBeNull()
      expect(edgesValid(shape!), letter).toBe(true)
      expect(inBox(shape!), letter).toBe(true)
      const used = new Set(shape!.edges.flat())
      expect(used.size, letter).toBe(shape!.points.length)
    }
    expect(letterConstellation('m')).toEqual(letterConstellation('M'))
    expect(letterConstellation('7')).toBeNull()
  })

  it('shares stars where strokes meet instead of stacking duplicates', () => {
    const shape = fromPolylines([[[0, 0], [10, 0]], [[10, 0], [10, 10]]])
    expect(shape.points).toHaveLength(3)
    expect(shape.edges).toEqual([[0, 1], [1, 2]])
  })

  it('resolves the chosen shape, falling back to the friend when no initial is set', () => {
    expect(resolveConstellation('friend', 'pip', 'A')).toBe(friendConstellation('pip'))
    expect(resolveConstellation('initial', 'pip', 'A')).toEqual(letterConstellation('A'))
    expect(resolveConstellation('initial', 'puff', '')).toBe(friendConstellation('puff'))
    expect(resolveConstellation('heart', 'bo', 'A')).not.toBe(friendConstellation('bo'))
  })
})

describe('drawnEdgeCount', () => {
  it('starts on bare stars and adds one line per step', () => {
    expect(drawnEdgeCount(0, 10)).toBe(0)
    expect(drawnEdgeCount(1 / 11 - 0.001, 10)).toBe(0)
    expect(drawnEdgeCount(1 / 11 + 0.001, 10)).toBe(1)
  })

  it('finishes the shape one step before lights out and holds it', () => {
    expect(drawnEdgeCount(10 / 11 - 0.001, 10)).toBe(9)
    expect(drawnEdgeCount(10 / 11 + 0.001, 10)).toBe(10)
    expect(drawnEdgeCount(1, 10)).toBe(10)
    expect(drawnEdgeCount(5, 10)).toBe(10)
  })

  it('never goes backwards as story time runs', () => {
    let previous = 0
    for (let step = 0; step <= 200; step++) {
      const count = drawnEdgeCount(step / 200, 16)
      expect(count).toBeGreaterThanOrEqual(previous)
      previous = count
    }
    expect(previous).toBe(16)
  })

  it('treats bad progress as the start', () => {
    expect(drawnEdgeCount(Number.NaN, 10)).toBe(0)
    expect(drawnEdgeCount(-1, 10)).toBe(0)
  })
})
