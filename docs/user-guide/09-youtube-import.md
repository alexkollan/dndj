# 9. YouTube Import

[← Prev: Scenes](./08-scenes.md) · [Back to User Guide](./README.md) · [Next: Syncing Two Machines →](./10-sync.md)

---

DNDj can pull audio straight from a YouTube link and add it to your library as a
normal track — handy for grabbing ambience, music, or sound effects you find
online.

> **Use responsibly.** Only download content you have the right to use, and
> respect creators' licences and YouTube's terms.

> Looking to import **local** files, folders, or a `.zip` instead? That's the
> separate **⬇ Import** button — see
> [Importing tracks](./03-library-and-tracks.md#importing-tracks-files-folders-zip).

## One-time setup

YouTube import relies on a small helper tool called **yt-dlp**. The first time you
use the feature, DNDj offers to download it for you:

1. Click **⬇ YouTube** in the tracklist toolbar.
2. If you see *"yt-dlp is not installed"*, click **Install yt-dlp** and wait for
   it to finish.

After that, the tool is ready and you won't be asked again.

## Importing a track

1. Click **⬇ YouTube**.
2. **Paste the YouTube URL** and click **Fetch** (or press Enter).
3. DNDj shows the video's thumbnail, title, channel, and length. Now fill in:
   - **Track name** — defaults to the video title; edit to taste.
   - **Category** — pick an existing category, or click **+ New** to create one
     inline (name, optional display name, colour).
   - **Tags** — click existing tag chips to apply them, and/or type new ones.
   - **Save as** — the audio format to store:
     - **MP3** (default) — widely compatible.
     - **OGG** — open format, good compression.
     - **Original** — keep whatever YouTube provides, no re-encoding (fastest).
4. Click **⬇ Import**.

A progress bar shows the download and, if needed, the conversion. When it's done
you'll see a ✓ and can **Import another** or close the dialog. The new track
appears in your library right away.

## Where it lands

The imported file is saved into the category folder you chose (inside `sounds/`),
named after your track name. It behaves exactly like any other track from then
on — drag it to decks, tag it, add it to playlists, etc.

## Troubleshooting

- **"Fetch" fails** — double-check the URL is a valid, public video.
- **Stuck at "Resolving stream URL…"** — this step has no percentage; give it a
  moment, especially on slower connections.
- **An error after install** — try the import again; if it persists, re-open the
  dialog so DNDj re-checks the helper tool.

---

[← Prev: Scenes](./08-scenes.md) · [Back to User Guide](./README.md) · [Next: Syncing Two Machines →](./10-sync.md)
