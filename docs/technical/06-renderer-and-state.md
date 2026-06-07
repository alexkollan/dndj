# 6. Renderer & State

[← Prev: Audio Engine](./05-audio-engine.md) · [Technical Index](./README.md) · [Next: Component Reference →](./07-components.md)

---

This chapter covers the renderer's bootstrapping, its two state stores, and how
`App.jsx` glues the [audio engine](./05-audio-engine.md), the
[IPC bridge](./03-ipc-and-preload.md), and the component tree together.

## Entry point

`index.html` → `src/main.jsx`:

```jsx
ReactDOM.createRoot(document.getElementById('root'))
  .render(<React.StrictMode><App /></React.StrictMode>);
```

`StrictMode` is on, so effects run twice in dev — engine subscriptions and IPC
listeners are written to be idempotent / properly cleaned up because of this.

## `App.jsx` — the root

`App` holds the top-level, library-wide state and renders **only**
[`StudioLayout`](./07-components.md#studiolayoutjsx). Its responsibilities:

### State it owns
- `allTracks`, `tags` — the library, loaded via IPC.
- `masterVolume` — mirrored to the engine and the `settings` table.
- `urlCache` — `{ [relativePath]: "app://audio/…" }` memo of resolved URLs.
- `loading` / `error` — startup gating.

### Engine → store wiring
A mount effect subscribes to the engine and translates `track*` events into the
`useAudioStore` sets:

```js
subscribe((event, data) => {
  if (event === 'trackStarted' || 'trackResumed') addPlaying(data.audioUrl);
  else if (event === 'trackEnded' || 'trackStopped') removePlaying(data.audioUrl);
  else if (event === 'trackPaused') addPaused(data.audioUrl);
});
```
This is what makes library-row play indicators reflect actual playback.

### `resolveUrl`
```js
const resolveUrl = async (filePath) => {
  if (urlCache[filePath]) return urlCache[filePath];
  const resolved = await window.dndj.getAudioUrl(filePath);  // → app://…
  setUrlCache(prev => ({ ...prev, [filePath]: resolved }));
  return resolved;
};
```
Every consumer (decks, sampler, previews) goes through this so each path is
resolved once.

### Startup sequence
On mount: read `master_volume` setting → apply to engine; then
`Promise.all([scanLibrary(), getTags()])` → set state → render. Errors surface as
a full-screen message.

### Handlers passed down
`handleMasterVolume`, `handleStopAll` (calls engine `stopAll()` + store
`clearAll()`), `handleRenameTrack`, `handleAddTag`, `handleLibraryRefresh`, plus
the raw setters `onTagsChange`/`onTracksChange`. These flow into `StudioLayout`
and onward.

## Zustand stores (`src/store.js`)

### `useUIStore` — persisted layout
```js
persist((set) => ({
  studioRailWidth: 220, setStudioRailWidth,
  deckASplit: 0.5,      setDeckASplit,
}), { name: 'dndj-ui' })
```
Saved to `localStorage` under `dndj-ui`. Holds only layout geometry. (Deck
*height* is local component state in `StudioLayout`, not persisted here.)

### `useAudioStore` — runtime audio reflection
Two `Set`s, `playingUrls` and `pausedUrls`, with `addPlaying`/`removePlaying`/
`addPaused`/`clearAll`. **Not persisted** — the engine is the source of truth;
this store only exists so React can render "is this playing?" cheaply. Populated by
the App-level engine subscription above and read by
[`TracklistPanel`](./07-components.md#tracklistpaneljsx).

## State distribution summary

```
App.jsx
 ├─ allTracks, tags, masterVolume, urlCache          (useState)
 ├─ useAudioStore  ← engine events                   (runtime)
 └─ StudioLayout
     ├─ playlists, selectedPlaylistId, playlistTracks (useState)
     ├─ deckTracks{A,B,C}, deckState{A,B,C}           ← deck events
     ├─ categoryMeta, crossfader init, drag state
     ├─ useUIStore (rail width, deck split)           (persisted)
     └─ children (DeckPanel, PlaylistRail, …) hold their own view state
```

## Scene snapshots

Scenes are assembled in `StudioLayout`, not the engine:

- **Save** — `handleGetSnapshot()` reads each deck's mixer state
  (`getDeckMixerState('A'|'B'|'C')`), `getCrossfadeState()`, and the persisted
  `sampler_pads` setting, producing:
  ```jsonc
  { "version": 1,
    "deckA": { "path": "...", "volume": 0.8, "filterFreq": 20000, "loopEnabled": true, "loopStart": 0, "loopEnd": null },
    "deckB": { ... }, "deckC": { ... },
    "crossfade": { "pos": 0.5, "curve": "equal_power" },
    "samplerPads": [ { "trackId":1, "name":"…", "path":"…", "volume":0.8 } | null, … ] }
  ```
  This JSON is stored via `saveSceneSnapshot` in `scenes.snapshot_json`.
- **Recall** — `handleRecall(snapshot, withFade)` stops decks A/B/C, then for each
  of `['A','B','C']` resolves the track by `path`, `loadDeck`s it, applies
  `setDeckMixerState`, and (if fading) ramps volume up over ~1.8 s. It restores the
  crossfader (remounting the Crossfader via a key bump) and rewrites the
  `sampler_pads` setting (bumping `samplerKey` to remount the strip).

> Deck C is fully included in both save and recall. The recall loop and the
> snapshot object both enumerate all three decks.

## Keyboard shortcuts

Global shortcuts are a single `keydown` effect in `StudioLayout` (ignored while a
text field is focused). Sampler pad keys `1`–`8` are a separate effect in
[`SamplerStrip`](./07-components.md#samplerstripjsx). The canonical list is in the
[user-facing reference](../user-guide/11-keyboard-shortcuts.md).

---

[← Prev: Audio Engine](./05-audio-engine.md) · [Technical Index](./README.md) · [Next: Component Reference →](./07-components.md)
