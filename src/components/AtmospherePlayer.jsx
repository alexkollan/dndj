// AtmospherePlayer.jsx — Looping Atmosphere Track Player
// Displays tracks from all non-sfx categories.
// Each track can be played/stopped independently (layering is supported).
// Includes per-track volume sliders and a crossfade action.

import React, { useState, useCallback, useEffect } from 'react';
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
 *   resolveUrl {function(path): Promise<string>} - Resolves a file path to an app:// URL
 *   urlCache   {object} - Shared cache of resolved URLs
 *   playingUrls {Set<string>} - Current playing URLs (from App.jsx)
 *   onPlayingUrlsChange {function(Set)} - Setter for playingUrls
 *   categorySettings {object} - { volume, eq } for this category
 */
function AtmospherePlayer({ library, category, resolveUrl, urlCache, playingUrls, onPlayingUrlsChange, categorySettings }) {
  // Per-track volume: { [url]: number (0..1) }
  const [volumes, setVolumes] = useState({});

  const catVol = categorySettings?.volume ?? 1;

  // ── Update active tracks when category volume changes ─────────────────────
  useEffect(() => {
    playingUrls.forEach((url) => {
      // Find if this URL belongs to the current category
      const trackInCat = (library[category] || []).find(t => urlCache[t.path] === url);
      if (trackInCat) {
        const trackVol = volumes[url] ?? 1;
        setTrackVolume(url, trackVol * catVol);
      }
    });
  }, [catVol, category, library, urlCache, playingUrls, volumes]);

  /**
   * handleToggle
   * Plays or stops a track when its button is clicked.
   * Relies on the local playingUrls state to determine intent, ensuring
   * that sounds can be stopped even while they are still loading.
   */
  const handleToggle = useCallback(async (track) => {
    const audioUrl = await resolveUrl(track.path);
    const trackVol = volumes[audioUrl] ?? 1;
    const isCurrentlyPlaying = playingUrls.has(audioUrl);

    if (isCurrentlyPlaying) {
      stopTrack(audioUrl);
      onPlayingUrlsChange((prev) => {
        const next = new Set(prev);
        next.delete(audioUrl);
        return next;
      });
    } else {
      // Factoring in category volume
      playTrack(audioUrl, true, trackVol * catVol, track.format);
      onPlayingUrlsChange((prev) => new Set([...prev, audioUrl]));
    }
  }, [resolveUrl, volumes, playingUrls, onPlayingUrlsChange, catVol]);

  /**
   * handleVolume
   * Adjusts the volume of a specific track and persists it in local state.
   */
  const handleVolume = useCallback(async (track, newVolume) => {
    const audioUrl = await resolveUrl(track.path);
    setVolumes((prev) => ({ ...prev, [audioUrl]: newVolume }));
    setTrackVolume(audioUrl, newVolume * catVol);
  }, [resolveUrl, catVol]);

  /**
   * handleCrossfade
   * Crossfades from the first playing track in this category to the clicked track.
   * If no track is currently playing, just starts the track normally.
   */
  const handleCrossfade = useCallback(async (toTrack) => {
    const toUrl = await resolveUrl(toTrack.path);
    const targetTrackVol = volumes[toUrl] ?? 1;
    const targetVol = targetTrackVol * catVol;

    // Current tracks in this category
    const categoryTracks = library[category] ?? [];

    // Find the first currently-playing URL in this category to fade out
    const playingInCategory = categoryTracks
      .map((t) => urlCache[t.path])
      .filter(Boolean)
      .find((u) => playingUrls.has(u) && u !== toUrl);

    if (playingInCategory) {
      crossfade(playingInCategory, toUrl, 2000, targetVol);
      onPlayingUrlsChange((prev) => {
        const next = new Set(prev);
        next.delete(playingInCategory);
        next.add(toUrl);
        return next;
      });
    } else {
      // No track playing — just start the new one
      playTrack(toUrl, true, targetVol, toTrack.format);
      onPlayingUrlsChange((prev) => new Set([...prev, toUrl]));
    }
  }, [resolveUrl, volumes, urlCache, library, category, playingUrls, onPlayingUrlsChange, catVol]);

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
