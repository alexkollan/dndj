# 7. Component Reference

[← Prev: Renderer & State](./06-renderer-and-state.md) · [Technical Index](./README.md) · [Next: Library Scanner →](./08-library-scanner.md)

---

Every component in the live UI lives in `src/components/studio/`. Each has a
matching stylesheet in `src/styles/studio/`. This chapter documents their roles,
key props, and how they interact with the [engine](./05-audio-engine.md) and
[IPC](./03-ipc-and-preload.md).

> Legacy components in `src/components/*.jsx` are **not** part of the tree — see
> the [note in the index](./README.md).

## Tree

```
App.jsx
└── StudioLayout
    ├── PlaylistRail            (left rail, top)
    │   └── SmartEditor, PlaylistItem, TrackTreeItem
    ├── ScenePanel              (left rail, bottom)
    │   └── SceneRow
    ├── DeckPanel  ×2 (A, B)    (deck zone)
    │   └── DeckWaveform
    ├── Crossfader              (between decks)
    ├── MiniDeck  (Deck C)      (crossfader column)
    │   └── DeckPanel (in modal, deckId="C")
    ├── TracklistPanel          (centre)
    │   └── DraggableRow / SortableRow → RowInner
    ├── SamplerStrip            (bottom)
    │   └── SamplerPad ×8
    ├── LibrarySettingsModal    (on demand)
    │   └── CategoriesTab, TagsTab, ShortcutsTab, SyncTab
    ├── DocsModal               (on demand — top-bar ?)
    ├── IntegrityModal          (on demand — top-bar 🩺; also launch gate in App.jsx)
    └── (TracklistPanel) ImportDialog   (on demand — tracklist ⬇ Import)
```

---

