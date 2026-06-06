'use strict';

// libraryScanner.js — Sound Library Scanner
const fs = require('fs');
const path = require('path');

const SUPPORTED_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.webm', '.m4a', '.aac', '.flac', '.opus'];

/**
 * scanLibrary
 * Scans the /sounds directory.
 * PORTABILITY: Stores paths RELATIVE to the sounds directory.
 */
function scanLibrary(soundsDir, dbOps) {
  if (dbOps && dbOps.markAllMissing) {
    dbOps.markAllMissing.run();
  }

  if (!fs.existsSync(soundsDir)) {
    console.warn(`[libraryScanner] Sounds directory not found: ${soundsDir}`);
    return;
  }

  const topLevelEntries = fs.readdirSync(soundsDir, { withFileTypes: true });

  topLevelEntries.forEach((entry) => {
    if (!entry.isDirectory()) return;

    const categoryName = entry.name;
    const categoryPath = path.join(soundsDir, categoryName);

    const files = fs.readdirSync(categoryPath, { withFileTypes: true });

    files.forEach((file) => {
      if (!file.isFile()) return;

      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

      // Calculate relative path (e.g., "atmosphere/wind.mp3")
      // We use forward slashes for the DB to ensure Mac compatibility
      const relativePath = `${categoryName}/${file.name}`;
      
      const trackName = cleanTrackName(file.name);
      const format = ext.slice(1);

      if (dbOps && dbOps.upsertTrack) {
        dbOps.upsertTrack.run(relativePath, trackName, categoryName, format);
      }
    });
  });
}

function cleanTrackName(filename) {
  const withoutExt = path.basename(filename, path.extname(filename));
  const withSpaces = withoutExt.replace(/[_-]/g, ' ');
  return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { scanLibrary };
