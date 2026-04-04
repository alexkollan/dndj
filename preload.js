const { contextBridge, ipcRenderer } = require('electron');

/**
 * contextBridge.exposeInMainWorld
 * Securely exposes a limited set of Electron/IPC methods to the renderer process.
 * All file-system and DB logic remains in the Main process.
 */
contextBridge.exposeInMainWorld('dndj', {
  // Sound Library & Audio
  scanLibrary: () => ipcRenderer.invoke('scan-library'),
  getAudioUrl: (filePath) => ipcRenderer.invoke('get-audio-url', filePath),

  // Tagging
  getTags: () => ipcRenderer.invoke('get-tags'),
  addTagToTrack: (trackId, tagName) => ipcRenderer.invoke('add-tag-to-track', trackId, tagName),
  removeTagFromTrack: (trackId, tagId) => ipcRenderer.invoke('remove-tag-from-track', trackId, tagId),

  // Scenes
  createEmptyScene: (name, description) => ipcRenderer.invoke('create-empty-scene', name, description),
  addTrackToScene: (sceneId, trackId, volume, isLoop) => ipcRenderer.invoke('add-track-to-scene', sceneId, trackId, volume, isLoop),
  removeTrackFromScene: (sceneId, trackId) => ipcRenderer.invoke('remove-track-from-scene', sceneId, trackId),
  updateSceneTrackSettings: (sceneId, trackId, volume, isLoop, startTime, endTime) => ipcRenderer.invoke('update-scene-track-settings', sceneId, trackId, volume, isLoop, startTime, endTime),
  saveScene: (name, description, tracks) => ipcRenderer.invoke('save-scene', name, description, tracks),
  getScenes: () => ipcRenderer.invoke('get-scenes'),
  getSceneTracks: (sceneId) => ipcRenderer.invoke('get-scene-tracks', sceneId),
  updateTrackPeaks: (trackId, peaks) => ipcRenderer.invoke('update-track-peaks', trackId, peaks),
  renameTrack: (trackId, newName) => ipcRenderer.invoke('rename-track', trackId, newName),

  // Settings (Persistent state like volumes, layout)
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
});
