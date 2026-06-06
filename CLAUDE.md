# GEMINI.md — DNDj Instructional Context

## Project Overview
**DNDj** is a specialized desktop application for Dungeon Masters to manage and play audio during tabletop RPG sessions. It follows an Electron-based architecture with a React frontend, leveraging **Tone.js** (Web Audio API) for professional-grade audio features like sample-accurate looping, multi-channel orchestration, and high-performance waveform visualization.

### Core Technologies
- **Runtime:** [Electron](https://www.electronjs.org/) (Main process handles file system and database).
- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/) (Fast HMR and modern build pipeline).
- **Audio Engine:** [Tone.js](https://tonejs.github.io/) (High-level Web Audio API for sample-accurate timing and effects).
- **Database:** SQLite ([better-sqlite3](https://github.com/Wise-Quotes/better-sqlite3)) stored in a local `./data/` folder for portability.
- **Dev Tooling:** `electron-reloader` for main process restarts; Vite HMR for frontend updates.

## Architecture & Data Flow (Modernized)
The app uses a secure, decoupled architecture to handle local file access and complex audio state:

1.  **Main Process (`main.js`):**
    - Registers a custom `app://` protocol to safely serve local audio files.
    - Manages IPC handlers for library scanning, scene management, and **Virtual Renaming**.
    - Configured to ignore the `./data/` folder during dev-reload to prevent infinite loops.
2.  **Preload Script (`preload.js`):**
    - Exposes a safe IPC bridge (`window.dndj`) for library, tag, scene, and settings operations.
3.  **Audio Engine (`src/audioEngine.js`):**
    - **Replaced Howler.js with Tone.js.**
    - Implements an event-driven synchronization system (`subscribe`) to notify UI of track state changes (`started`, `stopped`, `paused`, `ended`).
    - Handles sample-accurate manual looping via `loopStart` and `loopEnd`.
    - Includes `unloadTrack` to force release of file handles (critical for Windows stability).
4.  **Memory-Safe Waveforms:**
    - Peaks are generated **once** via `AudioContext.decodeAudioData`, then serialized and stored in the database (`tracks` table, `peaks` column).
    - `WaveformEditor.jsx` renders from these cached peaks, reducing RAM usage by 99% for large files.
5.  **Virtual Renaming System:**
    - Tracks use \"Display Names\" in the database while maintaining their original filenames on disk. This prevents `EBUSY` file locks and OS-level conflicts.
    - Custom names are preserved during folder re-scans via \"Smart Upsert\" logic.
6.  **Cross-Platform Portability:**
    - The database stores **Relative Paths** (e.g., `atmosphere/wind.mp3`) instead of absolute paths.
    - The `app://` protocol in `main.js` automatically resolves these to the correct absolute paths for the current OS (Windows/Mac).
    - This allows the `data/dndj.sqlite` file to be moved between machines without losing track data.

## Building and Running

### Prerequisites
- Node.js (Latest LTS recommended)
- `npm`

### Commands
- `npm install`: Install all dependencies (including `tone`).
- `npm start`: Launch the Electron application in production mode.
- `npm run dev`: Launch the development environment (Vite + Electron).
- `npm run build:vite`: Build the React frontend for production.

## Development Conventions

### Code Style
- **Naming:** React components (PascalCase), JS/Logic (camelCase), CSS (kebab-case, BEM-lite).
- **File Structure:**
    - UI: `src/components/`
    - Logic Core: `src/audioEngine.js`, `src/db/db_manager.js`
    - Styles: `src/styles/components/`
- **Audio Logic:** Use the public API in `src/audioEngine.js`. Never import `Tone` directly into components except for the engine itself.

### Data & Persistence
- **Local Storage:** The database `dndj.sqlite` is located in the project root's `/data/` folder. This folder should be included in backups but ignored by watchers.
- **Scenes:** Persistent collections. Scenes now support full tag management and clearly distinguish between Atmosphere and SFX tracks via category badges.
- **Interaction:** Waveform interactions use a priority system: Hover (Glow) = Handle Grab; Background Click = Seek.

### Styling & Design System
- **Pattern:** Modular CSS with layered Canvas for waveforms (60fps performance).
- **Design Language:** "Glassmorphism" (Emerald/Amber/Slate).
- **Tokens:** Emerald (`#10b981`) for Atmosphere/Success; Amber (`#f59e0b`) for SFX; Rose (`#ef4444`) for Removal/Error.
