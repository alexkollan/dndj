import React, { useState, useMemo, useCallback } from 'react';
import '../../styles/studio/ImportDialog.css';

const STAGES = { PICK: 'pick', MAP: 'map', IMPORTING: 'importing', DONE: 'done', ERROR: 'error' };
const COLORS = ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#818cf8', '#a78bfa', '#ef4444', '#22d3ee', '#fb923c', '#ec4899', '#6b7280'];

const slug = s => String(s).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
const titleize = s => String(s).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());

// Build the default per-group / per-track mapping state for a set of items.
function makeInitialMapping(items, allCats) {
  const groups = {}, itemState = {}, byFolder = {};
  for (const it of items) {
    (byFolder[it.folder] ||= []).push(it);
    itemState[it.id] = { include: true, name: it.suggestedName, override: '' };
  }
  Object.keys(byFolder).sort().forEach((folder, idx) => {
    const lastSeg = folder ? folder.split('/').pop() : '';
    groups[folder] = {
      mode: (folder === '' && allCats.length) ? 'existing' : 'new',
      existing: allCats[0] || '',
      newName: lastSeg ? titleize(lastSeg) : 'Imported',
      newColor: COLORS[idx % COLORS.length],
      tags: [], tagInput: '',
      expanded: Object.keys(byFolder).length <= 1,
    };
  });
  return { groups, itemState };
}

function ColorDots({ value, onChange }) {
  return (
    <div className="imp-colors">
      {COLORS.map(c => (
        <button key={c} className={`imp-color ${value === c ? 'imp-color--on' : ''}`}
          style={{ background: c }} onClick={() => onChange(c)} title={c} />
      ))}
    </div>
  );
}

