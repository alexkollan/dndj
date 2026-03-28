// audioEngine.js — Audio Engine (Howler.js)
// All audio playback logic lives here. Zero UI code.
// Components call these functions; they never touch Howler directly.
//
// Responsibilities:
//   - Load / cache Howl instances per file path
//   - Play, stop, and loop tracks
//   - Adjust per-track and master volume
//   - Crossfade between two tracks over a given duration

import { Howl, Howler } from 'howler';

// ─── Constants ────────────────────────────────────────────────────────────────

// Default fade duration in milliseconds when crossfading between tracks
const DEFAULT_CROSSFADE_MS = 2000;

// ─── Internal State ──────────────────────────────────────────────────────────

// Cache of Howl instances keyed by the app:// URL string.
// This prevents re-loading the same file repeatedly.
const howlCache = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * getHowl
 * Returns a cached Howl instance for the given URL, creating one if needed.
 * Uses html5: true by default to ensure better support for streaming large files
 * and custom Electron protocols (prevents "no sound" on initial load).
 *
 * @param {string} audioUrl - app:// URL for the track
 * @param {boolean} loop    - Whether the Howl should loop
 * @param {string} format   - Audio format (mp3, ogg, etc.)
 * @returns {Howl}
 */
function getHowl(audioUrl, loop = false, format = 'mp3') {
  if (!howlCache[audioUrl]) {
    howlCache[audioUrl] = new Howl({
      src: [audioUrl],
      format: [format],
      loop,
      html5: true,   // Enabled for better streaming/protocol support
      preload: true,
      onplayerror: (id, error) => {
        console.error('Playback error for', audioUrl, error);
        // Attempt to recover if the context was suspended
        Howler.unload();
      }
    });
  }
  return howlCache[audioUrl];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * playTrack
 * Starts playback of a single track. Ensures the track is not already playing
 * to prevent overlapping "cloned" sounds.
 *
 * @param {string}   audioUrl - app:// URL
 * @param {boolean}  loop     - Whether to loop
 * @param {number}   volume   - Initial volume 0..1
 * @param {string}   format   - Extension format
 * @param {function} onEnd    - Optional callback when sound finishes
 * @returns {Howl}
 */
function playTrack(audioUrl, loop = false, volume = 1, format = 'mp3', onEnd = null) {
  const howl = getHowl(audioUrl, loop, format);
  howl.loop(loop);
  howl.volume(volume);

  // Update callbacks
  if (onEnd) {
    howl.off('end'); // Remove previous listeners
    howl.on('end', onEnd);
  }

  // If already playing, don't start it again (prevents multiple overlapping instances)
  if (!howl.playing()) {
    howl.play();
  }
  return howl;
}

/**
 * stopTrack
 * Stops playback of a track immediately and unloads it from memory if needed.
 */
function stopTrack(audioUrl) {
  const howl = howlCache[audioUrl];
  if (howl) {
    howl.stop();
  }
}

/**
 * setTrackVolume
 * Adjusts the volume of a single track without affecting others.
 *
 * @param {string} audioUrl - app:// URL
 * @param {number} volume   - 0..1
 */
function setTrackVolume(audioUrl, volume) {
  const howl = howlCache[audioUrl];
  if (howl) {
    howl.volume(Math.max(0, Math.min(1, volume)));
  }
}

/**
 * setMasterVolume
 * Sets the global Howler volume. Affects all currently playing sounds.
 *
 * @param {number} volume - 0..1
 */
function setMasterVolume(volume) {
  Howler.volume(Math.max(0, Math.min(1, volume)));
}

/**
 * stopAll
 * Immediately stops every Howl instance that is currently playing.
 * Bound to the "Stop All" master control and the Space hotkey.
 */
function stopAll() {
  Howler.stop();
}

/**
 * crossfade
 * Fades out the currently-playing track while fading in the next one.
 * Both tracks must already be loaded (i.e., their Howl instances exist).
 *
 * @param {string} fromUrl       - app:// URL of the outgoing track
 * @param {string} toUrl         - app:// URL of the incoming track
 * @param {number} [durationMs]  - Crossfade duration in milliseconds
 * @param {number} [targetVolume] - Target volume for the incoming track (0..1)
 */
function crossfade(fromUrl, toUrl, durationMs = DEFAULT_CROSSFADE_MS, targetVolume = 1) {
  const outgoing = howlCache[fromUrl];
  const incoming = getHowl(toUrl, true);

  // Start the incoming track silently, then fade it in
  incoming.volume(0);
  if (!incoming.playing()) {
    incoming.play();
  }
  incoming.fade(0, targetVolume, durationMs);

  // Fade out and stop the outgoing track
  if (outgoing && outgoing.playing()) {
    outgoing.fade(outgoing.volume(), 0, durationMs);
    setTimeout(() => outgoing.stop(), durationMs);
  }
}

/**
 * isPlaying
 * Returns whether a given track is currently playing.
 *
 * @param {string} audioUrl - app:// URL
 * @returns {boolean}
 */
function isPlaying(audioUrl) {
  const howl = howlCache[audioUrl];
  return howl ? howl.playing() : false;
}

export {
  playTrack,
  stopTrack,
  setTrackVolume,
  setMasterVolume,
  stopAll,
  crossfade,
  isPlaying,
};
