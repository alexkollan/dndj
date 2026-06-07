# 14. Import Pipeline

[← Prev: Integrity & Reliability](./13-integrity.md) · [Technical Index](./README.md)

---

The import feature brings external audio into the library: individual files, a
folder tree, or a `.zip`. It's a two-phase **stage → map → commit** flow.
Module: [`src/importer.js`](../../src/importer.js); dialogs + staging map live in
`main.js`; UI is [`ImportDialog`](./07-components.md#importdialogjsx).

## Phases

```
import:pick(kind)                 import:commit({stagingId, mappings, newCategories})
  ─ dialog (files|folder|zip)       ─ create new categories (folder + meta)
  ─ walkAudio() discovers files     ─ copy each mapped file → sounds/<cat>/<name>.<ext>
  ─ stash sources in staging map    ─ insert/refresh track rows + apply tags
  ─ return flat item list           ─ clean up staging (temp zip dir), return tracks
        │                                  ▲
        └──────── renderer maps groups → categories ───────┘
```

### `import:pick(kind)` (main.js)
Opens the appropriate Electron dialog:
- **files** — `openFile` + `multiSelections`, audio filter.
- **folder** — `openDirectory`, then `importer.walkAudio(root)` (recursive).
- **zip** — `openFile` (`.zip`), extracted with **adm-zip** to a temp dir under
  `os.tmpdir()`, then `walkAudio` over the extraction.

Each discovered file becomes a source `{ absPath, folder, filename }` where
`folder` is the path **relative to the import root** (`''` for top-level / loose
files). Sources are stored server-side in an in-memory `importStaging` Map keyed by
a `stagingId` (so absolute paths never round-trip through the renderer). The
renderer receives only safe `items`: `{ id, folder, filename, suggestedName, ext }`.

### `import:commit({ stagingId, mappings, newCategories })`
Looks up the staging entry and calls `importer.commitImport`. Afterwards it deletes
any temp zip dir and drops the staging entry. Returns `{ result, tracks }`.

### `import:cancel(stagingId)`
Discards a staging session and its temp extraction (called when the dialog closes
without importing).

## `importer.commitImport({ db, soundsDir, sources, mappings, newCategories })`

- **mappings**: `[{ id, category, name, tags }]` — only the items the user kept.
- **newCategories**: `[{ folder, displayName, color }]` — categories to create.

Steps:
1. For each new category: `slugCategory` the name, `mkdir` `sounds/<slug>/`, upsert
   `category_meta`.
2. For each mapping: resolve the source by `id`, `slugCategory` the target, copy
   the file to `sounds/<category>/<safeFileName(displayName, ext)>` (with a
   `_<timestamp>` suffix on collision), then **insert or refresh** the track row
   (`source='local'`, `imported_at=now`) and apply tags (`INSERT OR IGNORE`).

Returns `{ imported, skipped }`. Files are **copied**, not moved — the originals
are left untouched (and the temp zip extraction is cleaned up by the caller).

Helpers: `walkAudio`, `cleanName` (filename → title-cased display name),
`safeFileName`, `slugCategory`, and the shared `AUDIO_EXTS` list.

## Mapping model (renderer)

[`ImportDialog`](./07-components.md#importdialogjsx) groups items by their source
`folder`. Each group carries: a category choice (**existing** dropdown or **new**
name + colour), group **tags**, and an expandable per-track list (include toggle,
rename, per-track category override). On confirm it builds:
- `mappings` — one per included item, resolving category as the per-track override
  or the group's category, with the group's tags and the per-track name.
- `newCategories` — de-duplicated from the groups set to "new" that are actually
  used by an included item.

So a sound pack laid out as `pack/ambient/*`, `pack/combat/*` can be mapped to
categories in a single pass — each subfolder → a new or existing category.

## Dependencies & notes

- **adm-zip** (added for this feature) handles `.zip` extraction.
- Imports always **copy into `sounds/`** so the library stays self-contained and
  [portable](./08-library-scanner.md#portability) / syncable.
- Naming follows the same "filename mirrors display name" convention as
  [renames](./08-library-scanner.md#renaming-renames-the-file).

---

[← Prev: Integrity & Reliability](./13-integrity.md) · [Technical Index](./README.md)
