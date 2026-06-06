import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/studio/ScenePanel.css';

function ScenePanel({ onGetSnapshot, onRecall }) {
  const [scenes, setScenes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const saveInputRef = useRef(null);

  const loadScenes = useCallback(async () => {
    const all = await window.dndj.getScenes();
    setScenes(all || []);
  }, []);

  useEffect(() => { loadScenes(); }, [loadScenes]);

  useEffect(() => {
    if (saving) saveInputRef.current?.select();
  }, [saving]);

  const handleSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name || !onGetSnapshot) return;
    const snapshot = await onGetSnapshot();
    await window.dndj.saveSceneSnapshot(name, JSON.stringify(snapshot));
    setSaving(false);
    setSaveName('');
    loadScenes();
  }, [saveName, onGetSnapshot, loadScenes]);

  const handleDelete = useCallback(async (id) => {
    await window.dndj.deleteScene(id);
    loadScenes();
  }, [loadScenes]);

  const handleRecall = useCallback((scene, withFade) => {
    if (!scene.snapshot_json || !onRecall) return;
    try {
      const snapshot = JSON.parse(scene.snapshot_json);
      onRecall(snapshot, withFade);
    } catch (_) {}
  }, [onRecall]);

  const snapshots = scenes.filter(s => s.snapshot_json);
  const classics = scenes.filter(s => !s.snapshot_json);

  return (
    <div className="scene-panel">
      <div className="scene-panel__header">
        <span className="scene-panel__title">SCENES</span>
        {!saving ? (
          <button
            className="scene-panel__save-btn"
            onClick={() => { setSaving(true); setSaveName(''); }}
            title="Save current board state as a scene"
          >+ Save</button>
        ) : (
          <div className="scene-panel__save-row">
            <input
              ref={saveInputRef}
              className="scene-panel__save-input"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Scene name…"
              onKeyDown={e => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') { setSaving(false); setSaveName(''); }
              }}
            />
            <button className="scene-panel__confirm-btn" onClick={handleSave} disabled={!saveName.trim()}>✓</button>
            <button className="scene-panel__cancel-btn" onClick={() => { setSaving(false); setSaveName(''); }}>×</button>
          </div>
        )}
      </div>

      <div className="scene-panel__list">
        {snapshots.length === 0 && classics.length === 0 && !saving && (
          <p className="scene-panel__empty">No scenes yet.<br />Set up your decks and click + Save.</p>
        )}

        {snapshots.map(scene => (
          <SceneRow
            key={scene.id}
            scene={scene}
            isSnapshot
            onRecall={handleRecall}
            onDelete={handleDelete}
          />
        ))}

        {classics.length > 0 && snapshots.length > 0 && <div className="scene-panel__sep" />}

        {classics.map(scene => (
          <SceneRow
            key={scene.id}
            scene={scene}
            isSnapshot={false}
            onRecall={handleRecall}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function SceneRow({ scene, isSnapshot, onRecall, onDelete }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`scene-row ${isSnapshot ? 'scene-row--snapshot' : 'scene-row--classic'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="scene-row__icon" title={isSnapshot ? 'Studio snapshot' : 'Classic scene'}>
        {isSnapshot ? '✦' : '♪'}
      </span>
      <span className="scene-row__name" title={scene.name}>{scene.name}</span>
      <div className="scene-row__actions">
        {isSnapshot && (
          <>
            <button
              className="scene-row__btn"
              onClick={() => onRecall(scene, false)}
              title="Recall instantly"
            >▶</button>
            <button
              className="scene-row__btn scene-row__btn--fade"
              onClick={() => onRecall(scene, true)}
              title="Recall with 2s crossfade"
            >⟶</button>
          </>
        )}
        {hovered && (
          <button
            className="scene-row__btn scene-row__btn--del"
            onClick={() => onDelete(scene.id)}
            title={`Delete "${scene.name}"`}
          >×</button>
        )}
      </div>
    </div>
  );
}

export default ScenePanel;
