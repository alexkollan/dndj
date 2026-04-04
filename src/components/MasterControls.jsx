// MasterControls.jsx — System Controls
import React, { useEffect } from 'react';
import '../styles/components/MasterControls.css';

function MasterControls({ 
  masterVolume, 
  onMasterVolume, 
  onStopAll, 
  onCreateEmptyScene,
  categories, 
  categorySettings, 
  onCategoryChange 
}) {
  const [isNaming, setIsNaming] = React.useState(false);
  const [sceneName, setSceneName] = React.useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (sceneName.trim()) {
      onCreateEmptyScene(sceneName.trim());
      setSceneName('');
      setIsNaming(false);
    }
  };

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === ' ' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        onStopAll();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStopAll]);

  return (
    <div className="controls-panel">
      <h2 className="controls-title">MASTER</h2>

      <section className="controls-section">
        <div className="master-vol-container">
          <span className="master-vol-val">{Math.round(masterVolume * 100)}%</span>
          <input
            className="master-vol-slider"
            type="range" min="0" max="1" step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolume(parseFloat(e.target.value))}
          />
          <span className="controls-subtitle">GLOBAL VOLUME</span>
        </div>
      </section>

      <section className="controls-section">
        <h3 className="controls-subtitle">CATEGORY MIXER</h3>
        <div className="mixer-grid">
          {categories.map((cat) => (
            <div key={cat} className="mixer-item">
              <span className="mixer-name">{cat.toUpperCase()}</span>
              <input
                type="range" min="0" max="1" step="0.01"
                value={categorySettings[cat]?.volume ?? 1}
                onChange={(e) => onCategoryChange(cat, 'volume', parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="controls-section">
        {!isNaming ? (
          <button className="btn-save-scene" onClick={() => setIsNaming(true)}>
            ➕ CREATE EMPTY SCENE
          </button>
        ) : (
          <form className="scene-save-form" onSubmit={handleCreate}>
            <input
              autoFocus
              className="scene-name-input"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="New Scene Name..."
              onBlur={() => !sceneName && setIsNaming(false)}
            />
            <div className="scene-save-actions">
              <button type="submit" className="btn-save-confirm">CREATE</button>
              <button type="button" className="btn-save-cancel" onClick={() => setIsNaming(false)}>X</button>
            </div>
          </form>
        )}
      </section>

      <button className="btn-stop-all" onClick={onStopAll}>
        ■ STOP ALL
      </button>
    </div>
  );
}

export default MasterControls;
