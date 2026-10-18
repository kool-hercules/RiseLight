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

// Reports the sound badge through console messages from an init script, so a
// spec can watch it without running script in the page (which would hand the
// page a user activation; see audioUnlock.spec.ts). Each change logs
// `riselight-e2e:badge <shown|hidden> activated=<hasBeenActive>`.
export const BADGE_LOG = 'riselight-e2e:badge'

export const reportSoundBadge = async (page: Page): Promise<void> => {
  await page.addInitScript(({ selector, prefix }) => {
    let shown = false
    new MutationObserver(() => {
      const now = document.querySelector(selector) !== null
      if (now !== shown) {
        shown = now
        console.log(`${prefix} ${now ? 'shown' : 'hidden'} activated=${navigator.userActivation.hasBeenActive}`)
      }
    }).observe(document, { subtree: true, childList: true })
  }, { selector: SOUND_BADGE, prefix: BADGE_LOG })
}

export const badgeLogged = (page: Page, change: 'shown' | 'hidden') =>
  page.waitForEvent('console', {
    predicate: message => message.text().startsWith(`${BADGE_LOG} ${change} `),
    timeout: 10_000
  }).then(message => ({ activated: message.text().endsWith('activated=true') }))
