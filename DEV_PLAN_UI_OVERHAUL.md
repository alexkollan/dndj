# DNDj — UI Overhaul Dev Plan ("Djay Pro for Dungeon Masters")

> Living document. Created 2026-06-06. Owner: Alex. Driver: Claude.

---

## 0. How We Work On This (READ FIRST — these are hard rules)

These rules are non-negotiable for the entire overhaul:

1. **One step at a time.** Each step below is self-contained and ends in a working, testable app. I will implement exactly one step, then **STOP**.
2. **🛑 Hard stop gate after every step.** I will **never** start the next step (or next phase) until you explicitly say "go" / "next" / "continue". No exceptions, even if the next step seems obvious.
3. **Every step ships testable.** After each step the app must `npm run dev` and run. Every step lists a **✅ What to test** block with concrete click-by-click checks plus regression checks.
4. **Nothing that works today may break.** The three things we just fixed are sacred and are re-tested at every single step:
   - **Streaming** — large/long tracks start playing immediately, no freeze, no full-RAM load.
   - **No double sounds** — a single trigger plays exactly one voice; no phantom restart/echo.
   - **Waveform seeking** — clicking the waveform jumps to that position without restarting.
5. **Additive, not destructive.** The old UI stays fully functional and reachable behind a toggle until the new UI reaches parity (Phase 6 retires it). DB changes are additive migrations only — existing `data/dndj.sqlite` must keep working.
6. **Purpose is preserved.** This is still a tabletop-RPG audio tool for live storytelling: ambience layers, scene transitions, and rapid-fire SFX. We are changing *how it looks and how flexible it feels*, not what it's for.

If at any point a step turns out bigger than expected, I'll split it and ask before proceeding.

---

## 1. The Vision

Today the app is organized around **categories** (folders) with three separate, disconnected screens (Atmosphere grid, SFX grid, Scene editor). It's rigid: hard to build collections, hard to organize, and there are zero "DJ" capabilities despite the name.

The target is the **Djay Pro mental model**, adapted for a DM:

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR:  brand · global search · layout toggle · master vol · STOP   │
├───────────────┬──────────────────────────────────────────────────────┤
│               │   DECK A                    DECK B                     │
│  PLAYLIST     │   ┌──────────────┐          ┌──────────────┐           │
│  TREE         │   │ scrolling wf │          │ scrolling wf │           │
│  (left rail)  │   │ ▶ ⏸ cue loop │          │ ▶ ⏸ cue loop │           │
│               │   └──────────────┘          └──────────────┘           │
│  • My Library │   vol│EQ│filter             vol│EQ│filter              │
│  • Smart:Combat        ╲           CROSSFADER          ╱               │
│  • Smart:Tavern         ┝━━━━━━━━━━━━━━●━━━━━━━━━━━━━━┥                │
│  • Folder: Camp │                                                       │
│    - Night                                                             │
│    - Campfire   ├──────────────────────────────────────────────────────┤
│               │   TRACKLIST (center): sortable, drag a row → a deck     │
│               │   [▶] Name           Tags        Dur    Cat   ⋮         │
│               ├──────────────────────────────────────────────────────┤
│               │   SAMPLER PADS (SFX): rapid-fire one-shots, overlapping │
│               │   [sword] [thunder] [door] [coins] [scream] [horn] ...  │
└───────────────┴──────────────────────────────────────────────────────┘
```

### DJ → DM feature mapping (the key design decision)

Djay Pro is built to beatmatch two songs. A DM narrates. So we adopt Djay's **layout, library browser, and mixing model** — and deliberately drop tempo-sync / beatmatching / pitch-bend, which are meaningless for ambience and narration. The adaptation:

| Djay Pro concept        | DNDj adaptation                                                                 |
|-------------------------|---------------------------------------------------------------------------------|
| 2–4 turntable decks     | 2 **ambience/music decks** you run simultaneously and crossfade between moods    |
| Crossfader              | **Scene-mood crossfade** (e.g. calm Deck A → combat Deck B) — the DM's best friend |
| Channel mixer + EQ      | Per-deck volume + **low-pass "muffle" filter** (sound from another room / underwater) |
| Sampler pads            | The **SFX soundboard** — rapid-fire, *intentionally overlapping* one-shots       |
| Playlist tree + crates  | **Flexible library**: folders, smart playlists (auto by tag/category), drag-drop |
| Cue points / loops      | **Loop regions** (we already crop) + named cue markers for long tracks          |
| Saved sets              | **Scenes** become saved snapshots of deck+mixer+sampler state you can recall     |
| Beatmatch / BPM sync    | ❌ Dropped — not applicable to narration                                          |

> **Assumption made (correct me if wrong):** 2 decks, not 4. Two ambience layers + a sampler covers virtually every DM moment (a bed + a transition + spot SFX). 4 decks add clutter for little narrative gain. We can add decks 3–4 later as a layout toggle if you want.

---

## 2. Technical Foundations & Constraints

**What we keep and build on:**
- `src/audioEngine.js` — the streaming engine (HTMLAudioElement + Web Audio graph). All UI talks to it through its public API. Streaming + no-double-play + seeking live here and must be preserved.
- `main.js` `app://` protocol with HTTP range support (powers streaming + seek).
- `better-sqlite3` DB in `data/dndj.sqlite`, accessed via `src/db/db_manager.js` and exposed through `preload.js` (`window.dndj`).
- Modular CSS + glassmorphism tokens (Emerald `#10b981` / Amber `#f59e0b` / Rose `#ef4444` / Slate).

