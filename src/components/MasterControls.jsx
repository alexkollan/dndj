// MasterControls.jsx — Master Controls Panel
// Provides the master volume slider, a "Stop All" button, and hotkey hints.
// The "Stop All" action is also triggered by pressing Space (registered here).

import React, { useEffect, useState } from 'react';
import '../styles/controls.css';

// Keyboard shortcut for stopping all audio
const STOP_ALL_KEY = ' '; // Space bar

/**
 * CategoryMixerRow
 * Sub-component for a single category's volume and EQ.
 */
function CategoryMixerRow({ name, settings, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const { volume = 1, eq = { bass: 0, mid: 0, high: 0 } } = settings || {};

  const handleEqChange = (band, val) => {
    onChange(name, 'eq', { ...eq, [band]: val });
  };

  const displayName = name.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mixer-row">
      <div className="mixer-row__main">
        <span className="mixer-row__name">{displayName}</span>
        <input
          className="mixer-row__slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onChange(name, 'volume', parseFloat(e.target.value))}
        />
        <button 
          className={`mixer-row__expand ${expanded ? 'mixer-row__expand--active' : ''}`}
          onClick={() => setExpanded(!expanded)}
          title="EQ Settings"
        >
          ⋯
        </button>
      </div>
      
      {expanded && (
        <div className="mixer-row__eq">
          <div className="eq-control">
            <label>Bass</label>
            <input 
              type="range" min="-1" max="1" step="0.1" 
              value={eq.bass} onChange={(e) => handleEqChange('bass', parseFloat(e.target.value))} 
            />
          </div>
          <div className="eq-control">
            <label>Mid</label>
            <input 
              type="range" min="-1" max="1" step="0.1" 
              value={eq.mid} onChange={(e) => handleEqChange('mid', parseFloat(e.target.value))} 
            />
          </div>
          <div className="eq-control">
            <label>High</label>
            <input 
              type="range" min="-1" max="1" step="0.1" 
              value={eq.high} onChange={(e) => handleEqChange('high', parseFloat(e.target.value))} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MasterControls
 */
function MasterControls({ 
  masterVolume, 
  onMasterVolume, 
  onStopAll, 
  categories, 
  categorySettings, 
  onCategoryChange 
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target.tagName.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (!isTyping && e.key === STOP_ALL_KEY) {
        e.preventDefault();
        onStopAll();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStopAll]);

  return (
    <div className="master-controls">
      <h2 className="master-controls__title">Master Controls</h2>

      {/* Global Volume */}
      <div className="master-controls__volume">
        <label className="master-controls__label" htmlFor="master-volume">
          Master Volume
        </label>
        <input
          id="master-volume"
          className="master-controls__slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={masterVolume}
          onChange={(e) => onMasterVolume(parseFloat(e.target.value))}
        />
        <span className="master-controls__value">{Math.round(masterVolume * 100)}%</span>
      </div>

      {/* Category Mixer */}
      <div className="master-controls__mixer">
        <h3 className="master-controls__subtitle">Category Mix</h3>
        {categories.map((cat) => (
          <CategoryMixerRow
            key={cat}
            name={cat}
            settings={categorySettings[cat]}
            onChange={onCategoryChange}
          />
        ))}
      </div>

      {/* Stop All button */}
      <button
        className="master-controls__stop-all"
        onClick={onStopAll}
      >
        ■ Stop All
      </button>

      {/* Hotkeys */}
      <div className="master-controls__hotkeys">
        <h3 className="master-controls__hotkeys-title">Hotkeys</h3>
        <ul className="master-controls__hotkeys-list">
          <li><kbd>Space</kbd> Stop all sounds</li>
        </ul>
      </div>
    </div>
  );
}

export default MasterControls;
