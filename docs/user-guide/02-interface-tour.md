# 2. Interface Tour

[← Prev: Getting Started](./01-getting-started.md) · [Back to User Guide](./README.md) · [Next: Library & Tracks →](./03-library-and-tracks.md)

---

DNDj has one screen — the **Studio**. This chapter labels every region so the
rest of the guide can refer to them by name.

```
┌─────────────────────────────────────────────────────────────────────┐
│  DNDj STUDIO                          MASTER [====o----] 80%  ■ STOP ⚙ │  ← Top bar
├──────────────┬──────────────────────────────────────────────────────┤
│              │   ┌────────────┐  ┌────────┐  ┌────────────┐          │
│  PLAYLISTS   │   │  DECK A    │  │ xfader │  │  DECK B    │          │  ← Deck zone
│  ♫ My Library│   │  waveform  │  │  + C   │  │  waveform  │          │
│  ▸ 📁 Folder │   │  controls  │  │ (mini) │  │  controls  │          │
│  ♪ Playlist  │   └────────────┘  └────────┘  └────────────┘          │
│  ✦ Smart     │  ──────────────── (drag to resize height) ───────────│
│              │   🔍 Search   [Category ▾]  [tag chips]   ↻  ⬇YouTube  │  ← Tracklist toolbar
│  ───────────  │   Name            Category   Tags    Duration   ⋮     │
│  SCENES      │   ▶ Wind Howl      ATMOS      windy   2:34      A B ⋮  │  ← Track rows
│  ✦ Snapshot  │   ▶ Tavern Brawl   COMBAT     ...     3:01      A B ⋮  │
│  + Save      │   ...                                                  │
│              │  ───────────────────────────────────────────────────  │
│              │   SFX PADS  [1][2][3][4][5][6][7][8]                   │  ← Sampler strip
└──────────────┴──────────────────────────────────────────────────────┘
       ↑ Left rail
```

## Top bar

Across the very top:

- **DNDj STUDIO** — the app brand (left).
- **MASTER** slider — the overall output volume for *everything*. The percentage
  is shown beside it.
- **■ STOP** — panic button. Immediately stops every sound: both decks, the third
  deck, and all sampler voices.
- **⚙ (gear)** — opens the **Library Settings** dialog (categories, tags,
  keyboard shortcuts, and sync). See [Settings](./12-settings.md).

## Left rail

A vertical strip on the left, split into two halves. You can drag its right edge
to make it wider or narrower.

- **Top half — PLAYLISTS.** Starts with **♫ My Library** (every track you own),
  followed by any playlists and folders you create. See [Playlists](./06-playlists.md).
- **Bottom half — SCENES.** Saved snapshots of your whole board. See [Scenes](./08-scenes.md).

## Deck zone

The heart of the app — two large **decks** side by side with the **crossfader**
between them. You can:

- Drag the **handle between the decks** left/right to change how much width each
  deck gets.
- Drag the **horizontal divider below the decks** up/down to change the deck
  height.

Each deck has a waveform, transport buttons (play/pause/stop/cue), loop controls,
cue markers, a volume slider, and a filter slider. Full details in
[Decks & Playback](./04-decks-and-playback.md).

Tucked into the crossfader column is a small **Deck C** (the "mini deck") — a
third, quieter deck for an extra ambient layer. Click it to open it full-size.
See [Deck C](./04-decks-and-playback.md#deck-c-the-third-deck).

## Tracklist (centre)

Below the decks is the **track list** — the contents of whatever is selected in
the left rail (by default, *My Library*).

- A **toolbar** on top: a search box, a category filter, clickable tag chips, a
  **↻ Refresh** button (re-scan the sounds folder), and a **⬇ YouTube** button
  (import from a link).
- **Column headers** — click *Name*, *Category*, or *Duration* to sort.
- **Track rows** — each row has a play button, the name, a coloured category
  badge, tag chips, the duration, **A / B** quick-load buttons, and a **⋮** menu
  for more actions.

Full details in [Library & Tracks](./03-library-and-tracks.md).

## Sampler strip (bottom)

Eight **SFX pads** for instant one-shot sounds — drop a track on a pad, then
click it or press its number key (1–8) to fire it. Multiple pads can play at
once and overlap. See [Sampler Pads](./07-sampler-pads.md).

---

## Things you can drag

DNDj is heavily drag-and-drop. Here's what can go where:

| Drag this… | …onto this | Result |
|------------|-----------|--------|
| A track (from the list) | Deck A or B | Loads it onto that deck |
| A track | The mini Deck C | Loads it onto Deck C |
| A track | An SFX pad | Assigns it to that pad |
| A track | A playlist or folder in the left rail | Adds it to that playlist |
| A playlist/folder | Another folder | Nests it inside |
| A track row | Another row (in a Manual playlist) | Reorders the playlist |

---

[← Prev: Getting Started](./01-getting-started.md) · [Back to User Guide](./README.md) · [Next: Library & Tracks →](./03-library-and-tracks.md)
