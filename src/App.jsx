import React, { useState, useEffect, useCallback } from 'react';
import { setMasterVolume, stopAll, subscribe } from './audioEngine.js';
import { useAudioStore } from './store.js';
import StudioLayout from './components/studio/StudioLayout.jsx';
import IntegrityModal from './components/studio/IntegrityModal.jsx';
import './styles/global.css';

function App() {
  const { addPlaying, removePlaying, addPaused, clearAll } = useAudioStore();

  const [allTracks, setAllTracks] = useState([]);
  const [tags, setTags] = useState([]);
  const [masterVolume, setMasterVolumeState] = useState(0.8);
  const [urlCache, setUrlCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [integrityReport, setIntegrityReport] = useState(null); // set when launch check finds issues

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

        // Compare the database against the filesystem. If anything the DB
        // references is missing on disk, gate the app behind a cleanup modal.
        const report = await window.dndj.integrityCheck();
        if (!report.ok) setIntegrityReport(report);
      } catch (err) {
        setError(`Initialization failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleIntegrityCleanup = useCallback(async () => {
    const { tracks } = await window.dndj.integrityCleanup();
    const freshTags = await window.dndj.getTags();
    setAllTracks(tracks);
    setTags(freshTags);
    setIntegrityReport(null); // proceed into the Studio
  }, []);

  const handleQuit = useCallback(() => window.dndj.quitApp(), []);

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

  if (integrityReport && !integrityReport.ok) {
    return (
      <IntegrityModal
        mode="launch"
        report={integrityReport}
        onCleanup={handleIntegrityCleanup}
        onQuit={handleQuit}
      />
    );
  }

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
