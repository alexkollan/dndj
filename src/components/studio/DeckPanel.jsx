import React, { useState, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  playDeck, pauseDeck, stopDeck, seekDeck,
  setDeckVolume, setDeckFilter, setDeckLoop, setDeckLoopEnabled,
  getDeckPosition, getDeckIsPlaying, subscribe,
} from '../../audioEngine.js';
import DeckWaveform from './DeckWaveform.jsx';
import '../../styles/studio/DeckPanel.css';

const DECK_LABELS = { A: 'DECK A', B: 'DECK B' };
const DECK_COLORS = { A: 'var(--deck-a-color)', B: 'var(--deck-b-color)' };
const DECK_ACCENT_CLASS = { A: 'deck--a', B: 'deck--b' };

function formatTime(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function DeckPanel({ deckId, track, isPlaying, isPaused }) {
  const droppableId = `deck-${deckId}`;
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  const [volume, setVolume] = useState(0.8);
  const [filterFreq, setFilterFreq] = useState(20000);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Subscribe to deckMetadata to get duration
  useEffect(() => {
    const unsub = subscribe((event, data) => {
      if (data.deckId !== deckId) return;
      if (event === 'deckMetadata') setDuration(data.duration || 0);
      if (event === 'deckLoaded') {
        setLoopStart(0);
        setLoopEnd(null);
        setLoopEnabled(true);
        setCurrentTime(0);
        setDuration(0);
      }
      if (event === 'deckStopped') setCurrentTime(0);
    });
    return () => unsub();
  }, [deckId]);

  // Update currentTime display
  useEffect(() => {
    let id;
    const tick = () => {
      const { currentTime: ct, duration: dur } = getDeckPosition(deckId);
      setCurrentTime(ct);
      if (dur > 0 && duration === 0) setDuration(dur);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [deckId, duration]);

  // Apply volume/filter on load
  useEffect(() => {
    if (!track) return;
    setDeckVolume(deckId, volume);
    setDeckFilter(deckId, filterFreq);
  }, [track?.id, deckId]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) pauseDeck(deckId);
    else playDeck(deckId);
  }, [isPlaying, deckId]);

  const handleStop = useCallback(() => stopDeck(deckId), [deckId]);

  const handleCue = useCallback(() => {
    stopDeck(deckId);
    seekDeck(deckId, loopStart);
    setCurrentTime(loopStart);
  }, [deckId, loopStart]);

  const handleSeek = useCallback((pos) => seekDeck(deckId, pos), [deckId]);

  const handleVolumeChange = useCallback((val) => {
    setVolume(val);
    setDeckVolume(deckId, val);
  }, [deckId]);

  const handleFilterChange = useCallback((val) => {
    setFilterFreq(val);
    setDeckFilter(deckId, val);
  }, [deckId]);

  const handleLoopToggle = useCallback(() => {
    const next = !loopEnabled;
    setLoopEnabled(next);
    setDeckLoopEnabled(deckId, next);
  }, [deckId, loopEnabled]);

  const handleLoopIn = useCallback(() => {
    const { currentTime: ct } = getDeckPosition(deckId);
    setLoopStart(ct);
    setDeckLoop(deckId, ct, loopEnd);
  }, [deckId, loopEnd]);

  const handleLoopOut = useCallback(() => {
    const { currentTime: ct } = getDeckPosition(deckId);
    setLoopEnd(ct);
    setDeckLoop(deckId, loopStart, ct);
  }, [deckId, loopStart]);

  const handleLoopClear = useCallback(() => {
    setLoopStart(0);
    setLoopEnd(null);
    setDeckLoop(deckId, 0, null);
  }, [deckId]);

  const accentColor = DECK_COLORS[deckId];
  const hasLoop = loopStart > 0.001 || (loopEnd !== null && isFinite(loopEnd));

  return (
    <div
      ref={setNodeRef}
      className={`deck-panel ${DECK_ACCENT_CLASS[deckId]} ${isPlaying ? 'deck-panel--playing' : ''} ${isOver ? 'deck-panel--over' : ''} ${!track ? 'deck-panel--empty' : ''}`}
    >
      {/* ── Header ── */}
      <div className="deck-panel__header">
        <span className="deck-panel__badge" style={{ color: accentColor }}>{DECK_LABELS[deckId]}</span>
        <span className="deck-panel__track-name" title={track?.name}>
          {track ? track.name : 'Drop a track here'}
        </span>
        <span className="deck-panel__time">
          {formatTime(currentTime)}
          <span className="deck-panel__time-sep"> / </span>
          {formatTime(duration)}
        </span>
      </div>

      {/* ── Waveform ── */}
      <div className="deck-panel__waveform">
        <DeckWaveform
          deckId={deckId}
          peaks={track?.peaks}
          loopStart={loopStart}
          loopEnd={loopEnd}
          onSeek={handleSeek}
        />
      </div>

      {/* ── Transport + Loop ── */}
      <div className="deck-panel__controls">
        <div className="deck-panel__transport">
          <button
            className="deck-btn deck-btn--cue"
            onClick={handleCue}
            disabled={!track}
            title="Cue (go to start)"
          >↩</button>
          <button
            className={`deck-btn deck-btn--play ${isPlaying ? 'deck-btn--active' : ''}`}
            onClick={handlePlayPause}
            disabled={!track}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="deck-btn deck-btn--stop"
            onClick={handleStop}
            disabled={!track}
            title="Stop"
          >■</button>
        </div>

        <div className="deck-panel__loop-controls">
          <button
            className={`deck-btn deck-btn--loop ${loopEnabled ? 'deck-btn--active' : ''}`}
            onClick={handleLoopToggle}
            disabled={!track}
            title="Toggle loop"
          >LP</button>
          <button
            className={`deck-btn deck-btn--sm ${hasLoop ? 'deck-btn--active' : ''}`}
            onClick={handleLoopIn}
            disabled={!track}
            title="Set loop in"
          >IN</button>
          <button
            className={`deck-btn deck-btn--sm ${loopEnd !== null ? 'deck-btn--active' : ''}`}
            onClick={handleLoopOut}
            disabled={!track}
            title="Set loop out"
          >OUT</button>
          {hasLoop && (
            <button
              className="deck-btn deck-btn--sm"
              onClick={handleLoopClear}
              title="Clear loop points"
            >CLR</button>
          )}
        </div>
      </div>

      {/* ── Mixer ── */}
      <div className="deck-panel__mixer">
        <div className="deck-mixer__row">
          <span className="deck-mixer__label">VOL</span>
          <input
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={e => handleVolumeChange(parseFloat(e.target.value))}
            className="deck-mixer__slider deck-mixer__slider--vol"
            disabled={!track}
          />
          <span className="deck-mixer__val">{Math.round(volume * 100)}%</span>
        </div>
        <div className="deck-mixer__row">
          <span className="deck-mixer__label">FILTER</span>
          <input
            type="range" min="80" max="20000" step="10"
            value={filterFreq}
            onChange={e => handleFilterChange(parseInt(e.target.value, 10))}
            className="deck-mixer__slider deck-mixer__slider--filter"
            disabled={!track}
          />
          <span className="deck-mixer__val">{filterFreq >= 19000 ? 'OFF' : `${Math.round(filterFreq)}Hz`}</span>
        </div>
      </div>
    </div>
  );
}

export default DeckPanel;
