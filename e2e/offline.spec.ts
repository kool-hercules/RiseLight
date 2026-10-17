import { expect, test } from '@playwright/test'
import { CLOCK, seedReturningParent } from './helpers'

const CACHE = 'riselight-v3'

test('loads once, then launches and renders offline', async ({ page, context }) => {
  await seedReturningParent(page)
  await page.goto('/')
  await expect(page.locator(CLOCK)).toBeVisible()

  // The worker must be in control, and the cache must hold every build file
  // the page loaded (they are handed over by plugins/pwa.client.ts).
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  await expect.poll(() => page.evaluate(async cacheName => {
    const loaded = performance.getEntriesByType('resource')
      .map(entry => new URL(entry.name))
      .filter(url => url.pathname.startsWith('/_nuxt/'))
    const cache = await caches.open(cacheName)
    const missing: string[] = []
    for (const url of loaded) {
      if (!(await cache.match(url.href))) {
        missing.push(url.pathname)
      }
    }
    return { loaded: loaded.length, missing }
  }, CACHE), { timeout: 15_000 }).toMatchObject({ missing: [] })

  await context.setOffline(true)
  await page.reload()

  await expect(page.locator(CLOCK)).toBeVisible()
  await expect(page).toHaveTitle('RiseLight')
})

test('a 404 navigation does not replace the cached shell', async ({ page, context }) => {
  await seedReturningParent(page)
  await page.goto('/')
  await expect(page.locator(CLOCK)).toBeVisible()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)

  const shell = () => page.evaluate(async cacheName => {
    const cached = await (await caches.open(cacheName)).match('/')
    return cached ? cached.text() : null
  }, CACHE)
  await expect.poll(shell).toContain('RiseLight')
  const before = await shell()

  const response = await page.goto('/no-such-page')
  expect(response?.status()).toBe(404)
  await expect(page.locator('body')).toContainText('Not found')

  // Let the worker finish whatever it does after a navigation response.
  await page.waitForTimeout(500)
  expect(await shell()).toBe(before)

  await context.setOffline(true)
  await page.goto('/')
  await expect(page.locator(CLOCK)).toBeVisible()
})
