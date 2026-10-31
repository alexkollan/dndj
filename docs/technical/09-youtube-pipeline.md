# 9. YouTube Pipeline

[← Prev: Library Scanner](./08-library-scanner.md) · [Technical Index](./README.md) · [Next: Sync System →](./10-sync-system.md)

---

The YouTube import lets the user turn a video URL into a library track. All the
heavy lifting is in `main.js` (handlers prefixed `youtube-`) using two external
tools; the UI is [`YoutubeImportDialog`](./07-components.md#youtubeimportdialogjsx).

## Tools

| Tool | Provided by | Role |
|------|-------------|------|
| **yt-dlp** | `yt-dlp-wrap` (binary downloaded on first use) | Fetch metadata, download best audio |
| **ffmpeg** | `ffmpeg-static` (bundled npm package) | Transcode to mp3/ogg when needed |

The yt-dlp binary is **not bundled** — it's downloaded into `resources/` the first
time. Paths:

```js
const YT_DLP_DIR = path.join(__dirname, 'resources');
const YT_DLP_BIN = path.join(YT_DLP_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const ffmpegBin  = require('ffmpeg-static');   // absolute path to bundled ffmpeg
```

## Keeping yt-dlp working

YouTube regularly breaks older yt-dlp versions (typically as `HTTP Error 403:
Forbidden` on download), so `main.js` does two things on every yt-dlp call:

- **Self-update once per session.** `ensureYtDlpUpdated()` runs `yt-dlp -U` the
  first time `youtube-get-info` or `youtube-import` is called after launch. It's
  memoised and non-fatal: if the update fails (offline, rate-limited), the call
  proceeds with the existing binary.
- **Provide a JS runtime.** yt-dlp needs a JavaScript runtime to solve YouTube's
  player challenges; without one it warns *"No supported JavaScript runtime could
  be found"* and downloads can fail. Rather than requiring deno/node on the PATH,
  we reuse **Electron's bundled Node** by running Electron's own binary as Node:

  ```js
  const YT_JS_ARGS = ['--no-update', '--js-runtimes', `node:${process.execPath}`];
  const YT_SPAWN_OPTS = { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } };
  ```

  Both are passed to every yt-dlp invocation (`--no-update` only silences the
  "older than 90 days" nag; the actual update is `ensureYtDlpUpdated`). yt-dlp
  inherits `ELECTRON_RUN_AS_NODE=1` and passes it to the Electron process it
  spawns as its JS runtime.

> This relies on Electron's `RunAsNode` fuse being enabled, which is the default.
> That's always true here because the app is only ever run from source with
> `npm run dev` and is never packaged (see [Build & Dev](./12-build-and-dev.md)).

## Handlers

### `youtube-check`
Returns `{ ready: fs.existsSync(YT_DLP_BIN) }` so the dialog can prompt for setup.

### `youtube-setup`
Downloads the yt-dlp binary if missing.

> **Platform nuance:** `yt-dlp-wrap`'s default download fetches the Python zipapp
> named `yt-dlp`. On macOS that's the wrong artifact, so the handler instead
> queries the latest GitHub release and downloads **`yt-dlp_macos`** explicitly.
> On non-Windows it then `chmod 0o755`s the binary.

### `youtube-get-info`
`wrap.execPromise([url, '--dump-json', '--no-playlist', ...YT_JS_ARGS], YT_SPAWN_OPTS)`
→ parsed into `{ id, title, duration, thumbnail, channel, ext }` for the preview
card. No download. (We don't use `wrap.getVideoInfo` because it can't take spawn
options, so the `ELECTRON_RUN_AS_NODE` env couldn't be set.)

### `youtube-import` (the main flow)
Payload: `{ url, category, displayName, categoryDisplayName, newCategoryColor,
tags, format }`.

1. **Resolve target dir** — `sounds/<category>/`, created if needed. If a new
   category was created inline, its meta is upserted with the *category* display
   name + colour (kept distinct from the *track* display name).
2. **Download** with a timestamped temp template (`_dl_<ts>.%(ext)s`) so the output
   file is findable:
   ```
   yt-dlp <url> -x --audio-quality 0 --no-playlist --no-mtime --newline
          --ffmpeg-location <dir(ffmpeg)> -o <targetDir>/_dl_<ts>.%(ext)s
          --no-update --js-runtimes node:<electron binary>
   ```
   Progress events (`p.percent`) are forwarded as `youtube-progress {phase:'download'}`.
3. **Locate the result** — scan the dir for files starting with the temp prefix,
   skipping `.part`/`.ytdl`, and pick by `AUDIO_EXT_PRIORITY`
   (`m4a > mp3 > ogg > …`).
4. **Transcode (conditional)** via ffmpeg when the user picked `mp3`/`ogg` and the
   download isn't already that, or the download isn't a natively-playable format:
   - mp3: `-codec:a libmp3lame -q:a 2`
   - ogg: `-codec:a libvorbis -q:a 6`
   The source temp file is unlinked after a successful transcode. `format:
   'original'` skips this step.
5. **Final naming** — sanitise the display name (strip filesystem-illegal chars,
   cap length), build `<name>.<ext>`, avoid clobbering an existing file by
   appending a timestamp.
6. **DB upsert** — relative path `<category>/<file>`. Insert or update with
   `source='youtube'`, `source_url=<url>`, `imported_at=now`. Apply tags
   (`INSERT OR IGNORE` into `tags`, link via `track_tags`).
7. Emit `youtube-progress {phase:'done', trackId}` and return all tracks.

## Progress phases (`youtube-progress` event)

| phase | meaning | UI |
|-------|---------|----|
| `setup` | binary download log line | setup log |
| `preparing` | resolving stream URL (no %) | indeterminate bar |
| `download` | `percent` 0–100 | progress bar |
| `converting` | ffmpeg transcoding | bar at ~75% |
| `done` | finished (`trackId`) | ✓ screen |

## Constants

```js
NATIVE_AUDIO_EXTS = {mp3, m4a, aac, ogg, wav, flac, webm, opus, weba}
AUDIO_EXT_PRIORITY = [m4a, mp3, ogg, aac, flac, wav, opus, webm, weba]
```

## Failure modes to be aware of

- A download that yields only `.part` files (interrupted) produces "output file
  not found".
- ffmpeg failures reject with the exit code; the temp download may remain.
- Info/download depend on yt-dlp being current. The per-session `-U` normally
  handles this; if a 403 persists, update manually with `resources/yt-dlp -U`
  and restart `npm run dev`.

---

[← Prev: Library Scanner](./08-library-scanner.md) · [Technical Index](./README.md) · [Next: Sync System →](./10-sync-system.md)
