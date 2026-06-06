import { start as toneStart, getContext } from 'tone';

// ─── Internal State ──────────────────────────────────────────────────────────

// players: { [url]: { audio, sourceNode, gainNode, isLoop, loopStart, loopEnd, onEnd, _loopHandler, _endedHandler } }
const players = {};
const activeSoundIds = {};
const pausedState = {};
const lastPlayCallTimes = {};

let _masterGain = null;

function getCtx() {
  return getContext().rawContext;
}

function getMasterGain() {
  if (!_masterGain) {
    const ctx = getCtx();
    _masterGain = ctx.createGain();
    _masterGain.gain.value = 1;
    _masterGain.connect(ctx.destination);
  }
  return _masterGain;
}

// ─── Event System ─────────────────────────────────────────────────────────────

const eventListeners = new Set();

function emit(event, data) {
  eventListeners.forEach(l => l(event, data));
}

export function subscribe(listener) {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureToneStarted() {
  if (getContext().state !== 'running') {
    await toneStart();
  }
}

// Volume 0-1 linear → linear gain (identical, but clamped for safety)
function toGain(vol) {
  return Math.max(0, Math.min(1, vol));
}

function getOrCreatePlayer(audioUrl) {
  if (players[audioUrl]) return players[audioUrl];

  const ctx = getCtx();
  const audio = new Audio();
  audio.src = audioUrl;
  audio.preload = 'none';

  const gainNode = ctx.createGain();
  gainNode.gain.value = 0;
  gainNode.connect(getMasterGain());

  const sourceNode = ctx.createMediaElementSource(audio);
  sourceNode.connect(gainNode);

  const player = { audio, sourceNode, gainNode, isLoop: false, loopStart: 0, loopEnd: null, onEnd: null, _loopHandler: null, _endedHandler: null };
  players[audioUrl] = player;
  return player;
}

function clearHandlers(player) {
  const { audio } = player;
  if (player._loopHandler) { audio.removeEventListener('timeupdate', player._loopHandler); player._loopHandler = null; }
  if (player._endedHandler) { audio.removeEventListener('ended', player._endedHandler); player._endedHandler = null; }
}

function setupHandlers(audioUrl, player) {
  clearHandlers(player);
  const { audio, isLoop, loopStart, loopEnd } = player;
  const hasCustomPoints = loopStart > 0.001 || (loopEnd !== null && isFinite(loopEnd));

  if (isLoop) {
    if (hasCustomPoints) {
      audio.loop = false;
      const handler = () => {
        const end = loopEnd ?? audio.duration;
        if (end && audio.currentTime >= end - 0.1) {
          audio.currentTime = loopStart;
        }
      };
      audio.addEventListener('timeupdate', handler);
      player._loopHandler = handler;
    } else {
      audio.loop = true;
    }
  } else {
    audio.loop = false;
    if (loopEnd !== null && isFinite(loopEnd)) {
      const handler = () => {
        if (audio.currentTime >= loopEnd) {
          audio.pause();
          onTrackEnd(audioUrl, player);
        }
      };
      audio.addEventListener('timeupdate', handler);
      player._loopHandler = handler;
    }
    const endedHandler = () => onTrackEnd(audioUrl, player);
    audio.addEventListener('ended', endedHandler);
    player._endedHandler = endedHandler;
  }
}

function onTrackEnd(audioUrl, player) {
  if (!activeSoundIds[audioUrl]) return; // already cleaned up
  delete activeSoundIds[audioUrl];
  emit('trackEnded', { audioUrl });
  if (player.onEnd) setTimeout(player.onEnd, 10);
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function playTrack(audioUrl, loop = false, volume = 1, format = 'mp3', onEnd = null, startTime = 0, endTime = null) {
  await ensureToneStarted();

  const now = Date.now();
  if (lastPlayCallTimes[audioUrl] && now - lastPlayCallTimes[audioUrl] < 150) return audioUrl;
  lastPlayCallTimes[audioUrl] = now;

  const player = getOrCreatePlayer(audioUrl);
  const { audio, gainNode } = player;

  player.isLoop = loop;
  player.loopStart = startTime || 0;
  player.loopEnd = endTime || null;
  player.onEnd = onEnd;

  audio.pause();
  audio.currentTime = player.loopStart;
  gainNode.gain.setTargetAtTime(toGain(volume), getCtx().currentTime, 0.01);

  setupHandlers(audioUrl, player);

  try {
    await audio.play();
    activeSoundIds[audioUrl] = audioUrl;
    pausedState[audioUrl] = false;
    emit('trackStarted', { audioUrl });
  } catch (err) {
    console.error(`[audioEngine] Play error for ${audioUrl}:`, err);
  }

  return audioUrl;
}

function stopTrack(audioUrl) {
  const player = players[audioUrl];
  if (!player) return;
  clearHandlers(player);
  player.audio.pause();
  player.audio.currentTime = 0;
  pausedState[audioUrl] = false;
  delete activeSoundIds[audioUrl];
  emit('trackStopped', { audioUrl });
}

function unloadTrack(audioUrl) {
  const player = players[audioUrl];
  if (!player) return;
  clearHandlers(player);
  player.audio.pause();
  player.audio.src = '';
  try { player.sourceNode.disconnect(); } catch (_) {}
  try { player.gainNode.disconnect(); } catch (_) {}
  delete players[audioUrl];
  delete activeSoundIds[audioUrl];
  delete pausedState[audioUrl];
}

function setTrackVolume(audioUrl, volume) {
  const player = players[audioUrl];
  if (player) {
    player.gainNode.gain.setTargetAtTime(toGain(volume), getCtx().currentTime, 0.1);
  }
}

function setMasterVolume(volume) {
  getMasterGain().gain.setTargetAtTime(toGain(volume), getCtx().currentTime, 0.1);
}

function stopAll() {
  Object.keys(players).forEach(url => {
    const player = players[url];
    clearHandlers(player);
    player.audio.pause();
    delete activeSoundIds[url];
    pausedState[url] = false;
    emit('trackStopped', { audioUrl: url });
  });
}

function transitionToScene(sceneTracks, durationMs = 2000) {
  const ctx = getCtx();
  const fadeSec = durationMs / 1000;
  const targetUrls = new Set(sceneTracks.map(t => t.url));

  // Fade out tracks not in the incoming scene
  Object.keys(activeSoundIds).forEach(url => {
    if (!targetUrls.has(url)) {
      const player = players[url];
      if (player) {
        player.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
        setTimeout(() => stopTrack(url), durationMs + 100);
      }
    }
  });

  // Start or update scene tracks
  sceneTracks.forEach(track => {
    if (activeSoundIds[track.url]) {
      setTrackVolume(track.url, track.volume);
    } else {
      playTrack(track.url, track.isLoop, 0, 'mp3', track.onEnd, track.startTime, track.endTime);
      setTimeout(() => {
        const player = players[track.url];
        if (player) {
          player.gainNode.gain.linearRampToValueAtTime(toGain(track.volume), ctx.currentTime + fadeSec);
        }
      }, 50);
    }
  });
}

function isPlaying(audioUrl) {
  const player = players[audioUrl];
  return player ? !player.audio.paused && !player.audio.ended : false;
}

function pauseTrack(audioUrl) {
  const player = players[audioUrl];
  if (player && !player.audio.paused) {
    pausedState[audioUrl] = player.audio.currentTime;
    player.audio.pause();
    emit('trackPaused', { audioUrl });
  }
}

function resumeTrack(audioUrl) {
  const player = players[audioUrl];
  const pos = pausedState[audioUrl];
  if (!player || pos === false || pos === undefined) return;
  player.audio.currentTime = pos;
  player.audio.play()
    .then(() => {
      activeSoundIds[audioUrl] = audioUrl;
      pausedState[audioUrl] = false;
      emit('trackResumed', { audioUrl });
    })
    .catch(err => console.error('[audioEngine] Resume error:', err));
}

function isPaused(audioUrl) {
  return pausedState[audioUrl] !== undefined && pausedState[audioUrl] !== false;
}

function seekTrack(audioUrl, position) {
  const player = players[audioUrl];
  if (!player) return;
  const dur = player.audio.duration;
  const safePos = Math.max(0, Math.min(position, isFinite(dur) ? dur - 0.001 : position));
  const wasPlaying = !player.audio.paused;
  player.audio.currentTime = safePos;
  if (!wasPlaying) pausedState[audioUrl] = safePos;
  emit('trackSeeked', { audioUrl, position: safePos });
}

function getPlaybackPosition(audioUrl) {
  const player = players[audioUrl];
  if (!player) return 0;
  if (!player.audio.paused) return player.audio.currentTime;
  const pos = pausedState[audioUrl];
  return (pos !== false && pos !== undefined) ? pos : 0;
}

function getDuration(audioUrl) {
  const player = players[audioUrl];
  if (!player) return 0;
  const d = player.audio.duration;
  return isNaN(d) || !isFinite(d) ? 0 : d;
}

function crossfade(fromUrl, toUrl, durationMs = 2000, targetVolume = 1) {
  transitionToScene([{ url: toUrl, volume: targetVolume, isLoop: true }], durationMs);
}

// ─── Deck Voice Layer (additive — does not touch URL-keyed players) ───────────

const deckVoices = {};
const deckLastPlayTimes = {};
let _crossfadePos = 0.5;
let _crossfadeCurve = 'equal_power'; // 'equal_power' | 'linear' | 'slow' | 'cut'

function createDeckVoice(url) {
  const ctx = getCtx();
  const audio = new Audio();
  audio.src = url;
  audio.preload = 'none';

  const sourceNode = ctx.createMediaElementSource(audio);
  const deckGainNode = ctx.createGain();
  const filterNode = ctx.createBiquadFilter();
  const xfadeGainNode = ctx.createGain();

  filterNode.type = 'lowpass';
  filterNode.frequency.value = 20000;
  filterNode.Q.value = 0.5;
  deckGainNode.gain.value = 1;
  xfadeGainNode.gain.value = 1;

  sourceNode.connect(deckGainNode);
  deckGainNode.connect(filterNode);
  filterNode.connect(xfadeGainNode);
  xfadeGainNode.connect(getMasterGain());

  return {
    url, audio, sourceNode, deckGainNode, filterNode, xfadeGainNode,
    isLoop: true, loopStart: 0, loopEnd: null,
    _timeHandler: null, _endedHandler: null,
  };
}

function destroyDeckVoice(voice) {
  clearDeckVoiceHandlers(voice);
  voice.audio.pause();
  voice.audio.src = '';
  try { voice.sourceNode.disconnect(); } catch (_) {}
  try { voice.deckGainNode.disconnect(); } catch (_) {}
  try { voice.filterNode.disconnect(); } catch (_) {}
  try { voice.xfadeGainNode.disconnect(); } catch (_) {}
}

function clearDeckVoiceHandlers(voice) {
  if (voice._timeHandler) {
    voice.audio.removeEventListener('timeupdate', voice._timeHandler);
    voice._timeHandler = null;
  }
  if (voice._endedHandler) {
    voice.audio.removeEventListener('ended', voice._endedHandler);
    voice._endedHandler = null;
  }
}

function setupDeckVoiceHandlers(deckId, voice) {
  clearDeckVoiceHandlers(voice);
  const { audio, isLoop, loopStart, loopEnd } = voice;
  const hasCustom = loopStart > 0.001 || (loopEnd !== null && isFinite(loopEnd));

  if (isLoop) {
    if (hasCustom) {
      audio.loop = false;
      const h = () => {
        const end = loopEnd ?? audio.duration;
        if (end && audio.currentTime >= end - 0.08) audio.currentTime = loopStart;
      };
      audio.addEventListener('timeupdate', h);
      voice._timeHandler = h;
    } else {
      audio.loop = true;
    }
  } else {
    audio.loop = false;
    const endH = () => emit('deckEnded', { deckId, url: voice.url });
    audio.addEventListener('ended', endH);
    voice._endedHandler = endH;
  }
}

function applyDeckCrossfade() {
  const audioTime = getCtx().currentTime;
  const pos = _crossfadePos;
  let gainA, gainB;

  switch (_crossfadeCurve) {
    case 'linear':
      gainA = 1 - pos;
      gainB = pos;
      break;
    case 'slow': {
      // Smoothstep remapping — B barely moves until ~40%, then rises steeply
      const sp = pos * pos * (3 - 2 * pos);
      gainA = Math.cos(sp * Math.PI / 2);
      gainB = Math.sin(sp * Math.PI / 2);
      break;
    }
    case 'cut':
      // DJ-style: each side stays at 100% until center, then cuts with cosine
      gainA = pos <= 0.5 ? 1 : Math.cos((pos - 0.5) * Math.PI);
      gainB = pos >= 0.5 ? 1 : Math.cos((0.5 - pos) * Math.PI);
      break;
    case 'equal_power':
    default:
      gainA = Math.cos(pos * Math.PI / 2);
      gainB = Math.sin(pos * Math.PI / 2);
      break;
  }

  if (deckVoices['A']?.xfadeGainNode)
    deckVoices['A'].xfadeGainNode.gain.setTargetAtTime(gainA, audioTime, 0.02);
  if (deckVoices['B']?.xfadeGainNode)
    deckVoices['B'].xfadeGainNode.gain.setTargetAtTime(gainB, audioTime, 0.02);
}

async function loadDeck(deckId, url) {
  await ensureToneStarted();
  if (deckVoices[deckId]) destroyDeckVoice(deckVoices[deckId]);

  const voice = createDeckVoice(url);
  deckVoices[deckId] = voice;
  applyDeckCrossfade();
  voice.audio.load();
  emit('deckLoaded', { deckId, url });

  voice.audio.addEventListener('loadedmetadata', () => {
    emit('deckMetadata', { deckId, url, duration: voice.audio.duration });
  }, { once: true });
}

async function playDeck(deckId) {
  await ensureToneStarted();
  const voice = deckVoices[deckId];
  if (!voice) return;
  const now = Date.now();
  if (deckLastPlayTimes[deckId] && now - deckLastPlayTimes[deckId] < 150) return;
  deckLastPlayTimes[deckId] = now;

  setupDeckVoiceHandlers(deckId, voice);
  try {
    await voice.audio.play();
    emit('deckStarted', { deckId, url: voice.url });
  } catch (err) {
    console.error(`[audioEngine] deck ${deckId} play error:`, err);
  }
}

function pauseDeck(deckId) {
  const voice = deckVoices[deckId];
  if (!voice || voice.audio.paused) return;
  voice.audio.pause();
  emit('deckPaused', { deckId, url: voice.url });
}

function stopDeck(deckId) {
  const voice = deckVoices[deckId];
  if (!voice) return;
  clearDeckVoiceHandlers(voice);
  voice.audio.pause();
  voice.audio.currentTime = voice.loopStart;
  emit('deckStopped', { deckId, url: voice.url });
}

function seekDeck(deckId, position) {
  const voice = deckVoices[deckId];
  if (!voice) return;
  const dur = voice.audio.duration;
  const safe = Math.max(0, Math.min(position, isFinite(dur) ? dur - 0.001 : position));
  voice.audio.currentTime = safe;
}

function setDeckVolume(deckId, volume) {
  const voice = deckVoices[deckId];
  if (voice) voice.deckGainNode.gain.setTargetAtTime(toGain(volume), getCtx().currentTime, 0.05);
}

function setDeckFilter(deckId, freq) {
  const voice = deckVoices[deckId];
  if (voice)
    voice.filterNode.frequency.setTargetAtTime(
      Math.max(80, Math.min(20000, freq)), getCtx().currentTime, 0.05,
    );
}

function setDeckLoop(deckId, loopStart, loopEnd) {
  const voice = deckVoices[deckId];
  if (!voice) return;
  voice.loopStart = loopStart;
  voice.loopEnd = loopEnd;
  if (!voice.audio.paused) setupDeckVoiceHandlers(deckId, voice);
}

function setDeckLoopEnabled(deckId, enabled) {
  const voice = deckVoices[deckId];
  if (!voice) return;
  voice.isLoop = enabled;
  if (!voice.audio.paused) setupDeckVoiceHandlers(deckId, voice);
  else voice.audio.loop = enabled && voice.loopStart <= 0.001 && voice.loopEnd == null;
}

function setCrossfade(pos) {
  _crossfadePos = Math.max(0, Math.min(1, pos));
  applyDeckCrossfade();
}

function setCrossfadeCurve(curve) {
  _crossfadeCurve = curve;
  applyDeckCrossfade();
}

function getDeckPosition(deckId) {
  const voice = deckVoices[deckId];
  if (!voice) return { currentTime: 0, duration: 0 };
  const dur = voice.audio.duration;
  return {
    currentTime: voice.audio.currentTime || 0,
    duration: isNaN(dur) || !isFinite(dur) ? 0 : dur,
  };
}

function getDeckIsPlaying(deckId) {
  const voice = deckVoices[deckId];
  return voice ? !voice.audio.paused && !voice.audio.ended : false;
}

function getDeckLoopState(deckId) {
  const voice = deckVoices[deckId];
  if (!voice) return { isLoop: false, loopStart: 0, loopEnd: null };
  return { isLoop: voice.isLoop, loopStart: voice.loopStart, loopEnd: voice.loopEnd };
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
  // Deck voice layer
  loadDeck,
  playDeck,
  pauseDeck,
  stopDeck,
  seekDeck,
  setDeckVolume,
  setDeckFilter,
  setDeckLoop,
  setDeckLoopEnabled,
  setCrossfade,
  setCrossfadeCurve,
  getDeckPosition,
  getDeckIsPlaying,
  getDeckLoopState,
};
