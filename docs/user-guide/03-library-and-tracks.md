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

DNDj uses **Virtual Renaming**: when you rename a track, only its *display name*
in the database changes — the actual file on disk keeps its original name.

Why this matters:

- It never causes file-lock errors or conflicts with the operating system.
- Custom names survive a re-scan — refreshing the library won't reset your names.
- It's safe to rename freely; nothing on disk is at risk.

## Deleting a track

Choosing **🗑 Delete track** asks *where* to delete it:

- **This machine only** — removes it from this computer (database entry **and**
  the file on disk).
- **⚠ Everywhere (on next sync)** — also removes it from your other machine the
  next time that machine pulls a sync. Use this when you want a track gone for
  good across both computers.

> **Deleting always removes the file from disk.** There is no "remove from
> library but keep the file" option — delete means delete.

## Categories

A category is just a subfolder of `sounds/`. By default the category badge shows
the raw folder name in grey. You can give each category a **friendly display
name** and a **colour** in **Settings → Categories**:

- Rename `atmos` to "Atmosphere", colour it emerald green.
- Create a brand-new category (which also creates the folder on disk).
- Categories with no tracks can have their metadata removed.

See [Settings](./12-settings.md#categories-tab) for the full walkthrough.

> **Convention:** atmosphere/ambient tracks loop by default when loaded on a
> deck; a category literally named `sfx` is treated as one-shot (no loop) when
> previewed. You can override looping per deck at any time.

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
