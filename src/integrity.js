'use strict';

// integrity.js — Database ↔ filesystem consistency.
//
// The app stores tracks by relative path. If a file (or a whole category folder)
// is removed from disk by hand, the DB still references it. These helpers detect
// that drift, report exactly what is missing and where it was linked, and clean
// the database so it once again matches reality.
//
// All functions receive the LIVE dbManager.db (the raw better-sqlite3 handle) so
// they keep working after the DB is hot-swapped by a sync pull.

const fs = require('fs');
const path = require('path');

function folderExists(soundsDir, category) {
  return fs.existsSync(path.join(soundsDir, category));
}

function fileExists(soundsDir, relPath) {
  return fs.existsSync(path.join(soundsDir, ...relPath.split('/')));
}

// Build a map of track-path → Set(scene names) from Studio scene snapshots.
// Scenes reference tracks by path inside snapshot_json (decks A/B/C + sampler).
function buildSceneRefs(db) {
  const scenes = db.prepare('SELECT name, snapshot_json FROM scenes WHERE snapshot_json IS NOT NULL').all();
  const byPath = new Map();
  for (const s of scenes) {
    let snap;
    try { snap = JSON.parse(s.snapshot_json); } catch { continue; }
    const paths = [];
    for (const k of ['deckA', 'deckB', 'deckC']) if (snap[k]?.path) paths.push(snap[k].path);
    if (Array.isArray(snap.samplerPads)) for (const p of snap.samplerPads) if (p?.path) paths.push(p.path);
    for (const p of paths) {
      if (!byPath.has(p)) byPath.set(p, new Set());
      byPath.get(p).add(s.name);
    }
  }
  return byPath;
}

// Where is this track referenced? Used to explain a missing track to the user.
function linksForTrack(db, track, sceneRefs) {
  const playlistRows = db.prepare(`
    SELECT p.name, p.type
    FROM playlist_tracks pt
    JOIN playlists p ON pt.playlist_id = p.id
    WHERE pt.track_id = ?
  `).all(track.id);
  const tags = db.prepare(`
    SELECT tg.name FROM track_tags tt
    JOIN tags tg ON tt.tag_id = tg.id
    WHERE tt.track_id = ?
  `).all(track.id).map(r => r.name);
  const cuePoints = db.prepare('SELECT COUNT(*) AS n FROM cue_points WHERE track_id = ?').get(track.id).n;

  return {
    playlists: playlistRows.filter(p => p.type !== 'folder').map(p => p.name),
    folders:   playlistRows.filter(p => p.type === 'folder').map(p => p.name),
    scenes:    [...(sceneRefs.get(track.path) || [])],
    tags,
    cuePoints,
  };
}

// Compare the DB against disk. READ-ONLY — never mutates anything.
// Returns { ok, missingCategories, missingTracks, scannedAt }.
function checkIntegrity({ db, soundsDir }) {
  const allTracks = db.prepare('SELECT id, name, path, category FROM tracks').all();
  const sceneRefs = buildSceneRefs(db);

  // Every category the DB knows about (from tracks + category_meta).
  const catSet = new Set();
  for (const t of allTracks) if (t.category) catSet.add(t.category);
  for (const m of db.prepare('SELECT folder_name FROM category_meta').all()) catSet.add(m.folder_name);

  // A category is "missing" when its folder no longer exists on disk.
  const missingCategories = [];
  const missingCatSet = new Set();
  for (const cat of catSet) {
    if (!cat || folderExists(soundsDir, cat)) continue;
    const tracksIn = allTracks.filter(t => t.category === cat);
    const meta = db.prepare('SELECT display_name FROM category_meta WHERE folder_name = ?').get(cat);
    missingCategories.push({
      folder: cat,
      displayName: meta?.display_name || cat,
      trackCount: tracksIn.length,
      tracks: tracksIn.map(t => ({ id: t.id, name: t.name, path: t.path })),
    });
    missingCatSet.add(cat);
  }

  // Individual tracks whose category folder still exists but whose file is gone.
  // Tracks inside a missing category are reported under the category instead.
  const missingTracks = [];
  for (const t of allTracks) {
    if (missingCatSet.has(t.category)) continue;
    if (!fileExists(soundsDir, t.path)) {
      missingTracks.push({
        id: t.id, name: t.name, path: t.path, category: t.category,
        links: linksForTrack(db, t, sceneRefs),
      });
    }
  }

  return {
    ok: missingCategories.length === 0 && missingTracks.length === 0,
    missingCategories,
    missingTracks,
    scannedAt: Date.now(),
  };
}

