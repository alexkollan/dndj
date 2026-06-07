# 2. Main Process (`main.js`)

[← Prev: Architecture Overview](./01-architecture-overview.md) · [Technical Index](./README.md) · [Next: IPC & Preload →](./03-ipc-and-preload.md)

---

`main.js` is the Electron entry point (`package.json#main`). It runs in Node with
full privileges and is responsible for the window, the audio-streaming protocol,
the app lifecycle, and registering every IPC handler.

## Responsibilities at a glance

1. Create and hold the `BrowserWindow` (`mainWindow`).
2. Register and serve the **`app://`** custom protocol for audio.
3. Register **~50 `ipcMain.handle()`** endpoints (the full list is in
   [IPC & Preload](./03-ipc-and-preload.md)).
4. Orchestrate the [YouTube pipeline](./09-youtube-pipeline.md) and
   [sync system](./10-sync-system.md).
5. Wire up `electron-reloader` for dev hot-reload.

## Window creation

`createWindow()` builds a 1280×800 window (min 900×600) with the dark theme
background and these security-relevant `webPreferences`:

```js
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,   // renderer can't see Node directly
  nodeIntegration: false,   // no require() in renderer
}
```

In dev (`!app.isPackaged`) it loads `http://localhost:5178` (the Vite dev server)
and opens detached DevTools. In production it loads the built
`dist/index.html`. The `mainWindow` reference is kept module-level so IPC handlers
can push events to the renderer (`mainWindow.webContents.send(...)`).

## The `app://` protocol

This is how audio bytes get from disk to the renderer's `<audio>` elements without
exposing `file://` paths or hitting CORS.

### Registration (before `app.ready`)
```js
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true },
}]);
```
`stream: true` is what allows large files to be streamed rather than buffered.

### Handler (`protocol.handle('app', …)`, inside `app.whenReady`)

URL shape: **`app://audio/<per-segment-encoded-relative-path>`**.

The handler:

1. Decodes each path segment individually (so spaces/special chars survive but
   `/` stays a separator).
2. Resolves it against `SOUNDS_DIR` (`<project>/sounds`).
3. **Security gate:** rejects (403) anything that resolves outside `SOUNDS_DIR`
   (case-insensitive prefix check). Returns 404 if the file no longer exists.
4. Honours the **`Range`** request header: parses `bytes=start-end`, returns
   `206 Partial Content` with `Content-Range`/`Accept-Ranges` and a
   `fs.createReadStream(path, { start, end })`. Without a range it returns the
   whole file but still advertises `Accept-Ranges: bytes`.

> **Why range support matters:** browser seeking on a media element issues range
> requests. Without `206` handling, dragging the playhead would fail. This is also
> why `get-audio-url` (below) encodes each segment rather than the whole path —
> whole-path `encodeURIComponent` turns `/` into `%2F`, which Chromium may
> re-normalise during range requests and 404.

MIME types come from `AUDIO_MIME_TYPES`. Note `.opus`/`.webm` map to
`audio/webm; codecs=opus` because yt-dlp produces WebM-container Opus.

### `get-audio-url` IPC

The renderer doesn't hardcode `app://` URLs; it calls `get-audio-url(relativePath)`
which performs the same security check and returns
`app://audio/<encoded-segments>`. The renderer caches these (see
[`resolveUrl` in App.jsx](./06-renderer-and-state.md)).

## App lifecycle

```js
app.whenReady().then(() => {
  protocol.handle('app', …);
  createWindow();
  // Auto-start sync server if it was enabled at last shutdown:
  if (getSetting('sync_server_enabled') === true) startServer(...);
  app.on('activate', recreate window on macOS dock click);
});
app.on('window-all-closed', () => { if (!darwin) app.quit(); });
```

On startup it reads `sync_server_enabled` from the DB and, if true, restarts the
[sync server](./10-sync-system.md) (and DuckDNS updater) automatically — so a
machine you left as a server comes back as one.

## IPC handler groups

All handlers are registered at module load. They're grouped by concern:

| Group | Example handlers | Backed by |
|-------|------------------|-----------|
| Library | `scan-library`, `get-audio-url` | `libraryScanner`, `db` |
| Tags | `get-tags`, `add-tag-to-track`, `create-tag`, `update-tag`, `delete-tag` | `db` |
| Scenes | `save-scene-snapshot`, `get-scenes`, `delete-scene`, plus legacy scene-track ops | `db` |
| Tracks | `rename-track`, `update-track-peaks`, `update-track-duration`, `move-track-to-category`, `delete-track` | `db` + `fs` |
| Settings | `get-setting`, `set-setting` | `db` (JSON-encoded values) |
| Playlists | `get-playlists`, `create/update/delete-playlist`, `*-track-to-playlist`, `reorder-playlist-track` | `db` |
| Cue points | `get/add/update/delete-cue-point` | `db` |
| Categories | `get/upsert/delete-category-meta`, `create-category` | `db` + `fs` |
| YouTube | `youtube-check/setup/get-info/import` | `yt-dlp`, `ffmpeg` |
| Sync | `sync:start-server`, `sync:stop-server`, `sync:server-status`, `sync:update-duckdns`, `sync:pull` | `src/sync/*` |

The exact signatures and return shapes are documented in
[IPC & Preload Bridge](./03-ipc-and-preload.md).

### Patterns worth noting

- **Mutations return fresh data.** Most write handlers end with
  `return dbManager.getAllTracks.all()` (or the relevant collection) so the
  renderer can replace state in one step.
- **`dbManager` is a reassignable binding** (`let`, not `const`). The
  [sync pull](./10-sync-system.md#the-database-hot-swap) closes the DB, swaps the
  file, then `delete require.cache[...]` and re-`require`s the module, reassigning
  `dbManager`. Because every handler closes over the `dbManager` *variable*, they
  all transparently use the new database afterward — no restart needed in dev.
- **`move-track-to-category` and `delete-track` touch the filesystem** (rename or
  unlink) in addition to the DB; `create-category` `mkdir`s the folder.

## Key constants

```js
const VITE_DEV_SERVER_PORT = 5178;                 // must match vite.config.js
const SOUNDS_DIR = path.join(__dirname, 'sounds');
const DB_PATH    = path.join(__dirname, 'data', 'dndj.sqlite');
const SYNC_PORT  = 7432;
```

> `electron-reloader` is configured to **ignore `/data/` and `dndj.sqlite`** so DB
> writes don't trigger an infinite reload loop in dev.

---

[← Prev: Architecture Overview](./01-architecture-overview.md) · [Technical Index](./README.md) · [Next: IPC & Preload →](./03-ipc-and-preload.md)
