# 12. Build & Dev Workflow

[← Prev: Design System](./11-design-system.md) · [Technical Index](./README.md)

---

DNDj has an unusual but deliberate build setup: **only the renderer is bundled**
(by Vite). The Electron main process runs straight from source via Node — no
bundling step for `main.js`, `preload.js`, `libraryScanner.js`, `db_manager.js`, or
`src/sync/*`.

## npm scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm start` | `electron .` | Run the app. In a non-packaged checkout this still uses the dev branch of `createWindow` (loads the Vite URL), so for plain "run it" you usually want `dev`. |
| `npm run dev` | `concurrently "vite" "wait-on http://localhost:5178 && electron ."` | The normal workflow: start Vite, wait for it, then launch Electron pointing at it. |
| `npm run dev:vite` | `vite` | Renderer dev server only. |
| `npm run build:vite` | `vite build` | Build the renderer into `dist/`. |
| `npm run rebuild` | `electron-rebuild -f -w better-sqlite3` | Recompile the native `better-sqlite3` addon against Electron's Node ABI (run after install or Electron upgrades). |

> **Native module note:** `better-sqlite3` is a native addon. If you hit
> `NODE_MODULE_VERSION` errors at startup, run `npm run rebuild`.

## Dev vs production detection

`main.js` branches on `!app.isPackaged`:

| | Dev (`!isPackaged`) | Production (packaged) |
|---|---------------------|------------------------|
| Renderer source | `http://localhost:5178` (Vite) | `dist/index.html` via `loadFile` |
| DevTools | Opened (detached) | Closed |
| Reload after sync pull | `webContents.reload()` (keeps process + terminal) | `app.relaunch(); app.exit(0)` |
| Hot reload | `electron-reloader` watches main + renderer | n/a |

There is no packaging/installer pipeline configured — the app is intended to run
from source (see the [user guide](../user-guide/01-getting-started.md)). That's why
the dev-mode behaviours (especially the renderer-only reload after sync) are
first-class: day-to-day use is `npm run dev`.

## Vite config (`vite.config.js`)

```js
defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? './' : '/',   // './' so file:// assets resolve in prod
  server: { port: 5178, strictPort: true }, // must match VITE_DEV_SERVER_PORT in main.js
  build:  { outDir: 'dist', emptyOutDir: true },
}));
```

- The **port `5178` is load-bearing**: `main.js` hardcodes the same value in
  `VITE_DEV_SERVER_PORT`. Change one, change both.
- `base: './'` in production makes built asset URLs relative, which is required
  when the page is loaded over `file://` inside Electron.
- Only `src/**` (the React app) is in Vite's graph; Node-side files are referenced
  by Electron directly.

## `electron-reloader`

Wired in `main.js` inside a try/catch (no-ops if absent):

```js
require('electron-reloader')(module, {
  watchRenderer: true,
  ignore: [/data/, /dndj\.sqlite/],   // don't reload on DB writes
});
```

The `ignore` patterns are essential — without them, every database write would
restart the app in a loop.

## Things to know when extending

- **New privileged capability?** Add an `ipcMain.handle` in `main.js`, a wrapper in
  `preload.js`, and call it via `window.dndj` ([IPC chapter](./03-ipc-and-preload.md)).
- **New DB field/table?** Add an additive migration in `db_manager.js`
  ([DB chapter](./04-database.md)) so existing and pulled databases keep working.
- **New audio behaviour?** Extend `audioEngine.js` and expose via its public API;
  don't import `tone`/Web Audio in components ([engine chapter](./05-audio-engine.md)).
- **New colour/spacing?** Add a token in `tokens.css`
  ([design chapter](./11-design-system.md)).
- **Touching sync?** Remember the [DB hot-swap](./10-sync-system.md#the-database-hot-swap)
  and `LOCAL_SETTING_KEYS` — anything machine-local must be preserved across a pull.

## Dependency reference

Runtime: `electron`, `react`, `react-dom`, `vite` (dev server), `better-sqlite3`,
`@dnd-kit/*`, `zustand`, `tone`, `yt-dlp-wrap`, `ffmpeg-static`,
`electron-reloader`. Dev: `@vitejs/plugin-react`, `concurrently`, `wait-on`,
`electron-rebuild`.

> `howler` is still listed as a dependency but is **no longer used** — playback was
> moved to the [Web Audio engine](./05-audio-engine.md). It can be removed in a
> future cleanup.

---

[← Prev: Design System](./11-design-system.md) · [Technical Index](./README.md)
