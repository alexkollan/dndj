const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Portability: Use a local 'data' folder in the project root.
const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'dndj.sqlite');
const db = new Database(dbPath);

/**
 * initDb
 */
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      format TEXT NOT NULL,
      peaks TEXT,
      is_missing INTEGER DEFAULT 0
    );
  `);
}

// Run initialization
db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      format TEXT NOT NULL,
      peaks TEXT,
      is_missing INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS track_tags (
      track_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (track_id, tag_id),
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scene_tracks (
      scene_id INTEGER,
      track_id INTEGER,
      volume REAL DEFAULT 1.0,
      is_loop INTEGER DEFAULT 1,
      start_time REAL DEFAULT 0.0,
      end_time REAL,
      PRIMARY KEY (scene_id, track_id),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scene_tags (
      scene_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (scene_id, tag_id),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      parent_id   INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
      type        TEXT NOT NULL DEFAULT 'manual',
      rules_json  TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id    INTEGER NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, track_id)
    );

    CREATE TABLE IF NOT EXISTS cue_points (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id   INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
      position   REAL    NOT NULL,
      label      TEXT    NOT NULL DEFAULT '',
      color      TEXT    NOT NULL DEFAULT '#10b981'
    );
`);

/**
 * Migrations — always additive, never destructive
 */
const tracksInfo = db.prepare("PRAGMA table_info(tracks)").all();
if (!tracksInfo.some(col => col.name === 'peaks')) {
  db.exec("ALTER TABLE tracks ADD COLUMN peaks TEXT");
}
if (!tracksInfo.some(col => col.name === 'source')) {
  db.exec("ALTER TABLE tracks ADD COLUMN source TEXT NOT NULL DEFAULT 'local'");
}
if (!tracksInfo.some(col => col.name === 'source_url')) {
  db.exec("ALTER TABLE tracks ADD COLUMN source_url TEXT");
}
if (!tracksInfo.some(col => col.name === 'imported_at')) {
  db.exec("ALTER TABLE tracks ADD COLUMN imported_at DATETIME");
}
if (!tracksInfo.some(col => col.name === 'duration')) {
  db.exec("ALTER TABLE tracks ADD COLUMN duration REAL");
}

const tableInfo = db.prepare("PRAGMA table_info(scene_tracks)").all();
if (!tableInfo.some(col => col.name === 'start_time')) {
  db.exec("ALTER TABLE scene_tracks ADD COLUMN start_time REAL DEFAULT 0.0");
}
if (!tableInfo.some(col => col.name === 'end_time')) {
  db.exec("ALTER TABLE scene_tracks ADD COLUMN end_time REAL");
}

const scenesInfo = db.prepare("PRAGMA table_info(scenes)").all();
if (!scenesInfo.some(col => col.name === 'snapshot_json')) {
  db.exec("ALTER TABLE scenes ADD COLUMN snapshot_json TEXT");
}

// Category metadata (display name + color per folder name)
db.exec(`
  CREATE TABLE IF NOT EXISTS category_meta (
    folder_name TEXT PRIMARY KEY,
    display_name TEXT,
    color       TEXT NOT NULL DEFAULT '#6b7280'
  )
`);

// Sync deletion queue — file paths to delete on other machines at next pull
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_deletions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path  TEXT NOT NULL,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tag colors
const tagsInfo = db.prepare("PRAGMA table_info(tags)").all();
if (!tagsInfo.some(col => col.name === 'color')) {
  db.exec("ALTER TABLE tags ADD COLUMN color TEXT NOT NULL DEFAULT '#6b7280'");
}

// ─── Track Operations ────────────────────────────────────────────────────────

const upsertTrack = db.prepare(`
  INSERT INTO tracks (path, name, category, format, is_missing)
  VALUES (?, ?, ?, ?, 0)
  ON CONFLICT(path) DO UPDATE SET
    category = excluded.category,
    format = excluded.format,
    is_missing = 0
`);

const markAllMissing = db.prepare(`UPDATE tracks SET is_missing = 1`);

