import { expect, test } from '@playwright/test'
import { SOUND_BADGE, blockAudioUntilActivation, seedReturningParent } from './helpers'

// On touch, `pointerdown` carries no user activation: a browser only lets audio
// start after `pointerup`/`touchend`. A fix that listened to pointerdown alone
// would leave the badge up forever on a phone or tablet.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

test('a single tap clears the sound badge on a touch device', async ({ page }) => {
  await seedReturningParent(page)
  await blockAudioUntilActivation(page)
  // Story time on the default schedule (starts 19:10), so the saved sound
  // tries to start by itself and is blocked until a gesture.
  await page.goto('/?clock=19:15')

  const badge = page.locator(SOUND_BADGE)
  await expect(badge).toBeVisible()

  await page.tap('body', { position: { x: 195, y: 500 } })

  await expect(badge).toHaveCount(0)
})
