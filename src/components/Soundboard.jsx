// Soundboard.jsx — SFX Button Grid
// Renders a grid of one-shot sound effect buttons from the /sounds/sfx/ folder.
// Multiple SFX can overlap (no deduplication) — each click fires a new playback.
// Button labels use the cleaned filename (underscores → spaces, no extension).

import React, { useState, useCallback } from 'react';
import { playTrack, stopTrack } from '../audioEngine.js';
import '../styles/soundboard.css';

// The category key that contains short one-shot sound effects
const SFX_CATEGORY = 'sfx';

/**
 * Soundboard
 *
 * Props:
 *   library {object} - Full sound library from IPC scan
 *   resolveUrl {function(path): Promise<string>} - Resolves a file path to an app:// URL
 *   urlCache   {object} - Shared cache of resolved URLs
 *   playingUrls {Set<string>} - Current playing URLs
 *   onPlayingUrlsChange {function(Set)} - Setter for playingUrls
 */
function Soundboard({ library, resolveUrl, urlCache, playingUrls, onPlayingUrlsChange }) {
  // Tracks which URLs are showing a "stopping" (red border) state
  const [stoppingUrls, setStoppingUrls] = useState(new Set());

  /**
   * handleSfxClick
   * Plays the SFX if stopped, or stops it if already playing.
   * Provides visual feedback via green (playing) and red (stopping) borders.
   */
  const handleSfxClick = useCallback(async (track) => {
    const audioUrl = await resolveUrl(track.path);
    const isCurrentlyPlaying = playingUrls.has(audioUrl);

    if (isCurrentlyPlaying) {
      // ── Stop Logic ──
      stopTrack(audioUrl);
      
      // Remove from playing set
      onPlayingUrlsChange((prev) => {
        const next = new Set(prev);
        next.delete(audioUrl);
        return next;
      });

      // Show red border briefly
      setStoppingUrls((prev) => new Set([...prev, audioUrl]));
      setTimeout(() => {
        setStoppingUrls((prev) => {
          const next = new Set(prev);
          next.delete(audioUrl);
          return next;
        });
      }, 500);

    } else {
      // ── Play Logic ──
      // Add to playing set
      onPlayingUrlsChange((prev) => new Set([...prev, audioUrl]));

      // Play once (loop: false)
      playTrack(audioUrl, false, 1, track.format, () => {
        // Callback: when sound naturally ends, remove from playing set
        onPlayingUrlsChange((prev) => {
          const next = new Set(prev);
          next.delete(audioUrl);
          return next;
        });
      });
    }
  }, [resolveUrl, playingUrls, onPlayingUrlsChange]);

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
        {sfxTracks.map((track) => {
          const audioUrl = urlCache[track.path];
          const isPlaying = audioUrl ? playingUrls.has(audioUrl) : false;
          const isStopping = audioUrl ? stoppingUrls.has(audioUrl) : false;

          return (
            <button
              key={track.path}
              className={`soundboard__button ${
                isPlaying ? 'soundboard__button--playing' : ''
              } ${isStopping ? 'soundboard__button--stopping' : ''}`}
              onClick={() => handleSfxClick(track)}
              title={track.name}
              aria-label={`Toggle ${track.name}`}
            >
              {track.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Soundboard;
