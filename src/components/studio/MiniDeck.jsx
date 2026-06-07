import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import {
  playDeck, pauseDeck, stopDeck,
  getDeckPosition, subscribe,
} from '../../audioEngine.js';
import DeckPanel from './DeckPanel.jsx';
import '../../styles/studio/MiniDeck.css';

function formatTime(sec) {
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MiniDeck({ track, url, isPlaying, isPaused }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { isOver, setNodeRef } = useDroppable({ id: 'deck-C' });

  useEffect(() => {
    let id;
    const tick = () => {
      const pos = getDeckPosition('C');
      setCurrentTime(pos.currentTime || 0);
      if (pos.duration > 0) setDuration(pos.duration);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const unsub = subscribe((event, data) => {
      if (data?.deckId !== 'C') return;
      if (event === 'deckMetadata') setDuration(data.duration || 0);
      if (event === 'deckLoaded') { setCurrentTime(0); setDuration(0); }
      if (event === 'deckStopped') setCurrentTime(0);
    });
    return () => unsub();
  }, []);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    if (isPlaying) pauseDeck('C');
    else playDeck('C');
  }, [isPlaying]);

  const handleStop = useCallback((e) => {
    e.stopPropagation();
    stopDeck('C');
  }, []);

  const handleBackdropClick = useCallback((e) => {
    if (e.currentTarget === e.target) setIsOpen(false);
  }, []);

  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    setIsOpen(true);
  }, []);

  return (
    <>
      <div
        ref={setNodeRef}
        className={[
          'mini-deck',
          isPlaying ? 'mini-deck--playing' : '',
          isPaused  ? 'mini-deck--paused'  : '',
          isOver    ? 'mini-deck--over'    : '',
          !track    ? 'mini-deck--empty'   : '',
        ].join(' ')}
        onClick={() => setIsOpen(true)}
        title="Deck C — click to expand"
      >
        <div className="mini-deck__header">
          <span className="mini-deck__badge">C</span>
          <span className="mini-deck__name">
            {track ? track.name : 'Drop a track or click to open'}
          </span>
          {isPlaying && <span className="mini-deck__playing-dot" />}
        </div>

        <div className="mini-deck__progress-row">
          <span className="mini-deck__time">{formatTime(currentTime)}</span>
          <div className="mini-deck__progress">
            <div
              className="mini-deck__progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="mini-deck__time">{formatTime(duration)}</span>
        </div>

        {track && (
          <div className="mini-deck__controls" onClick={e => e.stopPropagation()}>
            <button
              className={`mini-deck__btn ${isPlaying ? 'mini-deck__btn--active' : ''}`}
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="mini-deck__btn" onClick={handleStop} title="Stop">■</button>
            <button className="mini-deck__expand-btn" onClick={handleExpand} title="Open Deck C">
              ⤢
            </button>
          </div>
        )}
      </div>

      {isOpen && createPortal(
        <div className="mini-deck-modal__backdrop" onClick={handleBackdropClick}>
          <div className="mini-deck-modal" onClick={e => e.stopPropagation()}>
            <div className="mini-deck-modal__header">
              <span className="mini-deck-modal__title">DECK C</span>
              <button
                className="mini-deck-modal__close"
                onClick={() => setIsOpen(false)}
                title="Close"
              >✕</button>
            </div>
            <div className="mini-deck-modal__body">
              <DeckPanel
                deckId="C"
                track={track}
                url={url}
                isPlaying={isPlaying}
                isPaused={isPaused}
                droppableId="deck-C-full"
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default MiniDeck;
