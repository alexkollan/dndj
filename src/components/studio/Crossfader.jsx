import React, { useState, useCallback } from 'react';
import { setCrossfade } from '../../audioEngine.js';
import '../../styles/studio/Crossfader.css';

function Crossfader() {
  const [pos, setPos] = useState(0.5);

  const handleChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    setPos(val);
    setCrossfade(val);
  }, []);

  const handleCenter = useCallback(() => {
    setPos(0.5);
    setCrossfade(0.5);
  }, []);

  const posLabel = pos <= 0.01 ? 'A' : pos >= 0.99 ? 'B' : `${Math.round(pos * 100)}%`;

  return (
    <div className="xfader">
      <div className="xfader__labels">
        <span className="xfader__label xfader__label--a">A</span>
        <span className="xfader__label xfader__label--b">B</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.005"
        value={pos}
        onChange={handleChange}
        className="xfader__slider"
        title={`Crossfade position: ${posLabel}`}
      />
      <button
        className="xfader__center"
        onClick={handleCenter}
        title="Reset to center"
      >CENTER</button>
    </div>
  );
}

export default Crossfader;
