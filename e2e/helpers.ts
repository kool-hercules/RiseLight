import type { Page } from '@playwright/test'

// A returning parent: first-run intro done, a saved sound that auto-starts at
// story time. Seeded before the app boots, on every load.
export const seedReturningParent = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem('riselight-onboarded', '1')
    localStorage.setItem('nightlight-settings', JSON.stringify({
      version: 2,
      settings: { ambientSound: 'white', ambientAutoStart: true }
    }))
  })
}

// The dim clock doubles as the child-lock target.
export const CLOCK = '[aria-label^="Hold for 3 seconds"]'
export const PARENT_CONTROLS = '[aria-label="Parent controls"]'
export const SOUND_BADGE = '[aria-label="Tap anywhere to turn sound on"]'

// Headless Chromium has no dependable way to keep a page un-activated:
// Playwright's own navigation and evaluate calls hand the page a user
// activation, so real autoplay blocking comes and goes between runs. This
// models the browser rule instead, with the real input events Playwright
// dispatches: an AudioContext starts suspended, a resume() issued before any
// activation hangs and leaves it suspended, and only a resume() issued after a
// trusted activating event succeeds. Per the HTML spec those events are
// keydown, a *mouse* pointerdown, and for touch only pointerup / touchend.
export const blockAudioUntilActivation = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    let activated = false
    const grant = () => { activated = true }
    window.addEventListener('keydown', event => { if (event.isTrusted && event.key !== 'Escape') grant() }, true)
    window.addEventListener('mousedown', event => { if (event.isTrusted) grant() }, true)
    window.addEventListener('pointerdown', event => { if (event.isTrusted && event.pointerType === 'mouse') grant() }, true)
    window.addEventListener('pointerup', event => { if (event.isTrusted && event.pointerType !== 'mouse') grant() }, true)
    window.addEventListener('touchend', event => { if (event.isTrusted) grant() }, true)

    const Real = window.AudioContext
    const Gated = function (this: unknown, ...args: ConstructorParameters<typeof AudioContext>) {
      const context = new Real(...args)
      let denied = true
      return new Proxy(context, {
        get(target, key) {
          if (key === 'state') {
            return denied ? 'suspended' : target.state
          }
          if (key === 'resume') {
            return () => {
              denied = !activated
              return activated ? target.resume() : new Promise<void>(() => {})
            }
          }
          const value = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        }
      })
    } as unknown as typeof AudioContext
    Gated.prototype = Real.prototype
    window.AudioContext = Gated
  })
}
