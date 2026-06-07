import React, { useState } from 'react';
import '../../styles/studio/IntegrityModal.css';

// Render the "where was this linked" lines for a missing track.
function TrackLinks({ links }) {
  const rows = [];
  if (links.playlists.length) rows.push(['Playlists', links.playlists.join(', ')]);
  if (links.folders.length)   rows.push(['Folders', links.folders.join(', ')]);
  if (links.scenes.length)    rows.push(['Scenes', links.scenes.join(', ')]);
  if (links.tags.length)      rows.push(['Tags', links.tags.join(', ')]);
  if (links.cuePoints > 0)    rows.push(['Cue points', String(links.cuePoints)]);
  if (rows.length === 0) return <div className="integ-links integ-links--none">Not referenced anywhere.</div>;
  return (
    <div className="integ-links">
      {rows.map(([label, value]) => (
        <div key={label} className="integ-link-row">
          <span className="integ-link-label">{label}:</span>
          <span className="integ-link-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * IntegrityModal
 * mode "launch"  — blocking: the library has missing files and must be cleaned
 *                  before the app can proceed. Actions: Clean up & continue / Quit.
 * mode "report"  — on-demand health check. Shows "all good" or the issues, with
 *                  optional Clean up, plus Close.
 *
 * Props: { mode, report, onCleanup, onClose, onQuit }
 *   report === null → still scanning (report mode only)
 */
export default function IntegrityModal({ mode, report, onCleanup, onClose, onQuit }) {
  const [busy, setBusy] = useState(false);
  const isLaunch = mode === 'launch';

  const handleCleanup = async () => {
    setBusy(true);
    try { await onCleanup(); }
    finally { setBusy(false); }
  };

  const loading = report === null;
  const hasIssues = report && !report.ok;
  const totalMissing = report
    ? report.missingTracks.length + report.missingCategories.reduce((n, c) => n + c.trackCount, 0)
    : 0;

  return (
    <div
      className="integ-overlay"
      onClick={e => { if (!isLaunch && e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`integ-dialog ${isLaunch ? 'integ-dialog--launch' : ''}`}>
        <div className="integ-dialog__header">
          <span className="integ-dialog__title">
            {isLaunch ? '⚠ Library Issues Found' : '🩺 Library Health Check'}
          </span>
          {!isLaunch && (
            <button className="integ-dialog__close" onClick={onClose} title="Close">×</button>
          )}
        </div>

        <div className="integ-dialog__body">
          {loading && <p className="integ-status">Scanning your library…</p>}

          {!loading && !hasIssues && (
            <div className="integ-allgood">
              <div className="integ-allgood__icon">✓</div>
              <p className="integ-allgood__text">Everything checks out — the database matches your files.</p>
            </div>
          )}

          {hasIssues && (
            <>
              <p className="integ-intro">
                {isLaunch
                  ? 'Some files referenced by your library are missing from disk. To keep everything consistent, these entries must be removed before continuing.'
                  : 'These library entries point to files that no longer exist on disk.'}
                {' '}Cleaning up removes them from <strong>all</strong> playlists, folders, scenes,
                tags and cue points.
              </p>

              {report.missingCategories.length > 0 && (
                <div className="integ-section">
                  <div className="integ-section__title">
                    Missing categories ({report.missingCategories.length})
                  </div>
                  {report.missingCategories.map(cat => (
                    <div key={cat.folder} className="integ-card integ-card--cat">
                      <div className="integ-card__head">
                        <span className="integ-card__icon">📁</span>
                        <span className="integ-card__name">{cat.displayName}</span>
                        <span className="integ-card__sub">{cat.folder}/ — folder not found</span>
                        <span className="integ-card__badge">{cat.trackCount} track{cat.trackCount !== 1 ? 's' : ''}</span>
                      </div>
                      {cat.tracks.length > 0 && (
                        <div className="integ-card__tracks">
                          {cat.tracks.map(t => <span key={t.id} className="integ-chip">{t.name}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {report.missingTracks.length > 0 && (
                <div className="integ-section">
                  <div className="integ-section__title">
                    Missing tracks ({report.missingTracks.length})
                  </div>
                  {report.missingTracks.map(t => (
                    <div key={t.id} className="integ-card">
                      <div className="integ-card__head">
                        <span className="integ-card__icon">♪</span>
                        <span className="integ-card__name">{t.name}</span>
                        <span className="integ-card__sub">{t.path}</span>
                      </div>
                      <TrackLinks links={t.links} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="integ-dialog__footer">
          {isLaunch ? (
            <>
              <button className="integ-btn integ-btn--ghost" onClick={onQuit} disabled={busy}>
                Quit app
              </button>
              <button className="integ-btn integ-btn--primary" onClick={handleCleanup} disabled={busy}>
                {busy ? 'Cleaning up…' : `Clean up ${totalMissing} item${totalMissing !== 1 ? 's' : ''} & continue`}
              </button>
            </>
          ) : (
            <>
              {hasIssues && (
                <button className="integ-btn integ-btn--primary" onClick={handleCleanup} disabled={busy}>
                  {busy ? 'Cleaning up…' : `Clean up ${totalMissing} item${totalMissing !== 1 ? 's' : ''}`}
                </button>
              )}
              <button className="integ-btn integ-btn--ghost" onClick={onClose} disabled={busy}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
