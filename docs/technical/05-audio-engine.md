# 5. Audio Engine (`src/audioEngine.js`)

[← Prev: Database Layer](./04-database.md) · [Technical Index](./README.md) · [Next: Renderer & State →](./06-renderer-and-state.md)

---

`audioEngine.js` is a framework-agnostic module (no React) that owns all audio
*playback*. Components import its functions and subscribe to its events; they
never touch the Web Audio API or `Tone` directly.

> **Design rule:** only the engine imports `tone`. Everywhere else uses the
> engine's public API. `Tone` is used solely to obtain a single shared,
> browser-blessed `AudioContext` (`getContext().rawContext`) and to resume it on
> first user gesture (`toneStart()`).

## Why `HTMLAudioElement` instead of buffer playback

Every voice is an `HTMLAudioElement` (`new Audio()`) routed into Web Audio via
`createMediaElementSource`. This streams the file (small memory footprint, works
for long ambience tracks) while still allowing gain/filter processing and—via the
[`app://` range support](./02-main-process.md#the-app-protocol)—seeking.

## Three independent playback layers

The engine keeps three separate voice systems so they can't interfere:

| Layer | Keyed by | Purpose | Used by |
|-------|----------|---------|---------|
| **URL players** | audio URL | Library row preview & legacy scene transitions | track-row ▶ buttons |
| **Sampler voices** | ephemeral (Set) | Overlapping one-shots, auto-dispose on end | [SamplerStrip](./07-components.md#samplerstripjsx) |
| **Deck voices** | deck id `'A'`/`'B'`/`'C'` | Full DJ deck: volume, filter, loop, crossfade | [DeckPanel](./07-components.md#deckpaneljsx)/[MiniDeck](./07-components.md#minideckjsx) |

### Shared master
A single lazily-created master `GainNode` (`getMasterGain()`) sits in front of
`destination`. `setMasterVolume()` and the top-bar slider drive it; every voice
ultimately connects through it.

## Layer 1 — URL players

`players[url] = { audio, sourceNode, gainNode, isLoop, loopStart, loopEnd, onEnd, … }`

Graph: `audio → sourceNode → gainNode → master`.

Key functions: `playTrack(url, loop, volume, format, onEnd, startTime, endTime)`,
`stopTrack`, `pauseTrack`, `resumeTrack`, `seekTrack`, `setTrackVolume`,
`getPlaybackPosition`, `getDuration`, `unloadTrack`, and the scene helpers
`transitionToScene` / `crossfade`.

Notes:
- **Custom loop points** are implemented with a `timeupdate` listener that resets
  `currentTime` to `loopStart` near `loopEnd`; full-track loops use the native
  `audio.loop`. `setupHandlers`/`clearHandlers` manage these listeners.
- A **150 ms debounce** (`lastPlayCallTimes`) guards against double-trigger.
- `unloadTrack` fully disconnects nodes and clears `audio.src` — important on
  Windows to release file handles.

## Layer 2 — Sampler voices

`triggerSample(url, volume)` builds a throwaway graph
(`audio → source → gain → master`), plays it, and on the `ended` event disposes
itself (`cleanup` disconnects nodes and removes the voice from `samplerVoices`).
Because each call makes a new voice, **rapid triggers overlap** naturally.

`stopAllSamples()` (also called by `stopAll()`), `stopSampleByUrl(url)`, and
`isSampleUrlPlaying(url)` round it out.

## Layer 3 — Deck voices (the DJ core)

`deckVoices['A'|'B'|'C']`. Each voice has a richer graph:

```
audio → sourceNode → deckGainNode → filterNode(lowpass) → xfadeGainNode → master
```

| Node | Controlled by |
|------|---------------|
| `deckGainNode` | per-deck volume (`setDeckVolume`, `fadeDeckVolume`) |
| `filterNode` | low-pass cutoff 80–20000 Hz (`setDeckFilter`) |
| `xfadeGainNode` | the **crossfader** (decks A & B only) |

### Crossfader
Module state `_crossfadePos` (0–1) and `_crossfadeCurve`. `setCrossfade(pos)` and
`setCrossfadeCurve(curve)` call `applyDeckCrossfade()`, which computes per-side
gains from the curve and writes them to A's and B's `xfadeGainNode`
(`setTargetAtTime` for a smooth ramp). **Deck C has no xfade involvement.** Curve
math (`equal_power`, `slow`, `linear`, `cut`) is mirrored in the
[Crossfader component](./07-components.md#crossfaderjsx) for its preview canvas.

### Loading & transport
- `loadDeck(deckId, url)` destroys any existing voice, builds a new one, applies
  the current crossfade, `audio.load()`s, and emits `deckLoaded` then
  `deckMetadata` (with duration) on `loadedmetadata`.
- `playDeck` / `pauseDeck` / `stopDeck` / `seekDeck` — transport (also
  150 ms-debounced on play).
- Loops mirror the URL-player approach via `setupDeckVoiceHandlers`
  (`setDeckLoop`, `setDeckLoopEnabled`).

### Snapshot support
For [Scenes](./06-renderer-and-state.md#scene-snapshots), the engine exposes
`getDeckMixerState(deckId)` → `{ volume, filterFreq, loopEnabled, loopStart,
loopEnd }`, `setDeckMixerState(deckId, state)` (emits `deckMixerReset` so the
DeckPanel UI re-syncs its sliders), and `getCrossfadeState()`. Each deck voice
*tracks* `volume`/`filterFreq` on itself precisely so snapshots can read them back.

### Position polling
`getDeckPosition(deckId)` → `{ currentTime, duration }` is polled via
`requestAnimationFrame` by the deck UIs and waveform for the playhead.

## Event system

A tiny pub/sub:

```js
const unsubscribe = subscribe((event, data) => { … });
```

Components subscribe in effects and clean up on unmount. Events emitted:

| Event | `data` | Emitted by |
|-------|--------|-----------|
| `trackStarted` / `trackResumed` / `trackStopped` / `trackEnded` / `trackPaused` / `trackSeeked` | `{ audioUrl }` | URL players |
| `sampleTriggered` | `{ url }` | sampler |
| `deckLoaded` / `deckMetadata` | `{ deckId, url, duration? }` | decks |
| `deckStarted` / `deckPaused` / `deckStopped` / `deckEnded` | `{ deckId, url }` | decks |
| `deckMixerReset` / `deckLoopChanged` | `{ deckId, … }` | decks |
| `crossfadeChanged` | `{ pos }` | crossfader |

Two consumers matter most:
- [`App.jsx`](./06-renderer-and-state.md) maps `track*` events into the
  `useAudioStore` playing/paused sets (so library rows reflect playback).
- [`StudioLayout`/`DeckPanel`](./07-components.md) map `deck*` events into React
  transport state and slider positions.

## Public API summary

Playback: `playTrack, stopTrack, pauseTrack, resumeTrack, isPlaying, isPaused,
seekTrack, getPlaybackPosition, getDuration, setTrackVolume, unloadTrack,
transitionToScene, crossfade`.
Master/global: `setMasterVolume, stopAll, subscribe`.
Sampler: `triggerSample, stopSampleByUrl, isSampleUrlPlaying, stopAllSamples`.
Decks: `loadDeck, playDeck, pauseDeck, stopDeck, seekDeck, setDeckVolume,
setDeckFilter, setDeckLoop, setDeckLoopEnabled, setDeckMixerState, fadeDeckVolume,
getDeckMixerState, getDeckPosition, getDeckIsPlaying, getDeckLoopState`.
Crossfade: `setCrossfade, setCrossfadeCurve, getCrossfadeState`.

---

[← Prev: Database Layer](./04-database.md) · [Technical Index](./README.md) · [Next: Renderer & State →](./06-renderer-and-state.md)
