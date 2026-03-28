# DNDj — Dungeon Master Soundboard

A DJ-style soundboard and music manager built for Dungeon Masters running tabletop RPG (D&D) sessions. Manage and play local audio files organised by mood, trigger one-shot sound effects, crossfade between atmosphere tracks, and control everything from a clean, dark desktop interface.

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Electron | Cross-platform desktop |
| Frontend | React + Vite | Component isolation, HMR |
| Audio Engine | Howler.js | Multi-channel, seamless looping, crossfade |
| Dev tooling | electron-reloader + Vite HMR | Instant feedback on both layers |

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/alexkollan/dndj.git
cd dndj

# 2. Install dependencies
npm install

# 3. Drop your MP3 files into the sounds/ subfolders
#    sounds/atmosphere/  — looping background tracks
#    sounds/combat/      — battle music
#    sounds/exploration/ — travel / dungeon ambience
#    sounds/tavern/      — social scene music
#    sounds/sfx/         — one-shot sound effects

# 4. Start the app
npm start
```

For development with hot-reloading (Vite HMR + electron-reloader):

```bash
npm run dev
```

## Project Structure

```
dndj/
├── main.js                  # Electron main process: window, IPC, protocol
├── libraryScanner.js        # Scans /sounds folder recursively
├── preload.js               # Exposes safe IPC bridge to renderer
├── src/
│   ├── main.jsx             # React entry point
│   ├── App.jsx              # Root component, layout, state wiring
│   ├── audioEngine.js       # All Howler.js logic (play, stop, loop, volume, crossfade)
│   ├── components/
│   │   ├── AtmospherePlayer.jsx   # Looping track list with volume + crossfade
│   │   ├── Soundboard.jsx         # SFX button grid
│   │   ├── TrackCard.jsx          # Individual track UI (reusable)
│   │   ├── MasterControls.jsx     # Master volume, stop-all, hotkey display
│   │   └── CategorySidebar.jsx    # Sidebar nav for sound categories
│   └── styles/
│       ├── global.css        # Dark mode base styles, CSS variables
│       ├── atmosphere.css    # Atmosphere player styles
│       ├── soundboard.css    # Soundboard grid styles
│       └── controls.css      # Master controls + sidebar styles
├── sounds/                  # Drop your MP3s here
│   ├── atmosphere/
│   ├── combat/
│   ├── exploration/
│   ├── tavern/
│   └── sfx/
├── index.html
├── vite.config.js
└── package.json
```

## Features

- **Automatic Library Scanning** — Drop an MP3 into a subfolder and it appears on next launch. No manual registration needed.
- **Atmosphere Player** — Loop multiple tracks simultaneously. Per-track volume sliders. Crossfade between tracks.
- **Soundboard** — Grid of one-shot SFX buttons. Multiple sounds can overlap.
- **Master Controls** — Global volume slider and Stop All button.
- **Hotkeys** — `Space` stops all sounds.

## Supported Audio Formats

MP3, OGG, WAV, WebM

## Notes

- This app is for personal/local use and always runs in development mode.
- No code signing or distribution pipeline is configured.
- The `sounds/` directory is gitignored — add your own audio files locally.
