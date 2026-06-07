# 6. Playlists

[← Prev: The Crossfader](./05-crossfader.md) · [Back to User Guide](./README.md) · [Next: Sampler Pads →](./07-sampler-pads.md)

---

Playlists live in the top half of the left rail and help you organise a large
library. There are **three kinds**, each with a different icon and behaviour.

| Icon | Type | What it is |
|------|------|-----------|
| ♪ | **Manual** | A hand-picked, hand-ordered list of tracks |
| ✦ | **Smart** | A list that fills itself automatically from rules you define |
| 📁 | **Folder** | A container for nesting other playlists/folders (and tracks) |

At the very top is **♫ My Library** — not a playlist, just "everything you own".
Click it any time to see your full collection.

## Creating a playlist

Click the **+** next to the *PLAYLISTS* header and choose **Manual Playlist**,
**Folder**, or **Smart Playlist**. Type a name and press Enter.

## Selecting & viewing

Click any playlist to load its tracks into the centre track list. The toolbar,
sorting, search, and the **⋮** menu all work the same as in the library.

## Renaming, reordering, deleting

- **Double-click** a playlist name to rename it.
- **Drag** a playlist up or down to reorder, or onto a folder to nest it inside.
  A line shows where it will land; dropping onto the middle of a folder drops it
  *into* the folder.
- Hover a playlist and click the **×** to delete it. (Deleting a playlist never
  deletes the actual tracks or files — just the list.)

---

## Manual playlists ♪

The simplest kind: you decide exactly what's in it and in what order.

- **Add a track:** drag it from the library onto the playlist in the left rail.
- **Reorder:** while viewing the playlist, drag track rows up and down.
- **Remove a track:** open the row's **⋮** menu → **✕ Remove from playlist**.
  (This only removes it from the list — the track stays in your library.)

> Manual playlists show their tracks **only in the centre panel** when selected —
> they don't expand to show tracks in the left rail. (Folders do; see below.)

---

## Smart playlists ✦

A Smart playlist doesn't hold tracks — it holds **rules**, and automatically
shows every track that matches. Add a new track that fits the rules and it
appears in the Smart playlist instantly; no manual upkeep.

### Editing the rules

Click the **⚙** on a Smart playlist (or create one) to open the rule editor:

- Choose to match **ALL** of the rules (AND) or **ANY** of them (OR).
- Each rule is *field* + *operator* + *value*, for example:
  - `Category` `equals` `combat`
  - `Tags` `contains` `boss`
  - `Name` `doesn't contain` `intro`
- Fields: **Name**, **Category**, **Tags**.
- Operators: **contains**, **doesn't contain**, **equals**, **doesn't equal**.

Example — a "Boss Fights" Smart playlist matching **ALL**:
`Category equals combat` **and** `Tags contains boss`.

### Excluding a single track

Sometimes a track matches the rules but you want it out of *this* playlist.
Open its **⋮** menu → **Exclude from playlist**. This adds a special **exclusion
rule** for that one track. The exclusion shows up in the rule editor as
*"Exclude: <track name>"* and can be removed there if you change your mind.

This keeps Smart playlists honest: removing a track is itself just another rule,
so it's visible and reversible.

---

## Folders 📁

Folders are containers. Drag playlists, other folders, **or tracks** into them to
build a tree — for example a "Session 12" folder holding your combat, travel, and
town playlists for that night.

- A folder with contents shows a **▶ / ▼ caret**; click it to expand/collapse.
- Unlike Manual/Smart playlists, a folder **shows its child tracks directly in the
  left rail** when expanded, each with its own **×** to remove it from the folder.
- You can also remove a track from a folder via its row **⋮** menu →
  **Remove from folder** in the centre panel.

Folders can nest as deep as you like. DNDj prevents you from dropping a folder
into itself or into one of its own descendants.

---

[← Prev: The Crossfader](./05-crossfader.md) · [Back to User Guide](./README.md) · [Next: Sampler Pads →](./07-sampler-pads.md)
