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
const dbManager = require('./src/db/db_manager');

// ─── Constants ───────────────────────────────────────────────────────────────

// The port Vite's dev server listens on (must match vite.config.js)
const VITE_DEV_SERVER_PORT = 5178;
const VITE_DEV_SERVER_URL = `http://localhost:${VITE_DEV_SERVER_PORT}`;

// Absolute path to the /sounds folder, resolved relative to this file.
const SOUNDS_DIR = path.join(__dirname, 'sounds');

// ─── electron-reloader ───────────────────────────────────────────────────────
// Hot-reloads the main process and renderer when any source file changes.
// Wrapped in try/catch so it silently no-ops if the package isn't installed.
try {
  require('electron-reloader')(module, {
    watchRenderer: true,
    ignore: [/data/, /dndj\.sqlite/]
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
    // We strip the "/audio" prefix to get the relative track path.
    const encodedPath = requestUrl.pathname.replace(/^\/audio/, '');
    let relativeTrackPath = decodeURIComponent(encodedPath);

    // Remove leading slash if present to make it truly relative
    if (relativeTrackPath.startsWith('/')) relativeTrackPath = relativeTrackPath.slice(1);

    // Resolve the absolute path based on the current SOUNDS_DIR
    const resolvedPath = path.join(SOUNDS_DIR, relativeTrackPath);
    
    // Security: only serve files that live inside the /sounds directory.
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
 * Syncs the sound files on disk with the database and returns all tracks.
 */
ipcMain.handle('scan-library', () => {
  scanLibrary(SOUNDS_DIR, {
    upsertTrack: dbManager.upsertTrack,
    markAllMissing: dbManager.markAllMissing
  });
  return dbManager.getAllTracks.all();
});

/**
 * Handle 'get-tags'
 */
ipcMain.handle('get-tags', () => {
  return dbManager.getAllTags.all();
});

/**
 * Handle 'add-tag-to-track'
 */
ipcMain.handle('add-tag-to-track', (_event, trackId, tagName) => {
  dbManager.insertTag.run(tagName);
  const tag = dbManager.getTagByName.get(tagName);
  if (tag) {
    dbManager.linkTagToTrack.run(trackId, tag.id);
  }
  return dbManager.getAllTracks.all();
});

/**
 * Handle 'remove-tag-from-track'
 */
ipcMain.handle('remove-tag-from-track', (_event, trackId, tagId) => {
  dbManager.unlinkTagFromTrack.run(trackId, tagId);
  return dbManager.getAllTracks.all();
});

/**
 * Handle 'create-empty-scene'
 */
ipcMain.handle('create-empty-scene', (_event, name, description = '') => {
  dbManager.insertScene.run(name, description);
  return dbManager.getAllScenes.all();
});

/**
 * Handle 'add-track-to-scene'
 */
ipcMain.handle('add-track-to-scene', (_event, sceneId, trackId, volume = 1.0, isLoop = 1) => {
  dbManager.insertSceneTrack.run(sceneId, trackId, volume, isLoop);
  return dbManager.getSceneTracks.all(sceneId);
});

ipcMain.handle('remove-track-from-scene', (_event, sceneId, trackId) => {
  dbManager.deleteSceneTrack.run(sceneId, trackId);
  return dbManager.getSceneTracks.all(sceneId);
});

ipcMain.handle('update-scene-track-settings', (_event, sceneId, trackId, volume, isLoop, startTime, endTime) => {
  dbManager.updateSceneTrackSettings.run(volume, isLoop ? 1 : 0, startTime, endTime, sceneId, trackId);
  return dbManager.getSceneTracks.all(sceneId);
});

/**
 * Handle 'save-scene'
 */
ipcMain.handle('save-scene', (_event, name, description, tracks) => {
  const result = dbManager.insertScene.run(name, description);
  const sceneId = result.lastInsertRowid;
  
  const insertStmt = dbManager.insertSceneTrack;
  for (const track of tracks) {
    insertStmt.run(sceneId, track.id, track.volume, track.is_loop ? 1 : 0);
  }
  
  return dbManager.getAllScenes.all();
});

/**
 * Handle 'get-scenes'
 */
ipcMain.handle('get-scenes', () => {
  return dbManager.getAllScenes.all();
});

/**
 * Handle 'get-scene-tracks'
 */
ipcMain.handle('get-scene-tracks', (_event, sceneId) => {
  return dbManager.getSceneTracks.all(sceneId);
});

ipcMain.handle('update-track-peaks', (_event, trackId, peaks) => {
  dbManager.updateTrackPeaks.run(peaks, trackId);
});

ipcMain.handle('rename-track', async (_event, trackId, newName) => {
  const track = dbManager.getTrackById.get(trackId);
  if (!track) throw new Error('Track not found');

  // Virtual Rename: only update DB
  dbManager.updateTrackDisplayName.run(newName, trackId);

  return dbManager.getAllTracks.all();
});

/**
 * Handle 'get-setting'
 */
ipcMain.handle('get-setting', (_event, key) => {
  const result = dbManager.getSetting.get(key);
  return result ? JSON.parse(result.value) : null;
});

/**
 * Handle 'set-setting'
 */
ipcMain.handle('set-setting', (_event, key, value) => {
  dbManager.setSetting.run(key, JSON.stringify(value));
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
ipcMain.handle('get-audio-url', (_event, relativePath) => {
  // Security: only serve files inside SOUNDS_DIR
  // We resolve the relative path against our known SOUNDS_DIR
  const resolvedPath = path.join(SOUNDS_DIR, relativePath);
  
  const soundsDirBase = SOUNDS_DIR.toLowerCase();
  const resolvedPathBase = resolvedPath.toLowerCase();

  if (!resolvedPathBase.startsWith(soundsDirBase)) {
    throw new Error('Access denied: file is outside the sounds directory');
  }
  
  // Return the app:// URL using the relative path portion
  return `app://audio/${encodeURIComponent(relativePath)}`;
});