## `StudioLayout.jsx`
The orchestrator. Owns playlists, the selected playlist, deck state, category
meta, drag state, and all the layout resizers. Hosts the global keyboard-shortcut
effect, the `DndContext`, and the scene save/recall logic
([snapshots](./06-renderer-and-state.md#scene-snapshots)).

Key responsibilities:
- **Decks:** `deckTracks{A,B,C}` + `deckState{A,B,C}`; `handleLoadToDeck` resolves
  a URL and calls `loadDeck`. Subscribes to `deck*` engine events to update
  transport state and `activeDeckRef` (for shortcuts).
- **Drag & drop:** one `DndContext` with a pointer-then-rect collision strategy.
  `handleDragEnd` routes a drop to: a deck (`deck-A/B/C`, `deck-C-full`), a sampler
  pad (`pad-N`), a playlist (`playlist-N`), or a reorder within a Manual playlist.
  Playlist-on-playlist drops reparent/reorder with circular-nesting guards
  (`isAncestorOrSelf`) and a before/into/after drop indicator (`computeDropPosition`).
- **Smart remove:** `handleRemoveFromPlaylist` — for Smart playlists it appends an
  `{field:'id', op:'not_eq'}` exclusion rule instead of deleting a row; otherwise
  it removes the `playlist_tracks` entry.
- **Resizers:** rail width (→ `useUIStore`), deck A/B split (→ `useUIStore`), deck
  height (local state). The deck grid is `${deckASplit}fr 160px ${1-deckASplit}fr`
  — the centre `160px` is the fixed-width crossfader/Deck-C column.
- **External drag-and-drop:** window-level file-drop listeners stage dropped
  audio/folders/zips and open an `ImportDialog`; also hosts the 🩺 health report
  and the drop overlay. See [Import → Drag-and-drop](./14-import.md#drag-and-drop-renderer).

## `PlaylistRail.jsx`
The playlist tree plus the Smart-playlist editor. Exports
**`evaluateSmartPlaylist(tracks, rulesJson)`** (used here and by `StudioLayout`).

- **`evaluateSmartPlaylist`** filters tracks against the rules object, supporting
  fields `name`/`category`/`tags` (ops contains/not_contains/equals/not_equals)
  and the special `id` field (`not_eq`/eq) used for exclusions.
- **`renderTree(pl, depth)`** recursively renders `PlaylistItem`s. **Only folders**
  (`type === 'folder'`) show their child *tracks* in the rail; manual/smart
  playlists show their contents only in the centre panel. Folder track rows
  (`TrackTreeItem`) have a hover **×** that removes the track from the folder.
- **`SmartEditor`** — modal for combinator + rules. Exclusion rules render as a
  distinct read-only "Exclude: <name>" row with a remove button.
- **`PlaylistItem`** — droppable (accepts tracks/playlists) and draggable
  (reparent/reorder); double-click to rename; folders get a collapse caret.

Loads per-folder track caches via `getPlaylistTracks` for folders only.

## `ScenePanel.jsx`
The Scenes UI (left rail, bottom). Props: `onGetSnapshot`, `onRecall` (both from
`StudioLayout`). Lists scenes split into **snapshots** (have `snapshot_json`, ✦)
and legacy **classics** (♪). Save flow: name → `onGetSnapshot()` →
`saveSceneSnapshot`. `SceneRow` offers instant recall (▶), fade recall (⟶), and
delete (×). See [snapshot shape](./06-renderer-and-state.md#scene-snapshots).

## `DeckPanel.jsx`
A full deck (used for A, B, and—inside the MiniDeck modal—C). Props:
`deckId, track, url, isPlaying, isPaused, droppableId?`.

- Local state for volume, filter, loop (enabled/start/end), duration, currentTime,
  cue points, load flash.
- Subscribes to engine events for its `deckId` (`deckMetadata`, `deckLoaded`,
  `deckStopped`, `deckMixerReset`, `deckLoopChanged`) and polls `getDeckPosition`
  via rAF for the time display.
- Transport (cue/play/stop), loop controls (LP/IN/OUT/CLR), `+ CUE`, cue chip
  strip (click to seek, × to delete — via `add/deleteCuePoint` IPC), and the
  VOL/FILTER sliders (→ `setDeckVolume`/`setDeckFilter`).
- Renders `DeckWaveform`; when peaks are generated it persists them via
  `updateTrackPeaks`.
- Is a dnd-kit droppable (`deck-${deckId}` or the passed `droppableId`).

## `DeckWaveform.jsx`
Two stacked canvases: a **static** multi-band waveform and an **animated overlay**
(playhead, scanned region, loop region, cue flags, hover cursor) redrawn each rAF.

- Peaks come from the DB (`peaks` prop) or are generated on demand:
  `generatePeaksFromUrl` fetches the file, `decodeAudioData`s it, downsamples to
  `PEAKS_N = 1200` min/max pairs, then calls `onPeaksReady` so DeckPanel can cache
  them. (Generate-once, then read from DB forever — the memory-safe waveform
  scheme.)
- Interaction: click-to-seek (maps canvas x → global time accounting for zoom/pan),
  wheel/pinch zoom (`ZOOM_LEVELS [1,2,4,8]`), two-finger and drag panning, ± zoom
  buttons. `dpr`-aware rendering capped at 2× for performance.

## `Crossfader.jsx`
Props: `initialPos`, `initialCurve`. The A↔B balance slider plus four curve
buttons with hover **preview canvases** (`CurveCanvas` draws each curve's A/B gain
shape). Drives `setCrossfade`/`setCrossfadeCurve`; listens for `crossfadeChanged`
to stay in sync with keyboard nudges. `computeGains(pos, curve)` mirrors the
engine's curve math. Remounted (via key) on scene recall to re-seed position.

## `MiniDeck.jsx`
Deck C's compact bar plus an expand-to-modal. Props:
`track, url, isPlaying, isPaused`. The collapsed bar shows badge, name (ellipsised
— the column is fixed-width), progress, and inline play/pause/stop. Clicking
(or ⤢) opens a `createPortal` modal hosting a full `DeckPanel` with `deckId="C"`
and `droppableId="deck-C-full"`. Droppable as `deck-C`. Polls `getDeckPosition('C')`
for its mini progress bar.

## `TracklistPanel.jsx`
The centre track list for the current view (library or a playlist). Props include
`tracks, allTracks, tags, categoryMeta, urlCache, resolveUrl, selectedPlaylistId,
selectedPlaylistType, isReorderable, onLoadToDeck, onRename, onAddTag,
onRemoveFromPlaylist, onLibraryRefresh, onTracksChange`.

- Toolbar: search, category filter, tag-chip filter, Refresh, YouTube button
  (opens `YoutubeImportDialog`).
- Sorting by name/category/duration (disabled when `isReorderable`, i.e. a Manual
  playlist, to preserve `sort_order`).
- Rows: `DraggableRow` (library/non-reorderable) or `SortableRow` (manual playlist,
  dnd-kit sortable); both render shared `RowInner`. Row menu actions: rename, add
  tag, move-to-category, remove-from-playlist/folder/exclude (label depends on
  `selectedPlaylistType`), delete (with the machine-only / everywhere choice).
- Reflects playback by reading `useAudioStore.playingUrls` keyed on the resolved
  URL.

## `SamplerStrip.jsx`
Eight pads. Loads/saves assignments to the `sampler_pads` setting (storing
trackId/name/path/volume, re-resolving URLs on load). Exposes
`SamplerStrip._assignPad` so `StudioLayout`'s drag handler can assign on drop.
`SamplerPad` fires on click (or key 1–8 via a strip-level effect →
`triggerSample`), shows a hover volume slider, ■ stop (`stopSampleByUrl`), and
right-click clear.

## `YoutubeImportDialog.jsx`
Self-contained state machine (`IDLE → CHECKING/SETUP → INFO → IMPORTING →
DONE/ERROR`). Drives `youtubeCheck/Setup/GetInfo/Import` and listens to
`youtube-progress`. Lets the user set track name, category (with inline new-category
creation), tags, and target format (mp3/ogg/original). See
[YouTube Pipeline](./09-youtube-pipeline.md).

## `LibrarySettingsModal.jsx`
Tabbed dialog: **CategoriesTab** (CRUD category meta + create folder),
**TagsTab** (CRUD tags), **ShortcutsTab** (static reference), **SyncTab** (server
toggle, DuckDNS, saved connection chips, pull with progress — see
[Sync System](./10-sync-system.md)). Shares a `ColorPicker` swatch grid.

## `DocsModal.jsx`
The in-app documentation viewer (top-bar **?** button). Two tabs (User Guide /
Technical), each starting at its `README.md`. Renders markdown via `react-markdown`
+ `remark-gfm` + `rehype-slug`. A custom link renderer routes `.md`/anchor links to
in-app navigation (resolving relative paths against the current doc, auto-switching
tab across sections) and external links to `openExternal`. Includes per-section
full-text search (`docsSearch`) with a results panel and in-document match
highlighting via a small rehype plugin. Reads files through
`docsRead`/`docsList`/`docsSearch`.

## `IntegrityModal.jsx`
The DB↔filesystem health dialog. Two modes via the `mode` prop:
- **`launch`** — blocking gate rendered by `App.jsx` when the startup
  [integrity check](./13-integrity.md) finds missing files/categories. Lists
  missing categories and missing tracks (with per-track linkage: playlists,
  folders, scenes, tags, cue points) and forces **Clean up & continue** or
  **Quit** (`quitApp`).
- **`report`** — on-demand, opened by the top-bar **🩺** button in `StudioLayout`;
  shows "all good" or the same issue list with an optional **Clean up**.

Both call `integrityCheck` / `integrityCleanup`. Each missing item also offers a
**🔗 Locate** button (`onRelinkTrack` / `onRelinkCategory`) to re-point it instead
of deleting. See [Integrity & Reliability](./13-integrity.md).

## `ImportDialog.jsx`
Rendered by [`TracklistPanel`](#tracklistpaneljsx) (the **⬇ Import** button).
Stage machine `pick → map → importing → done`. **pick** calls `importPick(files|
folder|zip)`; **map** groups the returned items by source folder and lets the user
assign each group to an existing/new category (+ colour), add group tags, and
expand to rename/skip/override individual tracks; **commit** builds `mappings` +
`newCategories` and calls `importCommit`, then refreshes the library via
`onImported`. Closing before commit calls `importCancel` to clean up. An optional
`initialStaging` prop opens it straight on the mapping step — used by the
drag-and-drop flow (see [StudioLayout](#studiolayoutjsx) and
[Import Pipeline](./14-import.md#drag-and-drop-renderer)).

---

[← Prev: Renderer & State](./06-renderer-and-state.md) · [Technical Index](./README.md) · [Next: Library Scanner →](./08-library-scanner.md)
