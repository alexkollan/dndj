// SceneList.jsx — Collections
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  playTrack, stopTrack, setTrackVolume, seekTrack, 
  getPlaybackPosition, pauseTrack, resumeTrack, isPaused,
  subscribe
} from '../audioEngine.js';
import WaveformEditor from './WaveformEditor.jsx';
import '../styles/components/SceneList.css';

function SceneList({ scenes, resolveUrl, onPlayingUrlsChange, playingUrls, onRename, onAddTag }) {
  const [selectedScene, setSelectedScene] = useState(null);
  const [sceneTracks, setSceneTracks] = useState([]);
  const [localUrlCache, setLocalUrlCache] = useState({});
  const [playbackPositions, setPlaybackPositions] = useState({});
  const [pausedUrls, setPausedUrls] = useState(new Set());
  const [isRenamingTrack, setIsRenamingTrack] = useState(null); 
  const [tempName, setTempName] = useState('');
  const [isTaggingTrack, setIsTaggingTrack] = useState(null);
  const [newTag, setNewTag] = useState('');

  const rafRef = useRef();

  useEffect(() => {
    const updatePositions = () => {
      setPlaybackPositions(prev => {
        const next = { ...prev };
        let hasChanges = false;
        playingUrls.forEach(url => {
          const pos = getPlaybackPosition(url);
          if (next[url] !== pos) {
            next[url] = pos;
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
      rafRef.current = requestAnimationFrame(updatePositions);
    };
    rafRef.current = requestAnimationFrame(updatePositions);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playingUrls]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (['trackPaused', 'trackResumed', 'trackStarted', 'trackStopped', 'trackEnded', 'trackSeeked'].includes(event)) {
        const newPaused = new Set();
        // Check all tracked URLs for paused state
        Object.keys(playbackPositions).forEach(url => {
          if (isPaused(url)) newPaused.add(url);
        });
        // Also check active playingUrls
        playingUrls.forEach(url => {
          if (isPaused(url)) newPaused.add(url);
        });
        setPausedUrls(newPaused);
      }
    });
    return () => unsubscribe();
  }, [playingUrls, playbackPositions]);

  const fetchSceneTracks = useCallback(async (sceneId) => {
    const tracks = await window.dndj.getSceneTracks(sceneId);
    setSceneTracks(tracks);
    const cache = {};
    for (const t of tracks) {
      if (!localUrlCache[t.path]) {
        cache[t.path] = await resolveUrl(t.path);
      }
    }
    setLocalUrlCache(prev => ({ ...prev, ...cache }));
  }, [resolveUrl, localUrlCache]);

  useEffect(() => {
    if (selectedScene) {
      fetchSceneTracks(selectedScene.id);
    }
  }, [selectedScene]);

  const updateTrackSettings = async (trackId, settings) => {
    const track = sceneTracks.find(t => t.track_id === trackId);
    if (!track) return;
    const newVolume = settings.volume ?? track.volume;
    const newLoop = settings.is_loop ?? track.is_loop;
    const newStart = settings.start_time ?? track.start_time;
    const newEnd = settings.end_time ?? track.end_time;

    const updated = await window.dndj.updateSceneTrackSettings(
      selectedScene.id, trackId, newVolume, newLoop, newStart, newEnd
    );
    setSceneTracks(updated);

    const audioUrl = localUrlCache[track.path];
    if (audioUrl && playingUrls.has(audioUrl)) {
      if (settings.volume !== undefined) setTrackVolume(audioUrl, settings.volume);
    }
  };

  const handleToggleTrack = useCallback((track) => {
    const audioUrl = localUrlCache[track.path];
    if (!audioUrl) return;

    if (playingUrls.has(audioUrl)) {
      if (isPaused(audioUrl)) resumeTrack(audioUrl);
      else pauseTrack(audioUrl);
    } else {
      const startAt = playbackPositions[audioUrl] || track.start_time;
      playTrack(
        audioUrl, !!track.is_loop, track.volume, track.format, 
        null, 
        startAt, track.end_time
      );
    }
  }, [localUrlCache, playingUrls, playbackPositions]);

  const handleStopTrack = useCallback((track) => {
    const audioUrl = localUrlCache[track.path];
    if (audioUrl) {
      stopTrack(audioUrl);
      setPlaybackPositions(prev => ({ ...prev, [audioUrl]: track.start_time }));
    }
  }, [localUrlCache]);

  const handleRemoveTrack = async (trackId) => {
    if (!selectedScene) return;
    const updated = await window.dndj.removeTrackFromScene(selectedScene.id, trackId);
    setSceneTracks(updated);
  };

  const handleRenameSubmit = async (trackId, name) => {
    if (tempName.trim() && tempName.trim() !== name) {
      await onRename(trackId, tempName.trim());
      if (selectedScene) fetchSceneTracks(selectedScene.id);
    }
    setIsRenamingTrack(null);
  };

  const handleAddTagSubmit = async (e, trackId) => {
    e.preventDefault();
    if (newTag.trim()) {
      await onAddTag(trackId, newTag.trim());
      setNewTag('');
      setIsTaggingTrack(null);
      if (selectedScene) fetchSceneTracks(selectedScene.id);
    }
  };

  const handleManualSeek = (audioUrl, time) => {
    seekTrack(audioUrl, time);
    setPlaybackPositions(prev => ({ ...prev, [audioUrl]: time }));
  };

  if (!selectedScene) {
    if (scenes.length === 0) {
      return (
        <div className="empty-state">
          <p>Your scene collection is empty. Use the 🎬 button on any track to create one.</p>
        </div>
      );
    }
    return (
      <div className="scene-grid">
        {scenes.map(scene => (
          <div key={scene.id} className="scene-card" onClick={() => setSelectedScene(scene)}>
            <div className="scene-card__header">
              <h3 className="scene-card__title">{scene.name.toUpperCase()}</h3>
              <span className="scene-card__badge">EDIT →</span>
            </div>
            <p className="scene-card__desc">{scene.description || 'Custom audio collection'}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="scene-viewer">
      <header className="scene-viewer__header">
        <button className="btn-back" onClick={() => setSelectedScene(null)}>← ALL SCENES</button>
        <div className="scene-viewer__actions">
          <h2 className="scene-viewer__title">{selectedScene.name}</h2>
        </div>
      </header>

      <div className="scene-viewer__track-list">
        {sceneTracks.map(track => {
          const audioUrl = localUrlCache[track.path];
          const isPlayingTrack = audioUrl ? playingUrls.has(audioUrl) : false;
          const isPausedTrack = audioUrl ? pausedUrls.has(audioUrl) : false;
          const canRename = !isPlayingTrack && !isPausedTrack;
          const tagList = (track.tags || '').split(',').filter(Boolean);
          
          return (
            <div key={track.track_id} className={`scene-track-item ${isPlayingTrack ? 'scene-track-item--playing' : ''}`}>
              <div className="scene-track-item__main">
                <div className="scene-track-item__play-controls">
                  <button 
                    className={`scene-track-item__play-btn ${isPlayingTrack && !isPausedTrack ? 'scene-track-item__play-btn--active' : ''}`}
                    onClick={() => handleToggleTrack(track)}
                  >
                    {isPlayingTrack ? (isPausedTrack ? '▶' : 'Ⅱ') : '▶'}
                  </button>
                  <button 
                    className="scene-track-item__stop-btn"
                    onClick={() => handleStopTrack(track)}
                    disabled={!isPlayingTrack}
                  >
                    ■
                  </button>
                </div>
                
                <div className="scene-track-item__info">
                  <div className="scene-track-item__header-row">
                    <span className={`category-badge category-badge--${track.category}`}>
                      {track.category.toUpperCase()}
                    </span>
                    {isRenamingTrack === track.track_id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(track.track_id, track.name); }}>
                        <input 
                          autoFocus
                          className="scene-track-item__rename-input"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onBlur={() => setIsRenamingTrack(null)}
                        />
                      </form>
                    ) : (
                      <span 
                        className={`scene-track-item__name ${canRename ? 'scene-track-item__name--renamable' : ''}`}
                        onClick={() => { if (canRename) { setIsRenamingTrack(track.track_id); setTempName(track.name); } }}
                        title={canRename ? "Click to rename" : "Cannot rename while playing"}
                      >
                        {track.name}
                      </span>
                    )}
                    <button className="btn-remove-track" onClick={() => handleRemoveTrack(track.track_id)} title="Remove from scene">×</button>
                  </div>

                  <div className="scene-track-item__tags">
                    {tagList.map((tag, idx) => (
                      <span key={idx} className="track-card__tag">{tag}</span>
                    ))}
                    <button className="track-card__tag-add" onClick={() => setIsTaggingTrack(track.track_id)}>+</button>
                    {isTaggingTrack === track.track_id && (
                      <form onSubmit={(e) => handleAddTagSubmit(e, track.track_id)}>
                        <input 
                          autoFocus 
                          className="track-card__tag-input"
                          value={newTag} 
                          onChange={e => setNewTag(e.target.value)}
                          placeholder="Tag..."
                          onBlur={() => setIsTaggingTrack(null)}
                        />
                      </form>
                    )}
                  </div>
                </div>

                <div className="scene-track-item__controls">
                  <div className="control-group">
                    <label>VOL</label>
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={track.volume} 
                      onChange={(e) => updateTrackSettings(track.track_id, { volume: parseFloat(e.target.value) })}
                    />
                  </div>
                  <button 
                    className={`btn-loop-toggle ${track.is_loop ? 'active' : ''}`}
                    onClick={() => updateTrackSettings(track.track_id, { is_loop: track.is_loop ? 0 : 1 })}
                  >
                    🔁
                  </button>
                </div>
              </div>
              
              <div className="scene-track-item__waveform">
                <div className="waveform-header">
                  <span>CROP: {track.start_time.toFixed(1)}s - {track.end_time ? track.end_time.toFixed(1) + 's' : 'END'}</span>
                  <button className="btn-reset-crop" onClick={() => updateTrackSettings(track.track_id, { start_time: 0, end_time: null })}>RESET</button>
                </div>
                <WaveformEditor 
                  trackId={track.track_id}
                  audioUrl={audioUrl}
                  startTime={track.start_time}
                  endTime={track.end_time}
                  initialPeaks={track.peaks}
                  onPeaksGenerated={(id, peaks) => {
                    window.dndj.updateTrackPeaks(id, peaks);
                  }}
                  onCropChange={(start, end) => updateTrackSettings(track.track_id, { start_time: start, end_time: end })}
                  playbackTime={playbackPositions[audioUrl] ?? track.start_time}
                  onSeek={(time) => handleManualSeek(audioUrl, time)}
                  onSeekStart={null} // No auto-pause needed anymore
                  onSeekEnd={null}   // No auto-resume needed anymore
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SceneList;
