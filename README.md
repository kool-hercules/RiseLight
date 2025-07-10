# RiseLight

A color-changing light that helps kids know when it’s time to stay in bed –– and when it’s okay to rise.  Built with Vue 3 and Nuxt 3.

## Features

- **Full-Screen LED Simulation**: Displays a radial gradient light that fills the entire screen
- **Three Light Modes**: 
  - White light (night mode)
  - Blue light (wake period)
  - Pink light (awake period)
- **Customizable Settings**:
  - Wake time (default: 6:30 AM)
  - Wake duration (1-60 minutes, default: 30 minutes)
  - Brightness controls for each color
- **Timer Logic**: 
  - Automatically transitions between light modes
  - Handles overnight timing (e.g., start at 10 PM, wake at 6:30 AM)
- **iPad Optimized**: Responsive design for landscape and portrait orientations
- **Touch-Friendly**: Large buttons and gestures optimized for tablet use
- **Preview Mode**: Test different colors and brightness levels
- **Keyboard Shortcuts**: Space to toggle, 'S' for settings, Escape to close

## How It Works

1. **Night Mode**: Start with white light when activated
2. **Wake Mode**: At the specified wake time, light turns blue for the set duration
3. **Awake Mode**: After the wake period, light turns pink and stays on until you exit

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. Open the app in your browser
2. Tap the "Turn On" button to start the night light
3. Tap the settings icon to customize:
   - Wake time
   - Wake duration
   - Brightness levels
4. Use preview buttons to test different colors
5. The app will automatically transition through the light modes

## Technical Details

- Built with Vue 3 Composition API
- Nuxt 3 for SSR and auto-imports
- Tailwind CSS for styling
- TypeScript for type safety
- Pinia for state management
- VueUse for utility functions

## Project Structure

```
├── components/
│   ├── NightLight.vue      # Main LED display component
│   └── SettingsPanel.vue   # Settings configuration panel
├── composables/
│   ├── useNightLight.ts    # Timer logic and state management
│   └── useSettings.ts      # Settings persistence and validation
├── pages/
│   └── index.vue           # Main application page
├── types/
│   └── index.ts            # TypeScript type definitions
└── assets/css/
    └── main.css            # Custom CSS and light effects
```

## Browser Support

- Modern browsers with ES2015+ support
- Optimized for iPad Safari
- PWA-ready for full-screen experience

## License

MIT License - feel free to use and modify as needed. 