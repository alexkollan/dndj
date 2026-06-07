# 12. Settings

[← Prev: Keyboard Shortcuts](./11-keyboard-shortcuts.md) · [Back to User Guide](./README.md)

---

The **⚙ gear** in the top bar opens **Library Settings** — a dialog with four
tabs. This chapter covers Categories, Tags, and Shortcuts. The Sync tab has its
own full chapter: [Syncing Two Machines](./10-sync.md).

## Categories tab

Manage your categories — the subfolders that group your tracks.

For each category you can set:

- **Display name** — a friendly label (e.g. show "Atmosphere" instead of the raw
  folder `atmos`). The badge on every track in that category uses it.
- **Colour** — pick from the swatch grid; the category badge and related accents
  use it.

You can also:

- **+ New** — create a brand-new category. This *creates the folder on disk* too,
  ready for you to drop files into (or import tracks into).
- **✎ Edit** — change an existing category's display name or colour.
- **🗑 Delete** — delete the category (see below).

Each row shows how many tracks are in that category.

### Deleting a category

Click the **🗑** on any category:

- **If it's empty** — DNDj confirms, then removes the folder from disk and the
  category's metadata.
- **If it has tracks** — DNDj warns you how many, and asks what to do with them:
  - **Move them to another category** — pick an existing one or create a new one
    (name + colour) on the spot. The track files are moved there and everything
    (tags, playlists, cue points, scenes) is preserved. Then the old category is
    removed.
  - **⚠ Delete the tracks and their files** — permanently removes those tracks,
    their files on disk, and every reference to them (playlists, folders, scenes,
    tags, cue points).

Either way the category folder is deleted from disk, and the change **syncs** to
your other machine on the next pull (moved files relocate there too; deleted files
are removed there). Any tracks loaded on a deck or pad are unloaded automatically
first, so you don't need to stop playback.

## Tags tab

Manage the free-form labels you attach to tracks.

- **+ New** — create a tag with a name and colour.
- **✎ Edit** — rename or recolour a tag (changes apply everywhere it's used).
- **× Delete** — remove a tag entirely (it's removed from all tracks).

Tag colours are what you see on the track-row chips and the toolbar filter chips.
See [Library & Tracks → Tags](./03-library-and-tracks.md#tags).

## Shortcuts tab

A read-only reference card of every keyboard shortcut, grouped by area (Decks,
Seek, Loop, Crossfader, SFX Pads, Waveform). It's the same information as
[Keyboard Shortcuts](./11-keyboard-shortcuts.md), available without leaving the app.

## Sync tab

Start/stop the server, configure DuckDNS for internet access, save connections,
and pull from another machine. Fully covered in
**[Syncing Two Machines](./10-sync.md)**.

---

## Other settings (no dialog)

A few preferences are adjusted directly in the main interface and remembered
automatically:

- **Master volume** — the slider in the top bar.
- **Panel sizes** — the rail width, deck height, and the A/B deck split are all
  drag-to-resize and persist between sessions.
- **Sampler pad assignments** — remembered as you set them.

---

[← Prev: Keyboard Shortcuts](./11-keyboard-shortcuts.md) · [Back to User Guide](./README.md)
