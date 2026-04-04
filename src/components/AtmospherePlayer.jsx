// AtmospherePlayer.jsx — Seamless Ambience
import React from 'react';
import TrackCard from './TrackCard.jsx';
import '../styles/components/MainLayout.css';

function AtmospherePlayer({ 
  library, 
  filteredTracks, 
  category, 
  resolveUrl, 
  urlCache, 
  playingUrls, 
  pausedUrls,
  onPlayingUrlsChange, 
  categorySettings = { volume: 1 },
  scenes,
  onAddToScene,
  onAddTag,
  onRename
}) {
  const tracks = filteredTracks.filter(t => t.category === category);
  const catVol = categorySettings.volume ?? 1;

  const handleToggle = async (track) => {
    const audioUrl = urlCache[track.path] || await resolveUrl(track.path);
    const isPlaying = playingUrls.has(audioUrl);
    const isPaused = pausedUrls.has(audioUrl);

    const { playTrack, stopTrack, pauseTrack, resumeTrack } = await import('../audioEngine.js');

    if (isPlaying) {
      if (isPaused) {
        resumeTrack(audioUrl);
      } else {
        pauseTrack(audioUrl);
      }
    } else {
      const trackVol = 1.0; 
      playTrack(audioUrl, true, trackVol * catVol, track.format);
    }
  };

  return (
    <div className="track-grid">
      {tracks.length > 0 ? (
        tracks.map(track => {
          const audioUrl = urlCache[track.path];
          const isPlaying = audioUrl ? playingUrls.has(audioUrl) : false;
          const isPaused = audioUrl ? pausedUrls.has(audioUrl) : false;
          
          return (
            <TrackCard
              key={track.id}
              trackId={track.id}
              name={track.name}
              tags={track.tags}
              isPlaying={isPlaying}
              isPaused={isPaused}
              showVolume={false}
              onToggle={() => handleToggle(track)}
              onAddTag={onAddTag}
              scenes={scenes}
              onAddToScene={(tid, sid, name) => onAddToScene(tid, sid, name)}
              onRename={onRename}
            />
          );
        })
      ) : (
        <div className="empty-state">No tracks found in "{category}"</div>
      )}
    </div>
  );
}

export default AtmospherePlayer;
