import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import '../../styles/studio/YoutubeImportDialog.css';

const STAGES = { IDLE: 'idle', CHECKING: 'checking', SETUP: 'setup', INFO: 'info', IMPORTING: 'importing', DONE: 'done', ERROR: 'error' };

const PRESET_COLORS = ['#10b981','#34d399','#6ee7b7','#f59e0b','#fbbf24','#818cf8','#a78bfa','#ef4444','#f87171','#22d3ee','#67e8f9','#fb923c','#6b7280','#9ca3af','#ec4899'];

function formatDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function MiniColorPicker({ value, onChange }) {
  return (
    <div className="yt-color-grid">
      {PRESET_COLORS.map(c => (
        <button key={c} className={`yt-color-dot ${value === c ? 'yt-color-dot--on' : ''}`}
          style={{ background: c }} onClick={() => onChange(c)} title={c} />
      ))}
    </div>
  );
}

export default function YoutubeImportDialog({ onClose, onImported, existingCategories = [], categoryMeta = [], existingTags = [] }) {
  const [stage, setStage] = useState(STAGES.IDLE);
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);

  // Import form fields
  const [trackName, setTrackName] = useState('');
  const [category, setCategory] = useState('youtube');
  const [selectedTags, setSelectedTags] = useState([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [format, setFormat] = useState('mp3');

  // New category inline creation
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatFolder, setNewCatFolder] = useState('');
  const [newCatDisplay, setNewCatDisplay] = useState('');
  const [newCatColor, setNewCatColor] = useState('#818cf8');
  const [pendingNewCat, setPendingNewCat] = useState(null); // { folder, display, color }

  const [progress, setProgress] = useState({ percent: 0, status: '' });
  const [error, setError] = useState('');
  const [setupLog, setSetupLog] = useState('');
  const inputRef = useRef(null);

  const catMetaMap = useMemo(() => Object.fromEntries((categoryMeta || []).map(m => [m.folder_name, m])), [categoryMeta]);

  // All available categories = existing + any pending new one
  const allCategories = useMemo(() => {
    const base = [...new Set([...existingCategories, ...(categoryMeta || []).map(m => m.folder_name)])].sort();
    if (pendingNewCat && !base.includes(pendingNewCat.folder)) return [...base, pendingNewCat.folder];
    return base;
  }, [existingCategories, categoryMeta, pendingNewCat]);

  const existingTagNames = useMemo(() => (existingTags || []).map(t => t.name), [existingTags]);

  useEffect(() => {
    inputRef.current?.focus();
    window.dndj.youtubeCheck().then(res => {
      if (!res?.ready) setStage(STAGES.SETUP);
    });
    window.dndj.onYoutubeProgress((data) => {
      if (data.phase === 'preparing') setProgress({ percent: 0, status: data.status || 'Resolving stream URL…', indeterminate: true });
      if (data.phase === 'download') setProgress({ percent: data.percent ?? 0, status: `Downloading… ${data.percent ?? 0}%`, indeterminate: false });
      if (data.phase === 'converting') setProgress({ percent: 75, status: 'Converting audio…', indeterminate: false });
      if (data.phase === 'setup') setSetupLog(prev => prev + (data.status || '') + '\n');
    });
    return () => window.dndj.offYoutubeProgress();
  }, []);

  const handleSetup = useCallback(async () => {
    setSetupLog('Downloading yt-dlp…\n');
    setStage(STAGES.CHECKING);
    try {
      await window.dndj.youtubeSetup();
      setSetupLog(prev => prev + 'Ready!\n');
      setStage(STAGES.IDLE);
      inputRef.current?.focus();
    } catch (e) { setError(e.message || String(e)); setStage(STAGES.ERROR); }
  }, []);

  const handleFetch = useCallback(async () => {
    if (!url.trim()) return;
    setStage(STAGES.CHECKING);
    setError('');
    try {
      const i = await window.dndj.youtubeGetInfo(url.trim());
      setInfo(i);
      setTrackName(i.title || '');
      setCategory('youtube');
      setSelectedTags([]);
      setStage(STAGES.INFO);
    } catch (e) { setError(e.message || String(e)); setStage(STAGES.ERROR); }
  }, [url]);

  const commitNewCategory = () => {
    const slug = newCatFolder.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!slug) return;
    const display = newCatDisplay.trim() || slug;
    setPendingNewCat({ folder: slug, display, color: newCatColor });
    setCategory(slug);
    setCreatingCat(false);
    setNewCatFolder(''); setNewCatDisplay(''); setNewCatColor('#818cf8');
  };

  const toggleTag = (name) => setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);

  const addNewTag = () => {
    const t = newTagInput.trim();
    if (!t) return;
    if (!selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
    setNewTagInput('');
  };

  const handleImport = useCallback(async () => {
    setStage(STAGES.IMPORTING);
    setProgress({ percent: 0, status: 'Starting…' });
    try {
      const isNewCat = pendingNewCat?.folder === category;
      const result = await window.dndj.youtubeImport({
        url: url.trim(),
        displayName: trackName.trim() || info?.title,
        category,
        categoryDisplayName: isNewCat ? pendingNewCat.display : null,
        newCategoryColor: isNewCat ? pendingNewCat.color : null,
        tags: selectedTags,
        format,
      });
      setStage(STAGES.DONE);
      onImported?.(Array.isArray(result) ? result : null);
    } catch (e) { setError(e.message || String(e)); setStage(STAGES.ERROR); }
  }, [url, trackName, category, pendingNewCat, selectedTags, format, info, onImported]);

  const reset = () => { setStage(STAGES.IDLE); setUrl(''); setInfo(null); setTrackName(''); setSelectedTags([]); setPendingNewCat(null); setError(''); };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && stage === STAGES.IDLE) handleFetch();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="yt-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="yt-dialog">
        <div className="yt-dialog__header">
          <span className="yt-dialog__title">YouTube Import</span>
          <button className="yt-dialog__close" onClick={onClose}>×</button>
        </div>

        {stage === STAGES.SETUP && (
          <div className="yt-dialog__body">
            <p className="yt-msg">yt-dlp is not installed. Download it now?</p>
            <button className="yt-btn yt-btn--primary" onClick={handleSetup}>Install yt-dlp</button>
          </div>
        )}

        {stage === STAGES.CHECKING && (
          <div className="yt-dialog__body">
            <div className="yt-spinner" />
            <p className="yt-msg" style={{ whiteSpace: 'pre-line' }}>{setupLog || 'Fetching video info…'}</p>
          </div>
        )}

        {(stage === STAGES.IDLE || stage === STAGES.INFO) && (
          <div className="yt-dialog__body">
            {/* URL row */}
            <div className="yt-url-row">
              <input
                ref={inputRef}
                className="yt-url-input"
                type="text"
                placeholder="Paste YouTube URL…"
                value={url}
                onChange={e => { setUrl(e.target.value); if (stage === STAGES.INFO) { setInfo(null); setStage(STAGES.IDLE); } }}
                onKeyDown={handleKeyDown}
              />
              <button className="yt-btn yt-btn--fetch" onClick={handleFetch} disabled={!url.trim() || stage === STAGES.INFO}>Fetch</button>
            </div>

            {stage === STAGES.INFO && info && (<>
              {/* Video thumbnail + source title */}
              <div className="yt-info-card">
                {info.thumbnail && <img className="yt-info-thumb" src={info.thumbnail} alt="" />}
                <div className="yt-info-meta">
                  <p className="yt-info-title">{info.title}</p>
                  <p className="yt-info-sub">{info.channel} · {formatDuration(info.duration)}</p>
                </div>
              </div>

              {/* ── Form ── */}
              <div className="yt-form">

                {/* Track name */}
                <div className="yt-field">
                  <label className="yt-label">Track name</label>
                  <input
                    className="yt-url-input"
                    value={trackName}
                    onChange={e => setTrackName(e.target.value)}
                    placeholder="Track display name…"
                  />
                </div>

                {/* Category */}
                <div className="yt-field">
                  <label className="yt-label">Category</label>
                  <div className="yt-cat-row">
                    <select
                      className="yt-select"
                      value={category}
                      onChange={e => { setCategory(e.target.value); setCreatingCat(false); }}
                    >
                      {allCategories.map(c => {
                        const m = catMetaMap[c] || (pendingNewCat?.folder === c ? pendingNewCat : null);
                        return <option key={c} value={c}>{m?.display || m?.display_name || c}</option>;
                      })}
                      {!allCategories.includes('youtube') && <option value="youtube">youtube</option>}
                    </select>
                    {pendingNewCat && category === pendingNewCat.folder && (
                      <span className="yt-new-cat-badge" style={{ background: pendingNewCat.color + '28', color: pendingNewCat.color, borderColor: pendingNewCat.color + '60' }}>
                        new
                      </span>
                    )}
                    <button className="yt-btn yt-btn--ghost yt-btn--xs" onClick={() => setCreatingCat(c => !c)}>
                      {creatingCat ? 'Cancel' : '+ New'}
                    </button>
                  </div>
                  {creatingCat && (
                    <div className="yt-new-cat-form">
                      <input className="yt-url-input" placeholder="Folder name (slug)" value={newCatFolder} onChange={e => setNewCatFolder(e.target.value)} />
                      <input className="yt-url-input" placeholder="Display name (optional)" value={newCatDisplay} onChange={e => setNewCatDisplay(e.target.value)} />
                      <MiniColorPicker value={newCatColor} onChange={setNewCatColor} />
                      <button className="yt-btn yt-btn--primary yt-btn--xs" onClick={commitNewCategory} disabled={!newCatFolder.trim()}>Create & select</button>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="yt-field">
                  <label className="yt-label">Tags</label>
                  {existingTagNames.length > 0 && (
                    <div className="yt-tag-chips">
                      {existingTagNames.map(name => {
                        const on = selectedTags.includes(name);
                        const tc = (existingTags.find(t => t.name === name)?.color) || '#6b7280';
                        return (
                          <button
                            key={name}
                            className={`yt-tag-chip ${on ? 'yt-tag-chip--on' : ''}`}
                            style={on ? { background: tc + '28', borderColor: tc + '70', color: tc } : {}}
                            onClick={() => toggleTag(name)}
                          >{name}</button>
                        );
                      })}
                    </div>
                  )}
                  <div className="yt-tag-new-row">
                    <input
                      className="yt-url-input yt-url-input--sm"
                      placeholder="Add tag…"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } }}
                    />
                    <button className="yt-btn yt-btn--ghost yt-btn--xs" onClick={addNewTag} disabled={!newTagInput.trim()}>Add</button>
                  </div>
                  {selectedTags.filter(t => !existingTagNames.includes(t)).length > 0 && (
                    <div className="yt-tag-chips">
                      {selectedTags.filter(t => !existingTagNames.includes(t)).map(t => (
                        <button key={t} className="yt-tag-chip yt-tag-chip--on yt-tag-chip--new" onClick={() => toggleTag(t)}>{t} ×</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Format */}
                <div className="yt-field">
                  <label className="yt-label">Save as</label>
                  <div className="yt-format-row">
                    {['mp3', 'ogg', 'original'].map(f => (
                      <button key={f} className={`yt-format-btn ${format === f ? 'yt-format-btn--active' : ''}`} onClick={() => setFormat(f)}>
                        {f === 'original' ? 'Original' : f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <button className="yt-btn yt-btn--primary yt-btn--import" onClick={handleImport}>⬇ Import</button>
            </>)}
          </div>
        )}

        {stage === STAGES.IMPORTING && (
          <div className="yt-dialog__body">
            <p className="yt-msg yt-msg--status">{progress.status || 'Working…'}</p>
            <div className="yt-progress-track">
              <div
                className={`yt-progress-fill${progress.indeterminate ? ' yt-progress-fill--indeterminate' : ''}`}
                style={progress.indeterminate ? undefined : { width: `${progress.percent}%` }}
              />
            </div>
            <p className="yt-progress-pct">{progress.indeterminate ? '—' : `${Math.round(progress.percent)}%`}</p>
          </div>
        )}

        {stage === STAGES.DONE && (
          <div className="yt-dialog__body">
            <div className="yt-done-icon">✓</div>
            <p className="yt-msg">Track imported successfully.</p>
            <button className="yt-btn yt-btn--primary" onClick={reset}>Import another</button>
          </div>
        )}

        {stage === STAGES.ERROR && (
          <div className="yt-dialog__body">
            <p className="yt-msg yt-msg--error">{error}</p>
            <button className="yt-btn yt-btn--ghost" onClick={() => { setStage(stage === STAGES.INFO ? STAGES.INFO : STAGES.IDLE); setError(''); }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
