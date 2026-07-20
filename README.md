# RiseLight

A full-screen "OK-to-wake" night light that helps little ones know when to stay
in bed and when it's okay to get up — a free, no-hardware alternative to devices
like the Hatch. Built with Vue 3 + Nuxt 3, installable as a PWA.

## Features

- **Full-screen glow**: a radial-gradient light fills the screen, its color and
  brightness tuned per phase.
- **Three phases on a nightly schedule**:
  - **Stay in bed** — a dim, low-blue-light red through the night.
  - **Almost time** — eases to amber during the wake-up window.
  - **Okay to get up!** — a gentle green once it's time to rise.
  The wake-up window is a continuous sunrise ramp between these colors, not a
  hard switch.
- **Ambient sounds**: white / pink / brown noise plus rain, ocean, fan, wind,
  and a soft heartbeat — all **synthesized in the browser** (no audio files,
  perfect infinite loops, fully offline), with a master **volume** control and a
  **sleep timer** that fades the sound out while the light keeps running.
- **Okay-to-get-up chime**: an optional gentle chime at the wake transition.
- **Installable PWA**: add to home screen, runs full-screen and **offline**
  (offline app-shell service worker).
- **Stays awake**: holds a screen wake lock so the light never sleeps — designed
  to sit plugged in at the bedside with the screen on.
- **Customizable**: wake time, wake-up window length, per-phase color and
  brightness, with a live full-screen **preview**.
- **Touch- and tablet-friendly**, safe-area aware, with keyboard shortcuts
  (Space toggles the light, Cmd/Ctrl+S opens settings, Esc closes).

## How it works

1. Pick your wake-up time (and optionally a sound) in settings.
2. Tap **Turn On**. The light shows "Stay in bed" through the night.
3. As the wake-up time approaches, it eases through "Almost time" and lands on
   "Okay to get up!" — chiming if enabled.
4. Turning off silences the sound and light together; your sound choice is
   remembered for next time.

## Development

```bash
npm install       # install dependencies
npm run dev       # start the dev server
npm run generate  # static build → .output/public (what Netlify deploys)
npm test          # run the unit tests (vitest)
npm run typecheck # type-check
```

QA tip: append `?clock=06:29&rate=120` to the URL to simulate/accelerate the
schedule so the whole night → wake → okay cycle plays out in seconds.

## Technical details

- **Vue 3 Composition API + Nuxt 3**, statically generated (`ssr: false`,
  Nitro `static` preset) and deployed to Netlify.
- **Tailwind CSS**, **TypeScript**.
- State lives in **module-singleton composables** (`useSettings`, `useAmbient`,
  …), persisted to **localStorage** with schema versioning and validation. (The
  audio engines are framework-agnostic and unit-tested with fake AudioContexts.)
- **Web Audio API** for the chime (`utils/chime.ts`) and ambient sounds
  (`utils/ambient.ts`) — no audio assets shipped.

### Note on audio & going native

Continuous audio plays reliably only while the screen is on / the tab is
foregrounded (the wake lock covers the plugged-in bedside case). Background /
locked-screen audio is **not reliable in a PWA** — iOS suspends the AudioContext.
Closing that gap (background audio, alarm notifications when the app is closed,
app-store presence) is the reason to wrap this same codebase in **Capacitor**
later; it needs no rewrite.

## Project structure

```
├── components/        NightLight, SettingsPanel, OnboardingOverlay, icons
├── composables/       useNightLight, useSettings, useAmbient, useChime, useWakeLock, useOnboarding
├── pages/index.vue    wires composables to components
├── utils/             pure logic: schedule, ramp, settings, ambient, chime, session, …
├── public/            manifest, service worker, icons, sounds/ (optional recordings)
└── tests/             vitest suites
```

## License

MIT License — feel free to use and modify.
