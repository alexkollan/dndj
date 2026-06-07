# 10. Sync System

[← Prev: YouTube Pipeline](./09-youtube-pipeline.md) · [Technical Index](./README.md) · [Next: Design System →](./11-design-system.md)

---

The sync feature replicates one machine's library onto another over HTTP. It's a
**one-way, last-write-wins pull**: the client downloads the server's database and
any missing/changed audio files, then replaces its own database and reloads.
Either machine can play either role. User-facing guide:
[Syncing Two Machines](../user-guide/10-sync.md).

Three modules under `src/sync/`, orchestrated by `main.js` (`sync:*` handlers):

| File | Role |
|------|------|
| `syncServer.js` | HTTP server that serves the DB, a file manifest, and individual files |
| `syncClient.js` | The pull logic: download DB + diff files |
| `duckdns.js` | Keeps a DuckDNS domain pointed at the server's public IP |

## Server (`syncServer.js`)

A bare Node `http` server on port **7432**, bound to `0.0.0.0`. Every request must
carry `Authorization: Bearer <token>` or it gets `401`.

Endpoints:

| Route | Response |
|-------|----------|
| `GET /status` | `{ ok: true, version: 1 }` |
| `GET /db` | The raw `dndj.sqlite` bytes (`application/octet-stream`) |
| `GET /manifest` | `{ files: [{ path, size }, …] }` — recursive walk of `sounds/` |
| `GET /file?p=<relpath>` | The bytes of one file (path-traversal guarded) |

`startServer({ token, port, soundsDir, dbPath })` stores config in module state and
returns `{ port, localIp }`. `getLocalIp()` enumerates interfaces, **skips virtual
adapters** (WSL/Hyper-V/VirtualBox/VMware/tunnel/etc. by name), and prefers
`192.168.*` → `10.*` → `172.*` → first → `127.0.0.1`. `stopServer()`/`isRunning()`
round it out.

## Client (`syncClient.js`)

`pullFromServer({ serverUrl, token, soundsDir, dbPath, onProgress })`:

1. `GET /status` (auth check) — `httpGetJson` with a 12 s timeout.
2. **Download the DB** to `dndj_incoming.sqlite` (sibling of the real DB).
   `httpDownload` streams to a `.synctmp` file then atomically renames on finish.
3. `GET /manifest` and **diff**: a file is downloaded if it's missing locally *or*
   its local size differs from the manifest size. (Size-only comparison — fast,
   no hashing.)
4. Download each needed file to `sounds/<path>` (path split on `/` and re-joined
   with the local separator).
5. Return `{ tempDbPath, filesDownloaded }`. **The client does not apply the DB
   itself** — that's done in `main.js` (next section).

`onProgress` emits phases `connecting → db → manifest → files (with total/done/
current)`, surfaced to the UI via the `sync-progress` event.

## The database hot-swap

`main.js`'s `sync:pull` handler takes over after the client returns:

```
1. Snapshot LOCAL_SETTING_KEYS from the current DB         (preserve machine config)
2. Force sync_server_enabled = false                       (a client shouldn't auto-serve)
3. dbManager.db.close()
4. unlink old dndj.sqlite, rename incoming → dndj.sqlite
5. delete require.cache[db_manager]; dbManager = require(db_manager)   ← hot reload
6. Restore the snapshotted local settings into the new DB
7. Drain sync_deletions: unlink each queued file, then clear the table
8. Reload:
     dev  → mainWindow.webContents.reload()   (keeps process + terminal alive)
     prod → app.relaunch(); app.exit(0)
```

### Local settings preservation
A pulled DB would otherwise overwrite this machine's own config. Before the swap,
these keys are snapshotted and re-written afterward:

```js
const LOCAL_SETTING_KEYS = [
  'sync_server_enabled', 'sync_token',
  'sync_duckdns_domain', 'sync_duckdns_token',
  'sync_client_url', 'sync_client_token', 'sync_saved_connections',
];
```
So your saved connection chips, your own server token, and DuckDNS config all
survive a pull.

### Cross-machine deletions
When a track is deleted with `globalDelete` (see
[`delete-track`](./03-ipc-and-preload.md)), its relative path is inserted into
`sync_deletions`. That row travels inside the DB to the other machine, where step 7
of the pull deletes the corresponding file and clears the queue. This is how
"delete everywhere" propagates.

### Renames
A rename changes a track's `path` (the filename is part of it), which is the sync
identity. To avoid leaving an orphan copy on the other machine, `rename-track`
pushes the **old** path into `sync_deletions`. On the next pull the other machine:
downloads the renamed file (it's "missing" by the size/path diff), receives the
updated DB (new path), and then drains `sync_deletions` to remove the old-named
file — a net rename, no duplicate. See
[Library Scanner → Renaming](./08-library-scanner.md#renaming-renames-the-file).

### Dev vs prod reload
In dev the handler reloads only the renderer (`webContents.reload()`), because
`app.relaunch()` spawns a *detached* process and would sever the terminal that
`npm run dev` is attached to. In production it relaunches the whole app.

## DuckDNS (`duckdns.js`)

For WAN access, home IPs change, so the server keeps a DuckDNS domain current:

- `updateOnce(domain, token)` — `GET https://www.duckdns.org/update?domains=…&
  token=…&ip=` (empty `ip` lets DuckDNS use the caller's public IP). Records
  `{ ok, updatedAt }`.
- `startUpdater(domain, token)` — fire once immediately, then every **30 min**.
- `stopUpdater()`, `getStatus()`.

`sync:update-duckdns` persists the domain/token to settings, starts the updater,
and does one immediate update. The server auto-start path on app launch also
restarts the updater if a domain/token are saved.

> WAN access additionally requires the user to **port-forward 7432/TCP** on their
> router to the server machine — that's outside the app's control and is documented
> in the user guide.

## Security model

- A single shared **bearer token** (random 4-byte hex, created once via
  `getOrCreateSyncToken`, stored in settings, persistent).
- Server endpoints reject mismatched tokens with `401`.
- File routes resolve and verify the path stays within `soundsDir` (no traversal).
- There is **no TLS** — traffic is plain HTTP. On a trusted LAN this is fine; over
  WAN the token is the only gate. Treat the token as a secret.

---

[← Prev: YouTube Pipeline](./09-youtube-pipeline.md) · [Technical Index](./README.md) · [Next: Design System →](./11-design-system.md)
