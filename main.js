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

const AUDIO_MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm; codecs=opus',
  '.opus': 'audio/webm; codecs=opus', // yt-dlp produces WebM-container Opus; browser needs this MIME
};

let mainWindow = null;

function getAudioMime(filePath) {
  return AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'audio/mpeg';
}
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
  mainWindow = win;

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
    // URL shape: app://audio/<per-segment-encoded-relative-path>
    // "audio" is the host, so pathname is just the relative track path.
    const requestUrl = new URL(request.url);
    // Decode each segment individually to handle spaces/special chars correctly.
    let relativeTrackPath = requestUrl.pathname
      .split('/')
      .map(seg => decodeURIComponent(seg))
      .join('/');

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

    const stat = fs.statSync(resolvedPath);
    const fileSize = stat.size;
    const mimeType = getAudioMime(resolvedPath);
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      // Parse "bytes=start-end" — end is optional
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(resolvedPath, { start, end });
      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
        },
      });
    }

    // Full file — still advertise range support so the browser will seek properly
    const stream = fs.createReadStream(resolvedPath);
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
      },
    });
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

ipcMain.handle('save-scene-snapshot', (_event, name, snapshotJson) => {
  const result = dbManager.insertSceneSnapshot.run(name, snapshotJson);
  return result.lastInsertRowid;
});

ipcMain.handle('update-scene-snapshot', (_event, id, name, snapshotJson) => {
  dbManager.updateSceneSnapshot.run(name, snapshotJson, id);
});

ipcMain.handle('delete-scene', (_event, id) => {
  dbManager.deleteScene.run(id);
});

ipcMain.handle('update-track-peaks', (_event, trackId, peaks) => {
  dbManager.updateTrackPeaks.run(peaks, trackId);
});

