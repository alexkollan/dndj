import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useUIStore } from '../../store.js';
import { loadDeck, subscribe } from '../../audioEngine.js';
import PlaylistRail, { evaluateSmartPlaylist } from './PlaylistRail.jsx';
import TracklistPanel from './TracklistPanel.jsx';
import DeckPanel from './DeckPanel.jsx';
import Crossfader from './Crossfader.jsx';
import SamplerStrip from './SamplerStrip.jsx';
import '../../styles/studio/StudioLayout.css';

const INIT_DECK_STATE = { isPlaying: false, isPaused: false };

function StudioLayout({
  masterVolume, onMasterVolume, onStopAll,
  allTracks, tags, resolveUrl, urlCache,
}) {
  const { toggleUiMode, studioRailWidth, setStudioRailWidth } = useUIStore();
  const railResizing = useRef(false);
  const railStartX = useRef(0);
  const railStartW = useRef(0);

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null);

  // Deck state
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null }); // { track, url } | null
  const [deckState, setDeckState] = useState({ A: INIT_DECK_STATE, B: INIT_DECK_STATE });

  const samplerRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ── Subscribe to deck engine events ────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribe((event, data) => {
      const id = data?.deckId;
      if (!id) return;
      if (event === 'deckStarted') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: true, isPaused: false } }));
      } else if (event === 'deckPaused') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: false, isPaused: true } }));
      } else if (event === 'deckStopped' || event === 'deckEnded') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: false, isPaused: false } }));
      }
    });
    return () => unsub();
  }, []);

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

  // ── Load track to deck ──────────────────────────────────────────────────────
  const handleLoadToDeck = useCallback(async (deckId, track) => {
    const url = urlCache[track.path] || await resolveUrl(track.path);
    if (!url) return;
    setDeckTracks(prev => ({ ...prev, [deckId]: { track, url } }));
    setDeckState(prev => ({ ...prev, [deckId]: INIT_DECK_STATE }));
    await loadDeck(deckId, url);
  }, [urlCache, resolveUrl]);

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
    const trackId = active.data.current?.trackId;

    if (overId === 'deck-A' || overId === 'deck-B') {
      const deckId = overId === 'deck-A' ? 'A' : 'B';
      const track = allTracks.find(t => t.id === trackId);
      if (track) await handleLoadToDeck(deckId, track);
    } else if (overId.startsWith('pad-')) {
      const padIdx = parseInt(overId.replace('pad-', ''), 10);
      const track = allTracks.find(t => t.id === trackId);
      if (track && !isNaN(padIdx) && SamplerStrip._assignPad) {
        await SamplerStrip._assignPad(padIdx, track);
      }
    } else if (overId.startsWith('playlist-')) {
      const playlistId = parseInt(overId.replace('playlist-', ''), 10);
      if (trackId && playlistId) {
        await window.dndj.addTrackToPlaylist(playlistId, trackId);
        if (selectedPlaylistId === playlistId) await loadPlaylistTracks(playlistId);
      }
    } else if (isReorderable && typeof active.id === 'number' && typeof over.id === 'number' && active.id !== over.id) {
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
  }, [selectedPlaylistId, isReorderable, playlistTracks, loadPlaylistTracks, allTracks, handleLoadToDeck]);

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
              <div className="studio__deck studio__deck--a deck--a">
                <DeckPanel
                  deckId="A"
                  track={deckTracks.A?.track ?? null}
                  isPlaying={deckState.A.isPlaying}
                  isPaused={deckState.A.isPaused}
                />
              </div>

              <div className="studio__crossfader-zone">
                <Crossfader />
              </div>

              <div className="studio__deck studio__deck--b deck--b">
                <DeckPanel
                  deckId="B"
                  track={deckTracks.B?.track ?? null}
                  isPlaying={deckState.B.isPlaying}
                  isPaused={deckState.B.isPaused}
                />
              </div>
            </div>

            {/* Tracklist */}
            <div className="studio__tracklist">
              <TracklistPanel
                tracks={displayedTracks}
                allTracks={allTracks || []}
                tags={tags || []}
                urlCache={urlCache || {}}
                resolveUrl={resolveUrl}
                selectedPlaylistId={selectedPlaylistId}
                isReorderable={isReorderable}
                onLoadToDeck={handleLoadToDeck}
              />
            </div>

            {/* Sampler strip */}
            <div className="studio__sampler">
              <SamplerStrip
                allTracks={allTracks || []}
                resolveUrl={resolveUrl}
                urlCache={urlCache || {}}
              />
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