export default function ImportDialog({ onClose, onImported, existingCategories = [], categoryMeta = [], existingTags = [], initialStaging = null }) {
  const allCats = useMemo(
    () => [...new Set([...(existingCategories || []), ...(categoryMeta || []).map(m => m.folder_name)])].sort(),
    [existingCategories, categoryMeta],
  );
  // When opened from a drag-and-drop, the files are already staged → start at MAP.
  const init = useMemo(
    () => initialStaging ? makeInitialMapping(initialStaging.items, allCats) : { groups: {}, itemState: {} },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [stage, setStage] = useState(initialStaging ? STAGES.MAP : STAGES.PICK);
  const [stagingId, setStagingId] = useState(initialStaging?.stagingId ?? null);
  const [items, setItems] = useState(initialStaging?.items ?? []);
  const [groups, setGroups] = useState(init.groups);      // folder → { mode, existing, newName, newColor, tags, tagInput, expanded }
  const [itemState, setItemState] = useState(init.itemState); // id → { include, name, override }
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const catMetaMap = useMemo(() => Object.fromEntries((categoryMeta || []).map(m => [m.folder_name, m])), [categoryMeta]);
  const catLabel = (folder) => catMetaMap[folder]?.display_name || folder;

  const folders = useMemo(() => {
    const map = {};
    for (const it of items) (map[it.folder] ||= []).push(it);
    return map;
  }, [items]);

  const pick = useCallback(async (kind) => {
    setError('');
    const res = await window.dndj.importPick(kind);
    if (!res || res.canceled) return;
    if (!res.items || res.items.length === 0) { setError('No audio files found in that selection.'); return; }

    const { groups: g, itemState: is } = makeInitialMapping(res.items, allCats);
    setStagingId(res.stagingId);
    setItems(res.items);
    setGroups(g);
    setItemState(is);
    setStage(STAGES.MAP);
  }, [allCats]);

  const cancelAndClose = useCallback(() => {
    if (stagingId && stage !== STAGES.DONE) window.dndj.importCancel(stagingId);
    onClose();
  }, [stagingId, stage, onClose]);

  const setGroup = (folder, patch) => setGroups(prev => ({ ...prev, [folder]: { ...prev[folder], ...patch } }));
  const setItem = (id, patch) => setItemState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const resolvedCat = (folder) => {
    const grp = groups[folder];
    if (!grp) return '';
    return grp.mode === 'existing' ? grp.existing : slug(grp.newName);
  };

  const addGroupTag = (folder) => {
    const grp = groups[folder];
    const t = (grp.tagInput || '').trim();
    if (!t || grp.tags.includes(t)) { setGroup(folder, { tagInput: '' }); return; }
    setGroup(folder, { tags: [...grp.tags, t], tagInput: '' });
  };

  const includedCount = useMemo(() => Object.values(itemState).filter(s => s.include).length, [itemState]);

  const doImport = useCallback(async () => {
    const mappings = [];
    const usedNew = {};
    for (const it of items) {
      const st = itemState[it.id];
      if (!st?.include) continue;
      const grp = groups[it.folder];
      const category = st.override || resolvedCat(it.folder);
      if (!category) continue;
      if (!st.override && grp.mode === 'new') usedNew[it.folder] = grp;
      mappings.push({ id: it.id, category, name: st.name, tags: grp.tags });
    }
    if (mappings.length === 0) { setError('Nothing selected to import.'); return; }

    const newCatsMap = {};
    for (const folder of Object.keys(usedNew)) {
      const grp = usedNew[folder];
      const s = slug(grp.newName);
      if (s && !newCatsMap[s]) newCatsMap[s] = { folder: s, displayName: grp.newName.trim() || s, color: grp.newColor };
    }

    setStage(STAGES.IMPORTING);
    setError('');
    try {
      const { result, tracks } = await window.dndj.importCommit({
        stagingId, mappings, newCategories: Object.values(newCatsMap),
      });
      setResult(result);
      onImported?.(tracks);
      setStage(STAGES.DONE);
    } catch (e) {
      setError(e.message || String(e));
      setStage(STAGES.ERROR);
    }
  }, [items, itemState, groups, stagingId, onImported]);

  const folderKeys = Object.keys(folders).sort();

  return (
    <div className="imp-overlay" onClick={e => { if (e.target === e.currentTarget) cancelAndClose(); }}>
      <div className="imp-dialog">
        <div className="imp-dialog__header">
          <span className="imp-dialog__title">⬇ Import Tracks</span>
          <button className="imp-dialog__close" onClick={cancelAndClose}>×</button>
        </div>

        <div className="imp-dialog__body">
          {/* ── Pick ── */}
          {stage === STAGES.PICK && (
            <div className="imp-pick">
              <p className="imp-pick__hint">Choose what to import. You'll map each folder to a category next.</p>
              <div className="imp-pick__btns">
                <button className="imp-pick__btn" onClick={() => pick('files')}>
                  <span className="imp-pick__icon">♪</span> Audio files
                </button>
                <button className="imp-pick__btn" onClick={() => pick('folder')}>
                  <span className="imp-pick__icon">📁</span> A folder
                </button>
                <button className="imp-pick__btn" onClick={() => pick('zip')}>
                  <span className="imp-pick__icon">🗜</span> A .zip
                </button>
              </div>
              {error && <p className="imp-error">{error}</p>}
            </div>
          )}

          {/* ── Map ── */}
          {stage === STAGES.MAP && (
            <div className="imp-map">
              <p className="imp-map__hint">
                {items.length} track{items.length !== 1 ? 's' : ''} found in {folderKeys.length} folder{folderKeys.length !== 1 ? 's' : ''}.
                Map each folder to a category — pick an existing one or create a new one.
              </p>

              {folderKeys.map(folder => {
                const grp = groups[folder];
                const list = folders[folder];
                return (
                  <div key={folder || '__root'} className="imp-group">
                    <div className="imp-group__head">
                      <button
                        className="imp-group__toggle"
                        onClick={() => setGroup(folder, { expanded: !grp.expanded })}
                        title={grp.expanded ? 'Collapse' : 'Expand'}
                      >{grp.expanded ? '▼' : '▶'}</button>
                      <span className="imp-group__name">
                        {folder ? `📁 ${folder}` : '♪ Selected files'}
                      </span>
                      <span className="imp-group__count">{list.length}</span>
                    </div>

                    <div className="imp-group__cat">
                      <div className="imp-seg">
                        <button
                          className={`imp-seg__btn ${grp.mode === 'existing' ? 'imp-seg__btn--on' : ''}`}
                          onClick={() => setGroup(folder, { mode: 'existing' })}
                          disabled={allCats.length === 0}
                        >Existing</button>
                        <button
                          className={`imp-seg__btn ${grp.mode === 'new' ? 'imp-seg__btn--on' : ''}`}
                          onClick={() => setGroup(folder, { mode: 'new' })}
                        >New</button>
                      </div>

                      {grp.mode === 'existing' ? (
                        <select className="imp-select" value={grp.existing} onChange={e => setGroup(folder, { existing: e.target.value })}>
                          {allCats.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                        </select>
                      ) : (
                        <div className="imp-newcat">
                          <input className="imp-input" value={grp.newName}
                            onChange={e => setGroup(folder, { newName: e.target.value })} placeholder="New category name" />
                          <ColorDots value={grp.newColor} onChange={c => setGroup(folder, { newColor: c })} />
                        </div>
                      )}
                    </div>

                    {/* group tags */}
                    <div className="imp-tags">
                      {grp.tags.map(t => (
                        <button key={t} className="imp-tag" onClick={() => setGroup(folder, { tags: grp.tags.filter(x => x !== t) })}>
                          {t} ×
                        </button>
                      ))}
                      <input
                        className="imp-tag-input"
                        value={grp.tagInput}
                        placeholder="+ tag"
                        onChange={e => setGroup(folder, { tagInput: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroupTag(folder); } }}
                        onBlur={() => addGroupTag(folder)}
                      />
                    </div>

                    {/* per-track overrides */}
                    {grp.expanded && (
                      <div className="imp-tracks">
                        {list.map(it => {
                          const st = itemState[it.id];
                          return (
                            <div key={it.id} className={`imp-track ${st.include ? '' : 'imp-track--off'}`}>
                              <input type="checkbox" checked={st.include} onChange={e => setItem(it.id, { include: e.target.checked })} />
                              <input className="imp-track__name" value={st.name}
                                onChange={e => setItem(it.id, { name: e.target.value })} disabled={!st.include} />
                              <select className="imp-track__cat" value={st.override}
                                onChange={e => setItem(it.id, { override: e.target.value })} disabled={!st.include}
                                title="Category override for this track">
                                <option value="">↳ group</option>
                                {allCats.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {error && <p className="imp-error">{error}</p>}
            </div>
          )}

          {stage === STAGES.IMPORTING && (
            <div className="imp-center"><div className="imp-spinner" /><p>Importing…</p></div>
          )}

          {stage === STAGES.DONE && (
            <div className="imp-center">
              <div className="imp-done">✓</div>
              <p>Imported {result?.imported ?? 0} track{result?.imported !== 1 ? 's' : ''}
                {result?.skipped ? ` (${result.skipped} skipped)` : ''}.</p>
            </div>
          )}

          {stage === STAGES.ERROR && (
            <div className="imp-center"><p className="imp-error">{error}</p></div>
          )}
        </div>

        <div className="imp-dialog__footer">
          {stage === STAGES.MAP && (
            <>
              <span className="imp-footer__count">{includedCount} selected</span>
              <button className="imp-btn imp-btn--ghost" onClick={cancelAndClose}>Cancel</button>
              <button className="imp-btn imp-btn--primary" onClick={doImport} disabled={includedCount === 0}>
                Import {includedCount}
              </button>
            </>
          )}
          {(stage === STAGES.DONE || stage === STAGES.ERROR) && (
            <button className="imp-btn imp-btn--primary" onClick={cancelAndClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
