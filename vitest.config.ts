import { defineConfig } from 'vitest/config'

// Pin a DST-observing zone so the routine engine's spring-forward/fall-back
// cases really exercise DST, whatever zone the machine runs in.
process.env.TZ = 'America/New_York'

export default defineConfig({})