// Remove a track from every table that references it, then the track itself.
// Explicit deletes make this correct regardless of whether FK enforcement is on.
function deleteTrackEverywhere(db, trackId) {
  db.prepare('DELETE FROM playlist_tracks WHERE track_id = ?').run(trackId);
  db.prepare('DELETE FROM scene_tracks   WHERE track_id = ?').run(trackId);
  db.prepare('DELETE FROM track_tags     WHERE track_id = ?').run(trackId);
  db.prepare('DELETE FROM cue_points     WHERE track_id = ?').run(trackId);
  db.prepare('DELETE FROM tracks         WHERE id = ?').run(trackId);
}

// Strip references to removed track paths out of scene snapshots.
function scrubSnapshots(db, removedPaths) {
  if (!removedPaths.length) return;
  const set = new Set(removedPaths);
  const scenes = db.prepare('SELECT id, snapshot_json FROM scenes WHERE snapshot_json IS NOT NULL').all();
  for (const s of scenes) {
    let snap;
    try { snap = JSON.parse(s.snapshot_json); } catch { continue; }
    let changed = false;
    for (const k of ['deckA', 'deckB', 'deckC']) {
      if (snap[k]?.path && set.has(snap[k].path)) { snap[k] = null; changed = true; }
    }
    if (Array.isArray(snap.samplerPads)) {
      const next = snap.samplerPads.map(p => (p?.path && set.has(p.path)) ? null : p);
      if (next.some((p, i) => p !== snap.samplerPads[i])) { snap.samplerPads = next; changed = true; }
    }
    if (changed) db.prepare('UPDATE scenes SET snapshot_json = ? WHERE id = ?').run(JSON.stringify(snap), s.id);
  }
}

// Delete everything reported as missing, in a single transaction.
// Returns a summary of what was removed.
function cleanupIntegrity({ db, soundsDir }) {
  const report = checkIntegrity({ db, soundsDir });
  const removedPaths = [];

  const run = db.transaction(() => {
    for (const cat of report.missingCategories) {
      for (const t of cat.tracks) { deleteTrackEverywhere(db, t.id); removedPaths.push(t.path); }
      db.prepare('DELETE FROM category_meta WHERE folder_name = ?').run(cat.folder);
    }
    for (const t of report.missingTracks) { deleteTrackEverywhere(db, t.id); removedPaths.push(t.path); }
    scrubSnapshots(db, removedPaths);
  });
  run();

  return {
    removedTracks: removedPaths.length,
    removedCategories: report.missingCategories.length,
  };
}

// Update any scene snapshots that referenced a track's old path after a rename.
function renameInSnapshots(db, oldPath, newPath) {
  const scenes = db.prepare('SELECT id, snapshot_json FROM scenes WHERE snapshot_json IS NOT NULL').all();
  for (const s of scenes) {
    let snap;
    try { snap = JSON.parse(s.snapshot_json); } catch { continue; }
    let changed = false;
    for (const k of ['deckA', 'deckB', 'deckC']) {
      if (snap[k]?.path === oldPath) { snap[k].path = newPath; changed = true; }
    }
    if (Array.isArray(snap.samplerPads)) {
      for (const p of snap.samplerPads) if (p?.path === oldPath) { p.path = newPath; changed = true; }
    }
    if (changed) db.prepare('UPDATE scenes SET snapshot_json = ? WHERE id = ?').run(JSON.stringify(snap), s.id);
  }
}

module.exports = { checkIntegrity, cleanupIntegrity, renameInSnapshots };
