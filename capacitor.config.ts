import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor wraps the *same* static Nuxt build (`.output/public`) in native iOS
// and Android shells — no rewrite. This exists to unlock what a PWA can't do:
// background / locked-screen audio and alarm notifications when the app is
// closed. See CAPACITOR.md for setup and the background-audio configuration.
const config: CapacitorConfig = {
  appId: 'com.riselight.app',
  appName: 'RiseLight',
  // The static SSG output that `npm run generate` produces. Run generate before
  // `cap sync` (see the build:native script).
  webDir: '.output/public',
  backgroundColor: '#05070d',
  ios: {
    // Match the app's dark, edge-to-edge look.
    backgroundColor: '#05070d',
    contentInset: 'never'
  },
  android: {
    backgroundColor: '#05070d'
  }
}

export default config
