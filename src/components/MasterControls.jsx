// MasterControls.jsx — Master Controls Panel
// Provides the master volume slider, a "Stop All" button, and hotkey hints.
// The "Stop All" action is also triggered by pressing Space (registered here).

import React, { useEffect } from 'react';
import '../styles/controls.css';

// Keyboard shortcut for stopping all audio
const STOP_ALL_KEY = ' '; // Space bar

/**
 * MasterControls
 *
 * Props:
 *   masterVolume    {number}    - Current master volume 0..1
 *   onMasterVolume  {function}  - Called with new volume when slider changes
 *   onStopAll       {function}  - Called when Stop All is triggered
 */
function MasterControls({ masterVolume, onMasterVolume, onStopAll }) {
  // Register the Space hotkey for Stop All.
  // The listener is added on mount and cleaned up on unmount to avoid leaks.
  useEffect(() => {
    function handleKeyDown(e) {
      // Only trigger if the focus is NOT inside an input/textarea/button,
      // so the hotkey doesn't interfere with other controls.
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

      {/* Master volume slider */}
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
          aria-label="Master volume"
        />
        <span className="master-controls__value">{Math.round(masterVolume * 100)}%</span>
      </div>

      {/* Stop All button */}
      <button
        className="master-controls__stop-all"
        onClick={onStopAll}
        aria-label="Stop all sounds"
      >
        ■ Stop All
      </button>

      {/* Hotkey hints for DMs who prefer keyboard navigation */}
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
