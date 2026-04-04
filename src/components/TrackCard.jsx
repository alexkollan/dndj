// TrackCard.jsx — Modular & Modern
import React, { useState } from 'react';
import '../styles/components/TrackCard.css';

function TrackCard({
  trackId,
  name,
  tags = '',
  isPlaying,
  isPaused,
  showVolume,
  volume,
  onToggle,
  onVolume,
  onAddTag,
  scenes = [],
  onAddToScene,
  onRename
}) {
  const [isTagging, setIsTagging] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isAddingToScene, setIsAddingToScene] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempName, setTempName] = useState(name);

  const tagList = (tags || '').split(',').filter(Boolean);

  const handleAddTag = (e) => {
    e.preventDefault();
    if (newTag.trim()) {
      onAddTag(trackId, newTag.trim());
      setNewTag('');
      setIsTagging(false);
    }
  };

  const handleSceneSubmit = (e) => {
    e.preventDefault();
    if (newSceneName.trim()) {
      onAddToScene(trackId, null, newSceneName.trim());
      setNewSceneName('');
      setIsAddingToScene(false);
    }
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (tempName.trim() && tempName.trim() !== name) {
      onRename(trackId, tempName.trim());
    }
    setIsRenaming(false);
  };

  const canRename = !isPlaying && !isPaused;

  const handleNameClick = (e) => {
    e.stopPropagation();
    if (canRename) {
      setIsRenaming(true);
      setTempName(name);
    }
  };

  return (
    <div 
      className={`track-card ${isPlaying ? 'track-card--playing' : ''} ${(isTagging || isAddingToScene || isRenaming) ? 'track-card--active' : ''}`} 
      onClick={(e) => {
        const isInteractive = e.target.closest('button, input, form, .track-card__vol, .track-card__tag, .track-card__scene-menu, .track-card__name');
        if (!isInteractive) {
          onToggle();
        }
    }}>
      <div className="track-card__main">
        <button 
          className={`track-card__btn ${isPlaying ? 'track-card__btn--active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isPlaying ? (isPaused ? '▶' : '■') : '▶'}
        </button>

        <div className="track-card__info">
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} onClick={e => e.stopPropagation()}>
              <input 
                autoFocus 
                className="track-card__rename-input"
                value={tempName} 
                onChange={e => setTempName(e.target.value)}
                onBlur={() => setIsRenaming(false)}
              />
            </form>
          ) : (
            <span 
              className={`track-card__name ${canRename ? 'track-card__name--renamable' : ''}`}
              title={canRename ? "Click to rename" : "Cannot rename while playing"}
              onClick={handleNameClick}
            >
              {name}
            </span>
          )}
          
          <div className="track-card__tags">
            <span className="track-card__tags-label">Tags:</span>
            {tagList.map((tag, idx) => (
              <span key={idx} className="track-card__tag">{tag}</span>
            ))}
            <button className="track-card__tag-add" title="Add Tag" onClick={(e) => { e.stopPropagation(); setIsTagging(!isTagging); }}>
              +
            </button>
            <button className="track-card__scene-add" title="Add to Scene" onClick={(e) => { e.stopPropagation(); setIsAddingToScene(!isAddingToScene); }}>
              🎬
            </button>
          </div>
          
          {isTagging && (
            <form onSubmit={handleAddTag} onClick={e => e.stopPropagation()}>
              <input 
                autoFocus 
                className="track-card__tag-input"
                value={newTag} 
                onChange={e => setNewTag(e.target.value)}
                placeholder="Tag..."
                onBlur={() => !newTag && setIsTagging(false)}
              />
            </form>
          )}

          {isAddingToScene && (
            <div className="track-card__scene-menu" onClick={e => e.stopPropagation()}>
              {scenes.length > 0 && (
                <div className="scene-menu__list">
                  {scenes.map(s => (
                    <button key={s.id} onClick={() => { onAddToScene(trackId, s.id); setIsAddingToScene(false); }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSceneSubmit}>
                <input 
                  autoFocus
                  placeholder="New Scene..." 
                  value={newSceneName} 
                  onChange={e => setNewSceneName(e.target.value)}
                />
              </form>
            </div>
          )}
        </div>
      </div>

      {showVolume && (
        <div className="track-card__vol" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          <input
            type="range" min="0" max="1" step="0.01"
            value={volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            onMouseDown={e => e.stopPropagation()}
            className="track-card__slider"
          />
          <span className="track-card__vol-val">{Math.round(volume * 100)}</span>
        </div>
      )}
    </div>
  );
}

export default TrackCard;
