// Soundboard.jsx — Rapid Fire SFX
import React from 'react';
import TrackCard from './TrackCard.jsx';
import '../styles/components/MainLayout.css';

function Soundboard({ 
  library, 
  filteredTracks, 
  resolveUrl, 
  urlCache, 
  playingUrls, 
  pausedUrls,
  onPlayingUrlsChange,
  scenes,
  onAddToScene,
  onRename
}) {
  const tracks = filteredTracks.filter(t => t.category === 'sfx');

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
      playTrack(audioUrl, false, 1.0, track.format);
    }
  };

  return (
    <div className="track-grid track-grid--sfx">
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
              onAddTag={() => {}} // No tags on sfx usually
              scenes={scenes}
              onAddToScene={(tid, sid, name) => onAddToScene(tid, sid, name)}
              onRename={onRename}
            />
          );
        })
      ) : (
        <div className="empty-state">No SFX tracks found</div>
      )}
    </div>
  );
}

export default Soundboard;