const updateTrackPeaks = db.prepare(`UPDATE tracks SET peaks = ? WHERE id = ?`);
const updateTrackDuration = db.prepare(`UPDATE tracks SET duration = ? WHERE id = ?`);

const updateTrackDisplayName = db.prepare(`
  UPDATE tracks 
  SET name = ? 
  WHERE id = ?
`);

const getTrackById = db.prepare(`SELECT * FROM tracks WHERE id = ?`);

const getAllTracks = db.prepare(`
  SELECT t.*, GROUP_CONCAT(tg.name) as tags
  FROM tracks t
  LEFT JOIN track_tags tt ON t.id = tt.track_id
  LEFT JOIN tags tg ON tt.tag_id = tg.id
  WHERE t.is_missing = 0
  GROUP BY t.id
`);

// ─── Tag Operations ──────────────────────────────────────────────────────────

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
const getTagByName = db.prepare(`SELECT id FROM tags WHERE name = ?`);
const linkTagToTrack = db.prepare(`INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)`);
const unlinkTagFromTrack = db.prepare(`DELETE FROM track_tags WHERE track_id = ? AND tag_id = ?`);
const getAllTags = db.prepare(`SELECT * FROM tags ORDER BY name ASC`);

// ─── Scene Operations ─────────────────────────────────────────────────────────

const insertScene = db.prepare(`INSERT INTO scenes (name, description) VALUES (?, ?)`);
const insertSceneSnapshot = db.prepare(`INSERT INTO scenes (name, snapshot_json) VALUES (?, ?)`);
const updateSceneSnapshot = db.prepare(`UPDATE scenes SET name = ?, snapshot_json = ? WHERE id = ?`);
const deleteScene = db.prepare(`DELETE FROM scenes WHERE id = ?`);
const insertSceneTrack = db.prepare(`
  INSERT OR REPLACE INTO scene_tracks (scene_id, track_id, volume, is_loop)
  VALUES (?, ?, ?, ?)
`);

const deleteSceneTrack = db.prepare(`
  DELETE FROM scene_tracks WHERE scene_id = ? AND track_id = ?
`);

const getAllScenes = db.prepare(`
  SELECT s.*, GROUP_CONCAT(tg.name) as tags
  FROM scenes s
  LEFT JOIN scene_tags st ON s.id = st.scene_id
  LEFT JOIN tags tg ON st.tag_id = tg.id
  GROUP BY s.id
`);

const getSceneTracks = db.prepare(`
  SELECT st.*, t.path, t.name, t.format, t.peaks, t.category, GROUP_CONCAT(tg.name) as tags
  FROM scene_tracks st
  JOIN tracks t ON st.track_id = t.id
  LEFT JOIN track_tags tt ON t.id = tt.track_id
  LEFT JOIN tags tg ON tt.tag_id = tg.id
  WHERE st.scene_id = ?
  GROUP BY st.track_id
`);

const updateSceneTrackSettings = db.prepare(`
  UPDATE scene_tracks
  SET volume = ?, is_loop = ?, start_time = ?, end_time = ?
  WHERE scene_id = ? AND track_id = ?
`);

// ─── Settings Operations ──────────────────────────────────────────────────────

const getSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
const setSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);

// ─── Playlist Operations ──────────────────────────────────────────────────────

const getAllPlaylists = db.prepare(`
  SELECT * FROM playlists ORDER BY parent_id ASC, sort_order ASC, name ASC
`);

const getPlaylistById = db.prepare(`SELECT * FROM playlists WHERE id = ?`);

const insertPlaylist = db.prepare(`
  INSERT INTO playlists (name, parent_id, type, rules_json, sort_order)
  VALUES (?, ?, ?, ?, ?)
`);

const updatePlaylist = db.prepare(`
  UPDATE playlists SET name = ?, parent_id = ?, rules_json = ?, sort_order = ?
  WHERE id = ?
`);

const deletePlaylist = db.prepare(`DELETE FROM playlists WHERE id = ?`);

