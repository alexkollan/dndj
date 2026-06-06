import React, { useState, useCallback, useRef, useEffect } from 'react';
import { setCrossfade, setCrossfadeCurve } from '../../audioEngine.js';
import '../../styles/studio/Crossfader.css';

const CURVES = [
  { id: 'equal_power', label: 'Natural',  tip: 'Equal-power — constant loudness' },
  { id: 'slow',        label: 'Slow',     tip: 'Gradual — less bleed at extremes' },
  { id: 'linear',      label: 'Linear',   tip: 'Linear — simple A↔B fade' },
  { id: 'cut',         label: 'Cut',      tip: 'DJ-style — both full until center' },
];

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
    default:
      return [Math.cos(pos * Math.PI / 2), Math.sin(pos * Math.PI / 2)];
  }
}

function CurveCanvas({ curve }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.stroke();

    [['#10b981', 0], ['#f59e0b', 1]].forEach(([color, idx]) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= W; i++) {
        const gains = computeGains(i / W, curve);
        const y = H - gains[idx] * H;
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
      }
      ctx.stroke();
    });
  }, [curve]);

  return <canvas ref={canvasRef} width={140} height={40} className="xfader__tip-canvas" />;
}

function CurveButton({ c, isOn, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className={`xfader__curve-btn ${isOn ? 'xfader__curve-btn--on' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {c.label}
      {hovered && (
        <div className="xfader__tooltip">
          <CurveCanvas curve={c.id} />
          <span className="xfader__tip-label">{c.tip}</span>
        </div>
      )}
    </button>
  );
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

  return (
    <div className="xfader">
      <div className="xfader__labels">
        <span className="xfader__label xfader__label--a">
          A <span className="xfader__pct">{Math.round(gA * 100)}%</span>
        </span>
        <span className="xfader__label xfader__label--b">
          <span className="xfader__pct">{Math.round(gB * 100)}%</span> B
        </span>
      </div>

      <input
        type="range" min="0" max="1" step="0.005"
        value={pos}
        onChange={handleChange}
        className="xfader__slider"
      />

      <div className="xfader__bottom">
        <div className="xfader__curve-btns">
          {CURVES.map(c => (
            <CurveButton
              key={c.id}
              c={c}
              isOn={curve === c.id}
              onClick={() => handleCurve(c.id)}
            />
          ))}
        </div>
        <button className="xfader__center" onClick={handleCenter} title="Reset to center">
          CTR
        </button>
      </div>
    </div>
  );
}

export default Crossfader;
