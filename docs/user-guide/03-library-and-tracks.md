# 3. Library & Tracks

[← Prev: Interface Tour](./02-interface-tour.md) · [Back to User Guide](./README.md) · [Next: Decks & Playback →](./04-decks-and-playback.md)

---

Everything you play in DNDj is a **track**. This chapter covers how tracks get
into the library and everything you can do with them.

## How tracks get into the library

DNDj reads the `sounds/` folder on disk. Every audio file inside a subfolder
becomes a track, and the **subfolder name becomes the track's category**.

- On launch, DNDj scans automatically.
- After adding or removing files on disk, click **↻ Refresh** in the tracklist
  toolbar to pick up the changes.

When a file is first seen, DNDj makes a tidy display name from the filename — it
strips the extension, turns `_` and `-` into spaces, and capitalises each word.
So `dragon_roar-02.mp3` becomes **"Dragon Roar 02"**. You can rename it
afterwards without touching the file.

> A track you delete from disk but haven't re-scanned is marked *missing* and
> hidden from the library — it won't clutter your list.

## Finding tracks

The toolbar above the list gives you three filters that combine:

- **🔍 Search** — matches track name or category as you type.
- **Category dropdown** — show only one category.
- **Tag chips** — click one or more tags; only tracks with *all* selected tags
  show. Click again to deselect. *Clear filters* resets everything.

Click the **Name / Category / Duration** column headers to sort. Click again to
reverse the direction.

## The track row

Each row shows, left to right:

- **▶ / ■** — play/stop this track directly (a quick preview, independent of the
  decks).
- **Name**.
- **Category badge** — coloured to match the category.
- **Tag chips** — up to three, then "+N".
- **Duration**.
- **A / B buttons** — instantly load the track onto Deck A or Deck B.
- **⋮ menu** — everything else (below).

## The ⋮ track menu

Click the three-dot menu on any row for:

- **✏ Rename** — give the track a friendly display name. (See below.)
- **+ Add Tag** — type a tag name and press ✓. Creates the tag if it's new.
- **↪ Move to…** — move the track to a different category. *This physically moves
  the file on disk* into the new category folder.
- **✕ Remove from playlist / folder / Exclude from playlist** — only appears when
  you're viewing a playlist (not the full library). The label changes with the
  playlist type. See [Playlists](./06-playlists.md).
- **🗑 Delete track** — removes the track. (See [Deleting a track](#deleting-a-track).)

## Renaming a track

Renaming a track **renames the actual file on disk** to match the new name (the
file extension is kept, and the name is cleaned of any characters that aren't
valid in a filename). The track keeps all its tags, playlist spots, cue points,
and scene assignments — those follow the track, not the filename.

Good to know:

- If a file with that exact name already exists in the folder, DNDj adds a small
  suffix so nothing gets overwritten.
- If the track is currently **playing on a deck**, the rename may fail because the
  file is in use — stop it first, then rename.
- Renames **sync correctly** to your other machine: on the next pull, the renamed
  file is copied across and the old-named file is cleaned up automatically (see
  [Syncing Two Machines](./10-sync.md)).

## Deleting a track

Choosing **🗑 Delete track** asks *where* to delete it:

- **This machine only** — removes it from this computer (database entry **and**
  the file on disk).
- **⚠ Everywhere (on next sync)** — also removes it from your other machine the
  next time that machine pulls a sync. Use this when you want a track gone for
  good across both computers.

> **Deleting always removes the file from disk.** There is no "remove from
> library but keep the file" option — delete means delete.

## Missing files & the health check

If you delete or move audio files (or a whole category folder) **outside** the
app — straight from your file manager — the library and the files on disk fall out
of sync. DNDj handles this in two ways.

### On launch
Every time the app starts it compares the database against your `sounds/` folder.
If anything the library references has gone missing, a **Library Issues Found**
window appears *before* the Studio loads. It lists:

- **Missing categories** — a whole folder that's gone, and how many tracks it held.
- **Missing tracks** — individual files that are gone, and **where each was
  linked** (which playlists, folders, scenes, tags, and how many cue points).

To keep everything consistent you then click **Clean up & continue**, which
removes those dead entries from *everywhere* they appear (playlists, folders,
scenes, tags, cue points). If something looks wrong — for example an external
drive isn't plugged in — click **Quit app** instead, fix it, and relaunch.

### Any time — the 🩺 button
The **🩺 health-check button** in the top bar runs the same check on demand and
shows a report: either *"Everything checks out"* or the same missing-items list,
with a **Clean up** button. Use it whenever you've been reorganising files on disk
and want to tidy the database.

> **Tip:** deleting from *inside* the app (the row's 🗑) keeps everything in sync
> automatically, so you'll rarely need the cleanup — it's there for when files
> change behind the app's back.

## Categories

A category is just a subfolder of `sounds/` — **the names are entirely up to
you**. There are no required or "special" folders; call them `dungeon`, `weather`,
`boss`, anything. By default the category badge shows the raw folder name in grey.
You can give each category a **friendly display name** and a **colour** in
**Settings → Categories**:

- Rename `atmos` to "Atmosphere", colour it emerald green.
- Create a brand-new category (which also creates the folder on disk).
- Categories with no tracks can have their metadata removed.

See [Settings](./12-settings.md#categories-tab) for the full walkthrough.

> **Does a category name change behaviour?** Almost never. The one and only
> special case: a category named exactly **`sfx`** (lowercase) plays **once**
> instead of looping when you use the ▶ *preview* button on a library row — handy
> for one-shots. That's it. Everything else about category names is cosmetic.
> Some names (`atmosphere`, `sfx`, `music`, `ambience`, `youtube`) come with a
> default badge colour until you pick your own, and `youtube` is just the
> pre-filled category in the import dialog. **Decks always start with looping on
> regardless of category** — toggle it per deck with the **LP** button.

## Tags

Tags are free-form labels you attach to tracks — `windy`, `boss-fight`,
`rain`, `creepy`, whatever helps you. A track can have any number of tags.

- Add a tag from the row's **⋮ → + Add Tag**.
- Filter by tag using the chips in the toolbar.
- Manage all tags (rename, recolour, delete) in **Settings → Tags**.

Tags and categories are the two main ways to keep a big library navigable, and
they're what **Smart Playlists** use to build themselves automatically — see
[Playlists → Smart Playlists](./06-playlists.md#smart-playlists).

---

[← Prev: Interface Tour](./02-interface-tour.md) · [Back to User Guide](./README.md) · [Next: Decks & Playback →](./04-decks-and-playback.md)
