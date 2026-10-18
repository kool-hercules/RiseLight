import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Specs run against the static `nuxt generate` build (run `npm run generate`
// first, or use `npm run e2e`), served on a port that is not the dev server's
// 8080. Each checkout gets its own port in 4310-4909, derived from its path,
// so parallel worktrees don't fight over one; E2E_PORT overrides. It goes back
// into the environment so the workers and the server agree on it.
const checkout = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.E2E_PORT ?? 4310 + createHash('sha1').update(checkout).digest().readUInt16BE(0) % 600)
process.env.E2E_PORT = String(port)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI retries once so a failure keeps a trace of the second attempt, but a
  // test that only passes on retry still fails the run: the specs are meant
  // to be deterministic, and a retry must not hide that one isn't.
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI,
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
