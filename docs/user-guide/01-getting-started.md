# 1. Getting Started

[← Back to User Guide](./README.md) · [Next: Interface Tour →](./02-interface-tour.md)

---

This chapter gets DNDj running on your computer and gets your first sounds into
the library.

## What you need

- A Windows or macOS computer.
- [Node.js](https://nodejs.org/) (the latest LTS version is fine).
- Some audio files (MP3, OGG, WAV, FLAC, M4A, AAC, WebM, or Opus).

DNDj is run from source — there is no installer. This is intentional: it lets the
app run the same way on every machine without code-signing or app-store licences.

## Installing

Open a terminal in the project folder and run:

```bash
npm install
```

This downloads everything the app needs (it may take a minute the first time).

## Running the app

You have two ways to start DNDj:

| Command | When to use it |
|---------|----------------|
| `npm start` | Normal use — just launch and play. |
| `npm run dev` | Development mode — auto-reloads when files change. This is the mode the app is normally used in day-to-day. |

A window titled **DNDj — STUDIO** opens. The first time it launches it will say
*"Scanning library…"* while it reads your sounds folder.

## Adding your sounds

DNDj plays audio files from a folder called `sounds/` inside the project. **Each
subfolder is a category.** For example:

```
sounds/
├── atmosphere/      ← looping background moods
├── combat/          ← battle music
├── exploration/     ← travel & dungeon ambience
├── tavern/          ← social / town music
└── sfx/             ← one-shot sound effects
```

To add audio:

1. Create a subfolder inside `sounds/` (the folder name becomes the category
   name) — or use one that already exists.
2. Drop your audio files into it.
3. In DNDj, click the **↻ Refresh** button above the track list (or restart the
   app). The new tracks appear in *My Library*.

> **You don't have to organise perfectly up front.** You can rename tracks, give
> them friendly category names and colours, move them between categories, and tag
> them — all from inside the app. See [Library & Tracks](./03-library-and-tracks.md).

### Supported formats

MP3 · OGG · WAV · WebM · M4A · AAC · FLAC · Opus

## Your first 2 minutes

1. **Find a track** in *My Library* (the main list in the centre).
2. **Drag it onto Deck A** (the left-hand deck near the top). It loads and shows
   a waveform.
3. Press the **▶ play** button on the deck, or just press the **`A`** key.
4. Drag a second, different track **onto Deck B** and play it.
5. **Drag the crossfader** (the slider between the two decks) left and right to
   blend between them.
6. Drag a short sound effect onto one of the **SFX pads** at the bottom, then
   click it (or press its number key) to fire it.

That's the whole core loop. Everything else in this guide builds on it.

---

## Where your data is stored

- **Your audio files:** stay exactly where you put them, in `sounds/`. DNDj never
  moves or renames the actual files unless you explicitly move a track to a
  different category. (See [Virtual Renaming](./03-library-and-tracks.md#renaming-a-track).)
- **Everything else** (track names, tags, playlists, cue points, scenes,
  settings): a single database file at `data/dndj.sqlite`. Back this file up to
  back up your whole setup.

---

[← Back to User Guide](./README.md) · [Next: Interface Tour →](./02-interface-tour.md)
