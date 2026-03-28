// TrackCard.jsx — Individual Track UI
// Reusable card component used by both AtmospherePlayer and Soundboard.
// Displays the track name, a play/stop toggle, and (optionally) a volume slider.

import React from 'react';

/**
 * TrackCard
 *
 * Props:
 *   name        {string}   - Human-readable track name
 *   isPlaying   {boolean}  - Whether this track is currently playing
 *   showVolume  {boolean}  - Whether to render the volume slider (default: false)
 *   volume      {number}   - Current volume 0..1 (used when showVolume is true)
 *   onToggle    {function} - Called when the play/stop button is clicked
 *   onVolume    {function} - Called with the new volume value when slider changes
 *   isLoop      {boolean}  - Show a loop indicator badge (default: false)
 */
function TrackCard({ name, isPlaying, showVolume = false, volume = 1, onToggle, onVolume, isLoop = false }) {
  return (
    <div className={`track-card${isPlaying ? ' track-card--playing' : ''}`}>
      <div className="track-card__header">
        {/* Loop indicator badge — only shown for atmosphere tracks */}
        {isLoop && <span className="track-card__loop-badge" title="Looping">↻</span>}

        <span className="track-card__name" title={name}>{name}</span>

        {/* Play / Stop toggle button */}
        <button
          className={`track-card__toggle${isPlaying ? ' track-card__toggle--stop' : ''}`}
          onClick={onToggle}
          aria-label={isPlaying ? `Stop ${name}` : `Play ${name}`}
        >
          {isPlaying ? '■' : '▶'}
        </button>
      </div>

      {/* Volume slider — only rendered for tracks that need it (atmosphere) */}
      {showVolume && (
        <div className="track-card__volume">
          <label className="track-card__volume-label" htmlFor={`vol-${name}`}>
            Vol
          </label>
          <input
            id={`vol-${name}`}
            className="track-card__volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            aria-label={`Volume for ${name}`}
          />
          <span className="track-card__volume-value">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}

export default TrackCard;