ipcMain.handle('update-track-duration', (_event, trackId, duration) => {
  dbManager.updateTrackDuration.run(duration, trackId);
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

// ─── Playlist IPC Handlers ────────────────────────────────────────────────────

ipcMain.handle('get-playlists', () => {
  return dbManager.getAllPlaylists.all();
});

ipcMain.handle('create-playlist', (_event, name, parentId, type, rulesJson) => {
  const maxOrder = dbManager.getAllPlaylists.all()
    .filter(p => p.parent_id === (parentId || null))
    .reduce((m, p) => Math.max(m, p.sort_order), -1);
  const result = dbManager.insertPlaylist.run(name, parentId || null, type || 'manual', rulesJson || null, maxOrder + 1);
  return dbManager.getAllPlaylists.all();
});

ipcMain.handle('update-playlist', (_event, id, name, parentId, rulesJson, sortOrder) => {
  dbManager.updatePlaylist.run(name, parentId || null, rulesJson || null, sortOrder ?? 0, id);
  return dbManager.getAllPlaylists.all();
});

ipcMain.handle('delete-playlist', (_event, id) => {
  dbManager.deletePlaylist.run(id);
  return dbManager.getAllPlaylists.all();
});

ipcMain.handle('get-playlist-tracks', (_event, playlistId) => {
  return dbManager.getPlaylistTracks.all(playlistId);
});

ipcMain.handle('add-track-to-playlist', (_event, playlistId, trackId) => {
  const { max_order } = dbManager.getMaxPlaylistTrackOrder.get(playlistId);
  dbManager.insertPlaylistTrack.run(playlistId, trackId, max_order + 1);
  return dbManager.getPlaylistTracks.all(playlistId);
});

ipcMain.handle('remove-track-from-playlist', (_event, playlistId, trackId) => {
  dbManager.deletePlaylistTrack.run(playlistId, trackId);
  return dbManager.getPlaylistTracks.all(playlistId);
});

ipcMain.handle('reorder-playlist-track', (_event, playlistId, trackId, sortOrder) => {
  dbManager.updatePlaylistTrackOrder.run(sortOrder, playlistId, trackId);
  return dbManager.getPlaylistTracks.all(playlistId);
});

// ─── Cue Point IPC Handlers ───────────────────────────────────────────────────

ipcMain.handle('get-cue-points', (_event, trackId) => {
  return dbManager.getCuePoints.all(trackId);
});

ipcMain.handle('add-cue-point', (_event, trackId, position, label, color) => {
  const result = dbManager.insertCuePoint.run(trackId, position, label || '', color || '#10b981');
  return dbManager.getCuePoints.all(trackId);
});

ipcMain.handle('update-cue-point', (_event, id, position, label, color) => {
  dbManager.updateCuePoint.run(position, label || '', color || '#10b981', id);
  const cue = dbManager.db.prepare('SELECT track_id FROM cue_points WHERE id = ?').get(id);
  return cue ? dbManager.getCuePoints.all(cue.track_id) : [];
});

ipcMain.handle('delete-cue-point', (_event, id) => {
  const cue = dbManager.db.prepare('SELECT track_id FROM cue_points WHERE id = ?').get(id);
  dbManager.deleteCuePoint.run(id);
  return cue ? dbManager.getCuePoints.all(cue.track_id) : [];
});

// ─── Category Meta ───────────────────────────────────────────────────────────

ipcMain.handle('get-category-meta', () => dbManager.getAllCategoryMeta.all());

ipcMain.handle('upsert-category-meta', (_e, folderName, displayName, color) => {
  dbManager.upsertCategoryMeta.run(folderName, displayName || folderName, color || '#6b7280');
  return dbManager.getAllCategoryMeta.all();
});

ipcMain.handle('create-category', (_e, folderName, displayName, color) => {
  const catDir = path.join(SOUNDS_DIR, folderName);
  if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
  dbManager.upsertCategoryMeta.run(folderName, displayName || folderName, color || '#6b7280');
  return dbManager.getAllCategoryMeta.all();
});

ipcMain.handle('delete-category-meta', (_e, folderName) => {
  dbManager.deleteCategoryMeta.run(folderName);
  return dbManager.getAllCategoryMeta.all();
});

ipcMain.handle('move-track-to-category', async (_e, trackId, newCategory) => {
  const track = dbManager.getTrackById.get(trackId);
  if (!track) throw new Error('Track not found');

  const filename = track.path.split('/').pop();
  const oldAbs = path.join(SOUNDS_DIR, ...track.path.split('/'));
  const newDir = path.join(SOUNDS_DIR, newCategory);
  const newAbs = path.join(newDir, filename);
  const newRel = `${newCategory}/${filename}`;

  if (!fs.existsSync(oldAbs)) throw new Error(`Source file not found: ${oldAbs}`);
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
  if (fs.existsSync(newAbs) && newAbs !== oldAbs) throw new Error(`A file named "${filename}" already exists in "${newCategory}"`);

  fs.renameSync(oldAbs, newAbs);
  dbManager.db.prepare('UPDATE tracks SET path = ?, category = ? WHERE id = ?').run(newRel, newCategory, trackId);

  return dbManager.getAllTracks.all();
});

// ─── Tag Management ───────────────────────────────────────────────────────────

ipcMain.handle('delete-track', async (_e, trackId, deleteFile = false) => {
  const track = dbManager.getTrackById.get(trackId);
  if (!track) throw new Error('Track not found');
  if (deleteFile) {
    const absPath = path.join(SOUNDS_DIR, ...track.path.split('/'));
    try { if (fs.existsSync(absPath)) fs.unlinkSync(absPath); } catch (_) {}
  }
  dbManager.deleteTrack.run(trackId);
  return dbManager.getAllTracks.all();
});

ipcMain.handle('create-tag', (_e, name, color) => {
  dbManager.db.prepare(`INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)`).run(name, color || '#6b7280');
  return dbManager.getAllTags.all();
});

ipcMain.handle('update-tag', (_e, id, name, color) => {
  dbManager.updateTag.run(name, color || '#6b7280', id);
  return dbManager.getAllTags.all();
});

ipcMain.handle('delete-tag', (_e, id) => {
  dbManager.deleteTag.run(id);
  return dbManager.getAllTags.all();
});

// ─── YouTube Import ──────────────────────────────────────────────────────────

const { spawn } = require('child_process');
const YT_DLP_DIR = path.join(__dirname, 'resources');
const YT_DLP_BIN = path.join(YT_DLP_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const YT_SOUNDS_DIR = path.join(SOUNDS_DIR, 'youtube');
const NATIVE_AUDIO_EXTS = new Set(['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac', 'webm', 'opus', 'weba']);
// Preference order when yt-dlp produces multiple temp files
const AUDIO_EXT_PRIORITY = ['m4a', 'mp3', 'ogg', 'aac', 'flac', 'wav', 'opus', 'webm', 'weba'];
const ffmpegBin = require('ffmpeg-static');

function ytDlpWrap() {
  const Mod = require('yt-dlp-wrap');
  const Cls = Mod.default || Mod;
  return new Cls(YT_DLP_BIN);
}

function ytSend(data) {
  mainWindow?.webContents.send('youtube-progress', data);
}

// Check if yt-dlp binary exists
ipcMain.handle('youtube-check', async () => {
  return { ready: fs.existsSync(YT_DLP_BIN) };
});

// Download yt-dlp binary from GitHub
ipcMain.handle('youtube-setup', async () => {
  if (fs.existsSync(YT_DLP_BIN)) return { ok: true };
  if (!fs.existsSync(YT_DLP_DIR)) fs.mkdirSync(YT_DLP_DIR, { recursive: true });
  const Mod = require('yt-dlp-wrap');
  const Cls = Mod.default || Mod;
  ytSend({ phase: 'setup', status: 'Downloading yt-dlp…' });
  await Cls.downloadFromGithub(YT_DLP_BIN);
  if (process.platform !== 'win32') fs.chmodSync(YT_DLP_BIN, 0o755);
  ytSend({ phase: 'setup', status: 'Ready' });
  return { ok: true };
});

// Fetch video metadata without downloading
ipcMain.handle('youtube-get-info', async (_, url) => {
  const wrap = ytDlpWrap();
  const info = await wrap.getVideoInfo(url);
  return {
    id: info.id,
    title: info.title,
    duration: info.duration || 0,
    thumbnail: info.thumbnail || null,
    channel: info.channel || info.uploader || '',
    ext: info.ext || 'webm',
  };
});

// Download + optionally transcode + insert into DB
ipcMain.handle('youtube-import', async (_, { url, category = 'youtube', displayName, categoryDisplayName, newCategoryColor, tags = [], format = 'mp3' }) => {
  // Resolve target directory — use the chosen category folder, not always 'youtube'
  const targetDir = path.join(SOUNDS_DIR, category);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  // If a new category was created inline, persist its metadata using the CATEGORY display name
  // (displayName is the TRACK name, not the category name)
  if (newCategoryColor) {
    dbManager.upsertCategoryMeta.run(category, categoryDisplayName || category, newCategoryColor);
  }

  const wrap = ytDlpWrap();

  ytSend({ phase: 'download', percent: 0 });

  // Use timestamp-prefixed temp name so we can find the file reliably
  const tempBase = `_dl_${Date.now()}`;
  const outputTemplate = path.join(targetDir, `${tempBase}.%(ext)s`);

  await new Promise((resolve, reject) => {
    const proc = wrap.exec([
      url, '-x', '--audio-quality', '0',
      '--no-playlist', '--no-mtime',
      '-o', outputTemplate,
    ]);
    proc.on('progress', p => ytSend({ phase: 'download', percent: Math.round(p.percent || 0) }));
    proc.on('close', resolve);
    proc.on('error', reject);
  });

  // Find the downloaded file by the temp prefix
  // Prefer known audio extensions; skip .part files still being written
  const allDirFiles = fs.readdirSync(targetDir);
  const tempFiles = allDirFiles.filter(f => f.startsWith(tempBase) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
  const downloaded = tempFiles.sort((a, b) => {
    const extA = path.extname(a).slice(1).toLowerCase();
    const extB = path.extname(b).slice(1).toLowerCase();
    const iA = AUDIO_EXT_PRIORITY.indexOf(extA);
    const iB = AUDIO_EXT_PRIORITY.indexOf(extB);
    return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
  })[0];
  if (!downloaded) throw new Error('Download failed: output file not found');

  const downloadedPath = path.join(targetDir, downloaded);
  const ext = path.extname(downloaded).slice(1).toLowerCase();
  let finalPath = downloadedPath;

  // Transcode when: user chose mp3/ogg explicitly, or format is not natively playable
  const needsTranscode = (format === 'mp3' && ext !== 'mp3') || (format === 'ogg' && ext !== 'ogg') || (format !== 'original' && !NATIVE_AUDIO_EXTS.has(ext));
  if (needsTranscode) {
    const targetExt = (format === 'ogg') ? 'ogg' : 'mp3';
    ytSend({ phase: 'converting', percent: 0 });
    const outPath = downloadedPath.replace(/\.[^.]+$/, `.${targetExt}`);
    const ffArgs = targetExt === 'ogg'
      ? ['-i', downloadedPath, '-codec:a', 'libvorbis', '-q:a', '6', '-y', outPath]
      : ['-i', downloadedPath, '-codec:a', 'libmp3lame', '-q:a', '2', '-y', outPath];
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegBin, ffArgs);
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
      proc.on('error', reject);
    });
    try { fs.unlinkSync(downloadedPath); } catch (_) {}
    finalPath = outPath;
  }

  // Determine the final display name and clean filename
  const cleanTitle = (displayName || path.basename(finalPath, path.extname(finalPath)))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 120);
  const finalExt = path.extname(finalPath).slice(1).toLowerCase();
  const namedFilename = `${cleanTitle}.${finalExt}`;
  const namedPath = path.join(targetDir, namedFilename);

  // Avoid overwriting an existing file with the same name
  let destPath = namedPath;
  if (fs.existsSync(namedPath) && namedPath !== finalPath) {
    destPath = path.join(targetDir, `${cleanTitle}_${Date.now()}.${finalExt}`);
  }
  if (destPath !== finalPath) fs.renameSync(finalPath, destPath);

  // Build relative DB path using the actual category folder (e.g. "ambient/Track Name.mp3")
  const relativePath = `${category}/${path.basename(destPath)}`;
  const trackDisplayName = cleanTitle;

  // Upsert into DB
  const existing = dbManager.db.prepare('SELECT id FROM tracks WHERE path = ?').get(relativePath);
  let trackId;
  if (existing) {
    dbManager.db.prepare('UPDATE tracks SET is_missing=0, name=?, category=?, source=?, source_url=? WHERE id=?')
      .run(trackDisplayName, category, 'youtube', url, existing.id);
    trackId = existing.id;
  } else {
    const r = dbManager.db.prepare(
      `INSERT INTO tracks (path, name, category, format, is_missing, source, source_url, imported_at)
       VALUES (?, ?, ?, ?, 0, 'youtube', ?, CURRENT_TIMESTAMP)`
    ).run(relativePath, trackDisplayName, category, finalExt, url);
    trackId = r.lastInsertRowid;
  }

  // Apply tags
  for (const tagName of (tags || [])) {
    if (!tagName?.trim()) continue;
    dbManager.db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)').run(tagName.trim(), '#6b7280');
    const tag = dbManager.db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName.trim());
    if (tag) dbManager.db.prepare('INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)').run(trackId, tag.id);
  }

  ytSend({ phase: 'done', trackId });
  return dbManager.getAllTracks.all();
});

ipcMain.handle('get-audio-url', (_event, relativePath) => {
  // Security: only serve files inside SOUNDS_DIR
  // We resolve the relative path against our known SOUNDS_DIR
  const resolvedPath = path.join(SOUNDS_DIR, relativePath);
  
  const soundsDirBase = SOUNDS_DIR.toLowerCase();
  const resolvedPathBase = resolvedPath.toLowerCase();

  if (!resolvedPathBase.startsWith(soundsDirBase)) {
    throw new Error('Access denied: file is outside the sounds directory');
  }
  
  // Encode each path segment individually so '/' stays as a path separator.
  // Using encodeURIComponent on the whole path turns '/' into '%2F', which
  // Chromium may normalize during range requests (seek/play), causing 404s.
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  return `app://audio/${encodedPath}`;
});
