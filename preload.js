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
  updateTrackDuration: (trackId, duration) => ipcRenderer.invoke('update-track-duration', trackId, duration),
  renameTrack: (trackId, newName) => ipcRenderer.invoke('rename-track', trackId, newName),

  // Settings (Persistent state like volumes, layout)
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Playlists
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  createPlaylist: (name, parentId, type, rulesJson) => ipcRenderer.invoke('create-playlist', name, parentId, type, rulesJson),
  updatePlaylist: (id, name, parentId, rulesJson, sortOrder) => ipcRenderer.invoke('update-playlist', id, name, parentId, rulesJson, sortOrder),
  deletePlaylist: (id) => ipcRenderer.invoke('delete-playlist', id),
  getPlaylistTracks: (playlistId) => ipcRenderer.invoke('get-playlist-tracks', playlistId),
  addTrackToPlaylist: (playlistId, trackId) => ipcRenderer.invoke('add-track-to-playlist', playlistId, trackId),
  removeTrackFromPlaylist: (playlistId, trackId) => ipcRenderer.invoke('remove-track-from-playlist', playlistId, trackId),
  reorderPlaylistTrack: (playlistId, trackId, sortOrder) => ipcRenderer.invoke('reorder-playlist-track', playlistId, trackId, sortOrder),

  // Studio scene snapshots
  saveSceneSnapshot: (name, snapshotJson) => ipcRenderer.invoke('save-scene-snapshot', name, snapshotJson),
  updateSceneSnapshot: (id, name, snapshotJson) => ipcRenderer.invoke('update-scene-snapshot', id, name, snapshotJson),
  deleteScene: (id) => ipcRenderer.invoke('delete-scene', id),

  // Cue Points
  getCuePoints: (trackId) => ipcRenderer.invoke('get-cue-points', trackId),
  addCuePoint: (trackId, position, label, color) => ipcRenderer.invoke('add-cue-point', trackId, position, label, color),
  updateCuePoint: (id, position, label, color) => ipcRenderer.invoke('update-cue-point', id, position, label, color),
  deleteCuePoint: (id) => ipcRenderer.invoke('delete-cue-point', id),
});
