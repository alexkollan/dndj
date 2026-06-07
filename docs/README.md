# DNDj Documentation

**DNDj** is a desktop application for Dungeon Masters that turns a folder of audio
files into a professional, DJ-style mixing console for tabletop RPG sessions.
Load tracks onto dual mixing decks, crossfade between moods, fire off one-shot
sound effects, organise everything into playlists, snapshot a "scene" so you can
recall it instantly, and sync your whole library between two machines.

This documentation is split into two independent sets. Pick the one that matches
what you need.

---

## 📖 [User Guide](./user-guide/README.md)

For people who want to **use** DNDj at the table. No programming required.
Covers every feature, button, and keyboard shortcut.

Start here → **[User Guide → Getting Started](./user-guide/01-getting-started.md)**

| # | Chapter | What it covers |
|---|---------|----------------|
| 01 | [Getting Started](./user-guide/01-getting-started.md) | Install, launch, add your first sounds |
| 02 | [Interface Tour](./user-guide/02-interface-tour.md) | Every region of the screen, explained |
| 03 | [Library & Tracks](./user-guide/03-library-and-tracks.md) | Scanning, categories, tags, rename, delete |
| 04 | [Decks & Playback](./user-guide/04-decks-and-playback.md) | Decks A/B/C, waveform, loops, cue points, filter |
| 05 | [The Crossfader](./user-guide/05-crossfader.md) | Blending decks A and B, curve types |
| 06 | [Playlists](./user-guide/06-playlists.md) | Manual, Smart, and Folder playlists |
| 07 | [Sampler Pads](./user-guide/07-sampler-pads.md) | One-shot SFX pads |
| 08 | [Scenes](./user-guide/08-scenes.md) | Saving and recalling board snapshots |
| 09 | [YouTube Import](./user-guide/09-youtube-import.md) | Pulling audio from YouTube |
| 10 | [Syncing Two Machines](./user-guide/10-sync.md) | LAN/WAN sync, DuckDNS, saved connections |
| 11 | [Keyboard Shortcuts](./user-guide/11-keyboard-shortcuts.md) | Complete shortcut reference |
| 12 | [Settings](./user-guide/12-settings.md) | The Library Settings dialog |

---

## 🛠️ [Technical Documentation](./technical/README.md)

For developers who want to **understand, modify, or extend** DNDj. Covers the
architecture, the IPC contract, the database schema, the audio engine internals,
and the build pipeline.

Start here → **[Technical → Architecture Overview](./technical/01-architecture-overview.md)**

| # | Chapter | What it covers |
|---|---------|----------------|
| 01 | [Architecture Overview](./technical/01-architecture-overview.md) | Process model, data flow, file map |
| 02 | [Main Process](./technical/02-main-process.md) | `main.js`, `app://` protocol, lifecycle |
| 03 | [IPC & Preload Bridge](./technical/03-ipc-and-preload.md) | The full `window.dndj` API contract |
| 04 | [Database Layer](./technical/04-database.md) | Schema, prepared statements, migrations |
| 05 | [Audio Engine](./technical/05-audio-engine.md) | `audioEngine.js` — players, decks, sampler |
| 06 | [Renderer & State](./technical/06-renderer-and-state.md) | React tree, Zustand stores, `App.jsx` |
| 07 | [Component Reference](./technical/07-components.md) | Every Studio component, props and roles |
| 08 | [Library Scanner & Portability](./technical/08-library-scanner.md) | Scanning, virtual rename, relative paths |
| 09 | [YouTube Pipeline](./technical/09-youtube-pipeline.md) | `yt-dlp` + `ffmpeg` download/transcode |
| 10 | [Sync System](./technical/10-sync-system.md) | Server, client, DuckDNS, DB hot-swap |
| 11 | [Design System](./technical/11-design-system.md) | Tokens, CSS conventions |
| 12 | [Build & Dev Workflow](./technical/12-build-and-dev.md) | Vite, scripts, dev vs production |

---

## At a glance

| | |
|---|---|
| **Runtime** | [Electron](https://www.electronjs.org/) 35 |
| **Frontend** | [React](https://react.dev/) 18 + [Vite](https://vitejs.dev/) 6 |
| **Audio** | Web Audio API (via [Tone.js](https://tonejs.github.io/) context) + `HTMLAudioElement` streaming |
| **Database** | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (local `data/dndj.sqlite`) |
| **Drag & drop** | [@dnd-kit](https://dndkit.com/) |
| **UI state** | [Zustand](https://github.com/pmndrs/zustand) |
| **Media tools** | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) |

> **A note on the two READMEs in the repo root:** the root `README.md` and
> `GEMINI.md`/`CLAUDE.md` predate parts of the current codebase (for example the
> root README still mentions Howler.js, which has been replaced). **This `docs/`
> folder is the authoritative, up-to-date documentation.** Where they conflict,
> trust `docs/`.
