# DNDj Technical Documentation

Reference material for developers working on DNDj. It assumes familiarity with
JavaScript, React, and Electron. For end-user feature docs, see the
[User Guide](../user-guide/README.md).

## Read in order (recommended)

1. **[Architecture Overview](./01-architecture-overview.md)** — the process model, data flow, and a map of every file. Start here.
2. **[Main Process](./02-main-process.md)** — `main.js`: window creation, the `app://` protocol, app lifecycle, and where IPC handlers live.
3. **[IPC & Preload Bridge](./03-ipc-and-preload.md)** — the complete `window.dndj` API contract between renderer and main.
4. **[Database Layer](./04-database.md)** — SQLite schema, prepared statements, and the additive migration strategy.
5. **[Audio Engine](./05-audio-engine.md)** — `audioEngine.js`: the three playback layers (URL players, decks, sampler) and the event system.
6. **[Renderer & State](./06-renderer-and-state.md)** — the React tree, the Zustand stores, and how `App.jsx` wires it together.
7. **[Component Reference](./07-components.md)** — every Studio component, its props, and responsibilities.
8. **[Library Scanner & Portability](./08-library-scanner.md)** — scanning, virtual renaming, and the relative-path portability scheme.
9. **[YouTube Pipeline](./09-youtube-pipeline.md)** — the `yt-dlp` + `ffmpeg` download/transcode/import flow.
10. **[Sync System](./10-sync-system.md)** — the HTTP server, the pull client, DuckDNS, and the database hot-swap on pull.
11. **[Design System](./11-design-system.md)** — the token file and CSS conventions.
12. **[Build & Dev Workflow](./12-build-and-dev.md)** — Vite config, npm scripts, and dev-vs-production behaviour.
13. **[Integrity & Reliability](./13-integrity.md)** — DB↔filesystem checks, the launch cleanup gate, the health-check button, and real renames.

## Tech stack

| Concern | Library / API | Notes |
|---------|---------------|-------|
| Desktop shell | Electron 35 | `main.js` is the entry (`package.json#main`) |
| UI | React 18 | Function components + hooks only |
| Bundler (renderer only) | Vite 6 | Main process runs un-bundled via Node |
| Audio | Web Audio API | `Tone` is used only to obtain/standardise the `AudioContext`; playback is `HTMLAudioElement` → `MediaElementSource` graphs |
| Database | better-sqlite3 12 | Synchronous, prepared statements, single file |
| Drag & drop | @dnd-kit/core + /sortable | Decks, pads, playlist tree, reordering |
| Renderer state | Zustand 5 | One persisted UI store + one runtime audio store |
| Media tooling | yt-dlp-wrap, ffmpeg-static | Bundled ffmpeg; yt-dlp downloaded on first use |

## Repository layout (top level)

```
dndj/
├── main.js                 # Electron main process + all IPC handlers
├── preload.js              # contextBridge → window.dndj
├── libraryScanner.js       # Filesystem → DB track sync
├── vite.config.js          # Renderer build/dev config
├── index.html              # Renderer HTML entry
├── package.json            # Scripts & dependencies
├── data/dndj.sqlite        # The database (gitignored, created at runtime)
├── sounds/<category>/...   # Audio files (gitignored)
├── resources/yt-dlp[.exe]  # Downloaded on first YouTube import (gitignored)
└── src/
    ├── main.jsx            # React mount
    ├── App.jsx             # Root component & top-level state
    ├── audioEngine.js      # Audio playback core
    ├── integrity.js        # DB↔filesystem checks, cleanup, rename helpers
    ├── store.js            # Zustand stores
    ├── db/db_manager.js    # SQLite schema + prepared statements
    ├── sync/               # syncServer.js, syncClient.js, duckdns.js
    ├── components/studio/  # The live UI (see Component Reference)
    ├── components/*.jsx    # Legacy "classic" UI — ORPHANED, see below
    └── styles/             # tokens.css + per-component CSS
```

> ### ⚠️ Legacy components
> `src/components/*.jsx` (`AtmospherePlayer`, `Soundboard`, `CategorySidebar`,
> `SceneList`, `MasterControls`, `TrackCard`) are from a previous "classic" UI
> that has been retired. **`App.jsx` renders only `StudioLayout`** — none of these
> are imported into the live tree (they only reference each other). Treat them as
> dead code; don't extend them. The Studio (`src/components/studio/`) is the only
> UI.

> ### ⚠️ Stale root docs
> The root `README.md`, `GEMINI.md`, and `CLAUDE.md` predate parts of the current
> code (e.g. they mention Howler.js, which is gone — `howler` is still a
> dependency in `package.json` but is unused). This `docs/` tree is authoritative.
