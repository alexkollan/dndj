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
import { setMasterVolume, stopAll, setTrackVolume } from './audioEngine.js';
import { loadSettings, saveSettings } from './settingsManager.js';

// Default layout sizes
const DEFAULT_SIDEBAR_WIDTH = 180;
const DEFAULT_CONTROLS_WIDTH = 280;

// SFX category is handled by Soundboard, not AtmospherePlayer
const SFX_CATEGORY = 'sfx';

/**
 * App
 * Root component. Mounts once and manages global state.
 */
function App() {
  // Load settings from storage or defaults
  const [settings, setSettingsState] = useState(loadSettings());

  // Layout state
  const [sidebarWidth, setSidebarWidth] = useState(settings.layout?.sidebarWidth || DEFAULT_SIDEBAR_WIDTH);
  const [controlsWidth, setControlsWidth] = useState(settings.layout?.controlsWidth || DEFAULT_CONTROLS_WIDTH);
  const appRef = React.useRef(null);

  // The full sound library returned by libraryScanner: { [category]: [tracks] }
  const [library, setLibrary] = useState({});

  // Sorted list of category keys for the sidebar
  const [categories, setCategories] = useState([]);

  // The category currently displayed in the main panel
  const [selectedCategory, setSelectedCategory] = useState('');

  // Global master volume (0..1)
  const [masterVolume, setMasterVolumeState] = useState(settings.masterVolume);

  // Loading state for the initial library scan
  const [loading, setLoading] = useState(true);

  // Error message if scanning fails
  const [error, setError] = useState(null);

  // Track which URLs are currently playing: Set<string>
  const [playingUrls, setPlayingUrls] = useState(new Set());

  // Cache of resolved URLs to avoid repeated IPC round-trips: { [filePath]: url }
  const [urlCache, setUrlCache] = useState({});

  /**
   * resolveUrl
   * Converts a file path to an app:// URL, using the local cache to avoid
   * repeated IPC calls for the same file.
   */
  const resolveUrl = useCallback(async (filePath) => {
    if (urlCache[filePath]) return urlCache[filePath];
    const resolvedUrl = await window.dndj.getAudioUrl(filePath);
    setUrlCache((prev) => ({ ...prev, [filePath]: resolvedUrl }));
    return resolvedUrl;
  }, [urlCache]);

  /**
   * updateSettings
   * Helper to update part of the settings object and persist to storage.
   */
  const updateSettings = useCallback((updates) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  /**
   * updateCategorySetting
   * Helper to update specific category's volume or EQ and persist.
   */
  const updateCategorySetting = useCallback((categoryName, settingKey, value) => {
    setSettingsState((prev) => {
      const catSettings = prev.categories[categoryName] || { volume: 1, eq: { bass: 0, mid: 0, high: 0 } };
      const nextCatSettings = { ...catSettings, [settingKey]: value };
      const next = {
        ...prev,
        categories: { ...prev.categories, [categoryName]: nextCatSettings }
      };
      saveSettings(next);
      return next;
    });
  }, []);

  // ── Layout Persistence & Sync ─────────────────────────────────────────────
  useEffect(() => {
    if (appRef.current) {
      appRef.current.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
      appRef.current.style.setProperty('--controls-width', `${controlsWidth}px`);
    }
    // Debounced save of layout
    const timer = setTimeout(() => {
      updateSettings({ layout: { sidebarWidth, controlsWidth } });
    }, 500);
    return () => clearTimeout(timer);
  }, [sidebarWidth, controlsWidth, updateSettings]);

  // ── Resizing Handlers ─────────────────────────────────────────────────────
  const startResizing = useCallback((type) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = type === 'sidebar' ? sidebarWidth : controlsWidth;

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      if (type === 'sidebar') {
        setSidebarWidth(Math.max(140, Math.min(400, startWidth + delta)));
      } else {
        setControlsWidth(Math.max(180, Math.min(500, startWidth - delta)));
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth, controlsWidth]);

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
    setMasterVolume(settings.masterVolume);
  }, [settings.masterVolume]);

  // ── Master volume handler ─────────────────────────────────────────────────
  const handleMasterVolume = useCallback((vol) => {
    setMasterVolumeState(vol);
    setMasterVolume(vol);
    updateSettings({ masterVolume: vol });
  }, [updateSettings]);

  // ── Stop All handler ──────────────────────────────────────────────────────
  const handleStopAll = useCallback(() => {
    stopAll();
    setPlayingUrls(new Set()); // Clear UI state for all playing tracks
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
    <div className="app" ref={appRef}>
      {/* Left: category navigation sidebar */}
      <CategorySidebar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Resizer Sidebar/Main */}
      <div className="app__resizer" onMouseDown={startResizing('sidebar')} />

      {/* Centre: atmosphere player or soundboard depending on selected category */}
      <main className="app__main">
        <h1 className="app__panel-title">
          {selectedCategory
            ? selectedCategory.replace(/\b\w/g, (c) => c.toUpperCase())
            : 'DNDj'}
        </h1>

        {showSoundboard ? (
          <Soundboard
            library={library}
            resolveUrl={resolveUrl}
            urlCache={urlCache}
            playingUrls={playingUrls}
            onPlayingUrlsChange={setPlayingUrls}
          />
        ) : (
          <AtmospherePlayer
            library={library}
            category={selectedCategory}
            resolveUrl={resolveUrl}
            urlCache={urlCache}
            playingUrls={playingUrls}
            onPlayingUrlsChange={setPlayingUrls}
            categorySettings={settings.categories[selectedCategory]}
          />
        )}
      </main>

      {/* Resizer Main/Controls */}
      <div className="app__resizer" onMouseDown={startResizing('controls')} />

      {/* Right: master volume and stop-all controls */}
      <aside className="app__controls">
        <MasterControls
          masterVolume={masterVolume}
          onMasterVolume={handleMasterVolume}
          onStopAll={handleStopAll}
          categories={categories}
          categorySettings={settings.categories}
          onCategoryChange={updateCategorySetting}
        />
      </aside>
    </div>
  );
}

export default App;
