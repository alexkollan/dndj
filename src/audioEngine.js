import * as Tone from 'tone';

// ─── Internal State ──────────────────────────────────────────────────────────

const playersCache = {};
const volumeNodes = {};
const playQueue = {};
const activeSoundIds = {};
const pausedState = {};
const trackStartOffsets = {};
const trackDurationCache = {};
const lastPlayCallTimes = {};

// Event system for UI synchronization
const eventListeners = new Set();

function emit(event, data) {
  eventListeners.forEach(listener => listener(event, data));
}

export function subscribe(listener) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function volToDb(vol) {
  if (vol <= 0) return -60; 
  return 20 * Math.log10(Math.max(0.0001, vol));
}

async function ensureToneStarted() {
  if (Tone.context.state !== 'running') {
    await Tone.start();
  }
}

function getPlayer(audioUrl, loop, onEnd) {
  if (!playersCache[audioUrl]) {
    const vol = new Tone.Volume(-60).toDestination();
    volumeNodes[audioUrl] = vol;

    const player = new Tone.Player({
      url: audioUrl,
      loop: loop,
      onload: () => {
        trackDurationCache[audioUrl] = player.buffer.duration;
        if (playQueue[audioUrl]) {
           playQueue[audioUrl]();
           delete playQueue[audioUrl];
        }
      },
      onstop: () => {
         // Clean up internal state if stopped
         if (player.state === 'stopped') {
            const isActuallyPaused = !!pausedState[audioUrl];
            if (!isActuallyPaused) {
              delete activeSoundIds[audioUrl];
              emit('trackEnded', { audioUrl });
              if (player.onEndCallback) {
                setTimeout(() => player.onEndCallback(), 10);
              }
            }
         }
      }
    }).connect(vol);
    playersCache[audioUrl] = player;
  }
  return playersCache[audioUrl];
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function playTrack(audioUrl, loop = false, volume = 1, format = 'mp3', onEnd = null, startTime = 0, endTime = null) {
  await ensureToneStarted();
  const now = Date.now();
  if (lastPlayCallTimes[audioUrl] && (now - lastPlayCallTimes[audioUrl] < 150)) {
    return audioUrl;
  }
  lastPlayCallTimes[audioUrl] = now;

  const player = getPlayer(audioUrl, loop, onEnd);
  player.onEndCallback = onEnd;

  const performPlay = () => {
    try {
      player.stop();
      const volNode = volumeNodes[audioUrl];
      volNode.volume.value = volToDb(volume);

      const fullDuration = player.buffer.duration || 0;
      if (!fullDuration || fullDuration === Infinity) return;

      const safeStartTime = Math.max(0, Math.min(startTime, fullDuration - 0.001));
      let safeEndTime = endTime || fullDuration;
      safeEndTime = Math.max(safeStartTime + 0.001, Math.min(safeEndTime, fullDuration));
      
      const durationSec = safeEndTime - safeStartTime;
      const isCropped = safeStartTime > 0.001 || Math.abs(safeEndTime - fullDuration) > 0.01;

      player.loopStart = safeStartTime;
      player.loopEnd = safeEndTime;
      player.loop = loop;

      trackStartOffsets[audioUrl] = Tone.now() - safeStartTime;
      
      if (isCropped && !loop) {
        player.start(0, safeStartTime, durationSec);
      } else {
        player.start(0, safeStartTime);
      }
      
      activeSoundIds[audioUrl] = audioUrl;
      pausedState[audioUrl] = false;
      emit('trackStarted', { audioUrl });
    } catch (err) {
      console.error(`[audioEngine] Play error for ${audioUrl}:`, err);
    }
  };

  if (player.loaded) {
    performPlay();
  } else {
    playQueue[audioUrl] = performPlay;
  }
  
  return audioUrl;
}

function stopTrack(audioUrl) {
  if (playQueue[audioUrl]) delete playQueue[audioUrl];
  const player = playersCache[audioUrl];
  if (player) {
    player.stop();
    pausedState[audioUrl] = false;
    delete activeSoundIds[audioUrl];
    emit('trackStopped', { audioUrl });
  }
}

/**
 * unloadTrack
 * Completely removes the player and releases the file handle.
 * Critical for renaming files on Windows.
 */
function unloadTrack(audioUrl) {
  const player = playersCache[audioUrl];
  if (player) {
    player.dispose(); // Releases buffer and Web Audio nodes
    delete playersCache[audioUrl];
    delete volumeNodes[audioUrl];
    delete trackDurationCache[audioUrl];
    delete activeSoundIds[audioUrl];
    delete pausedState[audioUrl];
  }
}

function setTrackVolume(audioUrl, volume) {
  const volNode = volumeNodes[audioUrl];
  if (volNode) {
    volNode.volume.rampTo(volToDb(volume), 0.1);
  }
}

function setMasterVolume(volume) {
  Tone.Destination.volume.rampTo(volToDb(volume), 0.1);
}

function stopAll() {
  Object.keys(playersCache).forEach(url => {
    playersCache[url].stop();
    emit('trackStopped', { audioUrl: url });
  });
  Object.keys(playQueue).forEach(url => delete playQueue[url]);
  Object.keys(pausedState).forEach(k => pausedState[k] = false);
  Object.keys(activeSoundIds).forEach(k => delete activeSoundIds[k]);
}

/**
 * transitionToScene
 * Fades out all currently playing tracks that are NOT in the target list,
 * and starts/fades in the new tracks.
 */
function transitionToScene(sceneTracks, durationMs = 2000) {
  const targetUrls = new Set(sceneTracks.map(t => t.url));
  
  // 1. Fade out current tracks not in scene
  Object.keys(activeSoundIds).forEach(url => {
    if (!targetUrls.has(url)) {
      const volNode = volumeNodes[url];
      if (volNode) {
        volNode.volume.rampTo(-60, durationMs / 1000);
        setTimeout(() => stopTrack(url), durationMs + 100);
      }
    }
  });

  // 2. Start and fade in scene tracks
  sceneTracks.forEach(track => {
    const isPlaying = activeSoundIds[track.url];
    if (!isPlaying) {
      playTrack(track.url, track.isLoop, 0, 'mp3', track.onEnd, track.startTime, track.endTime);
      setTimeout(() => {
        const volNode = volumeNodes[track.url];
        if (volNode) volNode.volume.rampTo(volToDb(track.volume), durationMs / 1000);
      }, 50);
    } else {
      // Already playing, just update volume
      setTrackVolume(track.url, track.volume);
    }
  });
}

function isPlaying(audioUrl) {
  const player = playersCache[audioUrl];
  return player ? player.state === 'started' : false;
}

function pauseTrack(audioUrl) {
  const player = playersCache[audioUrl];
  if (player && player.state === 'started') {
    const elapsed = Tone.now() - trackStartOffsets[audioUrl];
    pausedState[audioUrl] = elapsed;
    player.stop();
    emit('trackPaused', { audioUrl });
  }
}

function resumeTrack(audioUrl) {
  const player = playersCache[audioUrl];
  if (player && pausedState[audioUrl] !== undefined && pausedState[audioUrl] !== false) {
    if (!player.loaded) {
        playTrack(audioUrl, player.loop, 1, 'mp3', player.onEndCallback, pausedState[audioUrl]);
        return;
    }
    const startAt = pausedState[audioUrl];
    trackStartOffsets[audioUrl] = Tone.now() - startAt;
    player.start(0, startAt);
    pausedState[audioUrl] = false;
    emit('trackResumed', { audioUrl });
  }
}

function isPaused(audioUrl) {
  return pausedState[audioUrl] !== undefined && pausedState[audioUrl] !== false;
}

function seekTrack(audioUrl, position) {
  const player = playersCache[audioUrl];
  if (player) {
    const wasPlaying = player.state === 'started';
    player.stop();
    const dur = trackDurationCache[audioUrl] || player.buffer.duration || Infinity;
    const safePos = Math.max(0, Math.min(position, dur - 0.001));
    trackStartOffsets[audioUrl] = Tone.now() - safePos;
    if (wasPlaying) {
      if (player.loaded) player.start(0, safePos);
      else playQueue[audioUrl] = () => player.start(0, safePos);
    } else {
      pausedState[audioUrl] = safePos;
    }
    emit('trackSeeked', { audioUrl, position: safePos });
  }
}

function getPlaybackPosition(audioUrl) {
  const player = playersCache[audioUrl];
  if (player && player.state === 'started') {
     let pos = Tone.now() - trackStartOffsets[audioUrl];
     if (player.loop) {
        const loopDur = player.loopEnd - player.loopStart;
        if (loopDur > 0 && pos > player.loopStart) {
           pos = ((pos - player.loopStart) % loopDur) + player.loopStart;
        }
     }
     return pos;
  } else if (pausedState[audioUrl] !== false && pausedState[audioUrl] !== undefined) {
     return pausedState[audioUrl];
  }
  return 0;
}

function getDuration(audioUrl) {
  return trackDurationCache[audioUrl] || 0;
}

function crossfade(fromUrl, toUrl, durationMs = 2000, targetVolume = 1) {
  // Compatibility wrapper for AtmospherePlayer
  transitionToScene([
    { url: toUrl, volume: targetVolume, isLoop: true }
  ], durationMs);
}

export {
  playTrack,
  stopTrack,
  setTrackVolume,
  setMasterVolume,
  stopAll,
  transitionToScene,
  crossfade,
  isPlaying,
  pauseTrack,
  resumeTrack,
  isPaused,
  seekTrack,
  getPlaybackPosition,
  getDuration,
  unloadTrack,
};
