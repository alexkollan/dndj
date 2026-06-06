import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useUIStore } from '../../store.js';
import PlaylistRail, { evaluateSmartPlaylist } from './PlaylistRail.jsx';
import TracklistPanel from './TracklistPanel.jsx';
import '../../styles/studio/StudioLayout.css';

function StudioLayout({
  masterVolume, onMasterVolume, onStopAll,
  allTracks, tags, resolveUrl, urlCache,
}) {
  const { toggleUiMode, studioRailWidth, setStudioRailWidth } = useUIStore();
  const railResizing = useRef(false);
  const railStartX = useRef(0);
  const railStartW = useRef(0);

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null); // null = My Library
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null); // { id, name }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ── Load playlists ──────────────────────────────────────────────────────────
  const loadPlaylists = useCallback(async () => {
    const pls = await window.dndj.getPlaylists();
    setPlaylists(pls || []);
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  // ── Load tracks for selected playlist ───────────────────────────────────────
  const loadPlaylistTracks = useCallback(async (id) => {
    if (id == null) { setPlaylistTracks([]); return; }
    const pl = playlists.find(p => p.id === id);
    if (!pl) { setPlaylistTracks([]); return; }
    if (pl.type === 'smart') {
      setPlaylistTracks(evaluateSmartPlaylist(allTracks, pl.rules_json));
    } else {
      const tracks = await window.dndj.getPlaylistTracks(id);
      setPlaylistTracks(tracks || []);
    }
  }, [playlists, allTracks]);

  useEffect(() => {
    loadPlaylistTracks(selectedPlaylistId);
  }, [selectedPlaylistId, loadPlaylistTracks]);

  // ── Displayed tracks ────────────────────────────────────────────────────────
  const displayedTracks = useMemo(
    () => selectedPlaylistId === null ? allTracks : playlistTracks,
    [selectedPlaylistId, allTracks, playlistTracks],
  );

  const isReorderable = useMemo(() => {
    if (selectedPlaylistId === null) return false;
    const pl = playlists.find(p => p.id === selectedPlaylistId);
    return pl?.type === 'manual';
  }, [selectedPlaylistId, playlists]);

  // ── Rail resize ─────────────────────────────────────────────────────────────
  const startRailResize = useCallback((e) => {
    e.preventDefault();
    railResizing.current = true;
    railStartX.current = e.clientX;
    railStartW.current = studioRailWidth;
    const onMove = (me) => {
      if (!railResizing.current) return;
      setStudioRailWidth(Math.max(160, Math.min(360, railStartW.current + (me.clientX - railStartX.current))));
    };
    const onUp = () => {
      railResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [studioRailWidth, setStudioRailWidth]);

  // ── DnD handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback(({ active }) => {
    setActiveDrag({ id: active.id, name: active.data.current?.trackName || String(active.id) });
  }, []);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveDrag(null);
    if (!over) return;

    const overId = String(over.id);

    if (overId.startsWith('playlist-')) {
      // Dropped on a playlist item → add track to that playlist
      const trackId = active.data.current?.trackId;
      const playlistId = parseInt(overId.replace('playlist-', ''), 10);
      if (trackId && playlistId) {
        await window.dndj.addTrackToPlaylist(playlistId, trackId);
        if (selectedPlaylistId === playlistId) await loadPlaylistTracks(playlistId);
      }
    } else if (isReorderable && typeof active.id === 'number' && typeof over.id === 'number' && active.id !== over.id) {
      // Reorder within a manual playlist
      const oldIdx = playlistTracks.findIndex(t => t.id === active.id);
      const newIdx = playlistTracks.findIndex(t => t.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(playlistTracks, oldIdx, newIdx);
        setPlaylistTracks(reordered);
        for (let i = 0; i < reordered.length; i++) {
          await window.dndj.reorderPlaylistTrack(selectedPlaylistId, reordered[i].id, i);
        }
      }
    }
  }, [selectedPlaylistId, isReorderable, playlistTracks, loadPlaylistTracks]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="studio">

        {/* ── Top Bar ── */}
        <header className="studio__topbar">
          <div className="studio__brand">
            DND<span>j</span>
            <span className="studio__brand-mode">STUDIO</span>
          </div>

          <div className="studio__topbar-center" />

          <div className="studio__topbar-right">
            <div className="studio__master-vol">
              <span className="studio__master-label">MASTER</span>
              <input
                type="range" min="0" max="1" step="0.01"
                value={masterVolume}
                onChange={e => onMasterVolume(parseFloat(e.target.value))}
                className="studio__master-slider"
              />
              <span className="studio__master-val">{Math.round(masterVolume * 100)}%</span>
            </div>
            <button className="studio__stop-btn" onClick={onStopAll}>■ STOP</button>
            <button className="studio__classic-btn" onClick={toggleUiMode}>CLASSIC ↩</button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="studio__body">

          {/* Left rail */}
          <aside className="studio__rail" style={{ width: studioRailWidth }}>
            <PlaylistRail
              playlists={playlists}
              selectedPlaylistId={selectedPlaylistId}
              onSelect={setSelectedPlaylistId}
              onLibrarySelect={() => setSelectedPlaylistId(null)}
              onRefresh={loadPlaylists}
              allTracks={allTracks || []}
            />
          </aside>
          <div className="studio__rail-resizer" onMouseDown={startRailResize} />

          {/* Center column */}
          <div className="studio__center">

            {/* Deck zone */}
            <div className="studio__decks">
              <div className="studio__deck studio__deck--a">
                <span className="studio__section-label studio__section-label--a">DECK A</span>
                <div className="studio__placeholder-block studio__placeholder-block--deck">
                  Deck A — Phase 3
                </div>
              </div>
              <div className="studio__crossfader-zone">
                <span className="studio__section-label">CROSSFADE</span>
                <div className="studio__placeholder-block">⟵ ━━●━━ ⟶ — Phase 3</div>
              </div>
              <div className="studio__deck studio__deck--b">
                <span className="studio__section-label studio__section-label--b">DECK B</span>
                <div className="studio__placeholder-block studio__placeholder-block--deck">
                  Deck B — Phase 3
                </div>
              </div>
            </div>

            {/* Tracklist — Phase 2 */}
            <div className="studio__tracklist">
              <TracklistPanel
                tracks={displayedTracks}
                allTracks={allTracks || []}
                tags={tags || []}
                urlCache={urlCache || {}}
                resolveUrl={resolveUrl}
                selectedPlaylistId={selectedPlaylistId}
                isReorderable={isReorderable}
              />
            </div>

            {/* Sampler strip */}
            <div className="studio__sampler">
              <span className="studio__section-label studio__section-label--sfx">SFX PADS</span>
              <div className="studio__pads-placeholder">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="studio__pad-placeholder">PAD {i + 1}</div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Drag overlay pill */}
        <DragOverlay>
          {activeDrag ? (
            <div className="studio__drag-pill">{activeDrag.name}</div>
          ) : null}
        </DragOverlay>

      </div>
    </DndContext>
  );
}

export default StudioLayout;
