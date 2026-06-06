import React, { useCallback, useRef } from 'react';
import { useUIStore } from '../../store.js';
import '../../styles/studio/StudioLayout.css';

function StudioLayout({ masterVolume, onMasterVolume, onStopAll }) {
  const { toggleUiMode, studioRailWidth, setStudioRailWidth } = useUIStore();
  const railResizing = useRef(false);
  const railStartX = useRef(0);
  const railStartW = useRef(0);

  const startRailResize = useCallback((e) => {
    e.preventDefault();
    railResizing.current = true;
    railStartX.current = e.clientX;
    railStartW.current = studioRailWidth;
    const onMove = (me) => {
      if (!railResizing.current) return;
      const delta = me.clientX - railStartX.current;
      setStudioRailWidth(Math.max(160, Math.min(360, railStartW.current + delta)));
    };
    const onUp = () => {
      railResizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [studioRailWidth, setStudioRailWidth]);

  return (
    <div className="studio">

      {/* ── Top Bar ── */}
      <header className="studio__topbar">
        <div className="studio__brand">
          DND<span>j</span>
          <span className="studio__brand-mode">STUDIO</span>
        </div>

        <div className="studio__topbar-center">
          {/* Global search placeholder — wired in Step 1.3 */}
          <div className="studio__search-placeholder">🔍 Search library…</div>
        </div>

        <div className="studio__topbar-right">
          <div className="studio__master-vol">
            <span className="studio__master-label">MASTER</span>
            <input
              type="range" min="0" max="1" step="0.01"
              value={masterVolume}
              onChange={(e) => onMasterVolume(parseFloat(e.target.value))}
              className="studio__master-slider"
            />
            <span className="studio__master-val">{Math.round(masterVolume * 100)}%</span>
          </div>
          <button className="studio__stop-btn" onClick={onStopAll}>■ STOP</button>
          <button className="studio__classic-btn" onClick={toggleUiMode} title="Back to Classic">CLASSIC ↩</button>
        </div>
      </header>

      {/* ── Body (rail + main) ── */}
      <div className="studio__body">

        {/* ── Left rail (playlist tree) ── */}
        <aside className="studio__rail" style={{ width: studioRailWidth }}>
          <div className="studio__rail-placeholder">
            <span className="studio__section-label">LIBRARY</span>
            <div className="studio__placeholder-block">Playlist tree — Phase 2</div>
          </div>
        </aside>
        <div className="studio__rail-resizer" onMouseDown={startRailResize} />

        {/* ── Center column ── */}
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

          {/* Tracklist */}
          <div className="studio__tracklist">
            <span className="studio__section-label">TRACKS</span>
            <div className="studio__placeholder-block studio__placeholder-block--tracklist">
              Tracklist — Phase 2
            </div>
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
    </div>
  );
}

export default StudioLayout;
