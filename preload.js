'use strict';

// preload.js — Context Bridge
// Exposes a minimal, safe IPC surface to the renderer process.
// The renderer cannot access Node.js APIs directly; everything goes through
// this bridge. Keep the surface area small — only expose what the UI needs.

const { contextBridge, ipcRenderer } = require('electron');

// The API object that the renderer can access as window.dndj
contextBridge.exposeInMainWorld('dndj', {
  // Ask the main process to scan the /sounds folder and return categorised tracks.
  // Returns a Promise that resolves with the library object: { category: [tracks] }
  scanLibrary: () => ipcRenderer.invoke('scan-library'),

  // Ask the main process to resolve a file path to a safe app:// URL that
  // the renderer can pass to Howler.js for playback.
  // filePath: absolute path string returned by scanLibrary
  // Returns a Promise<string> with the playable URL.
  getAudioUrl: (filePath) => ipcRenderer.invoke('get-audio-url', filePath),
});
