// Soundboard.jsx — SFX Button Grid
// Renders a grid of one-shot sound effect buttons from the /sounds/sfx/ folder.
// Multiple SFX can overlap (no deduplication) — each click fires a new playback.
// Button labels use the cleaned filename (underscores → spaces, no extension).

import React, { useState, useCallback } from 'react';
import { playTrack } from '../audioEngine.js';
import '../styles/soundboard.css';

// The category key that contains short one-shot sound effects
const SFX_CATEGORY = 'sfx';

/**
 * Soundboard
 *
 * Props:
 *   library {object} - Full sound library from IPC scan
 *   getUrl  {function(path): Promise<string>} - Resolves a file path to an app:// URL
 */
function Soundboard({ library, getUrl }) {
  // Cache of resolved URLs to avoid repeated IPC round-trips: { [filePath]: url }
  const [urlCache, setUrlCache] = useState({});

  // Tracks which buttons have been triggered (for visual flash feedback): Set<path>
  const [activePaths, setActivePaths] = useState(new Set());

  /**
   * resolveUrl
   * Returns a cached app:// URL for the given file path, fetching via IPC if needed.
   */
  const resolveUrl = useCallback(async (filePath) => {
    if (urlCache[filePath]) return urlCache[filePath];
    const resolvedUrl = await getUrl(filePath);
    setUrlCache((prev) => ({ ...prev, [filePath]: resolvedUrl }));
    return resolvedUrl;
  }, [urlCache, getUrl]);

  /**
   * handleSfxClick
   * Plays the SFX once (no looping). Multiple clicks stack.
   * A brief "active" CSS state is applied for visual feedback.
   */
  const handleSfxClick = useCallback(async (track) => {
    const audioUrl = await resolveUrl(track.path);
    // Play one-shot (loop: false, volume: 1)
    playTrack(audioUrl, false, 1);

    // Visual feedback: mark button active for 300 ms
    setActivePaths((prev) => new Set([...prev, track.path]));
    setTimeout(() => {
      setActivePaths((prev) => {
        const next = new Set(prev);
        next.delete(track.path);
        return next;
      });
    }, 300);
  }, [resolveUrl]);

  const sfxTracks = library[SFX_CATEGORY] ?? [];

  if (sfxTracks.length === 0) {
    return (
      <div className="soundboard">
        <p className="soundboard__empty">
          No SFX found. Drop MP3 files into <code>sounds/sfx/</code> and restart.
        </p>
      </div>
    );
  }

  return (
    <div className="soundboard">
      <div className="soundboard__grid">
        {sfxTracks.map((track) => (
          <button
            key={track.path}
            className={`soundboard__button${activePaths.has(track.path) ? ' soundboard__button--active' : ''}`}
            onClick={() => handleSfxClick(track)}
            title={track.name}
            aria-label={`Play ${track.name}`}
          >
            {track.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Soundboard;
