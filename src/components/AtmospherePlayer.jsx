// AtmospherePlayer.jsx — Looping Atmosphere Track Player
// Displays tracks from all non-sfx categories.
// Each track can be played/stopped independently (layering is supported).
// Includes per-track volume sliders and a crossfade action.

import React, { useState, useCallback } from 'react';
import TrackCard from './TrackCard.jsx';
import { playTrack, stopTrack, setTrackVolume, crossfade, isPlaying } from '../audioEngine.js';
import '../styles/atmosphere.css';

// The SFX category is handled by Soundboard.jsx — exclude it here
const SFX_CATEGORY = 'sfx';

/**
 * AtmospherePlayer
 *
 * Props:
 *   library  {{ [category: string]: Array<{ name: string, path: string }> }}
 *            - The full sound library from IPC scan
 *   category {string} - Currently selected category key
 *   getUrl   {function(path): Promise<string>} - Resolves a file path to an app:// URL
 */
function AtmospherePlayer({ library, category, getUrl }) {
  // Track which URLs are currently playing: Set<string>
  const [playingUrls, setPlayingUrls] = useState(new Set());

  // Per-track volume: { [url]: number (0..1) }
  const [volumes, setVolumes] = useState({});

  // Cache of resolved URLs: { [filePath]: url }
  const [urlCache, setUrlCache] = useState({});

  /**
   * resolveUrl
   * Converts a file path to an app:// URL, using the local cache to avoid
   * repeated IPC calls for the same file.
   */
  const resolveUrl = useCallback(async (filePath) => {
    if (urlCache[filePath]) return urlCache[filePath];
    const resolvedUrl = await getUrl(filePath);
    setUrlCache((prev) => ({ ...prev, [filePath]: resolvedUrl }));
    return resolvedUrl;
  }, [urlCache, getUrl]);

  /**
   * handleToggle
   * Plays or stops a track when its button is clicked.
   * If the track is currently stopped, start it (looping, at its stored volume).
   * If it's playing, stop it.
   */
  const handleToggle = useCallback(async (track) => {
    const audioUrl = await resolveUrl(track.path);
    const vol = volumes[audioUrl] ?? 1;

    if (isPlaying(audioUrl)) {
      stopTrack(audioUrl);
      setPlayingUrls((prev) => {
        const next = new Set(prev);
        next.delete(audioUrl);
        return next;
      });
    } else {
      playTrack(audioUrl, true, vol);
      setPlayingUrls((prev) => new Set([...prev, audioUrl]));
    }
  }, [resolveUrl, volumes]);

  /**
   * handleVolume
   * Adjusts the volume of a specific track and persists it in local state.
   */
  const handleVolume = useCallback(async (track, newVolume) => {
    const audioUrl = await resolveUrl(track.path);
    setVolumes((prev) => ({ ...prev, [audioUrl]: newVolume }));
    setTrackVolume(audioUrl, newVolume);
  }, [resolveUrl]);

  /**
   * handleCrossfade
   * Crossfades from the first playing track in this category to the clicked track.
   * If no track is currently playing, just starts the track normally.
   */
  const handleCrossfade = useCallback(async (toTrack) => {
    const toUrl = await resolveUrl(toTrack.path);
    const targetVol = volumes[toUrl] ?? 1;

    // Find the first currently-playing URL to fade out
    const playingInCategory = tracks
      .map((t) => urlCache[t.path])
      .filter(Boolean)
      .find((u) => isPlaying(u) && u !== toUrl);

    if (playingInCategory) {
      crossfade(playingInCategory, toUrl, 2000, targetVol);
      setPlayingUrls((prev) => {
        const next = new Set(prev);
        next.delete(playingInCategory);
        next.add(toUrl);
        return next;
      });
    } else {
      // No track playing — just start the new one
      playTrack(toUrl, true, targetVol);
      setPlayingUrls((prev) => new Set([...prev, toUrl]));
    }
  }, [resolveUrl, volumes, urlCache]);

  // Don't render for the SFX category — that's the Soundboard's job
  if (category === SFX_CATEGORY) return null;

  const tracks = library[category] ?? [];

  if (tracks.length === 0) {
    return (
      <div className="atmosphere-player">
        <p className="atmosphere-player__empty">
          No tracks found. Drop MP3 files into <code>sounds/{category}/</code> and restart.
        </p>
      </div>
    );
  }

  return (
    <div className="atmosphere-player">
      <div className="atmosphere-player__track-list">
        {tracks.map((track) => {
          const cachedUrl = urlCache[track.path];
          const playing = cachedUrl ? playingUrls.has(cachedUrl) : false;
          const vol = cachedUrl ? (volumes[cachedUrl] ?? 1) : 1;

          return (
            <TrackCard
              key={track.path}
              name={track.name}
              isPlaying={playing}
              showVolume
              volume={vol}
              isLoop
              onToggle={() => handleToggle(track)}
              onVolume={(v) => handleVolume(track, v)}
            />
          );
        })}
      </div>

      {/* Crossfade helper — only useful when multiple tracks exist */}
      {tracks.length > 1 && (
        <div className="atmosphere-player__crossfade-hint">
          <p>Tip: Use crossfade to smoothly transition between tracks.</p>
          <div className="atmosphere-player__crossfade-buttons">
            {tracks.map((track) => (
              <button
                key={track.path}
                className="atmosphere-player__crossfade-btn"
                onClick={() => handleCrossfade(track)}
                title={`Crossfade to ${track.name}`}
              >
                ⇄ {track.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AtmospherePlayer;