const getPlaylistTracks = db.prepare(`
  SELECT t.*, pt.sort_order as playlist_sort_order, GROUP_CONCAT(tg.name) as tags
  FROM playlist_tracks pt
  JOIN tracks t ON pt.track_id = t.id
  LEFT JOIN track_tags tt ON t.id = tt.track_id
  LEFT JOIN tags tg ON tt.tag_id = tg.id
  WHERE pt.playlist_id = ? AND t.is_missing = 0
  GROUP BY t.id
  ORDER BY pt.sort_order ASC
`);

const insertPlaylistTrack = db.prepare(`
  INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, sort_order)
  VALUES (?, ?, ?)
`);

const deletePlaylistTrack = db.prepare(`
  DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?
`);

const updatePlaylistTrackOrder = db.prepare(`
  UPDATE playlist_tracks SET sort_order = ? WHERE playlist_id = ? AND track_id = ?
`);

const getMaxPlaylistTrackOrder = db.prepare(`
  SELECT COALESCE(MAX(sort_order), -1) as max_order FROM playlist_tracks WHERE playlist_id = ?
`);

// ─── Cue Point Operations ─────────────────────────────────────────────────────

const getCuePoints = db.prepare(`
  SELECT * FROM cue_points WHERE track_id = ? ORDER BY position ASC
`);

const insertCuePoint = db.prepare(`
  INSERT INTO cue_points (track_id, position, label, color) VALUES (?, ?, ?, ?)
`);

const updateCuePoint = db.prepare(`
  UPDATE cue_points SET position = ?, label = ?, color = ? WHERE id = ?
`);

const deleteCuePoint = db.prepare(`DELETE FROM cue_points WHERE id = ?`);

// ─── Category Meta Operations ─────────────────────────────────────────────────

const getAllCategoryMeta = db.prepare(`SELECT * FROM category_meta ORDER BY folder_name ASC`);
const upsertCategoryMeta = db.prepare(`
  INSERT INTO category_meta (folder_name, display_name, color) VALUES (?, ?, ?)
  ON CONFLICT(folder_name) DO UPDATE SET display_name = excluded.display_name, color = excluded.color
`);
const deleteCategoryMeta = db.prepare(`DELETE FROM category_meta WHERE folder_name = ?`);

// ─── Track Delete ─────────────────────────────────────────────────────────────

const deleteTrack = db.prepare(`DELETE FROM tracks WHERE id = ?`);
const insertSyncDeletion = db.prepare(`INSERT INTO sync_deletions (file_path) VALUES (?)`);
const getAllSyncDeletions = db.prepare(`SELECT file_path FROM sync_deletions`);
const clearSyncDeletions = db.prepare(`DELETE FROM sync_deletions`);

// ─── Tag Management Operations ────────────────────────────────────────────────

const updateTag = db.prepare(`UPDATE tags SET name = ?, color = ? WHERE id = ?`);
const deleteTag = db.prepare(`DELETE FROM tags WHERE id = ?`);

module.exports = {
  db,
  initDb,
  upsertTrack,
  markAllMissing,
  getAllTracks,
  getTrackById,
  updateTrackPeaks,
  updateTrackDuration,
  updateTrackDisplayName,
  insertTag,
  getTagByName,
  linkTagToTrack,
  unlinkTagFromTrack,
  getAllTags,
  insertScene,
  insertSceneSnapshot,
  updateSceneSnapshot,
  deleteScene,
  insertSceneTrack,
  deleteSceneTrack,
  getAllScenes,
  getSceneTracks,
  updateSceneTrackSettings,
  getSetting,
  setSetting,
  // Playlists
  getAllPlaylists,
  getPlaylistById,
  insertPlaylist,
  updatePlaylist,
  deletePlaylist,
  getPlaylistTracks,
  insertPlaylistTrack,
  deletePlaylistTrack,
  updatePlaylistTrackOrder,
  getMaxPlaylistTrackOrder,
  // Cue Points
  getCuePoints,
  insertCuePoint,
  updateCuePoint,
  deleteCuePoint,
  // Category Meta
  getAllCategoryMeta,
  upsertCategoryMeta,
  deleteCategoryMeta,
  // Track Delete
  deleteTrack,
  insertSyncDeletion,
  getAllSyncDeletions,
  clearSyncDeletions,
  // Tag Management
  updateTag,
  deleteTag,
};