**New foundations this overhaul introduces:**
- **A real design-token layer** (CSS variables: spacing, radius, color, elevation, typography) so the whole UI is consistent and themeable.
- **Drag-and-drop** for the library (track → deck, track → playlist, reorder). Proposed lib: `@dnd-kit/core` (lightweight, accessible, React-first). *To be confirmed at Phase 2, Step 1 — no dependency is added without your OK.*
- **A central UI state store** for layout/decks/selection. Proposed: lightweight `zustand` (tiny) **or** plain React context. *Decision made at Phase 1, Step 1.*
- **Audio engine "voices" model** (Phase 3): today players are keyed by URL (one instance per file). Decks need a track addressable by *deck*, and the sampler needs *multiple overlapping* instances of the same SFX. This requires an additive engine capability layer that does **not** change existing URL-keyed behavior used by the old UI.

**Engine invariants to protect (every engine change re-tests these):**
- Deck voices: pause-before-play + debounce → exactly one voice per deck. No phantom restart.
- Sampler voices: overlapping is *allowed* and desired, but each pad press = exactly one new voice (no accidental double-trigger from one click).
- All playback remains streamed (no `decodeAudioData` of whole files for playback).

---

## 3. Branch & Safety Strategy

- Work happens on a feature branch: `feat/ui-overhaul` (created in Phase 0). `main` stays shippable.
- A **layout toggle** (Phase 1) lets you flip between **Classic UI** (everything that works today) and **Studio UI** (the new Djay-style shell) at runtime. This is how every step stays testable without losing the old app.
- DB migrations are additive and idempotent (same pattern already in `db_manager.js`). We back up `data/dndj.sqlite` before the first migration.

---

# PHASES

Each phase = a coherent capability. Each step = one testable increment ending in a 🛑 stop gate.

---

## PHASE 0 — Foundation & Safety Net
*Goal: set up the workspace so the overhaul is safe and reversible. No visible UI change yet.*

### Step 0.1 — Branch, backup, and this plan
- Create branch `feat/ui-overhaul`.
- Back up `data/dndj.sqlite` → `data/dndj.backup-<date>.sqlite`.
- Commit this plan file.
- **✅ What to test:** `npm run dev` still launches the current app exactly as before. `git branch` shows you're on `feat/ui-overhaul`. Backup file exists.
- 🛑 **STOP. Wait for "go".**

### Step 0.2 — Design-token layer (invisible groundwork)
- Add `src/styles/tokens.css` with CSS variables for color, spacing, radius, typography, elevation/shadows, transitions — derived from the existing glassmorphism palette so nothing changes visually yet.
- Wire it into `global.css`. Do **not** restyle any component yet.
- **✅ What to test:** App looks **identical** to before (this is the point — tokens are defined but not yet consumed). No console errors. Streaming/seek/no-double-play regression check on one atmosphere track + one SFX.
- 🛑 **STOP. Wait for "go".**

