import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  DndContext, DragOverlay,
  pointerWithin, rectIntersection,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useUIStore } from '../../store.js';
import {
  loadDeck, subscribe,
  setDeckMixerState, fadeDeckVolume, getDeckMixerState, getCrossfadeState,
  setCrossfade, setCrossfadeCurve, stopDeck, playDeck, pauseDeck,
  seekDeck, getDeckPosition, getDeckLoopState, setDeckLoopEnabled, stopAll,
} from '../../audioEngine.js';
import PlaylistRail, { evaluateSmartPlaylist } from './PlaylistRail.jsx';
import LibrarySettingsModal from './LibrarySettingsModal.jsx';
import TracklistPanel from './TracklistPanel.jsx';
import DeckPanel from './DeckPanel.jsx';
import Crossfader from './Crossfader.jsx';
import SamplerStrip from './SamplerStrip.jsx';
import ScenePanel from './ScenePanel.jsx';
import '../../styles/studio/StudioLayout.css';

const INIT_DECK_STATE = { isPlaying: false, isPaused: false };

function StudioLayout({
  masterVolume, onMasterVolume, onStopAll,
  allTracks, tags, resolveUrl, urlCache,
  onRename, onAddTag, onLibraryRefresh, onTagsChange, onTracksChange,
}) {
  const { studioRailWidth, setStudioRailWidth } = useUIStore();
  const railResizing = useRef(false);
  const railStartX = useRef(0);
  const railStartW = useRef(0);

  const [deckHeight, setDeckHeight] = useState(220);
  const deckResizing = useRef(false);
  const deckStartY = useRef(0);
  const deckStartH = useRef(0);

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const [activeDrag, setActiveDrag] = useState(null);
  const [categoryMeta, setCategoryMeta] = useState([]);
  const [playlistFlash, setPlaylistFlash] = useState(null); // { playlistId, key } — triggers drop animation

  // Deck state
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null }); // { track, url } | null
  const [deckState, setDeckState] = useState({ A: INIT_DECK_STATE, B: INIT_DECK_STATE });

  const samplerRef = useRef(null);
  const activeDeckRef = useRef('A'); // tracks the last-played deck for keyboard shortcuts
  const [samplerKey, setSamplerKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [crossfaderKey, setCrossfaderKey] = useState(0);
  const [crossfaderInit, setCrossfaderInit] = useState({ pos: 0.5, curve: 'equal_power' });

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
        activeDeckRef.current = id;
      } else if (event === 'deckPaused') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: false, isPaused: true } }));
      } else if (event === 'deckStopped' || event === 'deckEnded') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: false, isPaused: false } }));
      }
    });
    return () => unsub();
  }, []);

  // ── Global keyboard shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const tag = document.activeElement?.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || document.activeElement?.isContentEditable) return;

      const active = activeDeckRef.current;   // 'A' or 'B'
      const other  = active === 'A' ? 'B' : 'A';

      // ── Deck play/pause ──
      if (e.code === 'Space' && !e.shiftKey) {
        e.preventDefault();
        if (deckState[active].isPlaying) pauseDeck(active);
        else playDeck(active);
        return;
      }
      if (e.code === 'Space' && e.shiftKey) {
        e.preventDefault();
        if (deckState[other].isPlaying) pauseDeck(other);
        else playDeck(other);
        return;
      }

      // ── Individual deck keys ──
      if (e.key === 'a' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (deckState.A.isPlaying) pauseDeck('A'); else playDeck('A');
        return;
      }
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (deckState.B.isPlaying) pauseDeck('B'); else playDeck('B');
        return;
      }

      // ── Stop ──
      if (e.key === 's' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        stopDeck(active);
        return;
      }
      if (e.key === 'S' && e.shiftKey) {
        e.preventDefault();
        stopAll();
        return;
      }

      // ── Seek: Arrow keys ──
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const dir = e.code === 'ArrowLeft' ? -1 : 1;
        const jump = e.shiftKey ? 30 : 5;
        const { currentTime, duration } = getDeckPosition(active);
        if (duration > 0) {
          seekDeck(active, Math.max(0, Math.min(duration - 0.01, currentTime + dir * jump)));
        }
        return;
      }

      // ── Loop toggle ──
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const { isLoop } = getDeckLoopState(active);
        setDeckLoopEnabled(active, !isLoop);
        return;
      }

      // ── Crossfader: bracket keys ──
      if (e.key === '[') { e.preventDefault(); setCrossfade(Math.max(0, getCrossfadeState().pos - 0.05)); return; }
      if (e.key === ']') { e.preventDefault(); setCrossfade(Math.min(1, getCrossfadeState().pos + 0.05)); return; }
      if (e.key === '\\') { e.preventDefault(); setCrossfade(0.5); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deckState]);

  // ── Load playlists ──────────────────────────────────────────────────────────
  const loadPlaylists = useCallback(async () => {
    const pls = await window.dndj.getPlaylists();
    setPlaylists(pls || []);
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  // ── Category metadata ───────────────────────────────────────────────────────
  const loadCategoryMeta = useCallback(async () => {
    const meta = await window.dndj.getCategoryMeta();
    setCategoryMeta(meta || []);
  }, []);

  useEffect(() => { loadCategoryMeta(); }, [loadCategoryMeta]);

  // Wrap onLibraryRefresh so category meta is always re-fetched alongside tracks
  const handleLibraryRefresh = useCallback(async () => {
    await onLibraryRefresh?.();
    await loadCategoryMeta();
  }, [onLibraryRefresh, loadCategoryMeta]);

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

  // ── Scene snapshot save/recall ──────────────────────────────────────────────
  const handleGetSnapshot = useCallback(async () => {
    const mixerA = getDeckMixerState('A');
    const mixerB = getDeckMixerState('B');
    const xfade = getCrossfadeState();
    const samplerRaw = await window.dndj.getSetting('sampler_pads');
    const samplerPads = samplerRaw ? JSON.parse(samplerRaw) : Array(8).fill(null);
    return {
      version: 1,
      deckA: deckTracks.A ? { path: deckTracks.A.track.path, ...(mixerA || {}) } : null,
      deckB: deckTracks.B ? { path: deckTracks.B.track.path, ...(mixerB || {}) } : null,
      crossfade: xfade,
      samplerPads,
    };
  }, [deckTracks]);

  const handleRecall = useCallback(async (snapshot, withFade = false) => {
    const FADE_MS = 1800;
    if (withFade) {
      fadeDeckVolume('A', 0, FADE_MS);
      fadeDeckVolume('B', 0, FADE_MS);
      await new Promise(r => setTimeout(r, FADE_MS + 100));
    }
    stopDeck('A');
    stopDeck('B');
    setDeckState({ A: INIT_DECK_STATE, B: INIT_DECK_STATE });

    for (const [deckId, key] of [['A', 'deckA'], ['B', 'deckB']]) {
      const snap = snapshot[key];
      if (!snap?.path) { setDeckTracks(prev => ({ ...prev, [deckId]: null })); continue; }
      const track = (allTracks || []).find(t => t.path === snap.path);
      if (!track) continue;
      const url = urlCache[track.path] || await resolveUrl(track.path);
      setDeckTracks(prev => ({ ...prev, [deckId]: { track, url } }));
      await loadDeck(deckId, url);
      setDeckMixerState(deckId, {
        volume: withFade ? 0 : (snap.volume ?? 0.8),
        filterFreq: snap.filterFreq ?? 20000,
        loopEnabled: snap.loopEnabled ?? true,
        loopStart: snap.loopStart ?? 0,
        loopEnd: snap.loopEnd ?? null,
      });
      if (withFade) {
        await playDeck(deckId);
        fadeDeckVolume(deckId, snap.volume ?? 0.8, FADE_MS);
      }
    }

    if (snapshot.crossfade) {
      const { pos = 0.5, curve = 'equal_power' } = snapshot.crossfade;
      setCrossfade(pos);
      setCrossfadeCurve(curve);
      setCrossfaderInit({ pos, curve });
      setCrossfaderKey(k => k + 1);
    }

    if (snapshot.samplerPads) {
      const toSave = snapshot.samplerPads.map(p =>
        p ? { trackId: p.trackId, name: p.name, path: p.path, volume: p.volume ?? 0.8 } : null
      );
      await window.dndj.setSetting('sampler_pads', JSON.stringify(toSave));
      setSamplerKey(k => k + 1);
    }
  }, [allTracks, urlCache, resolveUrl]);

  // ── Deck height resize ───────────────────────────────────────────────────────
  const startDeckResize = useCallback((e) => {
    e.preventDefault();
    deckResizing.current = true;
    deckStartY.current = e.clientY;
    deckStartH.current = deckHeight;
    const onMove = (me) => {
      if (!deckResizing.current) return;
      setDeckHeight(Math.max(160, Math.min(420, deckStartH.current + (me.clientY - deckStartY.current))));
    };
    const onUp = () => {
      deckResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [deckHeight]);

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
        setPlaylistFlash({ playlistId, key: Date.now() });
        setTimeout(() => setPlaylistFlash(null), 600);
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
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const pointer = pointerWithin(args);
        return pointer.length > 0 ? pointer : rectIntersection(args);
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
            <button className="studio__settings-btn" onClick={() => setSettingsOpen(true)} title="Library settings">⚙</button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="studio__body">

          {/* Left rail — playlists (top) + scenes (bottom) */}
          <aside className="studio__rail" style={{ width: studioRailWidth }}>
            <div className="studio__rail-top">
              <PlaylistRail
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                onSelect={setSelectedPlaylistId}
                onLibrarySelect={() => setSelectedPlaylistId(null)}
                onRefresh={loadPlaylists}
                allTracks={allTracks || []}
                dropFlash={playlistFlash}
              />
            </div>
            <div className="studio__rail-divider" />
            <div className="studio__rail-bottom">
              <ScenePanel
                onGetSnapshot={handleGetSnapshot}
                onRecall={handleRecall}
              />
            </div>
          </aside>
          <div className="studio__rail-resizer" onMouseDown={startRailResize} />

          {/* Center column */}
          <div className="studio__center">

            {/* Deck zone */}
            <div className="studio__decks" style={{ height: deckHeight }}>
              <div className="studio__deck studio__deck--a deck--a">
                <DeckPanel
                  deckId="A"
                  track={deckTracks.A?.track ?? null}
                  url={deckTracks.A?.url ?? null}
                  isPlaying={deckState.A.isPlaying}
                  isPaused={deckState.A.isPaused}
                />
              </div>

              <div className="studio__crossfader-zone">
                <Crossfader
                  key={crossfaderKey}
                  initialPos={crossfaderInit.pos}
                  initialCurve={crossfaderInit.curve}
                />
              </div>

              <div className="studio__deck studio__deck--b deck--b">
                <DeckPanel
                  deckId="B"
                  track={deckTracks.B?.track ?? null}
                  url={deckTracks.B?.url ?? null}
                  isPlaying={deckState.B.isPlaying}
                  isPaused={deckState.B.isPaused}
                />
              </div>
            </div>

            <div className="studio__deck-resizer" onMouseDown={startDeckResize} />

            {/* Tracklist */}
            <div className="studio__tracklist">
              <TracklistPanel
                tracks={displayedTracks}
                allTracks={allTracks || []}
                tags={tags || []}
                categoryMeta={categoryMeta}
                urlCache={urlCache || {}}
                resolveUrl={resolveUrl}
                selectedPlaylistId={selectedPlaylistId}
                isReorderable={isReorderable}
                onLoadToDeck={handleLoadToDeck}
                onRename={onRename}
                onAddTag={onAddTag}
                onLibraryRefresh={handleLibraryRefresh}
                onTracksChange={onTracksChange}
              />
            </div>

            {/* Sampler strip */}
            <div className="studio__sampler">
              <SamplerStrip
                key={samplerKey}
                allTracks={allTracks || []}
                resolveUrl={resolveUrl}
                urlCache={urlCache || {}}
              />
            </div>

          </div>
        </div>

        {/* Drag overlay pill */}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="studio__drag-pill">{activeDrag.name}</div>
          ) : null}
        </DragOverlay>

      </div>

      {settingsOpen && (
        <LibrarySettingsModal
          allTracks={allTracks}
          tags={tags}
          onClose={() => setSettingsOpen(false)}
          onRefresh={handleLibraryRefresh}
          onTagsChange={onTagsChange}
          onCategoryMetaChange={setCategoryMeta}
        />
      )}

    </DndContext>
  );
}

export default StudioLayout;
