# GEMINI.md — DNDj Instructional Context

## Project Overview
**DNDj** is a specialized desktop application for Dungeon Masters to manage and play audio during tabletop RPG sessions. It follows an Electron-based architecture with a React frontend, leveraging `Howler.js` for advanced audio features like multi-channel playback and crossfading.

### Core Technologies
- **Runtime:** [Electron](https://www.electronjs.org/) (Main process handles file system and custom protocols).
- **Frontend:** [React](https://react.dev/) + [Vite](https://vitejs.dev/) (Fast HMR and modern build pipeline).
- **Audio Engine:** [Howler.js](https://howlerjs.com/) (Web Audio API abstraction for looping and fades).
- **Dev Tooling:** `electron-reloader` for main process restarts; Vite HMR for frontend updates.

## Architecture & Data Flow
The app uses a secure, decoupled architecture to handle local file access:

1.  **Main Process (`main.js`):**
    - Registers a custom `app://` protocol to safely serve local audio files to the renderer without exposing the full file system.
    - Uses `libraryScanner.js` to recursively scan the `sounds/` directory.
2.  **Preload Script (`preload.js`):**
    - Exposes a safe IPC bridge via `contextBridge` as `window.dndj`.
    - Methods: `scanLibrary()`, `getAudioUrl(filePath)`.
3.  **Audio Engine (`src/audioEngine.js`):**
    - A centralized wrapper for all `Howler.js` logic.
    - Handles track caching (preventing multiple loads of the same file), volume management, and crossfading.
4.  **Frontend State (`src/App.jsx`):**
    - Manages the sound library state, selected categories, and master volume.
    - Categorizes tracks based on the subfolders in `sounds/` (e.g., `atmosphere`, `combat`, `sfx`).

## Building and Running

### Prerequisites
- Node.js (Latest LTS recommended)
- `npm`

### Commands
- `npm install`: Install all dependencies.
- `npm start`: Launch the Electron application in production mode (loads from `dist/`).
- `npm run dev`: Launch the development environment (starts Vite dev server and Electron with hot-reloading).
- `npm run build:vite`: Build the React frontend for production.

## Development Conventions

### Code Style
- **Naming:** 
    - React components use **PascalCase** (e.g., `AtmospherePlayer.jsx`).
    - Standard JS files and hooks use **camelCase** (e.g., `audioEngine.js`).
    - CSS files use **kebab-case** and follow a BEM-lite naming convention (e.g., `.app__main`).
- **File Structure:**
    - UI components reside in `src/components/`.
    - Logic-heavy utilities (like the audio engine) live in the root of `src/`.
    - Styles are centralized in `src/styles/`.
- **Logic Isolation:** 
    - Components should *never* import `Howler` or `Howl` directly. They must use the public API exposed by `src/audioEngine.js`.
    - File system operations must remain in the Main process; the Renderer interacts only via the `window.dndj` IPC bridge.

### Adding Audio
1.  Place MP3/OGG/WAV files in subdirectories of `sounds/`.
2.  The subdirectory name becomes the category name in the UI.
3.  The `sfx` folder is treated specially (rendered as a grid of buttons instead of a list).

### Testing
- Currently, there is no automated test suite. Manual validation via `npm run dev` is required for any audio engine or UI changes.
- Ensure any new IPC events are mirrored in `preload.js`.
