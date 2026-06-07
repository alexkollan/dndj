# DNDj — Dungeon Master Soundboard & Studio

A DJ-style audio studio built for Dungeon Masters running tabletop RPG (D&D)
sessions. Turn a folder of audio files into a professional mixing console: load
tracks onto dual mixing decks, crossfade between moods, fire off one-shot sound
effects, organise everything into playlists, snapshot a "scene" to recall it
instantly, import audio from YouTube, and sync your whole library between two
machines.

> 📖 **Full documentation lives in [`docs/`](./docs/README.md)** — a complete
> [User Guide](./docs/user-guide/README.md) and
> [Technical Documentation](./docs/technical/README.md) set. The same guides are
> also browsable **inside the app** (the **?** button in the top bar) with search.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | [Electron](https://www.electronjs.org/) 35 | Cross-platform desktop, local file access |
| Frontend | [React](https://react.dev/) 18 + [Vite](https://vitejs.dev/) 6 | Component isolation, fast HMR |
| Audio | Web Audio API (`HTMLAudioElement` streaming, [Tone.js](https://tonejs.github.io/) context) | Sample-accurate looping, per-deck filter & gain, crossfade |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | Fast, synchronous, single portable file |
| Drag & drop | [@dnd-kit](https://dndkit.com/) | Decks, pads, playlist tree, reordering |
| UI state | [Zustand](https://github.com/pmndrs/zustand) | Lightweight layout/runtime state |
| Media tooling | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static) | YouTube import & transcoding |
| Docs viewer | react-markdown + remark-gfm + rehype-slug | In-app guides with search |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) (latest LTS)
- `npm`

### Install & run

```bash
# 1. Install dependencies
npm install

# 2. Launch in development (Vite HMR + Electron, the normal workflow)
npm run dev
```

`npm start` runs the app directly; `npm run dev` is the day-to-day mode with
hot-reload. If you hit a `NODE_MODULE_VERSION` error from the native database
module, run `npm run rebuild`.

> This app is meant to run **from source in development mode** — there is no
> installer or code-signing pipeline. See
> [Build & Dev Workflow](./docs/technical/12-build-and-dev.md) for details.

### Add your sounds

Drop audio files into subfolders of `sounds/` — **each subfolder is a category**.
The names are entirely your choice; the layout below is just an example, not a
required structure:

```
sounds/
├── atmosphere/   ← looping background moods
├── combat/       ← battle music
├── exploration/  ← travel & dungeon ambience
├── tavern/       ← social / town music
└── sfx/          ← one-shot sound effects
```

> The only name with any behaviour attached is **`sfx`** (lowercase): tracks in
> it play *once* instead of looping when previewed from the library list.
> Everything else is free-form.

Then click **↻ Refresh** in the app (or relaunch). New tracks appear in
*My Library*. You can rename, recolour categories, tag, and reorganise everything
from inside the app — see [Library & Tracks](./docs/user-guide/03-library-and-tracks.md).

**Supported formats:** MP3 · OGG · WAV · WebM · M4A · AAC · FLAC · Opus

---

## Features

- **Dual mixing decks (A & B)** with waveform display, seek, loops (with custom
  in/out points), colour-coded cue markers, per-deck volume, and a low-pass
  filter. → [Decks & Playback](./docs/user-guide/04-decks-and-playback.md)
- **A third deck (C)** — a compact, crossfader-independent layer for a persistent
  bed (storm, fire, drone), expandable to full size.
- **Crossfader** with four curves (Natural / Slow / Linear / Cut) for seamless
  mood changes. → [The Crossfader](./docs/user-guide/05-crossfader.md)
- **Playlists** in three flavours — **Manual**, rule-based **Smart**, and nesting
  **Folders**. → [Playlists](./docs/user-guide/06-playlists.md)
- **Sampler pads** — eight one-shot SFX pads, triggerable by keys `1`–`8`,
  overlapping voices. → [Sampler Pads](./docs/user-guide/07-sampler-pads.md)
- **Scenes** — snapshot the entire board (all decks, crossfader, pads) and recall
  it instantly or with a crossfade. → [Scenes](./docs/user-guide/08-scenes.md)
- **YouTube import** — pull audio straight from a link, with category/tag/format
  options. → [YouTube Import](./docs/user-guide/09-youtube-import.md)
- **Two-machine sync** — run one instance as a server and pull its library (DB +
  audio) onto another over LAN or the internet (DuckDNS), with saved connections.
  → [Syncing Two Machines](./docs/user-guide/10-sync.md)
- **In-app guides with search** — the **?** button opens this documentation
  rendered inside the app.
- **Tags & categories** with custom names and colours, plus a powerful
  search/filter bar. → [Settings](./docs/user-guide/12-settings.md)
- **Keyboard-driven** playback for live use.
  → [Keyboard Shortcuts](./docs/user-guide/11-keyboard-shortcuts.md)

---

## Project structure

```
dndj/
├── main.js                 # Electron main: window, app:// protocol, IPC, YouTube & sync
├── preload.js              # Safe IPC bridge → window.dndj
├── libraryScanner.js       # Scans sounds/ → database
├── vite.config.js          # Renderer dev server & build
├── index.html              # Renderer entry HTML
├── docs/                   # Full user + technical documentation
├── data/dndj.sqlite        # The database (created at runtime; gitignored)
├── sounds/<category>/...   # Your audio files (gitignored)
└── src/
    ├── main.jsx            # React mount
    ├── App.jsx             # Root state & wiring
    ├── audioEngine.js      # Web Audio playback (players, decks, sampler)
    ├── store.js            # Zustand stores
    ├── db/db_manager.js    # SQLite schema + prepared statements
    ├── sync/               # syncServer.js, syncClient.js, duckdns.js
    ├── components/studio/  # The live Studio UI
    └── styles/             # tokens.css + per-component CSS
```

For how it all fits together, start with the
[Architecture Overview](./docs/technical/01-architecture-overview.md).

---

## Where your data lives

- **Audio files** stay where you put them, in `sounds/`. DNDj never renames the
  files on disk — track names are stored separately (Virtual Renaming).
- **Everything else** (names, tags, playlists, cue points, scenes, settings) lives
  in a single SQLite file at `data/dndj.sqlite`. Back up that file to back up your
  whole setup. Paths inside it are stored **relative**, so the database is portable
  between machines (this is what powers sync).

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server + Electron (normal workflow) |
| `npm start` | Launch Electron |
| `npm run build:vite` | Build the renderer into `dist/` |
| `npm run rebuild` | Rebuild the native `better-sqlite3` addon for Electron |

---

## License

MIT
