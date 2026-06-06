import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import '../../styles/studio/PlaylistRail.css';

// ─── Smart Playlist Rule Evaluator ───────────────────────────────────────────
export function evaluateSmartPlaylist(tracks, rulesJson) {
  if (!rulesJson) return tracks;
  try {
    const { combinator = 'AND', rules = [] } = typeof rulesJson === 'string' ? JSON.parse(rulesJson) : rulesJson;
    if (rules.length === 0) return tracks;
    return tracks.filter(track => {
      const results = rules.map(rule => {
        const val = (rule.value || '').toLowerCase().trim();
        switch (rule.field) {
          case 'name': {
            const n = (track.name || '').toLowerCase();
            return rule.op === 'contains' ? n.includes(val)
              : rule.op === 'not_contains' ? !n.includes(val)
              : rule.op === 'equals' ? n === val : n !== val;
          }
          case 'category': {
            const c = (track.category || '').toLowerCase();
            return rule.op === 'contains' ? c.includes(val)
              : rule.op === 'not_contains' ? !c.includes(val)
              : rule.op === 'equals' ? c === val : c !== val;
          }
          case 'tags': {
            const ts = (track.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
            return rule.op === 'contains' ? ts.some(t => t.includes(val))
              : rule.op === 'not_contains' ? !ts.some(t => t.includes(val))
              : rule.op === 'equals' ? ts.includes(val) : !ts.includes(val);
          }
          default: return false;
        }
      });
      return combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
    });
  } catch { return []; }
}

// ─── Smart Playlist Editor Modal ─────────────────────────────────────────────
function SmartEditor({ playlist, onSave, onClose }) {
  const parsed = playlist?.rules_json
    ? JSON.parse(playlist.rules_json)
    : { combinator: 'AND', rules: [] };
  const [name, setName] = useState(playlist?.name || '');
  const [combinator, setCombinator] = useState(parsed.combinator || 'AND');
  const [rules, setRules] = useState(parsed.rules || []);

  const addRule = () => setRules(r => [...r, { field: 'name', op: 'contains', value: '' }]);
  const removeRule = i => setRules(r => r.filter((_, idx) => idx !== i));
  const updateRule = (i, k, v) => setRules(r => r.map((rule, idx) => idx === i ? { ...rule, [k]: v } : rule));

  return (
    <div className="smart-editor-overlay" onClick={onClose}>
      <div className="smart-editor" onClick={e => e.stopPropagation()}>
        <div className="smart-editor__header">
          <span>{playlist ? 'Edit Smart Playlist' : 'New Smart Playlist'}</span>
          <button className="smart-editor__close" onClick={onClose}>×</button>
        </div>
        <input
          className="smart-editor__name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Playlist name…"
          autoFocus
        />
        <div className="smart-editor__combinator">
          Match
          <select value={combinator} onChange={e => setCombinator(e.target.value)}>
            <option value="AND">ALL</option>
            <option value="OR">ANY</option>
          </select>
          of:
        </div>
        <div className="smart-editor__rules">
          {rules.map((rule, i) => (
            <div key={i} className="smart-editor__rule">
              <select value={rule.field} onChange={e => updateRule(i, 'field', e.target.value)}>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="tags">Tags</option>
              </select>
              <select value={rule.op} onChange={e => updateRule(i, 'op', e.target.value)}>
                <option value="contains">contains</option>
                <option value="not_contains">doesn't contain</option>
                <option value="equals">equals</option>
                <option value="not_equals">doesn't equal</option>
              </select>
              <input
                className="smart-editor__rule-val"
                value={rule.value}
                onChange={e => updateRule(i, 'value', e.target.value)}
                placeholder="value…"
              />
              <button className="smart-editor__rule-rm" onClick={() => removeRule(i)}>×</button>
            </div>
          ))}
          {rules.length === 0 && <p className="smart-editor__hint">Click + Add Rule to filter tracks.</p>}
        </div>
        <div className="smart-editor__footer">
          <button className="smart-editor__btn-add" onClick={addRule}>+ Add Rule</button>
          <button
            className="smart-editor__btn-save"
            disabled={!name.trim()}
            onClick={() => name.trim() && onSave({ name: name.trim(), rulesJson: JSON.stringify({ combinator, rules }) })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable Playlist Item ──────────────────────────────────────────────────
function PlaylistItem({ playlist, isSelected, depth, onSelect, onRename, onDelete, onEditSmart, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: `playlist-${playlist.id}` });
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const confirmRename = useCallback(() => {
    const t = editName.trim();
    if (t && t !== playlist.name) onRename(playlist.id, t);
    setEditing(false);
  }, [editName, playlist.id, playlist.name, onRename]);

  const icon = playlist.type === 'folder' ? '📁' : playlist.type === 'smart' ? '✦' : '♪';

  return (
    <div className="pl-group" style={{ paddingLeft: depth * 12 }}>
      <div
        ref={setNodeRef}
        className={`pl-item ${isSelected ? 'pl-item--selected' : ''} ${isOver ? 'pl-item--over' : ''}`}
        onClick={() => !editing && onSelect(playlist.id)}
        onDoubleClick={() => { setEditing(true); setEditName(playlist.name); }}
      >
        <span className="pl-item__icon">{icon}</span>
        {editing ? (
          <input
            ref={inputRef}
            className="pl-item__rename"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={confirmRename}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmRename();
              if (e.key === 'Escape') { setEditName(playlist.name); setEditing(false); }
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="pl-item__name" title={playlist.name}>{playlist.name}</span>
        )}
        <div className="pl-item__actions">
          {playlist.type === 'smart' && (
            <button
              className="pl-item__btn"
              title="Edit rules"
              onClick={e => { e.stopPropagation(); onEditSmart(playlist); }}
            >⚙</button>
          )}
          <button
            className="pl-item__btn pl-item__btn--del"
            title="Delete"
            onClick={e => {
              e.stopPropagation();
              if (window.confirm(`Delete "${playlist.name}"?`)) onDelete(playlist.id);
            }}
          >×</button>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── PlaylistRail ─────────────────────────────────────────────────────────────
function PlaylistRail({ playlists, selectedPlaylistId, onSelect, onLibrarySelect, onRefresh, allTracks }) {
  const [menu, setMenu] = useState(false);
  const [smartEditor, setSmartEditor] = useState(null); // null | 'new' | playlist object

  const createPlaylist = async (type) => {
    const defaultName = type === 'folder' ? 'New Folder' : type === 'smart' ? 'Smart Playlist' : 'New Playlist';
    const name = window.prompt(`${type === 'folder' ? 'Folder' : 'Playlist'} name:`, defaultName);
    if (!name?.trim()) return;
    await window.dndj.createPlaylist(name.trim(), null, type, null);
    onRefresh();
  };

  const handleSmartSave = async ({ name, rulesJson }) => {
    if (smartEditor && smartEditor !== 'new') {
      await window.dndj.updatePlaylist(smartEditor.id, name, smartEditor.parent_id, rulesJson, smartEditor.sort_order);
    } else {
      await window.dndj.createPlaylist(name, null, 'smart', rulesJson);
    }
    setSmartEditor(null);
    onRefresh();
  };

  const handleRename = async (id, name) => {
    const pl = playlists.find(p => p.id === id);
    if (!pl) return;
    await window.dndj.updatePlaylist(id, name, pl.parent_id, pl.rules_json, pl.sort_order);
    onRefresh();
  };

  const handleDelete = async (id) => {
    await window.dndj.deletePlaylist(id);
    if (selectedPlaylistId === id) onLibrarySelect();
    onRefresh();
  };

  const roots = playlists.filter(p => p.parent_id == null);
  const childrenOf = (id) => playlists.filter(p => p.parent_id === id);

  const renderTree = (pl, depth = 0) => (
    <PlaylistItem
      key={pl.id}
      playlist={pl}
      isSelected={selectedPlaylistId === pl.id}
      depth={depth}
      onSelect={onSelect}
      onRename={handleRename}
      onDelete={handleDelete}
      onEditSmart={setSmartEditor}
    >
      {childrenOf(pl.id).map(child => renderTree(child, depth + 1))}
    </PlaylistItem>
  );

  return (
    <div className="playlist-rail">
      {/* My Library root */}
      <div
        className={`pl-item pl-item--library ${selectedPlaylistId === null ? 'pl-item--selected' : ''}`}
        onClick={onLibrarySelect}
      >
        <span className="pl-item__icon">♫</span>
        <span className="pl-item__name">My Library</span>
        <span className="pl-item__count">{allTracks.length}</span>
      </div>

      <div className="pl-divider" />

      {/* Section header */}
      <div className="pl-section-header">
        <span>PLAYLISTS</span>
        <div className="pl-create-wrap">
          <button className="pl-create-btn" onClick={() => setMenu(m => !m)} title="New…">+</button>
          {menu && (
            <div className="pl-create-menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { createPlaylist('manual'); setMenu(false); }}>Manual Playlist</button>
              <button onClick={() => { createPlaylist('folder'); setMenu(false); }}>Folder</button>
              <button onClick={() => { setSmartEditor('new'); setMenu(false); }}>Smart Playlist</button>
            </div>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="pl-tree">
        {roots.map(pl => renderTree(pl))}
        {roots.length === 0 && (
          <p className="pl-empty">No playlists yet.<br />Click + to create one.</p>
        )}
      </div>

      {/* Smart playlist editor modal */}
      {smartEditor && (
        <SmartEditor
          playlist={smartEditor === 'new' ? null : smartEditor}
          onSave={handleSmartSave}
          onClose={() => setSmartEditor(null)}
        />
      )}
    </div>
  );
}

export default PlaylistRail;
