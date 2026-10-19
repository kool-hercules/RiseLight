import type { FriendId, StarShape } from '../types'

// The settings catalog for the kid screen's night friend and story-time stars.

export interface FriendMeta {
  id: FriendId
  name: string
  description: string
}

export const FRIENDS: readonly FriendMeta[] = [
  { id: 'bo', name: 'Bo', description: 'a sleepy bear cub' },
  { id: 'pip', name: 'Pip', description: 'a bunny, ears tucked' },
  { id: 'puff', name: 'Puff', description: 'a little cloud' }
]

export const friendName = (id: FriendId): string => FRIENDS.find(friend => friend.id === id)?.name ?? 'Bo'

export interface StarShapeMeta {
  id: StarShape
  label: string // 'friend' shows the chosen friend's name instead
}

export const STAR_SHAPE_OPTIONS: readonly StarShapeMeta[] = [
  { id: 'friend', label: 'Friend' },
  { id: 'initial', label: 'Their initial' },
  { id: 'heart', label: 'A heart' }
]
