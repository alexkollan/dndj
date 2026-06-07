# 3. IPC & Preload Bridge

[← Prev: Main Process](./02-main-process.md) · [Technical Index](./README.md) · [Next: Database Layer →](./04-database.md)

---

`preload.js` is the only bridge between the sandboxed renderer and the privileged
main process. It uses `contextBridge.exposeInMainWorld('dndj', { … })` to publish
a flat API at **`window.dndj`**. Every method is a thin wrapper around
`ipcRenderer.invoke(channel, …args)` (request/response) or `ipcRenderer.on(...)`
(main → renderer events).

> **Adding a capability = three edits:** an `ipcMain.handle('channel', …)` in
> `main.js`, a wrapper in `preload.js`, and a call site in the renderer. Keep the
> channel name and the method name aligned for sanity.

## The full `window.dndj` API

### Library & audio
| Method | Channel | Returns |
|--------|---------|---------|
| `scanLibrary()` | `scan-library` | all tracks (after re-scan) |
| `getAudioUrl(filePath)` | `get-audio-url` | `"app://audio/…"` string |

### Tagging
| Method | Channel | Returns |
|--------|---------|---------|
| `getTags()` | `get-tags` | all tags |
| `addTagToTrack(trackId, tagName)` | `add-tag-to-track` | all tracks |
| `removeTagFromTrack(trackId, tagId)` | `remove-tag-from-track` | all tracks |
| `createTag(name, color)` | `create-tag` | all tags |
| `updateTag(id, name, color)` | `update-tag` | all tags |
| `deleteTag(id)` | `delete-tag` | all tags |

### Tracks
| Method | Channel | Notes |
|--------|---------|-------|
| `renameTrack(trackId, newName)` | `rename-track` | Virtual rename (DB only); returns all tracks |
| `updateTrackPeaks(trackId, peaks)` | `update-track-peaks` | Caches waveform peaks JSON |
| `updateTrackDuration(trackId, duration)` | `update-track-duration` | — |
| `moveTrackToCategory(trackId, newCategory)` | `move-track-to-category` | **Moves file on disk**; returns all tracks |
| `deleteTrack(trackId, deleteFile, globalDelete)` | `delete-track` | Deletes file; optionally queues a sync deletion |

### Scenes (snapshots)
| Method | Channel | Notes |
|--------|---------|-------|
| `saveSceneSnapshot(name, snapshotJson)` | `save-scene-snapshot` | Returns new row id |
| `updateSceneSnapshot(id, name, snapshotJson)` | `update-scene-snapshot` | — |
| `getScenes()` | `get-scenes` | All scenes |
| `deleteScene(id)` | `delete-scene` | — |
| `createEmptyScene`, `addTrackToScene`, `removeTrackFromScene`, `updateSceneTrackSettings`, `saveScene`, `getSceneTracks` | various | **Legacy** "classic" scene-track API; not used by the Studio snapshot flow |

### Settings
| Method | Channel | Notes |
|--------|---------|-------|
| `getSetting(key)` | `get-setting` | Value is JSON-parsed in main; returns `null` if absent |
| `setSetting(key, value)` | `set-setting` | Value is `JSON.stringify`-ed in main |

### Playlists
| Method | Channel | Returns |
|--------|---------|---------|
| `getPlaylists()` | `get-playlists` | all playlists |
| `createPlaylist(name, parentId, type, rulesJson)` | `create-playlist` | all playlists |
| `updatePlaylist(id, name, parentId, rulesJson, sortOrder)` | `update-playlist` | all playlists |
| `deletePlaylist(id)` | `delete-playlist` | all playlists |
| `getPlaylistTracks(playlistId)` | `get-playlist-tracks` | tracks in playlist |
| `addTrackToPlaylist(playlistId, trackId)` | `add-track-to-playlist` | tracks in playlist |
| `removeTrackFromPlaylist(playlistId, trackId)` | `remove-track-from-playlist` | tracks in playlist |
| `reorderPlaylistTrack(playlistId, trackId, sortOrder)` | `reorder-playlist-track` | tracks in playlist |

### Cue points
| Method | Channel | Returns |
|--------|---------|---------|
| `getCuePoints(trackId)` | `get-cue-points` | cues for track |
| `addCuePoint(trackId, position, label, color)` | `add-cue-point` | cues for track |
| `updateCuePoint(id, position, label, color)` | `update-cue-point` | cues for track |
| `deleteCuePoint(id)` | `delete-cue-point` | cues for track |

### Category metadata
| Method | Channel | Notes |
|--------|---------|-------|
| `getCategoryMeta()` | `get-category-meta` | All category meta rows |
| `upsertCategoryMeta(folderName, displayName, color)` | `upsert-category-meta` | — |
| `createCategory(folderName, displayName, color)` | `create-category` | **Creates folder on disk** + meta |
| `deleteCategoryMeta(folderName)` | `delete-category-meta` | Meta only (no file deletion) |

### YouTube (request + event)
| Method | Channel | Notes |
|--------|---------|-------|
| `youtubeCheck()` | `youtube-check` | `{ ready: boolean }` |
| `youtubeSetup()` | `youtube-setup` | Downloads the yt-dlp binary |
| `youtubeGetInfo(url)` | `youtube-get-info` | Video metadata |
| `youtubeImport(opts)` | `youtube-import` | Download + transcode + insert; returns all tracks |
| `onYoutubeProgress(cb)` / `offYoutubeProgress()` | `youtube-progress` (event) | Progress phases |

### Sync (request + event)
| Method | Channel | Notes |
|--------|---------|-------|
| `syncStartServer()` | `sync:start-server` | Returns `{ port, localIp, token }` |
| `syncStopServer()` | `sync:stop-server` | — |
| `syncServerStatus()` | `sync:server-status` | `{ running, info?, duckdns? }` |
| `syncUpdateDuckDns({domain, token})` | `sync:update-duckdns` | `{ ok }` |
| `syncPull({serverUrl, token})` | `sync:pull` | Triggers full pull + reload |
| `onSyncProgress(cb)` / `offSyncProgress()` | `sync-progress` (event) | Pull progress phases |

## Conventions

- **Return shape:** read handlers return the requested rows; write handlers
  generally return the *whole* refreshed collection so the renderer can replace
  state. A few (snapshot save, sync) return small status objects.
- **Settings encoding:** values pass through `JSON.stringify`/`parse` in main, so
  the renderer can store/retrieve arrays and objects transparently (e.g.
  `sync_saved_connections` is an array of connection objects).
- **Events:** the three event channels (`youtube-progress`, `sync-progress`,
  and—conceptually—deck events which are renderer-internal) flow main → renderer
  via `webContents.send`. The `off*` helpers call `removeAllListeners`, so a
  component should register once (e.g. in a mount effect) and clean up on unmount.
- **No raw Node in the renderer.** If you find yourself wanting `fs`/`path`/`http`
  in a component, that's the signal to add an IPC handler instead.

---

[← Prev: Main Process](./02-main-process.md) · [Technical Index](./README.md) · [Next: Database Layer →](./04-database.md)
