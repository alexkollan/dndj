import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { triggerSample } from '../../audioEngine.js';
import '../../styles/studio/SamplerStrip.css';

const NUM_PADS = 8;
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];

function SamplerPad({ pad, padIdx, onFire, onVolumeChange, onClear }) {
  const { isOver, setNodeRef } = useDroppable({ id: `pad-${padIdx}` });
  const [flash, setFlash] = useState(false);
  const [showVol, setShowVol] = useState(false);

  const fire = useCallback(() => {
    if (!pad?.url) return;
    onFire(padIdx);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
  }, [pad, padIdx, onFire]);

  const assigned = !!pad;

  return (
    <div
      ref={setNodeRef}
      className={[
        'sp',
        assigned ? 'sp--assigned' : 'sp--empty',
        flash ? 'sp--flash' : '',
        isOver ? 'sp--over' : '',
      ].join(' ')}
      onClick={fire}
      onContextMenu={e => { e.preventDefault(); if (assigned) onClear(padIdx); }}
      onMouseEnter={() => assigned && setShowVol(true)}
      onMouseLeave={() => setShowVol(false)}
      title={assigned ? `${pad.name}\nRight-click to clear` : `Drop a track here (key: ${PAD_KEYS[padIdx]})`}
    >
      <span className="sp__key">{PAD_KEYS[padIdx]}</span>

      {assigned ? (
        <span className="sp__name">{pad.name}</span>
      ) : (
        <span className="sp__empty-hint">drop here</span>
      )}

      {assigned && showVol && (
        <div className="sp__vol-wrap" onClick={e => e.stopPropagation()}>
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={pad.volume ?? 0.8}
            onChange={e => onVolumeChange(padIdx, parseFloat(e.target.value))}
            className="sp__vol-slider"
            title={`Volume: ${Math.round((pad.volume ?? 0.8) * 100)}%`}
          />
        </div>
      )}
    </div>
  );
}

function SamplerStrip({ allTracks, resolveUrl, urlCache }) {
  const [pads, setPads] = useState(() => Array(NUM_PADS).fill(null));
  const padsRef = useRef(pads);
  padsRef.current = pads;

  // Load persisted pad assignments on mount
  useEffect(() => {
    window.dndj.getSetting('sampler_pads').then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          // Patch in resolved URLs lazily — URLs themselves may have changed
          setPads(saved.map(p => p ? { ...p, url: null } : null));
          // Resolve URLs for assigned pads
          saved.forEach(async (p, i) => {
            if (!p?.path) return;
            const url = urlCache[p.path] || await resolveUrl(p.path);
            setPads(prev => {
              const next = [...prev];
              if (next[i]) next[i] = { ...next[i], url };
              return next;
            });
          });
        }
      } catch (_) {}
    });
  }, []);

  const savePads = useCallback((p) => {
    // Don't persist resolved urls — re-resolve on next load
    const toSave = p.map(pad => pad ? { trackId: pad.trackId, name: pad.name, path: pad.path, volume: pad.volume ?? 0.8 } : null);
    window.dndj.setSetting('sampler_pads', JSON.stringify(toSave));
  }, []);

  // Called from StudioLayout's handleDragEnd via the pad droppable
  // Also exposed so StudioLayout can assign externally
  const assignPad = useCallback(async (padIdx, track) => {
    const url = urlCache[track.path] || await resolveUrl(track.path);
    setPads(prev => {
      const next = [...prev];
      next[padIdx] = { trackId: track.id, name: track.name, path: track.path, url, volume: 0.8 };
      savePads(next);
      return next;
    });
  }, [urlCache, resolveUrl, savePads]);

  // Expose assignPad for parent (StudioLayout drag handler)
  SamplerStrip._assignPad = assignPad;

  const handleFire = useCallback((padIdx) => {
    const pad = padsRef.current[padIdx];
    if (pad?.url) triggerSample(pad.url, pad.volume ?? 0.8);
  }, []);

  const handleVolumeChange = useCallback((padIdx, vol) => {
    setPads(prev => {
      const next = [...prev];
      if (next[padIdx]) next[padIdx] = { ...next[padIdx], volume: vol };
      savePads(next);
      return next;
    });
  }, [savePads]);

  const handleClear = useCallback((padIdx) => {
    setPads(prev => {
      const next = [...prev];
      next[padIdx] = null;
      savePads(next);
      return next;
    });
  }, [savePads]);

  // Keyboard triggers (keys 1–8)
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      const idx = PAD_KEYS.indexOf(e.key);
      if (idx === -1) return;
      const pad = padsRef.current[idx];
      if (pad?.url) triggerSample(pad.url, pad.volume ?? 0.8);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="sampler-strip">
      <span className="sampler-strip__label">SFX PADS</span>
      <div className="sampler-strip__pads">
        {pads.map((pad, i) => (
          <SamplerPad
            key={i}
            pad={pad}
            padIdx={i}
            onFire={handleFire}
            onVolumeChange={handleVolumeChange}
            onClear={handleClear}
          />
        ))}
      </div>
      <span className="sampler-strip__hint">keys 1–8 · right-click to clear</span>
    </div>
  );
}

export default SamplerStrip;
