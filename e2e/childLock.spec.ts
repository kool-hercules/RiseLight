import { expect, test } from '@playwright/test'
import { CLOCK, PARENT_CONTROLS, seedReturningParent } from './helpers'

// Mid-evening on the default schedule, so the kid screen is lit.
const URL = '/?clock=19:40'

test.beforeEach(async ({ page }) => {
  await seedReturningParent(page)
  await page.goto(URL)
  await expect(page.locator(CLOCK)).toBeVisible()
})

test('a 3 s press on the clock opens the parent controls', async ({ page }) => {
  const box = (await page.locator(CLOCK).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.locator(PARENT_CONTROLS)).toBeVisible({ timeout: 5_000 })
  await page.mouse.up()
  await expect(page.locator(PARENT_CONTROLS)).toBeVisible()
})

test('a 1.5 s press does not', async ({ page }) => {
  const box = (await page.locator(CLOCK).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1_500)
  await page.mouse.up()
  // Past the point where a full hold would have fired.
  await page.waitForTimeout(2_000)
  await expect(page.locator(PARENT_CONTROLS)).toHaveCount(0)
})

test('a tap on the kid screen does nothing', async ({ page }) => {
  await page.mouse.click(200, 400)
  await page.mouse.click(200, 400)
  await page.locator(CLOCK).click()
  await page.waitForTimeout(500)
  await expect(page.locator(PARENT_CONTROLS)).toHaveCount(0)
})
