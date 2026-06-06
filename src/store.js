import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── UI Store ────────────────────────────────────────────────────────────────
// Central state for layout and studio mode. Persisted to localStorage.

export const useUIStore = create(
  persist(
    (set) => ({
      // Studio panel widths (px)
      studioRailWidth: 220,
      setStudioRailWidth: (w) => set({ studioRailWidth: w }),
    }),
    { name: 'dndj-ui' }
  )
);

// ─── Audio Store ─────────────────────────────────────────────────────────────
// Runtime-only audio state (not persisted — engine is the source of truth).

export const useAudioStore = create((set) => ({
  playingUrls: new Set(),
  pausedUrls: new Set(),

  addPlaying: (url) => set((s) => {
    if (s.playingUrls.has(url)) return s;
    const next = new Set(s.playingUrls);
    next.add(url);
    const paused = new Set(s.pausedUrls);
    paused.delete(url);
    return { playingUrls: next, pausedUrls: paused };
  }),

  removePlaying: (url) => set((s) => {
    if (!s.playingUrls.has(url)) return s;
    const next = new Set(s.playingUrls);
    next.delete(url);
    const paused = new Set(s.pausedUrls);
    paused.delete(url);
    return { playingUrls: next, pausedUrls: paused };
  }),

  addPaused: (url) => set((s) => {
    const paused = new Set(s.pausedUrls);
    paused.add(url);
    return { pausedUrls: paused };
  }),

  clearAll: () => set({ playingUrls: new Set(), pausedUrls: new Set() }),
}));
