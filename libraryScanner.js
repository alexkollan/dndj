'use strict';

// libraryScanner.js — Sound Library Scanner
// Recursively scans the /sounds directory and returns a categorised list of
// MP3 files. Each top-level subdirectory becomes a category (e.g. "combat").
// This module is called by main.js in response to the 'scan-library' IPC event.

const fs = require('fs');
const path = require('path');

// Only these audio file extensions will be included.
const SUPPORTED_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.webm'];

/**
 * scanLibrary
 * Scans the given root directory for audio files, one level deep.
 * Each subdirectory becomes a category key.
 *
 * @param {string} soundsDir - Absolute path to the /sounds folder.
 * @returns {{ [category: string]: Array<{ name: string, path: string }> }}
 *   An object mapping category names to arrays of track objects.
 *   Example: { combat: [{ name: 'Battle Theme', path: '/abs/path/to/file.mp3' }] }
 */
function scanLibrary(soundsDir) {
  const library = {};

  // Guard: if the /sounds folder doesn't exist yet, return an empty library
  // rather than crashing. The user can create the folder and restart.
  if (!fs.existsSync(soundsDir)) {
    console.warn(`[libraryScanner] Sounds directory not found: ${soundsDir}`);
    return library;
  }

  // Read all entries directly inside /sounds
  const topLevelEntries = fs.readdirSync(soundsDir, { withFileTypes: true });

  topLevelEntries.forEach((entry) => {
    // Only process directories — files at the root level are ignored
    if (!entry.isDirectory()) return;

    const categoryName = entry.name;               // e.g. "combat"
    const categoryPath = path.join(soundsDir, categoryName);
    const tracks = [];

    // Read all files inside this category directory
    const files = fs.readdirSync(categoryPath, { withFileTypes: true });

    files.forEach((file) => {
      // Skip nested directories — only process flat files for simplicity
      if (!file.isFile()) return;

      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

      const filePath = path.join(categoryPath, file.name);
      const trackName = cleanTrackName(file.name);
      const format = ext.slice(1); // "mp3", "ogg", etc.

      tracks.push({ name: trackName, path: filePath, format });
    });

    // Always include the category, even if it has no tracks yet
    library[categoryName] = tracks;
  });

  return library;
}

/**
 * cleanTrackName
 * Strips the file extension and converts underscores/hyphens to spaces,
 * then title-cases the result so "dark_cave_ambience.mp3" → "Dark Cave Ambience".
 *
 * @param {string} filename - Raw filename, e.g. "dark_cave_ambience.mp3"
 * @returns {string} Human-readable track name
 */
function cleanTrackName(filename) {
  const withoutExt = path.basename(filename, path.extname(filename));
  const withSpaces = withoutExt.replace(/[_-]/g, ' ');
  // Title-case: capitalise first letter of each word
  return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { scanLibrary };
