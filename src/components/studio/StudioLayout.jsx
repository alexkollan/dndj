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
import MiniDeck from './MiniDeck.jsx';
import Crossfader from './Crossfader.jsx';
import SamplerStrip from './SamplerStrip.jsx';
import ScenePanel from './ScenePanel.jsx';
import DocsModal from './DocsModal.jsx';
import IntegrityModal from './IntegrityModal.jsx';
import ImportDialog from './ImportDialog.jsx';
import '../../styles/studio/StudioLayout.css';

const INIT_DECK_STATE = { isPlaying: false, isPaused: false };

// Returns true if ancestorId equals candidateId or is any ancestor of it
function isAncestorOrSelf(playlists, ancestorId, candidateId) {
  if (ancestorId === candidateId) return true;
  let node = playlists.find(p => p.id === candidateId);
  while (node?.parent_id != null) {
    if (node.parent_id === ancestorId) return true;
    node = playlists.find(p => p.id === node.parent_id);
  }
  return false;
}

function computeDropPosition(pointerY, rect, isFolder) {
  if (isFolder) {
    const third = rect.height / 3;
    if (pointerY < rect.top + third) return 'before';
    if (pointerY > rect.bottom - third) return 'after';
    return 'into';
  }
  return pointerY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function StudioLayout({
  masterVolume, onMasterVolume, onStopAll,
  allTracks, tags, resolveUrl, urlCache,
  onRename, onAddTag, onLibraryRefresh, onTagsChange, onTracksChange,
}) {
  const { studioRailWidth, setStudioRailWidth, deckASplit, setDeckASplit } = useUIStore();
  const railResizing = useRef(false);
  const railStartX = useRef(0);
  const railStartW = useRef(0);

  const decksRef = useRef(null);
  const splitResizing = useRef(false);
  const splitStartX = useRef(0);
  const splitStartV = useRef(0);

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
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null, C: null }); // { track, url } | null
  const [deckState, setDeckState] = useState({ A: INIT_DECK_STATE, B: INIT_DECK_STATE, C: INIT_DECK_STATE });

  const samplerRef = useRef(null);
  const activeDeckRef = useRef('A'); // tracks the last-played deck for keyboard shortcuts
  const pointerYRef = useRef(0);
  const [playlistDropIndicator, setPlaylistDropIndicator] = useState(null);
  const [samplerKey, setSamplerKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthReport, setHealthReport] = useState(null);
  const [dropActive, setDropActive] = useState(false);   // external file drag over the window
  const [dragStaging, setDragStaging] = useState(null);  // { stagingId, items } from a drop
  const [crossfaderKey, setCrossfaderKey] = useState(0);
  const [crossfaderInit, setCrossfaderInit] = useState({ pos: 0.5, curve: 'equal_power' });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // ── Track pointer Y for playlist drop-position detection ───────────────────
  useEffect(() => {
    const onMove = (e) => { pointerYRef.current = e.clientY; };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // ── External file drag-and-drop → import ────────────────────────────────────
  // Only reacts to OS file drags (dataTransfer "Files"); internal @dnd-kit drags
  // are pointer-based and never trigger these native handlers.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDropActive(true); };
    const onOver  = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const onLeave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDropActive(false); };
    const onDrop = async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropActive(false);
      const files = Array.from(e.dataTransfer.files || []);
      const paths = files.map(f => { try { return window.dndj.getPathForFile(f); } catch { return null; } }).filter(Boolean);
      if (paths.length === 0) return;
      // Main classifies: returns no items if nothing supported was dropped → do nothing.
      const staged = await window.dndj.importStagePaths(paths);
      if (staged?.items?.length) setDragStaging(staged);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const importCategories = useMemo(
    () => [...new Set([...(allTracks || []).map(t => t.category).filter(Boolean), ...categoryMeta.map(m => m.folder_name)])].sort(),
    [allTracks, categoryMeta],
  );

  // ── Subscribe to deck engine events ────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribe((event, data) => {
      const id = data?.deckId;
      if (!id) return;
      if (event === 'deckStarted') {
        setDeckState(prev => ({ ...prev, [id]: { isPlaying: true, isPaused: false } }));
        if (id !== 'C') activeDeckRef.current = id;
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

  // ── Library health check (on-demand) ────────────────────────────────────────
  const runHealthCheck = useCallback(async () => {
    setHealthReport(null);
    setHealthOpen(true);
    await handleLibraryRefresh();            // re-scan disk so the report is current
    const report = await window.dndj.integrityCheck();
    setHealthReport(report);
  }, [handleLibraryRefresh]);

  const handleHealthCleanup = useCallback(async () => {
    const { tracks } = await window.dndj.integrityCleanup();
    onTracksChange?.(tracks);
    await loadPlaylists();
    await loadCategoryMeta();
    const report = await window.dndj.integrityCheck();
    setHealthReport(report);
  }, [onTracksChange, loadPlaylists, loadCategoryMeta]);

  const handleHealthRelinkTrack = useCallback(async (trackId) => {
    const res = await window.dndj.relinkTrack(trackId);
    if (res?.tracks) onTracksChange?.(res.tracks);
    await loadPlaylists();
    setHealthReport(await window.dndj.integrityCheck());
  }, [onTracksChange, loadPlaylists]);

  const handleHealthRelinkCategory = useCallback(async (folder) => {
    const res = await window.dndj.relinkCategory(folder);
    if (res?.tracks) onTracksChange?.(res.tracks);
    await loadPlaylists();
    await loadCategoryMeta();
    setHealthReport(await window.dndj.integrityCheck());
  }, [onTracksChange, loadPlaylists, loadCategoryMeta]);

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

  const selectedPlaylistType = useMemo(() => {
    if (selectedPlaylistId === null) return null;
    return playlists.find(p => p.id === selectedPlaylistId)?.type || null;
  }, [selectedPlaylistId, playlists]);

  const handleRemoveFromPlaylist = useCallback(async (playlistId, trackId) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (pl.type === 'smart') {
      const parsed = pl.rules_json ? JSON.parse(pl.rules_json) : { combinator: 'AND', rules: [] };
      const trackName = allTracks.find(t => t.id === trackId)?.name || String(trackId);
      const newRules = { ...parsed, rules: [...parsed.rules, { field: 'id', op: 'not_eq', value: String(trackId), trackName }] };
      await window.dndj.updatePlaylist(pl.id, pl.name, pl.parent_id, JSON.stringify(newRules), pl.sort_order);
      await loadPlaylists();
    } else {
      await window.dndj.removeTrackFromPlaylist(playlistId, trackId);
      await loadPlaylistTracks(playlistId);
    }
  }, [playlists, allTracks, loadPlaylists, loadPlaylistTracks]);

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
    const mixerC = getDeckMixerState('C');
    const xfade = getCrossfadeState();
    const samplerRaw = await window.dndj.getSetting('sampler_pads');
    const samplerPads = samplerRaw ? JSON.parse(samplerRaw) : Array(8).fill(null);
    return {
      version: 1,
      deckA: deckTracks.A ? { path: deckTracks.A.track.path, ...(mixerA || {}) } : null,
      deckB: deckTracks.B ? { path: deckTracks.B.track.path, ...(mixerB || {}) } : null,
      deckC: deckTracks.C ? { path: deckTracks.C.track.path, ...(mixerC || {}) } : null,
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
    stopDeck('C');
    setDeckState(prev => ({ ...prev, A: INIT_DECK_STATE, B: INIT_DECK_STATE, C: INIT_DECK_STATE }));

    for (const [deckId, key] of [['A', 'deckA'], ['B', 'deckB'], ['C', 'deckC']]) {
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

  // ── Deck A/B split resize ────────────────────────────────────────────────────
  const startDeckSplitResize = useCallback((e) => {
    e.preventDefault();
    splitResizing.current = true;
    splitStartX.current = e.clientX;
    splitStartV.current = deckASplit;
    const onMove = (me) => {
      if (!splitResizing.current) return;
      const totalW = decksRef.current?.offsetWidth ?? 800;
      const delta = (me.clientX - splitStartX.current) / totalW;
      setDeckASplit(Math.max(0.2, Math.min(0.8, splitStartV.current + delta)));
    };
    const onUp = () => {
      splitResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [deckASplit, setDeckASplit]);

  // ── DnD handlers ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback(({ active }) => {
    setActiveDrag({
      id: active.id,
      name: active.data.current?.trackName || active.data.current?.playlistName || String(active.id),
    });
  }, []);

  const handleDragMove = useCallback(({ active, over }) => {
    if (active.data.current?.type !== 'playlist') { setPlaylistDropIndicator(null); return; }
    if (!over || !String(over.id).startsWith('playlist-')) { setPlaylistDropIndicator(null); return; }
    const targetId = parseInt(String(over.id).replace('playlist-', ''), 10);
    const draggedId = active.data.current.playlistId;
    if (targetId === draggedId) { setPlaylistDropIndicator(null); return; }
    const rect = over.rect;
    if (!rect) { setPlaylistDropIndicator(null); return; }
    const target = playlists.find(p => p.id === targetId);
    const position = computeDropPosition(pointerYRef.current, rect, target?.type === 'folder');
    setPlaylistDropIndicator({ targetId, position });
  }, [playlists]);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveDrag(null);
    setPlaylistDropIndicator(null);

    // ── Playlist reorganization ──────────────────────────────────────────────
    if (active.data.current?.type === 'playlist') {
      if (!over || !String(over.id).startsWith('playlist-')) return;
      const targetId = parseInt(String(over.id).replace('playlist-', ''), 10);
      const draggedId = active.data.current.playlistId;
      if (draggedId === targetId) return;

      const dragged = playlists.find(p => p.id === draggedId);
      const target  = playlists.find(p => p.id === targetId);
      if (!dragged || !target) return;

      // Guard circular nesting
      if (isAncestorOrSelf(playlists, draggedId, targetId)) return;

      const rect = over.rect;
      if (!rect) return;
      const position = computeDropPosition(pointerYRef.current, rect, target.type === 'folder');

      if (position === 'into') {
        // Move dragged to end of target folder's children
        const existingKids = playlists.filter(p => p.parent_id === targetId && p.id !== draggedId);
        await window.dndj.updatePlaylist(draggedId, dragged.name, targetId, dragged.rules_json, existingKids.length);
      } else {
        // Reorder within target's parent level
        const newParentId = target.parent_id;
        if (newParentId !== null && isAncestorOrSelf(playlists, draggedId, newParentId)) return;

        const siblings = playlists
          .filter(p => p.parent_id === newParentId && p.id !== draggedId)
          .sort((a, b) => a.sort_order - b.sort_order);

        const targetIdx = siblings.findIndex(p => p.id === targetId);
        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
        const newOrder = [...siblings];
        newOrder.splice(insertIdx, 0, dragged);

        await Promise.all(newOrder.map((pl, i) => {
          const newParent = pl.id === draggedId ? newParentId : pl.parent_id;
          const changed = pl.id === draggedId
            ? (pl.parent_id !== newParentId || pl.sort_order !== i)
            : pl.sort_order !== i;
          return changed
            ? window.dndj.updatePlaylist(pl.id, pl.name, newParent, pl.rules_json, i)
            : Promise.resolve();
        }));
      }

      await loadPlaylists();
      return;
    }

    if (!over) return;

    const overId = String(over.id);
    const trackId = active.data.current?.trackId;

    if (overId === 'deck-A' || overId === 'deck-B' || overId === 'deck-C' || overId === 'deck-C-full') {
      const deckMap = { 'deck-A': 'A', 'deck-B': 'B', 'deck-C': 'C', 'deck-C-full': 'C' };
      const deckId = deckMap[overId];
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
  }, [selectedPlaylistId, isReorderable, playlistTracks, loadPlaylistTracks, allTracks, handleLoadToDeck, playlists, loadPlaylists]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const pointer = pointerWithin(args);
        return pointer.length > 0 ? pointer : rectIntersection(args);
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
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
            <button className="studio__settings-btn" onClick={runHealthCheck} title="Check library health">🩺</button>
            <button className="studio__settings-btn" onClick={() => setDocsOpen(true)} title="Guides & documentation">?</button>
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
                dropIndicator={playlistDropIndicator}
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
            <div
              className="studio__decks"
              ref={decksRef}
              style={{
                height: deckHeight,
                gridTemplateColumns: `${deckASplit}fr 160px ${1 - deckASplit}fr`,
              }}
            >
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
                <div
                  className="studio__deck-split-handle"
                  onMouseDown={startDeckSplitResize}
                  title="Drag to resize decks"
                />
                <div className="studio__crossfader-center">
                  <Crossfader
                    key={crossfaderKey}
                    initialPos={crossfaderInit.pos}
                    initialCurve={crossfaderInit.curve}
                  />
                </div>
                <MiniDeck
                  track={deckTracks.C?.track ?? null}
                  url={deckTracks.C?.url ?? null}
                  isPlaying={deckState.C.isPlaying}
                  isPaused={deckState.C.isPaused}
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
                selectedPlaylistType={selectedPlaylistType}
                isReorderable={isReorderable}
                onLoadToDeck={handleLoadToDeck}
                onRename={onRename}
                onAddTag={onAddTag}
                onRemoveFromPlaylist={handleRemoveFromPlaylist}
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

      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}

      {healthOpen && (
        <IntegrityModal
          mode="report"
          report={healthReport}
          onCleanup={handleHealthCleanup}
          onRelinkTrack={handleHealthRelinkTrack}
          onRelinkCategory={handleHealthRelinkCategory}
          onClose={() => setHealthOpen(false)}
        />
      )}

      {dropActive && (
        <div className="studio__dropzone">
          <div className="studio__dropzone-card">
            <div className="studio__dropzone-icon">⬇</div>
            <div className="studio__dropzone-text">Drop audio files, a folder, or a .zip to import</div>
          </div>
        </div>
      )}

      {dragStaging && (
        <ImportDialog
          initialStaging={dragStaging}
          onClose={() => setDragStaging(null)}
          onImported={(tracks) => { if (tracks) onTracksChange?.(tracks); handleLibraryRefresh(); loadPlaylists(); }}
          existingCategories={importCategories}
          categoryMeta={categoryMeta}
          existingTags={tags}
        />
      )}

    </DndContext>
  );
}

export default StudioLayout;
