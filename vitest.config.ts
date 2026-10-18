import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Pin a DST-observing zone so the routine engine's spring-forward/fall-back
// cases really exercise DST, whatever zone the machine runs in.
process.env.TZ = 'America/New_York'

// The default environment stays node so the engine tests are fast; component
// and composable tests opt into happy-dom per file. Playwright specs live in
// e2e/ and run under `npm run e2e`, not here.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts']
  }
})
