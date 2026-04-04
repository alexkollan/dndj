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
`);

/**
 * Migration
 */
const tracksInfo = db.prepare("PRAGMA table_info(tracks)").all();
if (!tracksInfo.some(col => col.name === 'peaks')) {
  db.exec("ALTER TABLE tracks ADD COLUMN peaks TEXT");
}

const tableInfo = db.prepare("PRAGMA table_info(scene_tracks)").all();
if (!tableInfo.some(col => col.name === 'start_time')) {
  db.exec("ALTER TABLE scene_tracks ADD COLUMN start_time REAL DEFAULT 0.0");
}
if (!tableInfo.some(col => col.name === 'end_time')) {
  db.exec("ALTER TABLE scene_tracks ADD COLUMN end_time REAL");
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

module.exports = {
  db,
  initDb,
  upsertTrack,
  markAllMissing,
  getAllTracks,
  getTrackById,
  updateTrackPeaks,
  updateTrackDisplayName,
  insertTag,
  getTagByName,
  linkTagToTrack,
  unlinkTagFromTrack,
  getAllTags,
  insertScene,
  insertSceneTrack,
  deleteSceneTrack,
  getAllScenes,
  getSceneTracks,
  updateSceneTrackSettings,
  getSetting,
  setSetting,
};