### Step 0.3 — Additive DB migrations for new concepts
- Add tables (idempotent, alongside existing ones; nothing dropped):
  - `playlists (id, name, parent_id, type['manual'|'smart'], rules_json, sort_order, created_at)`
  - `playlist_tracks (playlist_id, track_id, sort_order)`
  - `cue_points (id, track_id, position, label, color)` — for Phase 6
  - Extend `settings` usage for layout/deck persistence (no schema change needed; it's key/value).
- Add the matching prepared statements + `preload.js` bridge methods, but **no UI consumes them yet**.
- **✅ What to test:** App launches; existing tracks, tags, and scenes all still load. Inspect `data/dndj.sqlite` (or add a temporary log) to confirm new tables exist and old data is intact. Full regression check.
- 🛑 **STOP. Wait for "go".**

---

## PHASE 1 — App Shell & Layout Skeleton
*Goal: stand up the new Djay-style frame as empty, switchable panels. Old UI untouched and still default.*

### Step 1.1 — Layout toggle + UI state store
- Decide state approach (zustand vs context) and add it.
- Add a **Classic ⇄ Studio** toggle in the top bar. Default = Classic. Studio renders a placeholder "coming soon" frame.
- **✅ What to test:** Toggle flips between the full working Classic app and an empty Studio placeholder, with no errors. Refresh remembers the choice. Classic still 100% works (play, scenes, SFX, seek).
- 🛑 **STOP. Wait for "go".**

### Step 1.2 — Static Studio frame (regions only, no behavior)
- Build the responsive grid: top bar, left playlist rail, center (decks zone + tracklist), bottom sampler strip — all as empty styled placeholders using tokens.
- Resizable panels (reuse the existing resizer pattern from `App.jsx`).
- **✅ What to test:** In Studio mode you see the full Djay-like skeleton; panels resize and persist widths; layout holds at min/max window sizes. Classic still works.
- 🛑 **STOP. Wait for "go".**

### Step 1.3 — Top bar essentials (master vol, STOP ALL, global search field)
- Wire the top bar's master volume + STOP ALL to the **existing** engine functions (`setMasterVolume`, `stopAll`). Search field is visual only for now.
- **✅ What to test:** In Studio mode, master volume and STOP ALL actually affect audio (play something in Classic, switch to Studio, confirm STOP ALL kills it). Spacebar STOP still works.
- 🛑 **STOP. Wait for "go".**

---

## PHASE 2 — Library Browser (the "intuitive, flexible library" win)
*Goal: a real Djay-style browser — playlist tree + tracklist + search + smart playlists + drag. This is the biggest usability payoff and is fully usable before decks exist.*

### Step 2.1 — Tracklist view (center)
- Render all tracks in a sortable, dense table: play button, name, tags, duration, category, overflow menu. Reads from existing `getAllTracks`.
- Inline play/pause/stop per row via existing engine (URL-keyed, exactly like today) so it's immediately useful.
- **✅ What to test:** All tracks appear; sorting by each column works; clicking ▶ streams instantly (large track = no freeze); clicking again doesn't double-play; stop works.
- 🛑 **STOP. Wait for "go".**

### Step 2.2 — Search & filter
- Live search box (name) + tag filter chips + category filter, all combinable. Reuse the filtering logic concept from `App.jsx`.
- **✅ What to test:** Typing filters instantly; tag chips narrow results; clearing restores all. Playing a filtered result still streams correctly.
- 🛑 **STOP. Wait for "go".**

### Step 2.3 — Playlist tree (manual playlists + folders)
- Left rail shows: **My Library** (all), then user playlists and folders (from Phase 0.3 tables). Create / rename / delete playlists and folders. Selecting one filters the tracklist.
- **✅ What to test:** Create a folder and a playlist inside it; rename; delete; selecting a playlist shows only its tracks; survives app restart.
- 🛑 **STOP. Wait for "go".**

### Step 2.4 — Drag-and-drop into playlists + reordering
- Confirm/add `@dnd-kit`. Drag tracklist rows into a playlist; reorder tracks within a playlist; reorder playlists in the tree.
- **✅ What to test:** Drag a track into a playlist (it appears there); reorder rows (order persists after restart); dragging doesn't trigger playback.
- 🛑 **STOP. Wait for "go".**

### Step 2.5 — Smart playlists (auto-organize by rules)
- Smart playlist editor: rules on tag / category / name. Auto-populates and updates as the library changes. (e.g. "Smart: Combat" = tag contains `combat`.)
- **✅ What to test:** Create a smart playlist by tag; it lists matching tracks; add that tag to another track → it appears automatically; restart preserves the rule.
- 🛑 **STOP. Wait for "go".** *(End of Phase 2: the library alone is now far better than today's app.)*

---

## PHASE 2B — YouTube Import (download & convert)
*Goal: paste a YouTube URL and have it land in the library as a **normal local track** — real waveform, instant seek, full mixer/sampler, works offline. Decided: download on import (not live-stream), because cross-origin YouTube audio can't enter the Web Audio graph (no crossfader/filter/sampler) and has no real waveform. **Format rule: keep the source audio as-is when its codec is natively supported (m4a/AAC, webm/opus, mp3, ogg, wav, flac); otherwise transcode to MP3.***

> **Ordering:** depends on Phase 0.3 (DB) and Phase 2.1 (tracklist to see results). Can be built any time after Phase 2; slotted here because import lives in the library.
>
> **Honest caveats:** downloading from YouTube is against their ToS — acceptable for a personal, single-user, non-redistributed tool, but it's your call. Bundling `yt-dlp` + `ffmpeg` increases the packaged app size (~50–100MB).

### Step 2B.1 — Provenance schema (additive migration)
- Add columns to `tracks`: `source TEXT DEFAULT 'local'` (`'local'|'youtube'`), `source_url TEXT`, `imported_at DATETIME`. Idempotent, like existing migrations.
- **✅ What to test:** App boots; all existing tracks/tags/scenes load; new columns exist; old data untouched. Regression triplet (stream / no-double / seek).
- 🛑 **STOP. Wait for "go".**

### Step 2B.2 — Bundle `yt-dlp` + `ffmpeg` and probe them
- Add platform binaries (macOS + Windows) + a resolver in the main process, plus an IPC `checkMediaTools()` returning versions/availability.
- **✅ What to test:** A temp call/log reports both binaries found with versions on your Mac (and Windows when you test there). No effect on normal playback.
- 🛑 **STOP. Wait for "go".**

### Step 2B.3 — Metadata fetch (no download yet)
- IPC `getYoutubeInfo(url)` → `{ title, duration, thumbnail, formats }`.
- **✅ What to test:** Paste a valid URL (temp field/console) → correct title + duration returned; an invalid/garbage URL returns a clean handled error (no crash).
- 🛑 **STOP. Wait for "go".**

### Step 2B.4 — Download + format logic (main-process core)
- IPC `importYoutube(url)`: download best audio → **keep container as-is if natively supported, else transcode to MP3** via ffmpeg → write to `sounds/youtube/<sanitized-title>.<ext>` → insert track row (`source='youtube'`, `source_url`, default category e.g. `music`) → generate peaks → emit progress events (download % → "converting" if needed → done).
- **✅ What to test (via temp trigger):** File appears under `sounds/youtube/`; a track row is created; it **plays via the existing streaming engine** (instant start, no freeze); waveform generates; click-to-seek works with no restart; a source that needs conversion produces a working MP3.
- 🛑 **STOP. Wait for "go".**

### Step 2B.5 — Import UI in the library browser
- "➕ Add from YouTube" in the library. Dialog: paste URL → live preview (title / thumbnail / duration) → choose category/playlist → Import. Progress bar (download %, then "Converting…" when applicable). On completion the track appears in the tracklist and is immediately playable.
- **✅ What to test:** Full flow — paste, see preview, import, watch progress, track appears and plays with real waveform + seek. Importing doesn't block the rest of the UI.
- 🛑 **STOP. Wait for "go".**

### Step 2B.6 — Robustness & edge cases
- Filename sanitize + de-dupe; clean errors for private / age-gated / geo-blocked / removed videos; **cancel** an in-progress import (no orphan file or DB row); long videos stream fine; reject (or clearly handle) playlist URLs; "re-download" action if a `source='youtube'` file goes missing (uses `source_url`).
- **✅ What to test:** Invalid/private video → friendly error; cancel mid-download → no leftover file/row; import a 1hr+ video → no freeze, streams fine; delete the local file then re-download → restored.
- 🛑 **STOP. Wait for "go".** *(End of Phase 2B: YouTube tracks are first-class citizens.)*

---

## PHASE 3 — Decks & Mixer (the "DJ features" win)
*Goal: two ambience decks with transport, per-deck mixing, and a crossfader. This is where engine voices land — handled carefully to protect streaming & no-double-play.*

### Step 3.1 — Engine: deck voice layer (additive, no behavior change to old paths)
- Extend `audioEngine.js` with a deck-addressable voice model: `loadDeck(deckId, url)`, `playDeck`, `pauseDeck`, `seekDeck`, `setDeckVolume`, plus per-deck events — **without** altering the existing URL-keyed functions the Classic UI and tracklist use.
- Enforce invariants: one voice per deck, pause-before-play, debounce, streaming preserved.
- **✅ What to test (engine-level, via temporary buttons or console):** Load a long track to Deck A → starts instantly (streaming); press play twice → no double/echo; seek → no restart; load a different track to Deck A → old one stops cleanly. Classic UI + tracklist playback still perfect.
- 🛑 **STOP. Wait for "go".**

### Step 3.2 — Deck UI: load + transport + scrolling waveform
- Two deck panels. Drag a track from the tracklist (or double-click) to load it. Play / pause / cue-to-start / restart. Reuse `WaveformEditor` for the scrolling waveform + click-to-seek.
- **✅ What to test:** Drag track → Deck A loads and shows waveform; play/pause works; waveform click seeks without restart; load to Deck B independently; both can play at once.
- 🛑 **STOP. Wait for "go".**

### Step 3.3 — Per-deck mixer channel (volume + gain + low-pass "muffle" filter)
- Each deck gets a volume fader and a low-pass filter knob (the "muffled / next room / underwater" effect) via a `BiquadFilterNode` inserted in that deck's chain.
- **✅ What to test:** Deck volume faders work independently; turning the filter makes the sound progressively muffled and back; no clicks/pops; master vol still global.
- 🛑 **STOP. Wait for "go".**

### Step 3.4 — Crossfader
- A crossfader blends Deck A ↔ Deck B (equal-power curve). Center = both audible.
- **✅ What to test:** With different tracks on each deck, sliding the crossfader smoothly moves the mix from A to B; center plays both; no volume dip/clipping at center.
- 🛑 **STOP. Wait for "go".**

### Step 3.5 — Deck loop regions (reuse crop)
- Per-deck loop in/out using the existing crop/loop mechanism, so a short ambience can loop seamlessly on a deck.
- **✅ What to test:** Set a loop region on a deck track; it loops within the region; clearing the loop plays through; seek still works.
- 🛑 **STOP. Wait for "go".**

---

## PHASE 4 — Sampler / SFX Pads
*Goal: replace the SFX grid with Djay-style sampler pads — rapid-fire, overlapping one-shots. This is the storytelling SFX workflow.*

### Step 4.1 — Engine: sampler voices (overlapping allowed)
- Add `triggerSample(url)` that spawns an independent, streamed one-shot voice each press and auto-disposes on end. Overlap is intentional; but one click = one voice (no accidental double-trigger).
- **✅ What to test:** Rapid-press a sample 5× → 5 overlapping plays, each clean; single click never produces an echo/double; voices free themselves (no leak after many presses).
- 🛑 **STOP. Wait for "go".**

### Step 4.2 — Sampler pad grid UI
- Bottom strip of pads. Assign any SFX track to a pad (drag from tracklist). Press to fire; visual flash on trigger. Per-pad volume.
- **✅ What to test:** Assign a few SFX to pads; click fires instantly (streamed); rapid fire overlaps; per-pad volume works; assignments persist after restart.
- 🛑 **STOP. Wait for "go".**

### Step 4.3 — Keyboard triggers for pads
- Map pads to keys (e.g. 1–9, Q–P) for hands-free firing during narration. Show the key on each pad.
- **✅ What to test:** Pressing the mapped key fires the pad; typing in a text field does **not** fire pads; spacebar STOP-ALL still works.
- 🛑 **STOP. Wait for "go".**

---

## PHASE 5 — Scenes as Snapshots
*Goal: evolve "Scenes" into recallable snapshots of the whole board (deck loads + mixer + crossfader + sampler), with smooth transitions — the DM's "set list".*

### Step 5.1 — Save snapshot
- "Save Scene" captures: each deck's track + volume + filter + loop, crossfader position, sampler assignments. Stored via existing scenes tables (extended in 0.3).
- **✅ What to test:** Build a board state, save it as a scene; it appears in the scene list with the right contents.
- 🛑 **STOP. Wait for "go".**

### Step 5.2 — Recall snapshot (instant)
- Selecting a scene loads decks/mixer/sampler to the saved state.
- **✅ What to test:** Change the board, recall a saved scene → board returns to saved state; decks stream correctly; no double-play.
- 🛑 **STOP. Wait for "go".**

### Step 5.3 — Crossfade transition into a scene
- Recall with a timed crossfade (reuse `transitionToScene`/`crossfade` concepts) so moving from "tavern" to "combat" fades smoothly instead of cutting.
- **✅ What to test:** Recall-with-fade smoothly transitions audio over the chosen duration; outgoing tracks fade and stop; incoming fade in; no clicks.
- 🛑 **STOP. Wait for "go".**

### Step 5.4 — Backward-compat with existing scenes
- Ensure scenes saved by the **old** app still load (as deck/sampler where sensible) so nothing you've already built is lost.
- **✅ What to test:** An old scene from before the overhaul still opens and plays.
- 🛑 **STOP. Wait for "go".**

---

## PHASE 6 — Polish, Parity & Retiring Classic
*Goal: finish the Djay feel, close gaps, and (only once you're happy) make Studio the default.*

### Step 6.1 — Colored frequency waveforms
- Upgrade waveforms to Djay-style multi-band color (highs/mids/lows) using cached peaks; keep performance (canvas, cached peaks — no full decode on playback).
- **✅ What to test:** Waveforms show frequency color; large tracks still render fast; seek/loop unaffected.
- 🛑 **STOP. Wait for "go".**

### Step 6.2 — Cue points / markers
- Named cue markers on long deck tracks (from `cue_points`); click to jump.
- **✅ What to test:** Add/label a cue; clicking jumps there without restart; persists after restart.
- 🛑 **STOP. Wait for "go".**

### Step 6.3 — Global keyboard shortcuts + AirPlay latency offset
- Shortcuts for decks/crossfader/STOP. Add the **AirPlay latency offset** affordance discussed earlier (visual cue/countdown for high-latency outputs) in settings.
- **✅ What to test:** Shortcuts work and don't fire while typing; latency offset shows the expected visual feedback when set.
- 🛑 **STOP. Wait for "go".**

### Step 6.4 — Full parity audit
- Checklist pass: every Classic capability exists in Studio (tags, rename, scene mgmt, category mixing, per-track volume, etc.). Fix gaps.
- **✅ What to test:** Walk the checklist together; confirm nothing from Classic is missing.
- 🛑 **STOP. Wait for "go".**

### Step 6.5 — Make Studio default; archive Classic
- Flip default to Studio; keep Classic reachable via toggle for one release as a safety net (remove later once confident).
- **✅ What to test:** Fresh launch opens Studio; a full mock session works end-to-end (library → decks → crossfade → sampler → save/recall scene). Final regression: streaming, no double-play, seek — all green.
- 🛑 **STOP. Done.**

---

## 4. Risks & Mitigations
- **Engine regressions (double-play/streaming).** → Decks/sampler are *additive* voice layers; URL-keyed paths untouched until parity; regression triplet tested every step.
- **DB corruption / data loss.** → Backup before first migration; additive idempotent migrations; old-scene compat step (5.4).
- **Scope creep toward literal DJ software.** → BPM/beatmatch explicitly out of scope; mapping table is the contract.
- **Performance with many tracks/voices.** → Streaming + cached peaks + voice auto-dispose; perf re-checked at 6.1.
- **New dependencies.** → `@dnd-kit` and the state lib are confirmed with you before install (Phase 1.1 / 2.4).
- **YouTube import (Phase 2B): ToS + binaries + reliability.** → Download-on-import (not live-stream) keeps tracks first-class and offline-safe; `yt-dlp`/`ffmpeg` bundled per-platform (adds ~50–100MB); ToS caveat acknowledged for personal single-user use; cancel/error/missing-file handling in Step 2B.6.

## 5. Resolved Decisions (confirmed by Alex 2026-06-06)
1. **Decks:** ✅ **2 decks + sampler.** (Can revisit adding 3–4 later as a layout toggle.)
2. **Deck visuals:** ✅ **Waveform-only.** No fake spinning platter.
3. **State lib:** ✅ **zustand** approved (use at Step 1.1).
4. **Drag-drop lib:** ✅ **@dnd-kit** approved (use at Step 2.4).
5. **YouTube import:** ✅ **Download on import** (not live-stream). Tracks become normal local files. (Phase 2B.)
6. **Import format:** ✅ **Keep source codec when natively supported; else convert to MP3.**

---

## 6. Progress Log
*(Updated as we complete steps. Format: date — step — status — notes.)*

- 2026-06-06 — Plan created — ✅ — Awaiting "go" on Phase 0, Step 0.1.
- 2026-06-06 — Decisions confirmed — ✅ — 2 decks + sampler; waveform-only; zustand + @dnd-kit approved.
- 2026-06-06 — Phase 2B added — ✅ — YouTube import via download-on-import; keep-source-codec else MP3.
