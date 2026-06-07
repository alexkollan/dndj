# 4. Database Layer (`src/db/db_manager.js`)

[← Prev: IPC & Preload](./03-ipc-and-preload.md) · [Technical Index](./README.md) · [Next: Audio Engine →](./05-audio-engine.md)

---

DNDj persists everything except audio bytes in a single SQLite file via
[better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (synchronous, fast,
prepared-statement based). `db_manager.js` creates the schema on load, runs
additive migrations, prepares every statement once, and exports them.

## Location & module shape

```js
const dbDir  = path.join(__dirname, '..', '..', 'data');   // <project>/data
const dbPath = path.join(dbDir, 'dndj.sqlite');
const db = new Database(dbPath);   // created if missing
```

The module **runs its schema/migration code at import time** and exports `db`
plus a flat set of prepared statements. It's effectively a singleton.

> **Hot-swappable singleton.** `main.js` holds it in a `let dbManager` and, after
> a [sync pull](./10-sync-system.md#the-database-hot-swap), does
> `delete require.cache[require.resolve('./src/db/db_manager')]` and re-`require`s
> it so the freshly pulled `.sqlite` file is picked up without restarting.

## Schema

```
tracks ──┬─< track_tags >── tags
         ├─< playlist_tracks >── playlists (self-referencing tree via parent_id)
         ├─< scene_tracks >── scenes        (legacy)
         └─< cue_points
scenes ──< scene_tags >── tags              (legacy)
category_meta   settings   sync_deletions
```

### `tracks`
The core table. One row per audio file.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `path` | TEXT UNIQUE | **Relative** path, forward slashes (e.g. `atmosphere/wind.mp3`) — see [portability](./08-library-scanner.md#portability) |
| `name` | TEXT | Display name (Virtual Rename target) |
| `category` | TEXT | Subfolder name |
| `format` | TEXT | Extension without dot |
| `peaks` | TEXT | Cached waveform peaks JSON (added by migration) |
| `is_missing` | INTEGER | `1` if not seen in last scan; hidden from queries |
| `source` | TEXT | `'local'` or `'youtube'` (migration) |
| `source_url` | TEXT | Original YouTube URL if imported (migration) |
| `imported_at` | DATETIME | (migration) |
| `duration` | REAL | Seconds (migration) |

`getAllTracks` returns rows where `is_missing = 0`, `LEFT JOIN`ed to tags with
`GROUP_CONCAT(tg.name) AS tags` (a comma-joined string the UI splits).

### `tags` / `track_tags`
`tags(id, name UNIQUE, color)` (color added by migration). `track_tags` is the
join with `ON DELETE CASCADE` both ways.

### `playlists`
Self-referencing tree.

| Column | Notes |
|--------|-------|
| `id` | PK |
| `name` | |
| `parent_id` | FK → `playlists(id)` `ON DELETE CASCADE`; `NULL` = root |
| `type` | `'manual'` \| `'smart'` \| `'folder'` |
| `rules_json` | Smart-playlist rules (see below); `NULL` otherwise |
| `sort_order` | Ordering among siblings |
| `created_at` | |

Smart playlist `rules_json` shape (evaluated client-side in
[`PlaylistRail.evaluateSmartPlaylist`](./07-components.md#playlistrailjsx)):
```jsonc
{
  "combinator": "AND" | "OR",
  "rules": [
    { "field": "name"|"category"|"tags", "op": "contains"|"not_contains"|"equals"|"not_equals", "value": "…" },
    { "field": "id", "op": "not_eq", "value": "42", "trackName": "…" }   // exclusion rule
  ]
}
```

### `playlist_tracks`
`(playlist_id, track_id, sort_order)` with composite PK and cascading FKs.
`getPlaylistTracks` orders by `sort_order` and filters out missing tracks.

### `cue_points`
`(id, track_id FK CASCADE, position REAL, label, color)`. Per-track bookmarks
shown on the deck waveform.

### `category_meta`
`(folder_name PK, display_name, color)`. Decorates raw folder names with a
friendly label and colour. Upserted via
`ON CONFLICT(folder_name) DO UPDATE`.

### `settings`
`(key PK, value)`. Values are **JSON strings**. Holds machine-local config
(master volume, sampler pads, all `sync_*` keys). The set of keys that must
survive a pull is `LOCAL_SETTING_KEYS` in `main.js` — see
[Sync System](./10-sync-system.md#local-settings-preservation).

### `sync_deletions`
`(id, file_path, deleted_at)`. A queue of relative paths to delete on the *other*
machine. Populated by `delete-track` when `globalDelete` is true; drained during a
pull. See [Sync System](./10-sync-system.md#cross-machine-deletions).

### `scenes` / `scene_tracks` / `scene_tags`
`scenes(id, name, description, created_at, snapshot_json)`. The **Studio uses only
`snapshot_json`** (a JSON blob of the whole board — see
[Component Reference → ScenePanel](./07-components.md#scenepaneljsx) and
[Renderer & State](./06-renderer-and-state.md#scene-snapshots)). The
`scene_tracks`/`scene_tags` tables and their statements are **legacy** from the
classic UI and aren't part of the snapshot flow.

## Migration strategy

Migrations are **additive and idempotent** — never destructive. The pattern:

```js
const cols = db.prepare("PRAGMA table_info(tracks)").all();
if (!cols.some(c => c.name === 'duration')) {
  db.exec("ALTER TABLE tracks ADD COLUMN duration REAL");
}
```

New tables use `CREATE TABLE IF NOT EXISTS`. This means an old `dndj.sqlite` from
a previous version upgrades cleanly on next launch, and a pulled database from a
machine on a different version is tolerated.

## Prepared statements

Every query is prepared once at module load and exported by name (e.g.
`upsertTrack`, `getAllTracks`, `insertPlaylistTrack`, `getCuePoints`,
`insertSyncDeletion`). Handlers in `main.js` call `.run()` / `.get()` / `.all()`
on them. A couple of one-off queries are built inline with `db.prepare(...)` where
a dedicated export wasn't warranted (e.g. fetching a cue's `track_id`).

Notable upserts:
- `upsertTrack` — `INSERT … ON CONFLICT(path) DO UPDATE` updating category/format
  and clearing `is_missing`. Crucially it **does not overwrite `name`**, which is
  what preserves Virtual Renames across re-scans.
- `setSetting` — `INSERT … ON CONFLICT(key) DO UPDATE`.
- `upsertCategoryMeta` — `INSERT … ON CONFLICT(folder_name) DO UPDATE`.

---

[← Prev: IPC & Preload](./03-ipc-and-preload.md) · [Technical Index](./README.md) · [Next: Audio Engine →](./05-audio-engine.md)
