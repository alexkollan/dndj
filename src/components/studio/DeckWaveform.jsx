import React, { useRef, useEffect, useMemo } from 'react';
import { getDeckPosition } from '../../audioEngine.js';
import '../../styles/studio/DeckWaveform.css';

const DECK_COLORS = { A: '#10b981', B: '#f59e0b' };

function DeckWaveform({ deckId, peaks, loopStart = 0, loopEnd = null, onSeek }) {
  const waveRef = useRef(null);
  const overlayRef = useRef(null);
  const hoverRef = useRef({ active: false, ratio: 0 });
  const color = DECK_COLORS[deckId] || '#10b981';

  const peaksArr = useMemo(() => {
    if (!peaks) return null;
    try { return JSON.parse(peaks); } catch { return null; }
  }, [peaks]);

  // Draw static waveform (re-runs only when peaks/color change)
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas || !peaksArr || peaksArr.length === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width: W, height: H } = canvas.getBoundingClientRect();
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const midY = H / 2;
    const n = peaksArr.length;
    const bw = W / n;

    for (let i = 0; i < n; i++) {
      const barH = Math.max(1, peaksArr[i] * midY * 0.85);
      ctx.fillStyle = color + '65';
      ctx.fillRect(i * bw, midY - barH, Math.max(1, bw - 0.5), barH * 2);
    }
  }, [peaksArr, color]);

  // Animated overlay: playhead, scanned region, loop markers, hover
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let animId;

    const draw = () => {
      const { width: W, height: H } = canvas.getBoundingClientRect();
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const { currentTime, duration } = getDeckPosition(deckId);
      const playRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
      const px = playRatio * W;

      // Scanned region (slightly lighter)
      ctx.fillStyle = color + '22';
      ctx.fillRect(0, 0, px, H);

      // Loop region
      if (duration > 0 && (loopStart > 0.001 || (loopEnd !== null && isFinite(loopEnd)))) {
        const lx = (loopStart / duration) * W;
        const rx = ((loopEnd ?? duration) / duration) * W;
        ctx.fillStyle = color + '28';
        ctx.fillRect(lx, 0, rx - lx, H);
        ctx.strokeStyle = color + 'B0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, 0); ctx.lineTo(lx, H);
        ctx.moveTo(rx, 0); ctx.lineTo(rx, H);
        ctx.stroke();
      }

      // Playhead
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();

      // Hover cursor
      if (hoverRef.current.active) {
        const hx = hoverRef.current.ratio * W;
        ctx.strokeStyle = color + '90';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, 0); ctx.lineTo(hx, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [deckId, color, loopStart, loopEnd]);

  const handleClick = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const { duration } = getDeckPosition(deckId);
    if (duration > 0) onSeek(ratio * duration);
  };

  const handleMouseMove = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    hoverRef.current = { active: true, ratio: Math.max(0, (e.clientX - rect.left) / rect.width) };
  };

  return (
    <div className="deck-wf">
      <canvas ref={waveRef} className="deck-wf__static" />
      <canvas
        ref={overlayRef}
        className="deck-wf__overlay"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { hoverRef.current = { active: false, ratio: 0 }; }}
      />
      {!peaksArr && (
        <div className="deck-wf__empty">Drop a track · waveform generates on first Classic view</div>
      )}
    </div>
  );
}

export default DeckWaveform;
