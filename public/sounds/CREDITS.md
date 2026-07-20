# Ambient sound recordings

RiseLight's ambient sounds are **synthesized at runtime** with the Web Audio API
(`utils/ambient.ts`) — white/pink/brown noise plus filtered/modulated
approximations of rain, ocean, fan, wind, and a soft heartbeat. This means the
app ships **no audio assets by default**, loops forever without a seam, and works
fully offline.

Optional, higher-fidelity **recordings** can be layered in per sound. When a
recording is present and reachable it is preferred; otherwise the synthesized
approximation always plays, so a sound is never silent.

## Adding a recording

1. Source a **CC0 / royalty-free, no-attribution** loop. Recommended sources:
   - **Freesound.org** — filter License = "Creative Commons 0"; verify each file.
   - **Pixabay** — royalty-free.
   Avoid anything requiring attribution or with restrictive terms.
2. Trim it to a **seamless loop at zero crossings**, normalize, make it mono,
   and encode to **`.m4a` (AAC-LC)** — the safe cross-browser format for
   `decodeAudioData` (iOS Safari lacks Ogg). Keep it 30–90s and < ~1 MB.
3. Drop it here, e.g. `public/sounds/rain.m4a`.
4. Point the sound at it: in `utils/ambient.ts`, give `createAmbientPlayer` an
   `assetUrlFor` that returns the URL for that id (or extend `AMBIENT_SOUNDS` /
   `SOUND_DEFS` with an `assetUrl`). The engine handles fetch → decode → looping
   buffer, caches the decoded buffer, and falls back to synth on any failure.
5. For guaranteed offline playback, add the file's path to `SHELL_URLS` in
   `public/sw.js` **and bump `CACHE_VERSION`** (e.g. `riselight-v2`) so the
   service worker re-precaches. Note: `cache.addAll` is atomic — only list files
   that actually exist, or the whole precache fails.

## Provenance

Record each recording's source and license below as you add them.

| File | Source | License | URL |
|------|--------|---------|-----|
| _(none yet — all sounds are synthesized)_ | | | |
