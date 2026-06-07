import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/studio/LibrarySettingsModal.css';

const PRESET_COLORS = [
  '#10b981', '#34d399', '#6ee7b7',
  '#f59e0b', '#fbbf24', '#fcd34d',
  '#818cf8', '#a78bfa', '#c4b5fd',
  '#ef4444', '#f87171', '#fca5a5',
  '#22d3ee', '#67e8f9', '#a5f3fc',
  '#fb923c', '#fdba74', '#fed7aa',
  '#6b7280', '#9ca3af', '#d1d5db',
  '#ec4899', '#f472b6', '#f9a8d4',
];

function ColorPicker({ value, onChange }) {
  return (
    <div className="ls-color-grid">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          className={`ls-color-swatch ${value === c ? 'ls-color-swatch--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ allTracks, onRefresh, onCategoryMetaChange }) {
  const [meta, setMeta] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [editId, setEditId] = useState(null); // folder_name being edited
  const [editDisplay, setEditDisplay] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');

  // Delete-category flow
  const [deletingFolder, setDeletingFolder] = useState(null);
  const [delMode, setDelMode] = useState('move');                          // 'move' | 'delete'
  const [delTarget, setDelTarget] = useState({ mode: 'existing', value: '' }); // { mode:'existing'|'new', value, color?, display? }
  const [delBusy, setDelBusy] = useState(false);

  // Derive existing folder names from tracks
  const folderNames = [...new Set((allTracks || []).map(t => t.category).filter(Boolean))].sort();

  const load = useCallback(async () => {
    const rows = await window.dndj.getCategoryMeta();
    setMeta(rows || []);
    onCategoryMetaChange?.(rows || []);
  }, [onCategoryMetaChange]);

  useEffect(() => { load(); }, [load]);

  const metaMap = Object.fromEntries(meta.map(m => [m.folder_name, m]));

  // All categories = union of folders in DB tracks + categories with metadata
  const allFolders = [...new Set([...folderNames, ...meta.map(m => m.folder_name)])].sort();

  const startEdit = (folder) => {
    const m = metaMap[folder];
    setEditId(folder);
    setEditDisplay(m?.display_name || folder);
    setEditColor(m?.color || '#6b7280');
  };

  const commitEdit = async () => {
    await window.dndj.upsertCategoryMeta(editId, editDisplay || editId, editColor);
    setEditId(null);
    await load();
  };

  const handleCreate = async () => {
    if (!newFolder.trim()) return;
    const slug = newFolder.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!slug) return;
    await window.dndj.createCategory(slug, newDisplay || slug, newColor);
    setCreating(false);
    setNewFolder(''); setNewDisplay(''); setNewColor('#6b7280');
    await load();
    await onRefresh();
  };

  const startDelete = (folder) => {
    setEditId(null);
    setDeletingFolder(folder);
    const others = allFolders.filter(f => f !== folder);
    if (others.length) { setDelMode('move'); setDelTarget({ mode: 'existing', value: others[0] }); }
    else { setDelMode('delete'); setDelTarget({ mode: 'new', value: '', color: '#6b7280', display: '' }); }
  };

  const confirmDelete = async () => {
    const folder = deletingFolder;
    const trackCount = (allTracks || []).filter(t => t.category === folder).length;
    setDelBusy(true);
    try {
      const opts = (trackCount > 0 && delMode === 'move') ? { action: 'move', target: delTarget } : { action: 'delete' };
      await window.dndj.deleteCategory(folder, opts);
      setDeletingFolder(null);
      await load();
      await onRefresh();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="ls-tab-content">
      <div className="ls-section-head">
        <span className="ls-section-title">Categories</span>
        <button className="ls-add-btn" onClick={() => setCreating(c => !c)}>+ New</button>
      </div>

      {creating && (
        <div className="ls-create-card">
          <div className="ls-create-row">
            <input
              className="ls-input" placeholder="Folder name (e.g. ambience)"
              value={newFolder} onChange={e => setNewFolder(e.target.value)}
              autoFocus
            />
            <input
              className="ls-input" placeholder="Display name (optional)"
              value={newDisplay} onChange={e => setNewDisplay(e.target.value)}
            />
          </div>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="ls-create-actions">
            <button className="ls-btn ls-btn--primary" onClick={handleCreate}>Create</button>
            <button className="ls-btn ls-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ls-list">
        {allFolders.length === 0 && <p className="ls-empty">No categories yet.</p>}
        {allFolders.map(folder => {
          const m = metaMap[folder];
          const color = m?.color || '#6b7280';
          const display = m?.display_name || folder;
          const trackCount = (allTracks || []).filter(t => t.category === folder).length;
          const isEditing = editId === folder;
          const isDeleting = deletingFolder === folder;
          const moveTargets = allFolders.filter(f => f !== folder);
          const newTargetInvalid = delMode === 'move' && delTarget.mode === 'new' && !delTarget.value.trim();

          return (
            <div key={folder} className="ls-row">
              <span className="ls-row__swatch" style={{ background: color }} />
              {isEditing ? (
                <div className="ls-row__edit">
                  <input
                    className="ls-input ls-input--sm"
                    value={editDisplay}
                    onChange={e => setEditDisplay(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="ls-row__edit-actions">
                    <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitEdit}>Save</button>
                    <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : isDeleting ? (
                <div className="ls-row__edit ls-catdel">
                  {trackCount === 0 ? (
                    <span className="ls-catdel__msg">Delete category “{display}”? The empty folder will be removed from disk.</span>
                  ) : (
                    <>
                      <span className="ls-catdel__msg">
                        “{display}” has <strong>{trackCount}</strong> track{trackCount !== 1 ? 's' : ''}. What should happen to them?
                      </span>
                      <label className="ls-catdel__opt">
                        <input type="radio" name={`del-${folder}`} checked={delMode === 'move'} onChange={() => setDelMode('move')} />
                        Move them to another category
                      </label>
                      {delMode === 'move' && (
                        <div className="ls-catdel__move">
                          <select
                            className="ls-input ls-input--sm"
                            value={delTarget.mode === 'new' ? '__new__' : delTarget.value}
                            onChange={e => {
                              if (e.target.value === '__new__') setDelTarget({ mode: 'new', value: '', color: '#6b7280', display: '' });
                              else setDelTarget({ mode: 'existing', value: e.target.value });
                            }}
                          >
                            {moveTargets.map(f => <option key={f} value={f}>{metaMap[f]?.display_name || f}</option>)}
                            <option value="__new__">+ New category…</option>
                          </select>
                          {delTarget.mode === 'new' && (
                            <div className="ls-catdel__new">
                              <input
                                className="ls-input ls-input--sm"
                                placeholder="New category name"
                                value={delTarget.value}
                                onChange={e => setDelTarget(t => ({ ...t, value: e.target.value, display: e.target.value }))}
                              />
                              <ColorPicker value={delTarget.color} onChange={c => setDelTarget(t => ({ ...t, color: c }))} />
                            </div>
                          )}
                        </div>
                      )}
                      <label className="ls-catdel__opt ls-catdel__opt--danger">
                        <input type="radio" name={`del-${folder}`} checked={delMode === 'delete'} onChange={() => setDelMode('delete')} />
                        ⚠ Delete the {trackCount} track{trackCount !== 1 ? 's' : ''} and their files
                      </label>
                    </>
                  )}
                  <div className="ls-row__edit-actions">
                    <button
                      className="ls-btn ls-btn--danger ls-btn--xs"
                      onClick={confirmDelete}
                      disabled={delBusy || newTargetInvalid}
                    >
                      {delBusy ? 'Working…'
                        : trackCount === 0 ? 'Delete category'
                        : delMode === 'move' ? 'Move & delete category'
                        : 'Delete category & files'}
                    </button>
                    <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setDeletingFolder(null)} disabled={delBusy}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="ls-row__info">
                    <span className="ls-row__name">{display}</span>
                    {display !== folder && <span className="ls-row__sub">{folder}/</span>}
                    <span className="ls-row__count">{trackCount} track{trackCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="ls-row__actions">
                    <button className="ls-icon-btn" onClick={() => startEdit(folder)} title="Edit">✎</button>
                    <button className="ls-icon-btn ls-icon-btn--danger" onClick={() => startDelete(folder)} title="Delete category">🗑</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tags Tab ─────────────────────────────────────────────────────────────────

function TagsTab({ tags, onTagsChange }) {
  const [localTags, setLocalTags] = useState(tags || []);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#10b981');

  useEffect(() => { setLocalTags(tags || []); }, [tags]);

  const refresh = async () => {
    const updated = await window.dndj.getTags();
    setLocalTags(updated || []);
    onTagsChange?.(updated || []);
  };

  const startEdit = (tag) => {
    setEditId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#6b7280');
  };

  const commitEdit = async () => {
    await window.dndj.updateTag(editId, editName, editColor);
    setEditId(null);
    await refresh();
  };

  const handleDelete = async (id) => {
    await window.dndj.deleteTag(id);
    await refresh();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await window.dndj.createTag(newName.trim(), newColor);
    setCreating(false);
    setNewName(''); setNewColor('#10b981');
    await refresh();
  };

  return (
    <div className="ls-tab-content">
      <div className="ls-section-head">
        <span className="ls-section-title">Tags</span>
        <button className="ls-add-btn" onClick={() => setCreating(c => !c)}>+ New</button>
      </div>

      {creating && (
        <div className="ls-create-card">
          <input
            className="ls-input" placeholder="Tag name"
            value={newName} onChange={e => setNewName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="ls-create-actions">
            <button className="ls-btn ls-btn--primary" onClick={handleCreate}>Create</button>
            <button className="ls-btn ls-btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="ls-list">
        {localTags.length === 0 && <p className="ls-empty">No tags yet. Add tags to tracks to get started.</p>}
        {localTags.map(tag => {
          const isEditing = editId === tag.id;
          return (
            <div key={tag.id} className="ls-row">
              <span className="ls-row__swatch" style={{ background: tag.color || '#6b7280' }} />
              {isEditing ? (
                <div className="ls-row__edit">
                  <input
                    className="ls-input ls-input--sm"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null); }}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="ls-row__edit-actions">
                    <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitEdit}>Save</button>
                    <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="ls-row__name">{tag.name}</span>
                  <div className="ls-row__actions">
                    <button className="ls-icon-btn" onClick={() => startEdit(tag)} title="Edit">✎</button>
                    <button className="ls-icon-btn ls-icon-btn--danger" onClick={() => handleDelete(tag.id)} title="Delete tag">×</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shortcuts Tab ────────────────────────────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    title: 'Decks',
    rows: [
      { keys: ['Space'],        desc: 'Play / Pause — active deck' },
      { keys: ['⇧', 'Space'],  desc: 'Play / Pause — other deck' },
      { keys: ['A'],            desc: 'Play / Pause — Deck A' },
      { keys: ['B'],            desc: 'Play / Pause — Deck B' },
      { keys: ['S'],            desc: 'Stop — active deck' },
      { keys: ['⇧', 'S'],      desc: 'Stop ALL sounds' },
    ],
  },
  {
    title: 'Seek',
    rows: [
      { keys: ['←'],           desc: 'Seek −5 s' },
      { keys: ['→'],           desc: 'Seek +5 s' },
      { keys: ['⇧', '←'],     desc: 'Seek −30 s' },
      { keys: ['⇧', '→'],     desc: 'Seek +30 s' },
    ],
  },
  {
    title: 'Loop',
    rows: [
      { keys: ['L'],           desc: 'Toggle loop on active deck' },
    ],
  },
  {
    title: 'Crossfader',
    rows: [
      { keys: ['['],           desc: 'Nudge crossfader toward A' },
      { keys: [']'],           desc: 'Nudge crossfader toward B' },
      { keys: ['\\'],          desc: 'Center crossfader' },
      { keys: ['↔ swipe'],    desc: 'Two-finger horizontal swipe on crossfader' },
    ],
  },
  {
    title: 'SFX Pads',
    rows: [
      { keys: ['1–8'],         desc: 'Trigger sampler pad' },
    ],
  },
  {
    title: 'Waveform',
    rows: [
      { keys: ['pinch'],       desc: 'Pinch-to-zoom (trackpad)' },
      { keys: ['↔ swipe'],    desc: 'Two-finger swipe to pan when zoomed' },
      { keys: ['scroll ↕'],   desc: 'Mouse wheel to zoom in/out' },
      { keys: ['drag'],        desc: 'Click & drag to pan when zoomed' },
      { keys: ['click'],       desc: 'Click to seek' },
    ],
  },
];

function ShortcutsTab() {
  return (
    <div className="ls-tab-content ls-shortcuts">
      {SHORTCUT_GROUPS.map(group => (
        <div key={group.title} className="ls-sc-group">
          <div className="ls-sc-group__title">{group.title}</div>
          <div className="ls-sc-rows">
            {group.rows.map((row, i) => (
              <div key={i} className="ls-sc-row">
                <div className="ls-sc-keys">
                  {row.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      {ki > 0 && <span className="ls-sc-plus">+</span>}
                      <kbd className="ls-kbd">{k}</kbd>
                    </React.Fragment>
                  ))}
                </div>
                <span className="ls-sc-desc">{row.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Sync Tab ─────────────────────────────────────────────────────────────────

const CONN_COLORS = [
  '#818cf8', '#10b981', '#f59e0b', '#ef4444',
  '#22d3ee', '#fb923c', '#ec4899', '#6b7280',
];

function ColorDots({ value, onChange }) {
  return (
    <div className="sync-color-dots">
      {CONN_COLORS.map(c => (
        <button
          key={c}
          className={`sync-color-dot ${value === c ? 'sync-color-dot--active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

function SyncTab() {
  const [serverRunning, setServerRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [ddDomain, setDdDomain] = useState('');
  const [ddApiToken, setDdApiToken] = useState('');
  const [ddSaved, setDdSaved] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [pullState, setPullState] = useState({ phase: 'idle' });
  const [copied, setCopied] = useState(false);

  // Saved connections
  const [connections, setConnections] = useState([]);
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CONN_COLORS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(CONN_COLORS[0]);

  async function persistConnections(list) {
    setConnections(list);
    await window.dndj.setSetting('sync_saved_connections', list);
  }

  useEffect(() => {
    async function load() {
      const status = await window.dndj.syncServerStatus();
      setServerRunning(status.running);
      if (status.running) setServerInfo(status.info);

      const savedDomain = await window.dndj.getSetting('sync_duckdns_domain');
      const savedDdToken = await window.dndj.getSetting('sync_duckdns_token');
      if (savedDomain) setDdDomain(savedDomain);
      if (savedDdToken) setDdApiToken(savedDdToken);

      const savedUrl = await window.dndj.getSetting('sync_client_url');
      const savedCToken = await window.dndj.getSetting('sync_client_token');
      if (savedUrl) {
        setServerUrl(savedUrl);
      } else if (status.running && status.info) {
        setServerUrl(`http://${status.info.localIp}:${status.info.port}`);
      }
      if (savedCToken) setClientToken(savedCToken);

      const savedConns = await window.dndj.getSetting('sync_saved_connections');
      if (Array.isArray(savedConns)) setConnections(savedConns);
    }
    load();
    window.dndj.onSyncProgress(data => setPullState(data));
    return () => window.dndj.offSyncProgress();
  }, []);

  async function toggleServer() {
    if (serverRunning) {
      await window.dndj.syncStopServer();
      setServerRunning(false);
      setServerInfo(null);
    } else {
      const info = await window.dndj.syncStartServer();
      setServerRunning(true);
      setServerInfo(info);
      setServerUrl(prev => prev || `http://${info.localIp}:${info.port}`);
    }
  }

  async function saveDuckDns() {
    const result = await window.dndj.syncUpdateDuckDns({ domain: ddDomain, token: ddApiToken });
    setDdSaved(result.ok);
    setTimeout(() => setDdSaved(false), 2500);
  }

  async function startPull() {
    await window.dndj.setSetting('sync_client_url', serverUrl);
    await window.dndj.setSetting('sync_client_token', clientToken);
    setPullState({ phase: 'starting', text: 'Starting...' });
    await window.dndj.syncPull({ serverUrl, token: clientToken });
  }

  function copyToken() {
    if (!serverInfo?.token) return;
    navigator.clipboard.writeText(serverInfo.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ── Saved connections ──
  async function commitSaveNew() {
    if (!newName.trim()) return;
    const conn = {
      id: Date.now().toString(36),
      name: newName.trim(),
      url: serverUrl,
      token: clientToken,
      color: newColor,
    };
    await persistConnections([...connections, conn]);
    setSavingNew(false);
    setNewName('');
    setNewColor(CONN_COLORS[0]);
  }

  function selectConnection(conn) {
    setServerUrl(conn.url);
    setClientToken(conn.token);
  }

  function startEdit(conn) {
    setEditingId(conn.id);
    setEditName(conn.name);
    setEditColor(conn.color);
  }

  async function commitEdit() {
    await persistConnections(connections.map(c =>
      c.id === editingId ? { ...c, name: editName.trim() || c.name, color: editColor } : c
    ));
    setEditingId(null);
  }

  async function deleteConnection(id) {
    await persistConnections(connections.filter(c => c.id !== id));
    if (editingId === id) setEditingId(null);
  }

  const isPulling = !['idle', 'done', 'error'].includes(pullState.phase);
  const isDone = pullState.phase === 'done';
  const isError = pullState.phase === 'error';
  const pullPct = (pullState.phase === 'files' && pullState.total > 0)
    ? Math.round((pullState.done / pullState.total) * 100) : null;
  const canSaveNew = serverUrl.trim() && clientToken.trim();

  return (
    <div className="ls-tab-content ls-sync">
      {/* ── Server section ── */}
      <div className="ls-section-head">
        <span className="ls-section-title">Server Mode</span>
        <button
          className={`ls-btn ls-btn--sm ${serverRunning ? 'ls-btn--danger' : 'ls-btn--primary'}`}
          onClick={toggleServer}
        >
          {serverRunning ? 'Stop Server' : 'Start Server'}
        </button>
      </div>

      {!serverRunning && (
        <p className="ls-sync-hint">
          Start the server on this machine so another device running DNDj can pull your library from it.
        </p>
      )}

      {serverRunning && serverInfo && (
        <div className="ls-sync-server-info">
          <div className="ls-sync-dot" />
          <div className="ls-sync-info-rows">
            <div className="ls-sync-info-row">
              <span className="ls-sync-label">Local</span>
              <code className="ls-sync-value">http://{serverInfo.localIp}:{serverInfo.port}</code>
            </div>
            <div className="ls-sync-info-row">
              <span className="ls-sync-label">Token</span>
              <code className="ls-sync-value">{serverInfo.token}</code>
              <button className="ls-icon-btn" onClick={copyToken} title="Copy token">
                {copied ? '✓' : '⎘'}
              </button>
            </div>
          </div>
        </div>
      )}

      {serverRunning && (
        <>
          <div className="ls-section-head" style={{ marginTop: '16px' }}>
            <span className="ls-section-title">DuckDNS — WAN Access</span>
          </div>
          <p className="ls-sync-hint">
            Keeps <strong>{ddDomain || 'your-domain'}.duckdns.org</strong> pointed at this machine's public IP every 30 min so your Mac can reach it from anywhere.
          </p>
          <div className="ls-sync-duckdns">
            <input className="ls-input" placeholder="Domain name (e.g. akpchome)" value={ddDomain} onChange={e => setDdDomain(e.target.value)} />
            <input className="ls-input" placeholder="DuckDNS API token (from duckdns.org)" value={ddApiToken} onChange={e => setDdApiToken(e.target.value)} />
            <button className={`ls-btn ${ddSaved ? 'ls-btn--success' : 'ls-btn--primary'}`} onClick={saveDuckDns} disabled={!ddDomain.trim() || !ddApiToken.trim()}>
              {ddSaved ? 'Updated ✓' : 'Save & Update Now'}
            </button>
          </div>
        </>
      )}

      <div className="ls-divider-line" />

      {/* ── Client section ── */}
      <div className="ls-section-head">
        <span className="ls-section-title">Pull from Server</span>
      </div>

      {/* Saved connection chips */}
      {connections.length > 0 && (
        <div className="sync-chips">
          {connections.map(conn =>
            editingId === conn.id ? (
              <div key={conn.id} className="sync-chip-edit">
                <input
                  className="sync-chip-edit__input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
                <ColorDots value={editColor} onChange={setEditColor} />
                <div className="sync-chip-edit__actions">
                  <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitEdit}>Save</button>
                  <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={conn.id} className="sync-chip" style={{ '--chip-color': conn.color }}>
                <button className="sync-chip__name" onClick={() => selectConnection(conn)} title={`${conn.url}`}>
                  {conn.name}
                </button>
                <button className="sync-chip__action" onClick={() => startEdit(conn)} title="Edit">✎</button>
                <button className="sync-chip__action sync-chip__action--del" onClick={() => deleteConnection(conn.id)} title="Delete">×</button>
              </div>
            )
          )}
        </div>
      )}

      {/* Save new connection form */}
      {savingNew ? (
        <div className="sync-save-form">
          <input
            className="ls-input"
            placeholder="Connection name (e.g. Home PC)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSaveNew(); if (e.key === 'Escape') setSavingNew(false); }}
            autoFocus
          />
          <ColorDots value={newColor} onChange={setNewColor} />
          <div className="sync-save-form__actions">
            <button className="ls-btn ls-btn--primary ls-btn--xs" onClick={commitSaveNew} disabled={!newName.trim()}>Save</button>
            <button className="ls-btn ls-btn--ghost ls-btn--xs" onClick={() => setSavingNew(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        canSaveNew && (
          <button className="sync-save-btn" onClick={() => { setSavingNew(true); setNewName(''); }}>
            + Save as connection
          </button>
        )
      )}

      {/* Connection inputs */}
      <div className="ls-sync-client">
        <input
          className="ls-input"
          placeholder="http://192.168.1.103:7432"
          value={serverUrl}
          onChange={e => setServerUrl(e.target.value)}
          disabled={isPulling}
        />
        <input
          className="ls-input"
          placeholder="Auth token (shown on the server machine)"
          value={clientToken}
          onChange={e => setClientToken(e.target.value)}
          disabled={isPulling}
        />
        <button
          className="ls-btn ls-btn--primary"
          onClick={startPull}
          disabled={isPulling || !serverUrl.trim() || !clientToken.trim()}
        >
          {isPulling ? 'Syncing…' : 'Pull from Server'}
        </button>
      </div>

      {pullState.phase !== 'idle' && (
        <div className={`ls-sync-progress ${isError ? 'ls-sync-progress--error' : ''} ${isDone ? 'ls-sync-progress--done' : ''}`}>
          {pullPct !== null && (
            <div className="ls-sync-bar">
              <div className="ls-sync-bar-fill" style={{ width: `${pullPct}%` }} />
            </div>
          )}
          <span className="ls-sync-progress-text">
            {pullState.text || pullState.phase}
            {pullPct !== null && ` — ${pullState.done}/${pullState.total}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export default function LibrarySettingsModal({ allTracks, tags, onClose, onRefresh, onTagsChange, onCategoryMetaChange }) {
  const [tab, setTab] = useState('categories');

  return (
    <div className="ls-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ls-dialog">
        <div className="ls-dialog__header">
          <span className="ls-dialog__title">Library Settings</span>
          <button className="ls-dialog__close" onClick={onClose}>×</button>
        </div>
        <div className="ls-tabs">
          <button className={`ls-tab ${tab === 'categories' ? 'ls-tab--active' : ''}`} onClick={() => setTab('categories')}>Categories</button>
          <button className={`ls-tab ${tab === 'tags' ? 'ls-tab--active' : ''}`} onClick={() => setTab('tags')}>Tags</button>
          <button className={`ls-tab ${tab === 'shortcuts' ? 'ls-tab--active' : ''}`} onClick={() => setTab('shortcuts')}>Shortcuts</button>
          <button className={`ls-tab ${tab === 'sync' ? 'ls-tab--active' : ''}`} onClick={() => setTab('sync')}>Sync</button>
        </div>
        <div className="ls-dialog__body">
          {tab === 'categories' && <CategoriesTab allTracks={allTracks} onRefresh={onRefresh} onCategoryMetaChange={onCategoryMetaChange} />}
          {tab === 'tags' && <TagsTab tags={tags} onTagsChange={onTagsChange} />}
          {tab === 'shortcuts' && <ShortcutsTab />}
          {tab === 'sync' && <SyncTab />}
        </div>
      </div>
    </div>
  );
}
