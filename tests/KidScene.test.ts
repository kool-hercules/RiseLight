// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import KidScene from '../components/KidScene.vue'
import { friendConstellation, letterConstellation } from '../utils/constellations'

const mountScene = (props: Record<string, unknown> = {}) =>
  mount(KidScene, {
    props: { state: 'bedtime', progress: 0.5, color: '#ffb347', brightness: 0.4, previewMode: null, ...props }
  })

const friend = (wrapper: ReturnType<typeof mountScene>) => wrapper.find('[data-test="friend"]')
const lineCount = (wrapper: ReturnType<typeof mountScene>) => wrapper.findAll('[data-test="constellation"] line').length

describe('KidScene', () => {
  it('shows nothing while idle', () => {
    expect(mountScene({ state: 'inactive' }).find('.kid-scene').exists()).toBe(false)
  })

  it('poses the friend for each part of the routine', () => {
    const poses = { bedtime: 'reading', night: 'asleep', wake: 'peeking', awake: 'awake' }
    for (const [state, pose] of Object.entries(poses)) {
      expect(friend(mountScene({ state })).attributes('data-pose'), state).toBe(pose)
    }
  })

  it('draws the chosen friend', () => {
    for (const id of ['bo', 'pip', 'puff']) {
      expect(friend(mountScene({ friend: id })).attributes('data-friend')).toBe(id)
    }
  })

  it('joins the stars as story time runs and holds the full shape after lights out', () => {
    const total = friendConstellation('bo').edges.length
    expect(lineCount(mountScene({ progress: 0 }))).toBe(0)
    const halfway = lineCount(mountScene({ progress: 0.5 }))
    expect(halfway).toBeGreaterThan(0)
    expect(halfway).toBeLessThan(total)
    expect(lineCount(mountScene({ progress: 0.99 }))).toBe(total)
    expect(lineCount(mountScene({ state: 'night', progress: 0.1 }))).toBe(total)
  })

  it('draws the child’s initial, or the friend until one is set', () => {
    const m = letterConstellation('M')!.edges.length
    expect(lineCount(mountScene({ starShape: 'initial', childInitial: 'M', progress: 1 }))).toBe(m)
    expect(lineCount(mountScene({ starShape: 'initial', childInitial: '', friend: 'pip', progress: 1 })))
      .toBe(friendConstellation('pip').edges.length)
  })

  it('previews mid-phase so every element shows', () => {
    const wrapper = mountScene({ state: 'inactive', previewMode: 'night' })
    expect(friend(wrapper).attributes('data-pose')).toBe('asleep')
    expect(wrapper.find('circle[mask="url(#kid-crescent)"]').exists()).toBe(true)
  })

  it('keeps no fast or decorative motion on the kid screen', () => {
    const html = mountScene({ state: 'awake' }).html()
    for (const removed of ['kid-bounce', 'kid-spin', 'kid-twinkle', 'kid-zzz']) {
      expect(html).not.toContain(removed)
    }
  })
})
