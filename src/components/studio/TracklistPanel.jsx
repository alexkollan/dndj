import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { playTrack, stopTrack } from '../../audioEngine.js';
import { useAudioStore } from '../../store.js';
import YoutubeImportDialog from './YoutubeImportDialog.jsx';
import '../../styles/studio/TracklistPanel.css';

// Fallback colors for well-known category names when no metadata exists
const CAT_COLORS_FALLBACK = {
  atmosphere: '#10b981',
  sfx: '#f59e0b',
  music: '#818cf8',
  ambience: '#22d3ee',
  youtube: '#ef4444',
};

function formatDur(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Shared row inner content ─────────────────────────────────────────────────
function RowInner({ track, isPlaying, onPlayToggle, onLoadToDeck, onRename, onAddTag, onMoved, onDelete, onRemoveFromPlaylist, selectedPlaylistId, selectedPlaylistType, categories, catMetaMap, tagColorMap }) {
  const catKey = track.category?.toLowerCase();
  const catMeta = catMetaMap?.[catKey];
  const catColor = catMeta?.color || CAT_COLORS_FALLBACK[catKey] || '#6b7280';
  const catDisplay = catMeta?.display_name || track.category || '';
  const tags = (track.tags || '').split(',').map(t => t.trim()).filter(Boolean);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [tagVal, setTagVal] = useState('');
  const [movingTo, setMovingTo] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [deleteMode, setDeleteMode] = useState(false);
  const menuRef = useRef(null);
  const renameRef = useRef(null);
  const tagRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) { setRenameVal(track.name); setTimeout(() => renameRef.current?.select(), 0); }
  }, [renaming]);

  useEffect(() => {
    if (addingTag) setTimeout(() => tagRef.current?.focus(), 0);
  }, [addingTag]);

  const commitRename = useCallback(() => {
    const name = renameVal.trim();
    if (name && name !== track.name && onRename) onRename(track.id, name);
    setRenaming(false);
    setMenuOpen(false);
  }, [renameVal, track, onRename]);

  const commitTag = useCallback(() => {
    const t = tagVal.trim();
    if (t && onAddTag) onAddTag(track.id, t);
    setTagVal('');
    setAddingTag(false);
    setMenuOpen(false);
  }, [tagVal, track, onAddTag]);

  const commitMove = useCallback(async () => {
    if (!moveTarget || moveTarget === track.category) { setMovingTo(false); setMenuOpen(false); return; }
    try {
      const updated = await window.dndj.moveTrackToCategory(track.id, moveTarget);
      onMoved?.(updated);
    } catch (e) {
      alert(`Move failed: ${e.message}`);
    }
    setMovingTo(false);
    setMenuOpen(false);
  }, [moveTarget, track, onMoved]);

  const hasMenu = onRename || onAddTag || onDelete || onRemoveFromPlaylist || (categories && categories.length > 1);

  return (
    <>
      <button
        className={`tr-play ${isPlaying ? 'tr-play--on' : ''}`}
        onClick={e => { e.stopPropagation(); onPlayToggle(); }}
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '■' : '▶'}
      </button>
      {renaming ? (
        <input
          ref={renameRef}
          className="tr-rename-input"
          value={renameVal}
          onChange={e => setRenameVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          onBlur={commitRename}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="tr-name" title={track.name}>{track.name}</span>
      )}
      <span className="tr-cat" style={{ color: catColor, borderColor: catColor + '40', background: catColor + '14' }}>
        {catDisplay.toUpperCase()}
      </span>
      <div className="tr-tags">
        {tags.slice(0, 3).map(t => {
          const tc = tagColorMap?.[t] || '#6b7280';
          return <span key={t} className="tr-tag" style={{ color: tc, borderColor: tc + '50', background: tc + '18' }}>{t}</span>;
        })}
        {tags.length > 3 && <span className="tr-tag tr-tag--more">+{tags.length - 3}</span>}
      </div>
      <div className="tr-dur-group">
        <span className="tr-dur">{formatDur(track.duration)}</span>
        {onLoadToDeck && (
          <div className="tr-deck-btns">
            <button
              className="tr-deck-btn tr-deck-btn--a"
              onClick={e => { e.stopPropagation(); onLoadToDeck('A', track); }}
              title="Load to Deck A"
            >A</button>
            <button
              className="tr-deck-btn tr-deck-btn--b"
              onClick={e => { e.stopPropagation(); onLoadToDeck('B', track); }}
              title="Load to Deck B"
            >B</button>
          </div>
        )}
      </div>
      {hasMenu && (
        <div className="tr-menu-wrap" ref={menuRef}>
          <button
            className="tr-menu-btn"
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            title="Track options"
          >⋮</button>
          {menuOpen && (
            <div className="tr-menu-dd">
              {onRename && !renaming && (
                <button className="tr-menu-item" onClick={() => { setRenaming(true); setMenuOpen(false); }}>
                  ✏ Rename
                </button>
              )}
              {onAddTag && (
                addingTag ? (
                  <div className="tr-menu-tag-row">
                    <input
                      ref={tagRef}
                      className="tr-menu-tag-input"
                      value={tagVal}
                      onChange={e => setTagVal(e.target.value)}
                      placeholder="Tag name…"
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitTag();
                        if (e.key === 'Escape') { setAddingTag(false); setMenuOpen(false); }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <button className="tr-menu-confirm" onClick={e => { e.stopPropagation(); commitTag(); }}>✓</button>
                  </div>
                ) : (
                  <button className="tr-menu-item" onClick={() => setAddingTag(true)}>
                    + Add Tag
                  </button>
                )
              )}
              {categories && categories.length > 1 && (
                movingTo ? (
                  <div className="tr-menu-tag-row">
                    <select
                      className="tr-menu-tag-input"
                      value={moveTarget}
                      onChange={e => setMoveTarget(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      autoFocus
                    >
                      <option value="">Pick category…</option>
                      {categories.filter(c => c !== track.category).map(c => (
                        <option key={c} value={c}>{catMetaMap?.[c]?.display_name || c}</option>
                      ))}
                    </select>
                    <button className="tr-menu-confirm" onClick={e => { e.stopPropagation(); commitMove(); }} disabled={!moveTarget}>✓</button>
                  </div>
                ) : (
                  <button className="tr-menu-item" onClick={() => { setMovingTo(true); setMoveTarget(''); }}>
                    ↪ Move to…
                  </button>
                )
              )}
              {selectedPlaylistId !== null && onRemoveFromPlaylist && (
                <button className="tr-menu-item" onClick={() => { onRemoveFromPlaylist(selectedPlaylistId, track.id); setMenuOpen(false); }}>
                  ✕ {selectedPlaylistType === 'folder' ? 'Remove from folder'
                     : selectedPlaylistType === 'smart' ? 'Exclude from playlist'
                     : 'Remove from playlist'}
                </button>
              )}
              {onDelete && (
                deleteMode ? (
                  <div className="tr-menu-delete-opts">
                    <span className="tr-menu-delete-label">Delete where?</span>
                    <button className="tr-menu-item tr-menu-item--warn" onClick={e => { e.stopPropagation(); onDelete(track.id, true, false); setMenuOpen(false); setDeleteMode(false); }}>
                      This machine only
                    </button>
                    <button className="tr-menu-item tr-menu-item--danger" onClick={e => { e.stopPropagation(); onDelete(track.id, true, true); setMenuOpen(false); setDeleteMode(false); }}>
                      ⚠ Everywhere (on next sync)
                    </button>
                    <button className="tr-menu-item tr-menu-item--cancel" onClick={e => { e.stopPropagation(); setDeleteMode(false); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="tr-menu-item tr-menu-item--danger" onClick={() => setDeleteMode(true)}>
                    🗑 Delete track
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Draggable row (library view) ─────────────────────────────────────────────
function DraggableRow({ track, isPlaying, onPlayToggle, onLoadToDeck, onRename, onAddTag, onMoved, onDelete, onRemoveFromPlaylist, selectedPlaylistId, selectedPlaylistType, categories, catMetaMap, tagColorMap }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track-${track.id}`,
    data: { trackId: track.id, trackName: track.name },
  });
  return (
    <div
      ref={setNodeRef}
      className={`tr ${isPlaying ? 'tr--playing' : ''} ${isDragging ? 'tr--dragging' : ''}`}
    >
      <span className="tr-drag" {...listeners} {...attributes} title="Drag to a playlist or deck">⣿</span>
      <RowInner track={track} isPlaying={isPlaying} onPlayToggle={onPlayToggle} onLoadToDeck={onLoadToDeck} onRename={onRename} onAddTag={onAddTag} onMoved={onMoved} onDelete={onDelete} onRemoveFromPlaylist={onRemoveFromPlaylist} selectedPlaylistId={selectedPlaylistId} selectedPlaylistType={selectedPlaylistType} categories={categories} catMetaMap={catMetaMap} tagColorMap={tagColorMap} />
    </div>
  );
}

// ─── Sortable row (playlist view) ─────────────────────────────────────────────
function SortableRow({ track, isPlaying, onPlayToggle, onLoadToDeck, onRename, onAddTag, onMoved, onDelete, onRemoveFromPlaylist, selectedPlaylistId, selectedPlaylistType, categories, catMetaMap, tagColorMap }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tr ${isPlaying ? 'tr--playing' : ''} ${isDragging ? 'tr--dragging' : ''}`}
    >
      <span className="tr-drag" {...listeners} {...attributes} title="Drag to reorder">⣿</span>
      <RowInner track={track} isPlaying={isPlaying} onPlayToggle={onPlayToggle} onLoadToDeck={onLoadToDeck} onRename={onRename} onAddTag={onAddTag} onMoved={onMoved} onDelete={onDelete} onRemoveFromPlaylist={onRemoveFromPlaylist} selectedPlaylistId={selectedPlaylistId} selectedPlaylistType={selectedPlaylistType} categories={categories} catMetaMap={catMetaMap} tagColorMap={tagColorMap} />
    </div>
  );
}

// ─── Sort column header ───────────────────────────────────────────────────────
function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <div className={`tl-th ${active ? 'tl-th--active' : ''}`} onClick={() => onSort(field)}>
      {label}{active && <span>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
    </div>
  );
}

// ─── TracklistPanel ───────────────────────────────────────────────────────────
function TracklistPanel({ tracks, allTracks, tags, categoryMeta, urlCache, resolveUrl, selectedPlaylistId, selectedPlaylistType, isReorderable, onLoadToDeck, onRename, onAddTag, onRemoveFromPlaylist, onLibraryRefresh, onTracksChange }) {
  const { playingUrls } = useAudioStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [ytOpen, setYtOpen] = useState(false);

  // Build lookup maps for colors
  const catMetaMap = useMemo(() => Object.fromEntries((categoryMeta || []).map(m => [m.folder_name, m])), [categoryMeta]);
  const tagColorMap = useMemo(() => Object.fromEntries((tags || []).map(t => [t.name, t.color || '#6b7280'])), [tags]);

  const categories = useMemo(
    () => [...new Set([
      ...(allTracks || []).map(t => t.category).filter(Boolean),
      ...(categoryMeta || []).map(m => m.folder_name),
    ])].sort(),
    [allTracks, categoryMeta],
  );
  const allTagNames = useMemo(
    () => [...new Set((tags || []).map(t => t.name))].sort(),
    [tags],
  );

  const filtered = useMemo(() => {
    return (tracks || []).filter(t => {
      const q = search.toLowerCase();
      if (q && !t.name.toLowerCase().includes(q) && !(t.category || '').toLowerCase().includes(q)) return false;
      if (filterCat && t.category !== filterCat) return false;
      if (filterTags.length > 0) {
        const ts = (t.tags || '').split(',').map(x => x.trim()).filter(Boolean);
        if (!filterTags.every(ft => ts.includes(ft))) return false;
      }
      return true;
    });
  }, [tracks, search, filterCat, filterTags]);

  const sorted = useMemo(() => {
    if (isReorderable) return filtered; // preserve DB sort_order for manual playlists
    return [...filtered].sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir, isReorderable]);

  const handleSort = useCallback((field) => {
    setSortDir(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortField(field);
  }, [sortField]);

  const handlePlayToggle = useCallback(async (track) => {
    const url = urlCache[track.path] || await resolveUrl(track.path);
    if (playingUrls.has(url)) {
      stopTrack(url);
    } else {
      playTrack(url, track.category !== 'sfx', 1.0, track.format || 'mp3');
    }
  }, [urlCache, resolveUrl, playingUrls]);

  const handleMoved = useCallback((updatedTracks) => {
    onTracksChange?.(updatedTracks);
  }, [onTracksChange]);

  const handleDelete = useCallback(async (trackId, deleteFile, globalDelete = false) => {
    try {
      const updated = await window.dndj.deleteTrack(trackId, deleteFile, globalDelete);
      onTracksChange?.(updated);
    } catch (e) { alert(`Delete failed: ${e.message}`); }
  }, [onTracksChange]);

  const handleRemoveFromPlaylist = useCallback(async (playlistId, trackId) => {
    if (onRemoveFromPlaylist) {
      await onRemoveFromPlaylist(playlistId, trackId);
    } else {
      await window.dndj.removeTrackFromPlaylist(playlistId, trackId);
      onLibraryRefresh?.();
    }
  }, [onRemoveFromPlaylist, onLibraryRefresh]);

  const isTrackPlaying = useCallback((track) => {
    const url = urlCache[track.path];
    return url ? playingUrls.has(url) : false;
  }, [urlCache, playingUrls]);

  const toggleTag = (tag) => setFilterTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);
  const hasFilters = search || filterCat || filterTags.length > 0;

  return (
    <div className="tracklist-panel">
      {/* ── Toolbar ── */}
      <div className="tl-toolbar">
        <div className="tl-search-wrap">
          <span className="tl-search-icon">🔍</span>
          <input
            className="tl-search"
            placeholder="Search tracks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="tl-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        <select className="tl-cat-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{catMetaMap[c]?.display_name || c}</option>)}
        </select>
        {allTagNames.length > 0 && (
          <div className="tl-tag-chips">
            {allTagNames.map(tag => {
              const tc = tagColorMap[tag] || '#6b7280';
              return (
                <button
                  key={tag}
                  className={`tl-chip ${filterTags.includes(tag) ? 'tl-chip--on' : ''}`}
                  style={filterTags.includes(tag) ? { background: tc + '28', borderColor: tc + '80', color: tc } : {}}
                  onClick={() => toggleTag(tag)}
                >{tag}</button>
              );
            })}
          </div>
        )}
        {hasFilters && (
          <button className="tl-clear-filters" onClick={() => { setSearch(''); setFilterCat(''); setFilterTags([]); }}>
            Clear filters
          </button>
        )}
        {onLibraryRefresh && (
          <button className="tl-refresh-btn" onClick={onLibraryRefresh} title="Re-scan library folder">
            ↻ Refresh
          </button>
        )}
        <button className="tl-yt-btn" onClick={() => setYtOpen(true)} title="Import from YouTube">
          ⬇ YouTube
        </button>
      </div>
      {ytOpen && (
        <YoutubeImportDialog
          onClose={() => setYtOpen(false)}
          onImported={(updatedTracks) => { setYtOpen(false); if (updatedTracks) onTracksChange?.(updatedTracks); onLibraryRefresh?.(); }}
          existingCategories={categories}
          categoryMeta={categoryMeta}
          existingTags={tags}
          onCategoryMetaChange={() => {}} // parent handles via onLibraryRefresh
        />
      )}

      {/* ── Count bar ── */}
      <div className="tl-meta">
        <span className="tl-count">{sorted.length} track{sorted.length !== 1 ? 's' : ''}</span>
        {selectedPlaylistId === null && <span className="tl-hint">Drag a track to a playlist to add it</span>}
      </div>

      {/* ── Column headers ── */}
      <div className="tl-header">
        <div className="tl-th tl-th--drag" />
        <div className="tl-th tl-th--play" />
        <SortHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
        <SortHeader label="Category" field="category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
        <div className="tl-th">Tags</div>
        <SortHeader label="Duration" field="duration" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
        <div className="tl-th tl-th--menu" />
      </div>

      {/* ── Rows ── */}
      <div className="tl-rows">
        {isReorderable ? (
          <SortableContext items={sorted.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {sorted.map(track => (
              <SortableRow
                key={track.id}
                track={track}
                isPlaying={isTrackPlaying(track)}
                onPlayToggle={() => handlePlayToggle(track)}
                onLoadToDeck={onLoadToDeck}
                onRename={onRename}
                onAddTag={onAddTag}
                onMoved={handleMoved}
                onDelete={handleDelete}
                onRemoveFromPlaylist={handleRemoveFromPlaylist}
                selectedPlaylistId={selectedPlaylistId}
                selectedPlaylistType={selectedPlaylistType}
                categories={categories}
                catMetaMap={catMetaMap}
                tagColorMap={tagColorMap}
              />
            ))}
          </SortableContext>
        ) : (
          sorted.map(track => (
            <DraggableRow
              key={track.id}
              track={track}
              isPlaying={isTrackPlaying(track)}
              onPlayToggle={() => handlePlayToggle(track)}
              onLoadToDeck={onLoadToDeck}
              onRename={onRename}
              onAddTag={onAddTag}
              onMoved={handleMoved}
              onDelete={handleDelete}
              onRemoveFromPlaylist={selectedPlaylistId !== null ? handleRemoveFromPlaylist : null}
              selectedPlaylistId={selectedPlaylistId}
              selectedPlaylistType={selectedPlaylistType}
              categories={categories}
              catMetaMap={catMetaMap}
              tagColorMap={tagColorMap}
            />
          ))
        )}
        {sorted.length === 0 && (
          <div className="tl-empty">
            {(tracks || []).length === 0
              ? 'This playlist is empty. Drag tracks here from My Library.'
              : 'No tracks match your search or filters.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default TracklistPanel;
