import { expect, test, type Page } from '@playwright/test'
import { CLOCK, PARENT_CONTROLS, seedReturningParent } from './helpers'

// Mid-evening on the default schedule, so the kid screen is lit.
const URL = '/?clock=19:40'

test.beforeEach(async ({ page }) => {
  await seedReturningParent(page)
  // The page's timers run on Playwright's clock, so holds are stepped exactly
  // instead of waited out in real time (a slow CI runner can't stretch a
  // 1.5 s press past 3 s).
  await page.clock.install()
  await page.goto(URL)
  await expect(page.locator(CLOCK)).toBeVisible()
  // install() keeps time flowing in real time too; freeze it (a few seconds
  // ahead, so it is never in the past by the time the call lands) so runFor()
  // is the only thing that moves it. Nothing is pending on the kid screen.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5_000))
})

const pressClock = async (page: Page): Promise<void> => {
  const box = (await page.locator(CLOCK).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}

test('a 3 s press on the clock opens the parent controls', async ({ page }) => {
  await pressClock(page)
  await page.clock.runFor(2_900)
  await expect(page.locator(PARENT_CONTROLS)).toHaveCount(0)
  await page.clock.runFor(100)
  await expect(page.locator(PARENT_CONTROLS)).toBeVisible()
  await page.mouse.up()
  await expect(page.locator(PARENT_CONTROLS)).toBeVisible()
})

test('a 1.5 s press does not', async ({ page }) => {
  await pressClock(page)
  await page.clock.runFor(1_500)
  await page.mouse.up()
  // Well past the point where a full hold would have fired.
  await page.clock.runFor(5_000)
  await expect(page.locator(PARENT_CONTROLS)).toHaveCount(0)
})

test('a tap on the kid screen does nothing', async ({ page }) => {
  await page.mouse.click(200, 400)
  await page.mouse.click(200, 400)
  await page.locator(CLOCK).click()
  await page.clock.runFor(5_000)
  await expect(page.locator(PARENT_CONTROLS)).toHaveCount(0)
})
