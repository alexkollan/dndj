# 1. Architecture Overview

[← Technical Index](./README.md) · [Next: Main Process →](./02-main-process.md)

---

DNDj is an Electron app with a strict two-process split. This chapter is the map;
later chapters drill into each region.

## Process model

```
┌─────────────────────────────── Electron ───────────────────────────────┐
│                                                                          │
│   MAIN PROCESS (Node)                    RENDERER PROCESS (Chromium)     │
│   ───────────────────                    ──────────────────────────     │
│   main.js                                src/main.jsx → App.jsx          │
│    • BrowserWindow                        • React 18 component tree      │
│    • app:// protocol (audio streaming)    • audioEngine.js (Web Audio)   │
│    • ~50 ipcMain.handle() endpoints       • Zustand stores (store.js)    │
│    • libraryScanner.js                    • window.dndj.* (from preload) │
│    • src/db/db_manager.js (SQLite)                                       │
│    • src/sync/* (HTTP server/client)                                     │
│                                                                          │
│            ▲                                         ▲                   │
│            │   ipcRenderer.invoke / .send           │                   │
│            └──────────── preload.js ────────────────┘                   │
│                     contextBridge → window.dndj                         │
└──────────────────────────────────────────────────────────────────────-─┘
                    │                              │
              data/dndj.sqlite              sounds/<category>/*
```

- **Main process** owns everything privileged: the filesystem, the database, the
  network (sync server/client, DuckDNS, yt-dlp), and the custom protocol that
  streams audio bytes. It exposes capabilities exclusively through `ipcMain`
  handlers.
- **Renderer process** owns the UI and audio *playback*. It never touches Node
  APIs directly (`nodeIntegration: false`, `contextIsolation: true`). It reaches
  the main process only through `window.dndj`, defined in [`preload.js`](./03-ipc-and-preload.md).

This separation is the central design constraint: **any new feature that needs the
disk, the DB, or the network must add an IPC handler in `main.js` and a method in
`preload.js`.**

## The two ways audio reaches the speakers

It's worth understanding early that audio data and audio *control* take different
paths:

1. **Bytes** travel over the **`app://` protocol** (registered in `main.js`).
   The renderer creates an `<audio>` element whose `src` is `app://audio/<path>`;
   the main process streams the file from `sounds/` with HTTP range support so the
   browser can seek. See [Main Process → Protocol](./02-main-process.md#the-app-protocol).

2. **Control** (play, volume, loop, filter, crossfade) happens entirely in the
   renderer via the [Audio Engine](./05-audio-engine.md), which wraps each
   `<audio>` element in a Web Audio graph (`MediaElementSource → gain → filter →
   … → destination`).

## Typical data flows

### Startup
```
App.jsx mount
  → window.dndj.scanLibrary()          (IPC → main)
      → libraryScanner.scanLibrary()   (disk → DB upserts)
      → db.getAllTracks()              (returns rows)
  → window.dndj.getTags()
  → setAllTracks / setTags             (React state)
  → render <StudioLayout/>
```

### Playing a track on a deck
```
drag track → Deck A (dnd-kit)
  → StudioLayout.handleLoadToDeck('A', track)
      → resolveUrl(track.path)         (IPC get-audio-url → "app://audio/…")
      → audioEngine.loadDeck('A', url) (builds Web Audio graph)
  → user clicks play
      → audioEngine.playDeck('A')      (<audio>.play())
      → emit('deckStarted')            (engine event)
  → DeckPanel & StudioLayout subscribers update React state
```

### Mutating data (e.g. add a tag)
```
UI action
  → window.dndj.addTagToTrack(id, name)  (IPC)
      → db_manager prepared statements (INSERT/链link)
      → returns fresh getAllTracks()
  → React state replaced with returned rows
```

Note the recurring pattern: **mutating IPC handlers return the fresh, full result
set** (e.g. all tracks, all playlists), and the renderer replaces its state
wholesale. This keeps the renderer a thin reflection of the database.

## State ownership

| State | Lives in | Persistence |
|-------|----------|-------------|
| Tracks, tags, playlists, scenes, cue points, category meta | SQLite (`data/dndj.sqlite`) | Authoritative, on disk |
| Master volume, sampler pads, sync config | SQLite `settings` table | On disk |
| Rail width, deck split | Zustand `useUIStore` (persisted) | `localStorage` |
| Which URLs are currently playing/paused | Zustand `useAudioStore` (runtime) | None — engine is source of truth |
| Live deck/transport state | React state in components, driven by engine events | None |
| Audio graph & playback position | `audioEngine.js` module singletons | None |

## File-by-file responsibilities

| File | Responsibility | Chapter |
|------|----------------|---------|
| `main.js` | Window, `app://`, lifecycle, all IPC handlers, YouTube & sync orchestration | [02](./02-main-process.md), [09](./09-youtube-pipeline.md), [10](./10-sync-system.md) |
| `preload.js` | `contextBridge` → `window.dndj` | [03](./03-ipc-and-preload.md) |
| `libraryScanner.js` | Walk `sounds/`, upsert tracks, mark missing | [08](./08-library-scanner.md) |
| `src/db/db_manager.js` | Schema, migrations, prepared statements | [04](./04-database.md) |
| `src/audioEngine.js` | Web Audio playback: players, decks, sampler, events | [05](./05-audio-engine.md) |
| `src/integrity.js` | DB↔filesystem delta, cleanup, rename/snapshot helpers | [13](./13-integrity.md) |
| `src/importer.js` | Import staging/commit for files, folders, zips | [14](./14-import.md) |
| `src/store.js` | Zustand UI + audio stores | [06](./06-renderer-and-state.md) |
| `src/App.jsx` | Root state, engine↔store wiring, library loading | [06](./06-renderer-and-state.md) |
| `src/components/studio/*` | The entire live UI | [07](./07-components.md) |
| `src/sync/*` | HTTP sync server, pull client, DuckDNS updater | [10](./10-sync-system.md) |
| `src/styles/tokens.css` | Design tokens | [11](./11-design-system.md) |
| `vite.config.js` | Renderer dev server & build | [12](./12-build-and-dev.md) |

---

[← Technical Index](./README.md) · [Next: Main Process →](./02-main-process.md)
