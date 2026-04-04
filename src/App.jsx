// App.jsx — Root Component
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CategorySidebar from './components/CategorySidebar.jsx';
import AtmospherePlayer from './components/AtmospherePlayer.jsx';
import Soundboard from './components/Soundboard.jsx';
import MasterControls from './components/MasterControls.jsx';
import SceneList from './components/SceneList.jsx';
import { setMasterVolume, stopAll, setTrackVolume, subscribe } from './audioEngine.js';

// Styles
import './styles/global.css';
import './styles/components/MainLayout.css';

const DEFAULT_SIDEBAR_WIDTH = 240;
const DEFAULT_CONTROLS_WIDTH = 300;
const SFX_CATEGORY = 'sfx';
const SCENES_CATEGORY = 'scenes';

function App() {
  const [allTracks, setAllTracks] = useState([]);
  const [tags, setTags] = useState([]);
  const [scenes, setScenes] = useState([]);
  const [settings, setSettingsState] = useState({
    masterVolume: 0.8,
    categories: {},
    layout: { sidebarWidth: DEFAULT_SIDEBAR_WIDTH, controlsWidth: DEFAULT_CONTROLS_WIDTH }
  });

  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const [playingUrls, setPlayingUrls] = useState(new Set());
  const [pausedUrls, setPausedUrls] = useState(new Set());
  const [urlCache, setUrlCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const appRef = React.useRef(null);

  useEffect(() => {
    const unsubscribe = subscribe((event, data) => {
      if (event === 'trackStarted' || event === 'trackResumed') {
        setPlayingUrls(prev => {
          if (prev.has(data.audioUrl)) return prev;
          const next = new Set(prev);
          next.add(data.audioUrl);
          return next;
        });
        setPausedUrls(prev => {
          if (!prev.has(data.audioUrl)) return prev;
          const next = new Set(prev);
          next.delete(data.audioUrl);
          return next;
        });
      } else if (event === 'trackEnded' || event === 'trackStopped') {
        setPlayingUrls(prev => {
          if (!prev.has(data.audioUrl)) return prev;
          const next = new Set(prev);
          next.delete(data.audioUrl);
          return next;
        });
        setPausedUrls(prev => {
          if (!prev.has(data.audioUrl)) return prev;
          const next = new Set(prev);
          next.delete(data.audioUrl);
          return next;
        });
      } else if (event === 'trackPaused') {
        setPausedUrls(prev => {
          if (prev.has(data.audioUrl)) return prev;
          const next = new Set(prev);
          next.add(data.audioUrl);
          return next;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const resolveUrl = useCallback(async (filePath) => {
    if (urlCache[filePath]) return urlCache[filePath];
    const resolvedUrl = await window.dndj.getAudioUrl(filePath);
    setUrlCache((prev) => ({ ...prev, [filePath]: resolvedUrl }));
    return resolvedUrl;
  }, [urlCache]);

  const updateSettings = useCallback(async (updates) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      window.dndj.setSetting('user_settings', next);
      return next;
    });
  }, []);

  const updateCategorySetting = useCallback((categoryName, settingKey, value) => {
    setSettingsState((prev) => {
      const catSettings = prev.categories[categoryName] || { volume: 1 };
      const nextCatSettings = { ...catSettings, [settingKey]: value };
      const next = {
        ...prev,
        categories: { ...prev.categories, [categoryName]: nextCatSettings }
      };
      window.dndj.setSetting('user_settings', next);
      return next;
    });
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const storedSettings = await window.dndj.getSetting('user_settings');
        if (storedSettings) {
          setSettingsState(storedSettings);
          setMasterVolumeState(storedSettings.masterVolume);
        }
        const tracks = await window.dndj.scanLibrary();
        const loadedTags = await window.dndj.getTags();
        const loadedScenes = await window.dndj.getScenes();
        setAllTracks(tracks);
        setTags(loadedTags);
        setScenes(loadedScenes);
        const cats = [...new Set(tracks.map(t => t.category))].sort();
        if (cats.length > 0) {
          setSelectedCategory(cats.includes('atmosphere') ? 'atmosphere' : cats[0]);
        }
      } catch (err) {
        setError(`Initialization failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const library = useMemo(() => {
    const lib = {};
    allTracks.forEach(track => {
      if (!lib[track.category]) lib[track.category] = [];
      lib[track.category].push(track);
    });
    return lib;
  }, [allTracks]);

  const categories = useMemo(() => Object.keys(library).sort(), [library]);

  const filteredTracks = useMemo(() => {
    return allTracks.filter(track => {
      const matchesSearch = track.name.toLowerCase().includes(searchQuery.toLowerCase());
      const trackTags = (track.tags || '').split(',').filter(Boolean);
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => trackTags.includes(tag));
      return matchesSearch && matchesTags;
    });
  }, [allTracks, searchQuery, selectedTags]);

  const handleMasterVolume = useCallback((vol) => {
    setMasterVolumeState(vol);
    setMasterVolume(vol);
    updateSettings({ masterVolume: vol });
  }, [updateSettings]);

  const handleStopAll = useCallback(() => {
    stopAll();
    setPlayingUrls(new Set());
    setPausedUrls(new Set());
  }, []);

  const handleCreateEmptyScene = useCallback(async (name) => {
    if (!name) return;
    const updatedScenes = await window.dndj.createEmptyScene(name, '');
    setScenes(updatedScenes);
  }, []);

  const handleAddToScene = useCallback(async (trackId, sceneId, newSceneName) => {
    let targetSceneId = sceneId;
    if (!targetSceneId && newSceneName) {
      const updatedScenes = await window.dndj.createEmptyScene(newSceneName, '');
      setScenes(updatedScenes);
      const newScene = updatedScenes.find(s => s.name === newSceneName);
      if (newScene) targetSceneId = newScene.id;
    }

    if (targetSceneId) {
      await window.dndj.addTrackToScene(targetSceneId, trackId, 1.0, 1);
    }
  }, []);

  const handleRenameTrack = useCallback(async (trackId, newName) => {
    try {
      const updatedTracks = await window.dndj.renameTrack(trackId, newName);
      setAllTracks(updatedTracks);
      const loadedScenes = await window.dndj.getScenes();
      setScenes(loadedScenes);
    } catch (err) {
      alert(`Rename failed: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    if (appRef.current) {
      appRef.current.style.setProperty('--sidebar-width', `${settings.layout.sidebarWidth}px`);
      appRef.current.style.setProperty('--controls-width', `${settings.layout.controlsWidth}px`);
    }
  }, [settings.layout]);

  const startResizing = useCallback((type) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = type === 'sidebar' ? settings.layout.sidebarWidth : settings.layout.controlsWidth;
    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      if (type === 'sidebar') {
        const newWidth = Math.max(160, Math.min(400, startWidth + delta));
        updateSettings({ layout: { ...settings.layout, sidebarWidth: newWidth } });
      } else {
        const newWidth = Math.max(200, Math.min(600, startWidth - delta));
        updateSettings({ layout: { ...settings.layout, controlsWidth: newWidth } });
      }
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [settings.layout, updateSettings]);

  if (loading) return <div className="app-container"><p>Scanning...</p></div>;
  if (error) return <div className="app-container"><p>{error}</p></div>;

  let mainContent;
  if (selectedCategory === SCENES_CATEGORY) {
    mainContent = <SceneList scenes={scenes} resolveUrl={resolveUrl} onPlayingUrlsChange={setPlayingUrls} playingUrls={playingUrls} onAddTag={async (id, tag) => {
      const t = await window.dndj.addTagToTrack(id, tag);
      setAllTracks(t);
      setTags(await window.dndj.getTags());
    }} onRename={handleRenameTrack} />;
  } else if (selectedCategory === SFX_CATEGORY) {
    mainContent = <Soundboard library={library} filteredTracks={filteredTracks} resolveUrl={resolveUrl} urlCache={urlCache} playingUrls={playingUrls} pausedUrls={pausedUrls} onPlayingUrlsChange={setPlayingUrls} scenes={scenes} onAddToScene={handleAddToScene} onRename={handleRenameTrack} />;
  } else {
    mainContent = (
      <AtmospherePlayer
        library={library}
        filteredTracks={filteredTracks}
        category={selectedCategory}
        resolveUrl={resolveUrl}
        urlCache={urlCache}
        playingUrls={playingUrls}
        pausedUrls={pausedUrls}
        onPlayingUrlsChange={setPlayingUrls}
        categorySettings={settings.categories[selectedCategory]}
        scenes={scenes}
        onAddToScene={handleAddToScene}
        onRename={handleRenameTrack}
        onAddTag={async (id, tag) => {
          const t = await window.dndj.addTagToTrack(id, tag);
          setAllTracks(t);
          setTags(await window.dndj.getTags());
        }}
      />
    );
  }

  return (
    <div className="app-container" ref={appRef}>
      <CategorySidebar categories={categories} selectedCategory={selectedCategory} onSelect={setSelectedCategory} />
      <div className="resizer" onMouseDown={startResizing('sidebar')} />
      <main className="main-content">
        <header className="main-header">
          <h1 className="panel-title">{selectedCategory?.toUpperCase() || 'DNDJ'}</h1>
          {selectedCategory !== SCENES_CATEGORY && (
            <div className="search-filter">
              <input type="text" placeholder="Search tracks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
              <div className="tag-list">
                {tags.map(tag => (
                  <button key={tag.id} className={`tag-btn ${selectedTags.includes(tag.name) ? 'tag-btn--active' : ''}`} onClick={() => setSelectedTags(prev => prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name])}>
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>
        {mainContent}
      </main>
      <div className="resizer" onMouseDown={startResizing('controls')} />
      <aside className="controls-panel">
        <MasterControls 
          masterVolume={masterVolume} 
          onMasterVolume={handleMasterVolume} 
          onStopAll={handleStopAll} 
          onCreateEmptyScene={handleCreateEmptyScene} 
          categories={categories} 
          categorySettings={settings.categories} 
          onCategoryChange={updateCategorySetting} 
        />
      </aside>
    </div>
  );
}

export default App;
