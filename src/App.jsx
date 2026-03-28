// App.jsx — Root Component
// Handles top-level layout and state wiring:
//   - Fetches the sound library via IPC on mount
//   - Tracks the selected category
//   - Wires master volume to the audio engine
//   - Renders the sidebar, main panel (atmosphere or soundboard), and controls

import React, { useState, useEffect, useCallback } from 'react';
import CategorySidebar from './components/CategorySidebar.jsx';
import AtmospherePlayer from './components/AtmospherePlayer.jsx';
import Soundboard from './components/Soundboard.jsx';
import MasterControls from './components/MasterControls.jsx';
import { setMasterVolume, stopAll } from './audioEngine.js';

// Default master volume on launch
const DEFAULT_MASTER_VOLUME = 0.8;

// SFX category is handled by Soundboard, not AtmospherePlayer
const SFX_CATEGORY = 'sfx';

/**
 * App
 * Root component. Mounts once and manages global state.
 */
function App() {
  // The full sound library returned by libraryScanner: { [category]: [tracks] }
  const [library, setLibrary] = useState({});

  // Sorted list of category keys for the sidebar
  const [categories, setCategories] = useState([]);

  // The category currently displayed in the main panel
  const [selectedCategory, setSelectedCategory] = useState('');

  // Global master volume (0..1)
  const [masterVolume, setMasterVolumeState] = useState(DEFAULT_MASTER_VOLUME);

  // Loading state for the initial library scan
  const [loading, setLoading] = useState(true);

  // Error message if scanning fails
  const [error, setError] = useState(null);

  // ── Load sound library on mount ───────────────────────────────────────────
  useEffect(() => {
    async function loadLibrary() {
      try {
        // window.dndj is exposed by preload.js via the context bridge
        const result = await window.dndj.scanLibrary();
        const cats = Object.keys(result).sort();
        setLibrary(result);
        setCategories(cats);
        // Default to the first category, preferring 'atmosphere' if available
        setSelectedCategory(cats.includes('atmosphere') ? 'atmosphere' : (cats[0] ?? ''));
      } catch (err) {
        setError(`Failed to load sound library: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    loadLibrary();
  }, []);

  // ── Apply initial master volume ───────────────────────────────────────────
  useEffect(() => {
    setMasterVolume(DEFAULT_MASTER_VOLUME);
  }, []);

  // ── Master volume handler ─────────────────────────────────────────────────
  const handleMasterVolume = useCallback((vol) => {
    setMasterVolumeState(vol);
    setMasterVolume(vol);
  }, []);

  // ── Stop All handler ──────────────────────────────────────────────────────
  const handleStopAll = useCallback(() => {
    stopAll();
  }, []);

  // ── URL resolver (passed to child components) ─────────────────────────────
  const getUrl = useCallback((filePath) => {
    return window.dndj.getAudioUrl(filePath);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app app--loading">
        <p>Scanning sound library…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app app--error">
        <p>{error}</p>
      </div>
    );
  }

  // Determine which main panel to show
  const showSoundboard = selectedCategory === SFX_CATEGORY;

  return (
    <div className="app">
      {/* Left: category navigation sidebar */}
      <CategorySidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Centre: atmosphere player or soundboard depending on selected category */}
      <main className="app__main">
        <h1 className="app__panel-title">
          {selectedCategory
            ? selectedCategory.replace(/\b\w/g, (c) => c.toUpperCase())
            : 'DNDj'}
        </h1>

        {showSoundboard ? (
          <Soundboard library={library} getUrl={getUrl} />
        ) : (
          <AtmospherePlayer
            library={library}
            category={selectedCategory}
            getUrl={getUrl}
          />
        )}
      </main>

      {/* Right: master volume and stop-all controls */}
      <aside className="app__controls">
        <MasterControls
          masterVolume={masterVolume}
          onMasterVolume={handleMasterVolume}
          onStopAll={handleStopAll}
        />
      </aside>
    </div>
  );
}

export default App;
