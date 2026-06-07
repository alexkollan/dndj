# 13. Integrity & Reliability

[← Prev: Build & Dev](./12-build-and-dev.md) · [Technical Index](./README.md) · [Next: Import Pipeline →](./14-import.md)

---

The library stores tracks by relative path. If files (or whole category folders)
are removed or changed **outside** the app, the database drifts from disk. The
integrity system detects that drift, explains it, and repairs it. Module:
[`src/integrity.js`](../../src/integrity.js); UI:
[`IntegrityModal`](./07-components.md#integritymodaljsx).

## Module API (`src/integrity.js`)

All functions take the **live** `dbManager.db` handle (so they keep working after
the [sync hot-swap](./10-sync-system.md#the-database-hot-swap)) plus `soundsDir`.

### `checkIntegrity({ db, soundsDir })` → report
**Read-only.** Compares the DB to the filesystem and returns:

```jsonc
{
  "ok": false,
  "scannedAt": 1733600000000,
  "missingCategories": [
    { "folder": "tavern", "displayName": "Tavern", "trackCount": 3,
      "tracks": [ { "id": 12, "name": "…", "path": "tavern/…" } ] }
  ],
  "missingTracks": [
    { "id": 7, "name": "Wind", "path": "atmosphere/wind.mp3", "category": "atmosphere",
      "links": { "playlists": ["Travel"], "folders": ["Session 12"],
                 "scenes": ["The Road"], "tags": ["windy"], "cuePoints": 2 } }
  ]
}
```

Logic:
- A **category** is missing when its folder doesn't exist on disk. Categories are
  gathered from both `tracks.category` and `category_meta`. Tracks inside a missing
  category are grouped under it (not double-listed as missing tracks).
- A **track** is missing when its category folder still exists but its file does
  not.
- **Linkage** for each missing track is resolved by querying `playlist_tracks`
  (joined to `playlists` to split folders from manual playlists), `track_tags`,
  `cue_points`, and by scanning scene `snapshot_json` for the track's path
  (`buildSceneRefs`). Smart playlists are rule-based/dynamic and intentionally not
  attributed.

### `cleanupIntegrity({ db, soundsDir })` → summary
Re-runs `checkIntegrity`, then in a **single `db.transaction`**:
- For each missing category: `deleteTrackEverywhere` each of its tracks, then
  delete its `category_meta` row.
- For each missing track: `deleteTrackEverywhere`.
- `scrubSnapshots` — null out decks / sampler pads in scene snapshots that
  referenced any removed path.

Returns `{ removedTracks, removedCategories }`.

`deleteTrackEverywhere(db, id)` explicitly deletes from `playlist_tracks`,
`scene_tracks`, `track_tags`, `cue_points`, then `tracks`. The explicit deletes
make cleanup correct **regardless of whether SQLite FK enforcement is on** (the
app doesn't set `PRAGMA foreign_keys = ON`, so the `ON DELETE CASCADE` declarations
aren't guaranteed to fire).

### `renameInSnapshots(db, oldPath, newPath)`
Rewrites scene snapshots so deck/pad path references survive a
[track rename](./08-library-scanner.md#renaming-renames-the-file).

## Relinking (instead of deleting)

Cleanup is one answer to a missing item; **relinking** is the other. When a file
was merely renamed or moved on disk, the user can point the existing track at it
and keep everything. The handlers live in `main.js` (they need Electron `dialog`):

- **`integrity:relink-track`** — opens a native file picker (defaulting to the
  track's category folder). The chosen file is mapped to a path relative to
  `sounds/`; if it sits outside `sounds/`, it's copied into the track's category.
  Guards against another track already owning that path, then updates `path` +
  `category` (keeping the display name and all `track_id`-keyed references),
  `renameInSnapshots`, and queues the old path in `sync_deletions`. Returns
  `{ relinked, tracks }`.
- **`integrity:relink-category`** — opens a folder picker (must be a direct child
  of `sounds/`). For each track in the missing category it looks for a same-named
  file in the chosen folder and re-points it; migrates the `category_meta` row to
  the new folder name. Returns `{ relinked, tracks }`.

The renderer (`App` launch gate / `StudioLayout` health report) calls these, then
re-runs `integrity:check`; in the launch gate, once the report is `ok` the gate
drops automatically. UI: the **🔗 Locate** buttons in
[`IntegrityModal`](./07-components.md#integritymodaljsx).

## IPC surface

| Channel | Handler behaviour |
|---------|-------------------|
| `integrity:check` | `checkIntegrity` (read-only). Callers scan first so new files are registered. |
| `integrity:cleanup` | `cleanupIntegrity`, then returns `{ result, tracks: getAllTracks() }`. |
| `integrity:relink-track` / `integrity:relink-category` | Relink via native dialogs (above). |
| `app:quit` | `app.quit()` — used by the launch gate's **Quit** button. |

## Flows

### Launch gate (`App.jsx`)
On startup, after `scanLibrary()` + `getTags()`, `App` calls `integrityCheck()`.
If `!report.ok` it stores the report and renders
`<IntegrityModal mode="launch" …>` **instead of** `StudioLayout` — the Studio is
unreachable until the user either:
- **Clean up & continue** → `integrityCleanup()` → reload tracks/tags → clear the
  report → Studio renders, or
- **Quit app** → `quitApp()`.

> **Design note / safety:** cleanup is destructive (it deletes DB rows). The gate
> is mandatory *to keep the DB truthful*, but it always shows exactly what will be
> removed and offers **Quit** as an escape hatch — important for the
> "files temporarily unavailable" case (e.g. an unplugged drive), so a transient
> problem can't silently wipe the library.

### On-demand (`StudioLayout`)
The top-bar **🩺** button runs `runHealthCheck`: refresh the library, then
`integrityCheck()`, then show `<IntegrityModal mode="report" …>`. Its **Clean up**
calls `integrityCleanup()` and refreshes tracks, playlists, and category meta.

## Related reliability mechanisms

- **Soft "missing" flag** — the scanner's [mark-and-sweep](./08-library-scanner.md)
  hides gone files (`is_missing`) without deleting rows; the integrity system is
  what turns that soft state into a deliberate, explained cleanup.
- **Real renames** that stay consistent on disk, in scenes, and across
  [sync](./10-sync-system.md#renames).
- **Additive migrations** ([DB](./04-database.md)) so old/pulled databases load.

---

[← Prev: Build & Dev](./12-build-and-dev.md) · [Technical Index](./README.md) · [Next: Import Pipeline →](./14-import.md)
