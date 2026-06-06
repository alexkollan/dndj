import React, { useState, useCallback, useRef, useEffect } from 'react';
import { setCrossfade, setCrossfadeCurve } from '../../audioEngine.js';
import '../../styles/studio/Crossfader.css';

const CURVES = [
  { id: 'equal_power', label: 'Natural',  tip: 'Equal-power — constant loudness blend' },
  { id: 'slow',        label: 'Slow',     tip: 'Gradual — less bleed at the extremes' },
  { id: 'linear',      label: 'Linear',   tip: 'Linear — simple A↔B fade' },
  { id: 'cut',         label: 'Cut',      tip: 'DJ-style — both tracks full until center' },
];

// Compute gain for a given curve + deck side
function computeGains(pos, curve) {
  switch (curve) {
    case 'linear':
      return [1 - pos, pos];
    case 'slow': {
      const sp = pos * pos * (3 - 2 * pos);
      return [Math.cos(sp * Math.PI / 2), Math.sin(sp * Math.PI / 2)];
    }
    case 'cut':
      return [
        pos <= 0.5 ? 1 : Math.cos((pos - 0.5) * Math.PI),
        pos >= 0.5 ? 1 : Math.cos((0.5 - pos) * Math.PI),
      ];
    default: // equal_power
      return [Math.cos(pos * Math.PI / 2), Math.sin(pos * Math.PI / 2)];
  }
}

// Mini canvas that draws the A and B gain curves for the current mode
function CurvePreview({ curve }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    // Grid center line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.stroke();

    const steps = W;
    // Deck A — emerald
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= steps; i++) {
      const pos = i / steps;
      const [gA] = computeGains(pos, curve);
      const x = i;
      const y = H - gA * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Deck B — amber
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= steps; i++) {
      const pos = i / steps;
      const [, gB] = computeGains(pos, curve);
      const x = i;
      const y = H - gB * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [curve]);

  return <canvas ref={canvasRef} className="xfader__preview" width={120} height={32} />;
}

function Crossfader() {
  const [pos, setPos] = useState(0.5);
  const [curve, setCurve] = useState('equal_power');

  const handleChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setPos(val);
    setCrossfade(val);
  }, []);

  const handleCenter = useCallback(() => {
    setPos(0.5);
    setCrossfade(0.5);
  }, []);

  const handleCurve = useCallback((id) => {
    setCurve(id);
    setCrossfadeCurve(id);
  }, []);

  const [gA, gB] = computeGains(pos, curve);
  const pctA = Math.round(gA * 100);
  const pctB = Math.round(gB * 100);

  return (
    <div className="xfader">
      <div className="xfader__labels">
        <span className="xfader__label xfader__label--a">A <span className="xfader__pct">{pctA}%</span></span>
        <span className="xfader__label xfader__label--b"><span className="xfader__pct">{pctB}%</span> B</span>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.005"
        value={pos}
        onChange={handleChange}
        className="xfader__slider"
        title={`Crossfade — A: ${pctA}%  B: ${pctB}%`}
      />

      <div className="xfader__bottom">
        <div className="xfader__curve-btns">
          {CURVES.map(c => (
            <button
              key={c.id}
              className={`xfader__curve-btn ${curve === c.id ? 'xfader__curve-btn--on' : ''}`}
              onClick={() => handleCurve(c.id)}
              title={c.tip}
            >{c.label}</button>
          ))}
        </div>

        <CurvePreview curve={curve} />

        <button className="xfader__center" onClick={handleCenter} title="Reset to center">
          CTR
        </button>
      </div>
    </div>
  );
}

export default Crossfader;
