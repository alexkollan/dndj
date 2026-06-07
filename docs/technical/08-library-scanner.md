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

## Virtual renaming

`upsertTrack` is:

```sql
INSERT INTO tracks (path, name, category, format, is_missing) VALUES (?, ?, ?, ?, 0)
ON CONFLICT(path) DO UPDATE SET category = excluded.category,
                               format   = excluded.format,
                               is_missing = 0;
```

Crucially, **`name` is set only on first insert** — the `DO UPDATE` clause does
*not* touch `name`. So once a user renames a track (`rename-track` →
`updateTrackDisplayName`, DB-only), subsequent scans re-confirm the row by `path`
but leave the custom name intact. The file on disk is never renamed. This:

- avoids `EBUSY`/file-lock errors (especially on Windows),
- prevents OS-level filename collisions,
- and makes display names stable across re-scans.

Moving a track to another category is the one operation that *does* touch the
filesystem: `move-track-to-category` `fs.renameSync`s the file into the new
category folder and updates `path` + `category` in the DB.

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
