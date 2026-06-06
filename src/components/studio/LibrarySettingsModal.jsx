import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/studio/LibrarySettingsModal.css';

const PRESET_COLORS = [
  '#10b981', '#34d399', '#6ee7b7',
  '#f59e0b', '#fbbf24', '#fcd34d',
  '#818cf8', '#a78bfa', '#c4b5fd',
  '#ef4444', '#f87171', '#fca5a5',
  '#22d3ee', '#67e8f9', '#a5f3fc',
  '#fb923c', '#fdba74', '#fed7aa',
  '#6b7280', '#9ca3af', '#d1d5db',
  '#ec4899', '#f472b6', '#f9a8d4',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="ls-color-grid">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          className={`ls-color-swatch ${value === c ? 'ls-color-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ allTracks, onRefresh, onCategoryMetaChange }) {
  const [meta, setMeta] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [editId, setEditId] = useState(null); // folder_name being edited
  const [editDisplay, setEditDisplay] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');

  // Derive existing folder names from tracks
  const folderNames = [...new Set((allTracks || []).map(t => t.category).filter(Boolean))].sort();

  const load = useCallback(async () => {
    const rows = await window.dndj.getCategoryMeta();
    setMeta(rows || []);
    onCategoryMetaChange?.(rows || []);
  }, [onCategoryMetaChange]);

  useEffect(() => { load(); }, [load]);

  const metaMap = Object.fromEntries(meta.map(m => [m.folder_name, m]));

  // All categories = union of folders in DB tracks + categories with metadata
  const allFolders = [...new Set([...folderNames, ...meta.map(m => m.folder_name)])].sort();

  const startEdit = (folder) => {
    const m = metaMap[folder];
    setEditId(folder);
    setEditDisplay(m?.display_name || folder);
    setEditColor(m?.color || '#6b7280');
  };

  const commitEdit = async () => {
    await window.dndj.upsertCategoryMeta(editId, editDisplay || editId, editColor);
    setEditId(null);
    await load();
  };

  const handleCreate = async () => {
    if (!newFolder.trim()) return;
    const slug = newFolder.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!slug) return;
    await window.dndj.createCategory(slug, newDisplay || slug, newColor);
    setCreating(false);
    setNewFolder(''); setNewDisplay(''); setNewColor('#6b7280');
    await load();
    await onRefresh();
  };

  const handleDeleteMeta = async (folder) => {
    await window.dndj.deleteCategoryMeta(folder);
    await load();
  };

  return (
    <div className="ls-tab-content">
      <div className="ls-section-head">
        <span className="ls-section-title">Categories</span>
        <button className="ls-add-btn" onClick={() => setCreating(c => !c)}>+ New</button>
      </div>

      {creating && (
        <div className="ls-create-card">
          <div className="ls-create-row">
            <input
              className="ls-input" placeholder="Folder name (e.g. ambience)"
              value={newFolder} onChange={e => setNewFolder(e.target.value)}
              autoFocus
            />
            <input
              className="ls-input" placeholder="Display name (optional)"
              value={newDisplay} onChange={e => setNewDisplay(e.target.value)}
            />
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="ls-create-actions">
            <button className="ls-btn ls-btn--primary" onClick={handleCreate}>Create</button>
            <button className="ls-btn ls-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ls-list">
        {allFolders.length === 0 && <p className="ls-empty">No categories yet.</p>}
        {allFolders.map(folder => {
          const m = metaMap[folder];
          const color = m?.color || '#6b7280';
          const display = m?.display_name || folder;
          const trackCount = (allTracks || []).filter(t => t.category === folder).length;
          const isEditing = editId === folder;

          return (
            <div key={folder} className="ls-row">
              <span className="ls-row__swatch" style={{ background: color }} />
              {isEditing ? (
                <div className="ls-row__edit">
                  <input
                    className="ls-input ls-input--sm"
                    value={editDisplay}
                    onChange={e => setEditDisplay(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="ls-row__edit-actions">
                    <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitEdit}>Save</button>
                    <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ls-row__info">
                    <span className="ls-row__name">{display}</span>
                    {display !== folder && <span className="ls-row__sub">{folder}/</span>}
                    <span className="ls-row__count">{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="ls-row__actions">
                    <button className="ls-icon-btn" onClick={() => startEdit(folder)} title="Edit">✎</button>
                    {!trackCount && (
                      <button className="ls-icon-btn ls-icon-btn--danger" onClick={() => handleDeleteMeta(folder)} title="Remove metadata">×</button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tags Tab ─────────────────────────────────────────────────────────────────

function TagsTab({ tags, onTagsChange }) {
  const [localTags, setLocalTags] = useState(tags || []);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');

  useEffect(() => { setLocalTags(tags || []); }, [tags]);

  const refresh = async () => {
    const updated = await window.dndj.getTags();
    setLocalTags(updated || []);
    onTagsChange?.(updated || []);
  };

  const startEdit = (tag) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#6b7280');
  };

  const commitEdit = async () => {
    await window.dndj.updateTag(editId, editName, editColor);
    setEditId(null);
    await refresh();
  };

  const handleDelete = async (id) => {
    await window.dndj.deleteTag(id);
    await refresh();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await window.dndj.createTag(newName.trim(), newColor);
    setCreating(false);
    setNewName(''); setNewColor('#10b981');
    await refresh();
  };

  return (
    <div className="ls-tab-content">
      <div className="ls-section-head">
        <span className="ls-section-title">Tags</span>
        <button className="ls-add-btn" onClick={() => setCreating(c => !c)}>+ New</button>
      </div>

      {creating && (
        <div className="ls-create-card">
          <input
            className="ls-input" placeholder="Tag name"
            value={newName} onChange={e => setNewName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="ls-create-actions">
            <button className="ls-btn ls-btn--primary" onClick={handleCreate}>Create</button>
            <button className="ls-btn ls-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ls-list">
        {localTags.length === 0 && <p className="ls-empty">No tags yet. Add tags to tracks to get started.</p>}
        {localTags.map(tag => {
          const isEditing = editId === tag.id;
          return (
            <div key={tag.id} className="ls-row">
              <span className="ls-row__swatch" style={{ background: tag.color || '#6b7280' }} />
              {isEditing ? (
                <div className="ls-row__edit">
                  <input
                    className="ls-input ls-input--sm"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="ls-row__edit-actions">
                    <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitEdit}>Save</button>
                    <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="ls-row__name">{tag.name}</span>
                  <div className="ls-row__actions">
                    <button className="ls-icon-btn" onClick={() => startEdit(tag)} title="Edit">✎</button>
                    <button className="ls-icon-btn ls-icon-btn--danger" onClick={() => handleDelete(tag.id)} title="Delete tag">×</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shortcuts Tab ────────────────────────────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    title: 'Decks',
    rows: [
      { keys: ['Space'],        desc: 'Play / Pause — active deck' },
      { keys: ['⇧', 'Space'],  desc: 'Play / Pause — other deck' },
      { keys: ['A'],            desc: 'Play / Pause — Deck A' },
      { keys: ['B'],            desc: 'Play / Pause — Deck B' },
      { keys: ['S'],            desc: 'Stop — active deck' },
      { keys: ['⇧', 'S'],      desc: 'Stop ALL sounds' },
    ],
  },
  {
    title: 'Seek',
    rows: [
      { keys: ['←'],           desc: 'Seek −5 s' },
      { keys: ['→'],           desc: 'Seek +5 s' },
      { keys: ['⇧', '←'],     desc: 'Seek −30 s' },
      { keys: ['⇧', '→'],     desc: 'Seek +30 s' },
    ],
  },
  {
    title: 'Loop',
    rows: [
      { keys: ['L'],           desc: 'Toggle loop on active deck' },
    ],
  },
  {
    title: 'Crossfader',
    rows: [
      { keys: ['['],           desc: 'Nudge crossfader toward A' },
      { keys: [']'],           desc: 'Nudge crossfader toward B' },
      { keys: ['\\'],          desc: 'Center crossfader' },
      { keys: ['↔ swipe'],    desc: 'Two-finger horizontal swipe on crossfader' },
    ],
  },
  {
    title: 'SFX Pads',
    rows: [
      { keys: ['1–8'],         desc: 'Trigger sampler pad' },
    ],
  },
  {
    title: 'Waveform',
    rows: [
      { keys: ['pinch'],       desc: 'Pinch-to-zoom (trackpad)' },
      { keys: ['↔ swipe'],    desc: 'Two-finger swipe to pan when zoomed' },
      { keys: ['scroll ↕'],   desc: 'Mouse wheel to zoom in/out' },
      { keys: ['drag'],        desc: 'Click & drag to pan when zoomed' },
      { keys: ['click'],       desc: 'Click to seek' },
    ],
  },
];

function ShortcutsTab() {
  return (
    <div className="ls-tab-content ls-shortcuts">
      {SHORTCUT_GROUPS.map(group => (
        <div key={group.title} className="ls-sc-group">
          <div className="ls-sc-group__title">{group.title}</div>
          <div className="ls-sc-rows">
            {group.rows.map((row, i) => (
              <div key={i} className="ls-sc-row">
                <div className="ls-sc-keys">
                  {row.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      {ki > 0 && <span className="ls-sc-plus">+</span>}
                      <kbd className="ls-kbd">{k}</kbd>
                    </React.Fragment>
                  ))}
                </div>
                <span className="ls-sc-desc">{row.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export default function LibrarySettingsModal({ allTracks, tags, onClose, onRefresh, onTagsChange, onCategoryMetaChange }) {
  const [tab, setTab] = useState('categories');

  return (
    <div className="ls-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ls-dialog">
        <div className="ls-dialog__header">
          <span className="ls-dialog__title">Library Settings</span>
          <button className="ls-dialog__close" onClick={onClose}>×</button>
        </div>
        <div className="ls-tabs">
          <button className={`ls-tab ${tab === 'categories' ? 'ls-tab--active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
          <button className={`ls-tab ${tab === 'tags' ? 'ls-tab--active' : ''}`} onClick={() => setTab('tags')}>Tags</button>
          <button className={`ls-tab ${tab === 'shortcuts' ? 'ls-tab--active' : ''}`} onClick={() => setTab('shortcuts')}>Shortcuts</button>
        </div>
        <div className="ls-dialog__body">
          {tab === 'categories' && <CategoriesTab allTracks={allTracks} onRefresh={onRefresh} onCategoryMetaChange={onCategoryMetaChange} />}
          {tab === 'tags' && <TagsTab tags={tags} onTagsChange={onTagsChange} />}
          {tab === 'shortcuts' && <ShortcutsTab />}
        </div>
      </div>
    </div>
  );
}
