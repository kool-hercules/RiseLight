import type { FriendId, StarShape } from '../types'

// The story-time constellation: a handful of stars that join up, one faint line
// at a time, into a shape the child knows. It finishes just before lights out, so
// it doubles as a wind-down countdown a toddler can watch. Pure geometry, no
// Vue, so the shapes and the pacing are unit-tested directly.
//
// Every shape lives in a 100 x 80 box; the scene places and scales it.

export type Point = readonly [number, number]

export interface Constellation {
  points: readonly Point[]
  // Index pairs into `points`, in drawing order.
  edges: readonly (readonly [number, number])[]
  // Loose stars that never join a line (eyes, a nose). They brighten once the
  // shape is complete.
  extras: readonly Point[]
}

// Turn polylines into deduplicated stars and the lines between them, keeping
// the polylines' order so the shape draws stroke by stroke.
export const fromPolylines = (lines: readonly (readonly Point[])[], extras: readonly Point[] = []): Constellation => {
  const points: Point[] = []
  const edges: [number, number][] = []
  const indexOf = ([x, y]: Point): number => {
    const found = points.findIndex(([px, py]) => Math.abs(px - x) < 0.01 && Math.abs(py - y) < 0.01)
    if (found >= 0) {
      return found
    }
    points.push([x, y])
    return points.length - 1
  }
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = indexOf(line[i - 1])
      const b = indexOf(line[i])
      if (a !== b) {
        edges.push([a, b])
      }
    }
  }
  return { points, edges, extras }
}

// A closed outline through `points`.
const ring = (points: readonly Point[]): Point[] => [...points, points[0]]

const FRIEND_SHAPES: Record<FriendId, Constellation> = {
  // A bear cub's face: two round ears on a round head.
  bo: fromPolylines(
    [ring([[22, 24], [15, 13], [24, 4], [35, 9], [42, 18], [58, 18], [65, 9], [76, 4], [85, 13], [78, 24], [86, 42], [78, 60], [60, 70], [40, 70], [22, 60], [14, 42]])],
    [[38, 42], [62, 42], [50, 53]]
  ),
  // A bunny: two tall ears on a round head.
  pip: fromPolylines(
    [ring([[36, 40], [30, 8], [40, 2], [46, 36], [54, 36], [60, 2], [70, 8], [64, 40], [72, 56], [62, 72], [38, 72], [28, 56]])],
    [[42, 54], [58, 54], [50, 62]]
  ),
  // A little cloud.
  puff: fromPolylines(
    [ring([[16, 62], [8, 50], [16, 38], [26, 26], [42, 18], [56, 22], [66, 30], [80, 28], [92, 40], [90, 56], [76, 62]])],
    [[40, 44], [60, 44]]
  )
}

const HEART = fromPolylines([
  ring([[50, 76], [18, 46], [10, 24], [26, 8], [44, 14], [50, 24], [56, 14], [74, 8], [90, 24], [82, 46]])
])

// Capital letters on a 4 x 6 grid, drawn as strokes. Grid points map into the
// 100 x 80 box so a letter sits centred at the same size as the other shapes.
type GridLine = readonly Point[]
const LETTER_STROKES: Record<string, readonly GridLine[]> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 3], [3, 3]]],
  B: [[[0, 6], [0, 0], [3, 0], [4, 1], [3, 3], [0, 3]], [[3, 3], [4, 4.5], [3, 6], [0, 6]]],
  C: [[[4, 1], [3, 0], [1, 0], [0, 1.5], [0, 4.5], [1, 6], [3, 6], [4, 5]]],
  D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
  G: [[[4, 1], [3, 0], [1, 0], [0, 1.5], [0, 4.5], [1, 6], [3, 6], [4, 5], [4, 3.5], [2.5, 3.5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[1, 0], [3, 0]], [[2, 0], [2, 6]], [[1, 6], [3, 6]]],
  J: [[[1, 0], [4, 0]], [[3, 0], [3, 5], [2, 6], [1, 6], [0, 5]]],
  K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.5]], [[1.2, 2.8], [4, 6]]],
  L: [[[0, 0], [0, 6], [4, 6]]],
  M: [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1, 0], [3, 0], [4, 1.5], [4, 4.5], [3, 6], [1, 6], [0, 4.5], [0, 1.5], [1, 0]]],
  P: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.5], [3, 3.5], [0, 3.5]]],
  Q: [[[1, 0], [3, 0], [4, 1.5], [4, 4.5], [3, 6], [1, 6], [0, 4.5], [0, 1.5], [1, 0]], [[2.5, 4.5], [4, 6.2]]],
  R: [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.5], [3, 3.5], [0, 3.5]], [[2, 3.5], [4, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2.2], [1, 3], [3, 3], [4, 3.8], [4, 5], [3, 6], [1, 6], [0, 5]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
  X: [[[0, 0], [2, 3], [4, 6]], [[4, 0], [2, 3], [0, 6]]],
  Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]]
}

export const LETTERS = Object.keys(LETTER_STROKES)

const toBox = ([x, y]: Point): Point => [20 + x * 15, 4 + y * 12]

export const letterConstellation = (letter: string): Constellation | null => {
  const strokes = LETTER_STROKES[letter.toUpperCase()]
  return strokes ? fromPolylines(strokes.map(line => line.map(toBox))) : null
}

export const friendConstellation = (friend: FriendId): Constellation => FRIEND_SHAPES[friend]

// The shape for tonight. "Their initial" with no initial set falls back to the
// friend, so the sky is never empty.
export const resolveConstellation = (shape: StarShape, friend: FriendId, initial: string): Constellation => {
  if (shape === 'heart') {
    return HEART
  }
  if (shape === 'initial') {
    return letterConstellation(initial) ?? FRIEND_SHAPES[friend]
  }
  return FRIEND_SHAPES[friend]
}

// How many lines are drawn at a point in story time (0..1). Story time is split
// into total + 1 equal steps: it opens on bare stars, adds a line each step, and
// spends the last step with the finished shape, so "the picture is done" means
// "lights out is next".
export const drawnEdgeCount = (progress: number, total: number): number => {
  if (!Number.isFinite(progress) || progress <= 0) {
    return 0
  }
  return Math.min(total, Math.floor(progress * (total + 1)))
}
