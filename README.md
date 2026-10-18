# RiseLight

A full-screen "OK-to-wake" night light that helps little ones know when to stay
in bed and when it's okay to get up — a free, no-hardware alternative to devices
like the Hatch. Built with Vue 3 + Nuxt 3, installable as a PWA.

## Features

- **A daily routine that runs itself**: no nightly tap. Every day the light
  moves through
  - **Story time**: a warm, soft amber to wind down before lights out.
  - **Stay in bed**: a dim, low-blue-light red through the night.
  - **Almost time**: a continuous sunrise ramp through amber during the wake-up
    window.
  - **Okay to get up!**: a gentle green, held for a set time, then the screen
    goes quiet (near-black, dim clock) for the day.
- **Weekly schedule**: bedtime and sunrise start per day, with "Same every
  day", "Weekdays & weekends" and "Custom" presets. The editor shows when each
  morning turns green.
- **One-tap nap**: night → short sunrise → 15 minutes of green. A nap that runs
  into the evening routine hands straight back to it with no green.
- **Off for now / Start now**: switch off until the routine's next step (the
  morning cue still comes), or start the night early. Start now right after
  Off for now is an undo: the schedule carries on where it was.
- **Kid-first screen with a child lock**: the kid screen is purely visual -- a
  glow and a simple scene (lamp and book, moon and sleeping friend, sun rising
  over hills, full sun) painted only in the current light colour. Parent
  controls open by holding the clock for 3 seconds and hide themselves again.
  They carry quick brightness and volume sliders for 2 AM adjustments.
- **Ambient sounds**: white / pink / brown noise plus rain, ocean, fan, wind,
  and a soft heartbeat, all **synthesized in the browser** (no audio files,
  perfect infinite loops, fully offline), with volume and a fading **sleep
  timer**. Optionally starts by itself at story time and stops at "okay to get
  up".
- **Okay-to-get-up chime**: an optional gentle chime at the wake transition.
- **Installable PWA**: add to home screen, runs full-screen and **offline**
  after a single online visit.
- **Stays awake**: holds a screen wake lock while the routine is armed, and
  warns if the browser can't.
- **Customizable**: per-phase colour and brightness with a live full-screen
  **preview**, story-time length, wake-up window, how long green shows.

## How it works

1. Set bedtimes and sunrise times (and optionally a sound) in settings. Green
   ("okay to get up") comes one wake-up window after the sunrise starts.
2. Leave RiseLight open, on screen and plugged in by the bed. It runs story
   time → stay in bed → almost time → okay to get up every day on its own.
3. To open the parent controls, **hold the clock for 3 seconds** (or turn the
   child lock off in settings so any tap opens them). They hide after 15
   seconds; settings and help close themselves after a minute.
4. On iPhone/iPad, turn on **Guided Access** to keep little fingers in the app.

If the browser blocks a scheduled sound or chime (no recent tap), a tiny dim
speaker badge appears; the next tap anywhere turns sound back on.

## Development

```bash
npm install       # install dependencies
npm run dev       # start the dev server
npm run generate  # static build → .output/public (what Netlify deploys)
npm test          # run the unit and component tests (vitest)
npm run e2e       # build, then run the browser tests (Playwright)
npm run typecheck # type-check
```

QA tips:

- `?clock=06:29&rate=120` starts the simulated clock at 06:29 today and runs it
  120× faster, so a 30-minute wake window plays out in 15 seconds.
- `?clock=2026-10-17T05:50` starts at a full local date and time, to test a
  specific weekday's schedule row (e.g. a Saturday wake-up).
- `?clock=2026-10-16T19:05&rate=240` walks a whole evening: story time → night.
- Fresh `localStorage` shows the first-run parent controls pinned open; left
  untouched they hand back to the kid screen after two minutes.
- `npm test` pins `TZ=America/New_York` so the DST cases really cross DST.

## Testing

Three layers, all run in CI (`.github/workflows/ci.yml`):

- **Engine tests** (`tests/*.test.ts`, node): the routine, settings, audio
  engines and service worker, with `TZ` pinned to `America/New_York`.
- **Component and composable tests** (`@vue/test-utils` + happy-dom, opted into
  per file with `// @vitest-environment happy-dom`, fake timers): the child-lock
  hold, the parent controls, and the page wiring extracted into
  `composables/useRoutineAudio.ts` and `composables/useParentLayer.ts`, which
  take their players as arguments so tests can pass fakes.
- **Browser tests** (`e2e/`, Playwright, Chromium only): the child lock,
  offline launch from the service worker, and the mobile audio-unlock tap. They
  run against the static `nuxt generate` build, served on port 4310 (override
  with `E2E_PORT`).

```bash
npm test            # first two layers
npx playwright install chromium   # once
npm run e2e         # generate + browser tests
npx playwright test e2e/offline.spec.ts   # one spec, against the last build
```

Notes: the audio spec runs against Chromium's real autoplay policy. Playwright
grants the page a user activation whenever it runs script there (evaluate,
locator and `expect` queries, trace DOM snapshots), so that spec reads the
badge through console messages and taps with raw touchscreen input until the
tap has happened. Press-and-hold specs step the page's timers with
`page.clock` rather than waiting in real time. A change to anything under
`pages/`, `components/` or `public/sw.js` needs `npm run generate` before
re-running a single spec.

## Technical details

- **Vue 3 Composition API + Nuxt 3**, statically generated (`ssr: false`,
  Nitro `static` preset) and deployed to Netlify.
- **Tailwind CSS**, **TypeScript**.
- The routine is a **pure function** (`utils/routine.ts`): `resolvePhase(now,
  settings, override)` derives the phase on every tick from the weekly schedule
  plus at most one override (`on` / `nap` / `off`), so edits and reloads always
  land on the right phase. Built on local calendar dates, so DST is handled by
  `Date`.
- State lives in **module-singleton composables** (`useSettings`, `useAmbient`,
  …), persisted to **localStorage** with schema versioning, validation and
  migration (settings v2; the override in its own key). (The
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
├── components/        NightLight (kid layer), KidScene, ParentControls, HoldToUnlock,
│                      SettingsPanel, ScheduleEditor, HelpPopover, icons
├── composables/       useNightLight, useSettings, useAmbient, useChime, useWakeLock,
│                      useKeepAwake, useWakeAlarm, useOnboarding,
│                      useRoutineAudio, useParentLayer
├── pages/index.vue    template and wiring only
├── utils/             pure logic: routine, override, ramp, settings, alarm, ambient, chime, …
├── public/            manifest, service worker, icons, sounds/ (optional recordings)
├── tests/             vitest suites (engine, component, composable)
└── e2e/               Playwright specs and a static server for the generated build
```

## License

MIT License — feel free to use and modify.
