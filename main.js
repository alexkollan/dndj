'use strict';

// main.js — Electron Main Process
// Responsibilities:
//   1. Create and manage the BrowserWindow
//   2. Register the custom app:// protocol for serving local audio files
//   3. Handle IPC events from the renderer (library scan, audio URL resolution)
//   4. Enable electron-reloader for instant reloads during development

const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { scanLibrary } = require('./libraryScanner');

// ─── Constants ───────────────────────────────────────────────────────────────

// The port Vite's dev server listens on (must match vite.config.js)
const VITE_DEV_SERVER_PORT = 5173;
const VITE_DEV_SERVER_URL = `http://localhost:${VITE_DEV_SERVER_PORT}`;

// Absolute path to the /sounds folder, resolved relative to this file.
// path.join ensures cross-platform correctness (Mac/Windows slashes).
const SOUNDS_DIR = path.join(__dirname, 'sounds');

// ─── electron-reloader ───────────────────────────────────────────────────────
// Hot-reloads the main process and renderer when any source file changes.
// Wrapped in try/catch so it silently no-ops if the package isn't installed.
try {
  require('electron-reloader')(module, {
    // Watch these directories in addition to the default (project root)
    watchRenderer: true,
  });
} catch (_) { /* not installed — ignore */ }

// ─── Protocol Registration ───────────────────────────────────────────────────
// Register the app:// custom protocol BEFORE the app is ready.
// This protocol lets the renderer safely request local audio files without
// exposing raw file:// paths or triggering CORS / security errors.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,          // Required for streaming large audio files
    },
  },
]);

// ─── Window Factory ──────────────────────────────────────────────────────────

/**
 * createWindow
 * Creates the main application window with sensible defaults for a DM tool:
 * dark background, generous size, no default menu bar clutter.
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a2e',   // Matches the dark theme — prevents white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,     // Required for secure contextBridge usage
      nodeIntegration: false,     // Never expose Node in renderer
    },
  });

  // In development, load from Vite's hot-reloading dev server.
  // In production (vite build), load the built index.html.
  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Register the app:// protocol handler.
  // Maps app://audio/<encoded-absolute-path> → reads the file from disk.
  protocol.handle('app', (request) => {
    // The URL looks like:  app://audio/<url-encoded-absolute-path>
    const requestUrl = new URL(request.url);
    
    // The URL parser might include a leading slash in the pathname.
    // We strip the "/audio" prefix to get the encoded file path.
    const encodedPath = requestUrl.pathname.replace(/^\/audio/, '');
    let filePath = decodeURIComponent(encodedPath);

    // Cross-platform path normalization:
    // On Windows, "/C:/..." needs the leading slash removed.
    // On Mac/Linux, "Users/..." needs the leading slash restored if it was stripped.
    if (process.platform === 'win32') {
      if (filePath.startsWith('/')) filePath = filePath.slice(1);
    } else {
      if (!filePath.startsWith('/')) filePath = '/' + filePath;
    }

    // Security: only serve files that live inside the /sounds directory.
    const resolvedPath = path.resolve(filePath);
    const soundsDirBase = SOUNDS_DIR.toLowerCase();
    const resolvedPathBase = resolvedPath.toLowerCase();

    if (!resolvedPathBase.startsWith(soundsDirBase)) {
      console.warn(`[main] Blocked access to file outside sounds dir: ${resolvedPath}`);
      return new Response('Forbidden', { status: 403 });
    }

    // Guard: return a 404 if the audio file has been deleted since the library scan
    if (!fs.existsSync(resolvedPath)) {
      return new Response(`Audio file not found: ${path.basename(resolvedPath)}`, { status: 404 });
    }

    return net.fetch(url.pathToFileURL(resolvedPath).toString());
  });

  createWindow();

  // macOS: re-create the window when the dock icon is clicked and no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (standard on Windows/Linux; macOS keeps running)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC Handlers ────────────────────────────────────────────────────────────

/**
 * Handle 'scan-library'
 * Called by the renderer on startup to load the full sound library.
 * Returns the categorised track list produced by libraryScanner.js.
 */
ipcMain.handle('scan-library', () => {
  return scanLibrary(SOUNDS_DIR);
});

/**
 * Handle 'get-audio-url'
 * Converts an absolute file path into an app:// URL that the renderer
 * (and Howler.js) can safely load.
 *
 * @param {Electron.IpcMainInvokeEvent} _event
 * @param {string} filePath - Absolute path to the audio file
 * @returns {string} app:// URL safe for use in Howler
 */
ipcMain.handle('get-audio-url', (_event, filePath) => {
  // Security: only serve files inside SOUNDS_DIR
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(SOUNDS_DIR)) {
    throw new Error('Access denied: file is outside the sounds directory');
  }
  // Encode the path so special characters don't break URL parsing
  return `app://audio/${encodeURIComponent(resolvedPath)}`;
});
