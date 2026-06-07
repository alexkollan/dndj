# 8. Library Scanner & Portability

[← Prev: Component Reference](./07-components.md) · [Technical Index](./README.md) · [Next: YouTube Pipeline →](./09-youtube-pipeline.md)

---

`libraryScanner.js` is the bridge between the `sounds/` directory on disk and the
`tracks` table. It's a small, pure-Node module invoked by the `scan-library` IPC
handler.

## `scanLibrary(soundsDir, dbOps)`

```js
function scanLibrary(soundsDir, dbOps) {
  dbOps.markAllMissing.run();                 // 1. assume everything gone
  for (const dir of subfolders(soundsDir)) {  // 2. each subfolder = category
    for (const file of files(dir)) {
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;
      const relativePath = `${categoryName}/${file.name}`;   // forward slashes
      dbOps.upsertTrack.run(relativePath, cleanTrackName(file.name), categoryName, format);
    }
  }
}
```

Steps:

1. **Mark-and-sweep.** `markAllMissing` sets `is_missing = 1` on every track up
   front. Each file found during the walk upserts with `is_missing = 0`. Anything
   still flagged afterward is a file that disappeared from disk — it stays in the
   DB (preserving tags/playlist membership if it returns) but is filtered out of
   `getAllTracks`.
2. **One level deep.** Only immediate subfolders of `sounds/` are categories;
   files directly in `sounds/` or in nested sub-subfolders are ignored.
3. **Extension filter.** `SUPPORTED_EXTENSIONS = ['.mp3','.ogg','.wav','.webm',
   '.m4a','.aac','.flac','.opus']`.
4. **Name cleanup.** `cleanTrackName` strips the extension, converts `_`/`-` to
   spaces, and title-cases each word. This is only the *initial* name.

`dbOps` is injected (`{ upsertTrack, markAllMissing }`) rather than imported, so
the scanner has no hard dependency on the DB module.

## Upsert keeps custom names across re-scans

`upsertTrack` is:

```sql
INSERT INTO tracks (path, name, category, format, is_missing) VALUES (?, ?, ?, ?, 0)
ON CONFLICT(path) DO UPDATE SET category = excluded.category,
                               format   = excluded.format,
                               is_missing = 0;
```

**`name` is set only on first insert** — the `DO UPDATE` clause does *not* touch
`name`. So a re-scan re-confirms an existing row by `path` and updates its
category/format/missing flag, but never clobbers the display name. (The scanner's
`cleanTrackName` only seeds the name when a file is first discovered.)

## Renaming renames the file

> **Note:** earlier versions used "virtual renaming" (DB-only). That is no longer
> the case — renaming now renames the file on disk.

`rename-track` (in `main.js`):

1. Derives a filesystem-safe filename from the new display name (illegal chars
   replaced, length-capped) keeping the original extension; if that filename
   already exists it appends a `_<timestamp>` suffix to avoid clobbering.
2. `fs.renameSync`s the file within its category folder. If the file is open (e.g.
   loaded on a playing deck) this can throw `EBUSY`; the handler surfaces a clear
   error telling the user to stop it first.
3. Updates the track's `path` **and** `name` in the DB.
4. Queues the **old path** in `sync_deletions` so a pull on another device removes
   the orphaned old-named file there (the renamed file arrives via the normal
   manifest download — see [Sync System](./10-sync-system.md#renames)).
5. Calls `integrity.renameInSnapshots(db, oldPath, newPath)` to fix scene
   snapshots that referenced the old path (decks store track paths as strings).

Tags, playlist membership, and cue points are keyed by `track_id`, so they're
unaffected by a rename. Only scenes (path-keyed) need the fix-up in step 5.

Moving a track to another category also touches the filesystem:
`move-track-to-category` `fs.renameSync`s the file into the new category folder and
updates `path` + `category`.

## Portability

The DB stores **relative paths with forward slashes** (`atmosphere/wind.mp3`),
never absolute or OS-specific paths. Resolution to an absolute path happens at the
edges:

- **Playback:** the [`app://` handler](./02-main-process.md#the-app-protocol) and
  `get-audio-url` join the relative path onto the *current machine's* `SOUNDS_DIR`.
- **Sync:** the [client](./10-sync-system.md) splits on `/` and re-joins with the
  local `path.sep` when writing files.

The payoff: the entire `data/dndj.sqlite` can be copied between a Windows PC and a
Mac and every track still resolves, as long as the `sounds/` tree matches. This is
also what makes the [sync feature](./10-sync-system.md) possible — file identity is
the relative path, compared by size.

---

[← Prev: Component Reference](./07-components.md) · [Technical Index](./README.md) · [Next: YouTube Pipeline →](./09-youtube-pipeline.md)
