import { defineConfig, devices } from '@playwright/test'

// Specs run against the static `nuxt generate` build (run `npm run generate`
// first, or use `npm run e2e`), served on a port that is not the dev server's
// 8080. Override with E2E_PORT if 4310 is taken.
const port = Number(process.env.E2E_PORT ?? 4310)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    launchOptions: {
      // Pin the browser's autoplay rule to the real-world one (audio needs a
      // user activation) so the unlock specs mean the same thing everywhere.
      args: ['--autoplay-policy=document-user-activation-required']
    }
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/serve.mjs .output/public',
    url: `http://127.0.0.1:${port}/`,
    env: { E2E_PORT: String(port) },
    reuseExistingServer: false
  }
})
