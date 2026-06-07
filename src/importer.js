'use strict';

// importer.js — bring external audio into the library.
//
// Two-phase: the caller "stages" a selection (files / a folder / a .zip) into a
// flat list of discovered audio files, the renderer maps each to a category, and
// then "commit" copies the files into sounds/<category>/ and inserts track rows.
//
// Pure helpers here; the Electron dialogs and the staging map live in main.js.

const fs = require('fs');
const path = require('path');

const AUDIO_EXTS = ['.mp3', '.ogg', '.wav', '.webm', '.m4a', '.aac', '.flac', '.opus'];

// Recursively collect audio files under `root`.
function walkAudio(root) {
  const out = [];
  (function rec(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) rec(abs);
      else if (AUDIO_EXTS.includes(path.extname(entry.name).toLowerCase())) out.push(abs);
    }
  })(root);
  return out;
}

// "dragon_roar-02.mp3" → "Dragon Roar 02"
function cleanName(filename) {
  const base = path.basename(filename, path.extname(filename));
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
}

// Turn a display name into a filesystem-safe file name with the given extension.
function safeFileName(name, ext) {
  const base = String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 120) || 'track';
  return `${base}.${ext}`;
}

// Turn arbitrary text into a category folder slug.
function slugCategory(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
}

// Copy staged files into the library and insert/refresh track rows.
//   sources:       [{ id, absPath, filename, folder }]
//   mappings:      [{ id, category, name, tags:[] }]   (only items to import)
//   newCategories: [{ folder, displayName, color }]    (categories to create)
// Returns { imported, skipped }.
function commitImport({ db, soundsDir, sources, mappings, newCategories }) {
  const srcById = new Map(sources.map(s => [s.id, s]));

  for (const c of (newCategories || [])) {
    const folder = slugCategory(c.folder);
    if (!folder) continue;
    const dir = path.join(soundsDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db.prepare(`
      INSERT INTO category_meta (folder_name, display_name, color) VALUES (?, ?, ?)
      ON CONFLICT(folder_name) DO UPDATE SET display_name = excluded.display_name, color = excluded.color
    `).run(folder, c.displayName || folder, c.color || '#6b7280');
  }

  let imported = 0, skipped = 0;
  for (const m of (mappings || [])) {
    const src = srcById.get(m.id);
    const category = slugCategory(m.category);
    if (!src || !category || !fs.existsSync(src.absPath)) { skipped++; continue; }

    const dir = path.join(soundsDir, category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(src.filename).slice(1).toLowerCase();
    const displayName = (m.name && m.name.trim()) || cleanName(src.filename);

    let fileName = safeFileName(displayName, ext);
    let destAbs = path.join(dir, fileName);
    if (fs.existsSync(destAbs)) {
      fileName = `${fileName.replace(/\.[^.]+$/, '')}_${Date.now()}.${ext}`;
      destAbs = path.join(dir, fileName);
    }

    try { fs.copyFileSync(src.absPath, destAbs); }
    catch { skipped++; continue; }

    const relPath = `${category}/${fileName}`;
    const existing = db.prepare('SELECT id FROM tracks WHERE path = ?').get(relPath);
    let trackId;
    if (existing) {
      db.prepare('UPDATE tracks SET name = ?, category = ?, format = ?, is_missing = 0 WHERE id = ?')
        .run(displayName, category, ext, existing.id);
      trackId = existing.id;
    } else {
      const r = db.prepare(`
        INSERT INTO tracks (path, name, category, format, is_missing, source, imported_at)
        VALUES (?, ?, ?, ?, 0, 'local', CURRENT_TIMESTAMP)
      `).run(relPath, displayName, category, ext);
      trackId = r.lastInsertRowid;
    }

    for (const tag of (m.tags || [])) {
      const t = String(tag).trim();
      if (!t) continue;
      db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)').run(t, '#6b7280');
      const row = db.prepare('SELECT id FROM tags WHERE name = ?').get(t);
      if (row) db.prepare('INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)').run(trackId, row.id);
    }
    imported++;
  }

  return { imported, skipped };
}

module.exports = { walkAudio, cleanName, slugCategory, commitImport, AUDIO_EXTS };
