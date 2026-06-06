import React, { useState, useMemo, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { playTrack, stopTrack } from '../../audioEngine.js';
import { useAudioStore } from '../../store.js';
import '../../styles/studio/TracklistPanel.css';

const CAT_COLORS = {
  atmosphere: 'var(--color-emerald)',
  sfx: 'var(--color-amber)',
  music: '#818cf8',
  ambience: '#22d3ee',
};

function formatDur(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Shared row inner content ─────────────────────────────────────────────────
function RowInner({ track, isPlaying, onPlayToggle }) {
  const catColor = CAT_COLORS[track.category?.toLowerCase()] || 'var(--text-muted)';
  const tags = (track.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  return (
    <>
      <button
        className={`tr-play ${isPlaying ? 'tr-play--on' : ''}`}
        onClick={e => { e.stopPropagation(); onPlayToggle(); }}
        title={isPlaying ? 'Stop' : 'Play'}
      >
        {isPlaying ? '■' : '▶'}
      </button>
      <span className="tr-name" title={track.name}>{track.name}</span>
      <span className="tr-cat" style={{ color: catColor }}>{(track.category || '').toUpperCase()}</span>
      <div className="tr-tags">
        {tags.slice(0, 3).map(t => <span key={t} className="tr-tag">{t}</span>)}
        {tags.length > 3 && <span className="tr-tag tr-tag--more">+{tags.length - 3}</span>}
      </div>
      <span className="tr-dur">{formatDur(track.duration)}</span>
    </>
  );
}

// ─── Draggable row (library view) ─────────────────────────────────────────────
function DraggableRow({ track, isPlaying, onPlayToggle }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track-${track.id}`,
    data: { trackId: track.id, trackName: track.name },
  });
  return (
    <div
      ref={setNodeRef}
      className={`tr ${isPlaying ? 'tr--playing' : ''} ${isDragging ? 'tr--dragging' : ''}`}
    >
      <span className="tr-drag" {...listeners} {...attributes} title="Drag to a playlist">⣿</span>
      <RowInner track={track} isPlaying={isPlaying} onPlayToggle={onPlayToggle} />
    </div>
  );
}

// ─── Sortable row (playlist view) ─────────────────────────────────────────────
function SortableRow({ track, isPlaying, onPlayToggle }) {
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
      <RowInner track={track} isPlaying={isPlaying} onPlayToggle={onPlayToggle} />
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
function TracklistPanel({ tracks, allTracks, tags, urlCache, resolveUrl, selectedPlaylistId, isReorderable }) {
  const { playingUrls } = useAudioStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const categories = useMemo(
    () => [...new Set((allTracks || []).map(t => t.category))].filter(Boolean).sort(),
    [allTracks],
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
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {allTagNames.length > 0 && (
          <div className="tl-tag-chips">
            {allTagNames.map(tag => (
              <button
                key={tag}
                className={`tl-chip ${filterTags.includes(tag) ? 'tl-chip--on' : ''}`}
                onClick={() => toggleTag(tag)}
              >{tag}</button>
            ))}
          </div>
        )}
        {hasFilters && (
          <button className="tl-clear-filters" onClick={() => { setSearch(''); setFilterCat(''); setFilterTags([]); }}>
            Clear filters
          </button>
        )}
      </div>

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
