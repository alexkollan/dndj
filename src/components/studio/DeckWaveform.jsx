import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { getDeckPosition } from '../../audioEngine.js';
import '../../styles/studio/DeckWaveform.css';

const DECK_COLORS = {
  A: { mid: '#10b981', hi: '#6ee7b7', bass: '#065f46' },
  B: { mid: '#f59e0b', hi: '#fcd34d', bass: '#78350f' },
};
const PEAKS_N = 1200;

function getPeakMinMax(p) {
  if (p == null) return { min: 0, max: 0 };
  if (typeof p === 'number') return { min: -Math.abs(p), max: Math.abs(p) };
  return { min: p.min || 0, max: p.max || 0 };
}

async function generatePeaksFromUrl(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();
  const data = decoded.getChannelData(0);
  const step = Math.ceil(data.length / PEAKS_N);
  const peaks = [];
  for (let i = 0; i < PEAKS_N; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks.push({ min, max });
  }
  return peaks;
}

const ZOOM_LEVELS = [1, 2, 4, 8];

function DeckWaveform({ deckId, peaks, loopStart = 0, loopEnd = null, onSeek, cuePoints = [], url = null, onPeaksReady }) {
  const waveRef = useRef(null);
  const overlayRef = useRef(null);
  const hoverRef = useRef({ active: false, ratio: 0 });
  const cuePointsRef = useRef(cuePoints);
  useEffect(() => { cuePointsRef.current = cuePoints; }, [cuePoints]);

  const palette = DECK_COLORS[deckId] || DECK_COLORS.A;

  // Zoom state: zoom level and scroll position (0 = start, 1 = end - 1/zoom)
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0); // fraction of total waveform
  const zoomRef = useRef(zoom);
  const viewStartRef = useRef(viewStart);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { viewStartRef.current = viewStart; }, [viewStart]);

  const peaksArr = useMemo(() => {
    if (!peaks) return null;
    try { return JSON.parse(peaks); } catch { return null; }
  }, [peaks]);

  const [genPeaks, setGenPeaks] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { setGenPeaks(null); setZoom(1); setViewStart(0); }, [url]);

  useEffect(() => {
    if (peaksArr || !url) return;
    let cancelled = false;
    setGenerating(true);
    generatePeaksFromUrl(url)
      .then(p => {
        if (cancelled) return;
        setGenPeaks(p);
        setGenerating(false);
        if (onPeaksReady) onPeaksReady(JSON.stringify(p));
      })
      .catch(err => {
        console.error('DeckWaveform: peak generation failed', err);
        if (!cancelled) setGenerating(false);
      });
    return () => { cancelled = true; };
  }, [url, peaksArr]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePeaks = peaksArr || genPeaks;

  // Draw static waveform (Djay-style multi-band)
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas || !activePeaks || activePeaks.length === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width: W, height: H } = canvas.getBoundingClientRect();
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const n = activePeaks.length;
    const viewFraction = 1 / zoom;
    const startFrac = viewStart;
    const endFrac = Math.min(1, startFrac + viewFraction);

    const startIdx = Math.floor(startFrac * n);
    const endIdx = Math.ceil(endFrac * n);
    const visibleN = endIdx - startIdx;

    // Bar width with gap — slightly less dense
    const slotW = W / visibleN;
    const barW = Math.max(1, slotW * 0.55);
    const midY = H / 2;
    const centerGap = 1; // 1px gap at center line

    for (let vi = 0; vi < visibleN; vi++) {
      const i = startIdx + vi;
      if (i >= n) break;
      const { min, max } = getPeakMinMax(activePeaks[i]);
      const amp = Math.max(Math.abs(min), Math.abs(max));
      if (amp < 0.001) continue;

      const x = vi * slotW + (slotW - barW) / 2;

      // Total half-height of bar
      const halfH = Math.max(1, amp * (midY - centerGap) * 0.9);

      // Three bands: bass (center 30%), mid (middle 50%), hi (top 20%)
      const bassH = halfH * 0.30;
      const midH  = halfH * 0.50;
      const hiH   = halfH * 0.20;

      // Top half (positive): draw from center upward
      // hi tips (topmost)
      ctx.fillStyle = palette.hi + 'CC';
      ctx.fillRect(x, midY - centerGap - hiH - midH - bassH, barW, hiH);
      // mid section
      ctx.fillStyle = palette.mid + 'E0';
      ctx.fillRect(x, midY - centerGap - midH - bassH, barW, midH);
      // bass (closest to center)
      ctx.fillStyle = palette.bass + 'FF';
      ctx.fillRect(x, midY - centerGap - bassH, barW, bassH);

      // Bottom half (mirror)
      ctx.fillStyle = palette.bass + 'FF';
      ctx.fillRect(x, midY + centerGap, barW, bassH);
      ctx.fillStyle = palette.mid + 'E0';
      ctx.fillRect(x, midY + centerGap + bassH, barW, midH);
      ctx.fillStyle = palette.hi + 'CC';
      ctx.fillRect(x, midY + centerGap + bassH + midH, barW, hiH);
    }
  }, [activePeaks, palette, zoom, viewStart]);

  // Animated overlay
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
      const z = zoomRef.current;
      const vs = viewStartRef.current;
      const viewFraction = 1 / z;

      // Convert global ratio → canvas x
      const toX = (globalRatio) => ((globalRatio - vs) / viewFraction) * W;
      const inView = (globalRatio) => globalRatio >= vs && globalRatio <= vs + viewFraction;

      const playRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
      const px = toX(playRatio);

      // Scanned region (already played, this session)
      ctx.fillStyle = palette.mid + '1A';
      ctx.fillRect(0, 0, Math.max(0, px), H);

      // Loop region
      if (duration > 0 && (loopStart > 0.001 || (loopEnd !== null && isFinite(loopEnd)))) {
        const lRatio = loopStart / duration;
        const rRatio = (loopEnd ?? duration) / duration;
        if (lRatio < vs + viewFraction && rRatio > vs) {
          const lx = toX(Math.max(vs, lRatio));
          const rx = toX(Math.min(vs + viewFraction, rRatio));
          ctx.fillStyle = palette.mid + '28';
          ctx.fillRect(lx, 0, rx - lx, H);
          if (inView(lRatio)) {
            ctx.strokeStyle = palette.mid + 'B0'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(toX(lRatio), 0); ctx.lineTo(toX(lRatio), H); ctx.stroke();
          }
          if (inView(rRatio)) {
            ctx.strokeStyle = palette.mid + 'B0'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(toX(rRatio), 0); ctx.lineTo(toX(rRatio), H); ctx.stroke();
          }
        }
      }

      // Cue markers
      if (duration > 0) {
        cuePointsRef.current.forEach(cue => {
          const cr = cue.position / duration;
          if (!inView(cr)) return;
          const cx = toX(cr);
          const c = cue.color || '#10b981';
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(cx - 4, 0); ctx.lineTo(cx + 4, 0); ctx.lineTo(cx, 7);
          ctx.fill();
        });
      }

      // Playhead
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();

      // Hover cursor
      if (hoverRef.current.active) {
        const hx = hoverRef.current.ratio * W;
        ctx.strokeStyle = palette.mid + '80';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, H); ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [deckId, palette, loopStart, loopEnd]);

  // Seek — map canvas x back to global time
  const handleClick = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    const canvasRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const viewFraction = 1 / zoomRef.current;
    const globalRatio = viewStartRef.current + canvasRatio * viewFraction;
    const { duration } = getDeckPosition(deckId);
    if (duration > 0) onSeek(globalRatio * duration);
  }, [deckId, onSeek]);

  const handleMouseMove = useCallback((e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    hoverRef.current = { active: true, ratio: Math.max(0, (e.clientX - rect.left) / rect.width) };
  }, []);

  // Wheel handler:
  //   ctrlKey=true  → pinch-to-zoom (Mac trackpad pinch sends this)
  //   |deltaX|>|deltaY| → two-finger horizontal swipe → pan when zoomed
  //   otherwise     → discrete zoom step (mouse wheel)
  const handleWheel = useCallback((e) => {
    e.preventDefault();

    const isPinch = e.ctrlKey;
    const isHorizontalPan = !isPinch && Math.abs(e.deltaX) > Math.abs(e.deltaY);

    if (isPinch || (!isHorizontalPan)) {
      // Zoom: pinch uses deltaY magnitude continuously; mouse wheel uses discrete steps
      const delta = isPinch ? e.deltaY : (e.deltaY < 0 ? -1 : 1);
      const zIdx = ZOOM_LEVELS.indexOf(zoomRef.current);
      const next = delta < 0
        ? ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zIdx + 1)]
        : ZOOM_LEVELS[Math.max(0, zIdx - 1)];
      if (next === zoomRef.current) return;

      const rect = overlayRef.current.getBoundingClientRect();
      const cursorRatio = (e.clientX - rect.left) / rect.width;
      const oldFrac = 1 / zoomRef.current;
      const globalCursor = viewStartRef.current + cursorRatio * oldFrac;
      const newFrac = 1 / next;
      const newStart = Math.max(0, Math.min(1 - newFrac, globalCursor - cursorRatio * newFrac));
      setZoom(next);
      setViewStart(newStart);
    } else {
      // Horizontal pan (two-finger swipe left/right on trackpad)
      if (zoomRef.current <= 1) return;
      const viewFraction = 1 / zoomRef.current;
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.deltaX / rect.width;
      setViewStart(prev => Math.max(0, Math.min(1 - viewFraction, prev + dx * viewFraction * 2)));
    }
  }, []);

  // Drag pan
  const dragRef = useRef({ active: false, startX: 0, startVs: 0 });

  const handleMouseDown = useCallback((e) => {
    dragRef.current = { active: true, startX: e.clientX, startVs: viewStartRef.current };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - dragRef.current.startX) / rect.width;
      const viewFraction = 1 / zoomRef.current;
      const newStart = Math.max(0, Math.min(1 - viewFraction, dragRef.current.startVs - dx * viewFraction));
      setViewStart(newStart);
    };
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const cycleZoom = useCallback((dir) => {
    const zIdx = ZOOM_LEVELS.indexOf(zoomRef.current);
    const next = dir > 0
      ? ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zIdx + 1)]
      : ZOOM_LEVELS[Math.max(0, zIdx - 1)];
    if (next === zoomRef.current) return;
    const newFrac = 1 / next;
    const center = viewStartRef.current + (1 / zoomRef.current) / 2;
    const newStart = Math.max(0, Math.min(1 - newFrac, center - newFrac / 2));
    setZoom(next);
    setViewStart(newStart);
  }, []);

  return (
    <div className="deck-wf">
      <canvas ref={waveRef} className="deck-wf__static" />
      <canvas
        ref={overlayRef}
        className="deck-wf__overlay"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { hoverRef.current = { active: false, ratio: 0 }; }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      />
      {!activePeaks && (
        <div className="deck-wf__empty">
          {generating ? 'Analyzing…' : 'Drop a track here'}
        </div>
      )}
      {activePeaks && (
        <div className="deck-wf__zoom-controls">
          <button className="deck-wf__zoom-btn" onClick={() => cycleZoom(-1)} disabled={zoom === 1} title="Zoom out">−</button>
          <span className="deck-wf__zoom-label">{zoom}×</span>
          <button className="deck-wf__zoom-btn" onClick={() => cycleZoom(1)} disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]} title="Zoom in">+</button>
        </div>
      )}
    </div>
  );
}

export default DeckWaveform;
