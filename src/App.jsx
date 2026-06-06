import React, { useState, useEffect, useCallback } from 'react';
import { setMasterVolume, stopAll, subscribe } from './audioEngine.js';
import { useAudioStore } from './store.js';
import StudioLayout from './components/studio/StudioLayout.jsx';
import './styles/global.css';

function App() {
  const { addPlaying, removePlaying, addPaused, clearAll } = useAudioStore();

  const [allTracks, setAllTracks] = useState([]);
  const [tags, setTags] = useState([]);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const [urlCache, setUrlCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wire audio engine events into the global audio store
  useEffect(() => {
    const unsub = subscribe((event, data) => {
      if (event === 'trackStarted' || event === 'trackResumed') addPlaying(data.audioUrl);
      else if (event === 'trackEnded' || event === 'trackStopped') removePlaying(data.audioUrl);
      else if (event === 'trackPaused') addPaused(data.audioUrl);
    });
    return () => unsub();
  }, [addPlaying, removePlaying, addPaused]);

  const resolveUrl = useCallback(async (filePath) => {
    if (urlCache[filePath]) return urlCache[filePath];
    const resolved = await window.dndj.getAudioUrl(filePath);
    setUrlCache(prev => ({ ...prev, [filePath]: resolved }));
    return resolved;
  }, [urlCache]);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const stored = await window.dndj.getSetting('master_volume');
        if (stored != null) {
          const vol = parseFloat(stored);
          if (!isNaN(vol)) { setMasterVolumeState(vol); setMasterVolume(vol); }
        }
        const [tracks, loadedTags] = await Promise.all([
          window.dndj.scanLibrary(),
          window.dndj.getTags(),
        ]);
        setAllTracks(tracks);
        setTags(loadedTags);
      } catch (err) {
        setError(`Initialization failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleMasterVolume = useCallback((vol) => {
    setMasterVolumeState(vol);
    setMasterVolume(vol);
    window.dndj.setSetting('master_volume', String(vol));
  }, []);

  const handleStopAll = useCallback(() => {
    stopAll();
    clearAll();
  }, [clearAll]);

  const handleRenameTrack = useCallback(async (trackId, newName) => {
    try {
      const updated = await window.dndj.renameTrack(trackId, newName);
      setAllTracks(updated);
    } catch (err) {
      alert(`Rename failed: ${err.message}`);
    }
  }, []);

  const handleAddTag = useCallback(async (id, tag) => {
    const updated = await window.dndj.addTagToTrack(id, tag);
    setAllTracks(updated);
    setTags(await window.dndj.getTags());
  }, []);

  const handleLibraryRefresh = useCallback(async () => {
    const [tracks, loadedTags] = await Promise.all([
      window.dndj.scanLibrary(),
      window.dndj.getTags(),
    ]);
    setAllTracks(tracks);
    setTags(loadedTags);
  }, []);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1623', color: '#6b7280', fontFamily: 'monospace' }}>Scanning library…</div>;
  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f1623', color: '#ef4444', fontFamily: 'monospace', padding: 32 }}>{error}</div>;

  return (
    <StudioLayout
      masterVolume={masterVolume}
      onMasterVolume={handleMasterVolume}
      onStopAll={handleStopAll}
      allTracks={allTracks}
      tags={tags}
      resolveUrl={resolveUrl}
      urlCache={urlCache}
      onRename={handleRenameTrack}
      onAddTag={handleAddTag}
      onLibraryRefresh={handleLibraryRefresh}
      onTagsChange={setTags}
      onTracksChange={setAllTracks}
    />
  );
}

export default App;
