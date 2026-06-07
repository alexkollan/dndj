# 11. Design System

[← Prev: Sync System](./10-sync-system.md) · [Technical Index](./README.md) · [Next: Build & Dev →](./12-build-and-dev.md)

---

DNDj's visual language is a dark "glassmorphism" theme built entirely on CSS
custom properties. The single source of truth is **`src/styles/tokens.css`**;
component stylesheets reference tokens and (by convention) contain no raw
hex/rgba values.

## Token file (`src/styles/tokens.css`)

All tokens live under `:root`. Categories:

| Group | Examples | Notes |
|-------|----------|-------|
| **Brand palette** | `--color-emerald #10b981`, `--color-amber #f59e0b`, `--color-rose #ef4444` | Emerald = atmosphere/success, Amber = SFX/warning, Rose = destructive |
| **Surfaces** | `--bg-app`, `--bg-sidebar`, `--bg-panel`, `--bg-card(-hover)`, `--bg-elevated`, `--bg-overlay` | Layered dark slate, mostly translucent for the glass effect |
| **Accent aliases** | `--accent`, `--accent-glow`, `--accent-sfx`, `--danger` | **Use these in components, not raw colors** |
| **Text** | `--text-primary/secondary/muted/disabled`, `--text-on-accent` | Slate ramp |
| **Borders** | `--border-subtle/normal/strong`, `--border-glow(-sfx)` | |
| **Spacing** | `--s-0-5 … --s-24` (rem scale) | `--s-2` = 8px, `--s-4` = 16px, … |
| **Radius** | `--radius-sm … --radius-3xl`, `--radius-full` | |
| **Typography** | `--font-sans`, `--font-mono`, `--text-2xs … --text-4xl`, `--weight-*`, `--leading-*` | |
| **Elevation** | `--shadow-sm … --shadow-xl`, `--shadow-glow(-sfx)`, `--shadow-btn-stop` | |
| **Blur** | `--blur-sm … --blur-xl` | backdrop blur for glass |
| **Transitions** | `--ease*`, `--t-instant/fast/base/slow/fade/expand` | |
| **Z-index** | `--z-base … --z-toast` | named scale |
| **Layout** | `--studio-top-bar-height`, `--studio-rail-width`, `--studio-deck-height`, etc. | |
| **Component-specific** | `--deck-a-color` (emerald), `--deck-b-color` (amber), `--deck-c-color` (#818cf8 violet) + `--deck-c-glow`, `--pad-size`, waveform band colors | |

### The deck colour convention
- **Deck A → emerald**, **Deck B → amber**, **Deck C → violet**. These appear in
  the deck badges, waveform palettes ([DeckWaveform](./07-components.md#deckwaveformjsx)
  hardcodes matching RGBs for canvas drawing), and glow shadows. If you add a deck
  colour, add it here and in the waveform palette.

## CSS conventions

- **One stylesheet per component**, in `src/styles/studio/<Component>.css`,
  imported at the top of the component file. Global base styles are in
  `src/styles/global.css`; tokens in `tokens.css`.
- **Naming:** BEM-lite. Block prefixes are short and component-scoped, e.g.
  `.deck-panel__header`, `.tr-menu-item`, `.pl-item--selected`, `.ls-tab`,
  `.sync-chip`, `.xfader__slider`, `.sp--assigned`, `.mini-deck__name`.
- **Modifiers** use `--`: `--active`, `--selected`, `--over`, `--danger`,
  `--playing`, `--empty`, etc.
- **Colours come from tokens.** New component CSS should reference `var(--…)`
  rather than literal colours so theming stays centralised.

## Canvas rendering (performance)

The waveforms are drawn on `<canvas>` rather than the DOM for 60fps. Two layers:
a static waveform redrawn only when peaks/zoom/pan change, and an overlay redrawn
every `requestAnimationFrame` for the moving playhead. Rendering is `devicePixelRatio`-aware (capped at 2×) to stay crisp without over-drawing. See
[DeckWaveform](./07-components.md#deckwaveformjsx). The crossfader curve previews
use the same canvas approach at small size.

---

[← Prev: Sync System](./10-sync-system.md) · [Technical Index](./README.md) · [Next: Build & Dev →](./12-build-and-dev.md)
