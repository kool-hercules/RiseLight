import { vi } from 'vitest'
import { defineComponent, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { LightState, Settings } from '../../types'
import { createDefaultSettings } from '../../utils/settings'
import { useRoutineAudio, type RoutineAmbient, type RoutineChime } from '../../composables/useRoutineAudio'

// Fake players whose results the test scripts. `prime` defaults to "blocked"
// like a browser before any gesture.
export const createFakePlayers = () => {
  const isPlaying = ref(false)
  const ambient = {
    prime: vi.fn(async () => false),
    selectSound: vi.fn(async () => {
      isPlaying.value = true
      return true
    }),
    stopPlayback: vi.fn(() => {
      isPlaying.value = false
    }),
    isPlaying
  }
  const chime = {
    prime: vi.fn(async () => false),
    play: vi.fn(async () => true)
  }
  return { ambient: ambient as RoutineAmbient & typeof ambient, chime: chime as RoutineChime & typeof chime }
}

export const mountRoutineAudio = (
  initial: LightState,
  overrides: Partial<Settings> = {},
  players = createFakePlayers(),
  isArmed = true
) => {
  const currentState: Ref<LightState> = ref(initial)
  const settings = ref<Settings>({
    ...createDefaultSettings(),
    ambientSound: 'white',
    ambientAutoStart: true,
    ...overrides
  })

  let api!: ReturnType<typeof useRoutineAudio>
  const wrapper = mount(defineComponent({
    setup() {
      api = useRoutineAudio({ currentState, settings, isArmed: ref(isArmed), ...players })
      return () => null
    }
  }))

  return { wrapper, currentState, settings, api, ...players }
}
