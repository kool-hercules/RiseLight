import { expect, test } from '@playwright/test'
import { CLOCK, PARENT_CONTROLS } from './helpers'

// A brand-new install (empty storage): the parent controls are pinned open for
// setup, but a phone set down mid-setup must not keep them lit all night. Two
// quiet minutes hand the screen to the kid scene and complete first run, so the
// next launch is locked. This crosses ParentControls' timer, the page's
// @close wiring and useOnboarding's storage, which no unit test spans.
test('the first-run controls let go after two quiet minutes, for good', async ({ page }) => {
  await page.clock.install()
  await page.goto('/?clock=19:40')
  const controls = page.locator(PARENT_CONTROLS)
  await expect(controls).toBeVisible()
  await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible()
  // Freeze time (see childLock.spec.ts); the pin's timer started at mount.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000))

  await page.clock.runFor(100_000)
  await expect(controls).toBeVisible()
  await page.clock.runFor(20_000)
  await expect(controls).toHaveCount(0)

  await page.reload()
  await expect(page.locator(CLOCK)).toBeVisible()
  await expect(controls).toHaveCount(0)
})
