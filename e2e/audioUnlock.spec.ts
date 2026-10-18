import { expect, test } from '@playwright/test'
import { SOUND_BADGE, badgeLogged, reportSoundBadge, seedReturningParent } from './helpers'

// On touch, `pointerdown` carries no user activation: the browser only lets
// audio start after `pointerup`/`touchend`. A fix that listened to pointerdown
// alone would leave the badge up forever on a phone or tablet.
//
// This runs against Chromium's real autoplay policy (playwright.config.ts sets
// --autoplay-policy=document-user-activation-required). Playwright hands the
// page a user activation whenever it runs script there: page.evaluate, every
// locator and expect() query (CDP callFunctionOn with userGesture), and the
// trace's DOM snapshot after each action. One of those before the tap and the
// sound just starts. So until the tap this spec reaches the page only through
// console messages and raw touchscreen input, and the trace keeps screenshots
// but no DOM snapshots.
test.use({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
  trace: { mode: 'retain-on-failure', snapshots: false, screenshots: true, sources: true }
})

test('a single tap clears the sound badge on a touch device', async ({ page }) => {
  await seedReturningParent(page)
  await reportSoundBadge(page)

  // Story time on the default schedule (starts 19:10), so the saved sound
  // tries to start by itself and the browser blocks it.
  const shown = badgeLogged(page, 'shown')
  await page.goto('/?clock=19:15')
  expect((await shown).activated, 'the page was activated before any input, so the browser would not have blocked audio').toBe(false)

  // Raw input: page.tap() would resolve its target by running script first.
  const hidden = badgeLogged(page, 'hidden')
  await page.touchscreen.tap(195, 500)
  await hidden

  await expect(page.locator(SOUND_BADGE)).toHaveCount(0)
})
