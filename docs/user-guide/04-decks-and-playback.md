# 4. Decks & Playback

[← Prev: Library & Tracks](./03-library-and-tracks.md) · [Back to User Guide](./README.md) · [Next: The Crossfader →](./05-crossfader.md)

---

Decks are where music actually plays with full control. DNDj has **three** decks:
**A** and **B** (the big ones, blended by the [crossfader](./05-crossfader.md))
and **C** (a smaller third deck for an extra layer).

## Loading a track onto a deck

Three ways:

1. **Drag** a track from the list onto the deck.
2. Click the **A** or **B** button on the track's row.
3. Drag onto the mini **Deck C** for the third deck.

When a track loads, the deck flashes briefly and draws its **waveform**.

## The waveform

The waveform is a detailed, colour-banded picture of the audio (bass / mid /
treble shown in different shades). It's interactive:

| Action | Result |
|--------|--------|
| **Click** anywhere | Seek (jump the playhead there) |
| **Mouse wheel** | Zoom in / out |
| **Pinch** (trackpad) | Zoom in / out |
| **Two-finger swipe** (trackpad) | Pan left/right when zoomed |
| **Click & drag** | Pan when zoomed |
| **+ / − buttons** (corner) | Zoom step (1× → 8×) |

The bright vertical line is the **playhead**. A faint dashed line follows your
cursor so you can see exactly where a click will seek to.

> The first time a track is shown, DNDj analyses it to draw the waveform and then
> remembers the result, so it's instant every time after that.

## Transport controls

Below the waveform:

- **↩ Cue** — stop and jump back to the start (or to the loop-in point if you've
  set one).
- **▶ / ⏸ Play / Pause**.
- **■ Stop** — stop and reset to the start.

The deck glows while it's playing.

## Looping

DNDj can loop a deck endlessly — perfect for atmosphere beds.

- **LP** — toggle looping on/off for the deck. (Atmosphere/ambient tracks start
  with looping on; others start off.)
- **IN** — set the loop start point at the current playhead position.
- **OUT** — set the loop end point at the current position.
- **CLR** — clear the custom loop points (appears once you've set any).

With **IN** and **OUT** set, the deck loops just that section seamlessly. With no
custom points but **LP** on, the whole track loops. The loop region is shaded on
the waveform.

## Cue points

Cue points are coloured bookmarks on a track so you can jump to exact moments
(a drop, a stinger, a chorus).

- **+ CUE** — drop a cue marker at the current playhead. Each new cue gets a
  different colour automatically.
- Cues appear as coloured flags on the waveform and as chips in a strip below the
  controls.
- **Click a cue chip** to jump straight to it.
- **× on a chip** to delete that cue.

Cue points are saved per track, so they're there next time you load it — on any
deck.

## The filter

Each deck has a **FILTER** slider (a low-pass filter):

- Slide **right** (toward 20 000 Hz / "OFF") for the full, unfiltered sound.
- Slide **left** to progressively cut the high frequencies — muffling the track,
  great for "music heard through a wall" or building tension before a reveal.

## Volume

The **VOL** slider sets that deck's level. This is separate from:

- the **crossfader** (which balances A against B), and
- the **MASTER** volume in the top bar (which scales everything).

All three multiply together to produce what you hear.

## Deck C — the third deck

Deck C is the small "mini deck" tucked into the crossfader column. It's designed
for a **third, persistent layer** — a distant storm, a crackling fire, a drone —
that sits underneath whatever A and B are doing. It is **not** affected by the
crossfader.

- **Drop a track** on it to load.
- Use its inline **play / pause / stop** buttons.
- Click it (or the **⤢ expand** button) to open it **full-size in a pop-up** with
  the complete deck interface — waveform, loops, cues, filter, everything A and B
  have.
- Close the pop-up and it shrinks back to the mini bar, still playing.

---

## Keyboard control

You can drive the decks entirely from the keyboard — see the full list in
[Keyboard Shortcuts](./11-keyboard-shortcuts.md). The essentials:

| Key | Action |
|-----|--------|
| `Space` | Play/pause the **active** deck (the last one you started) |
| `Shift`+`Space` | Play/pause the **other** deck |
| `A` / `B` | Play/pause Deck A / Deck B directly |
| `S` | Stop the active deck |
| `Shift`+`S` | **Stop everything** |
| `←` / `→` | Seek −5 s / +5 s |
| `Shift`+`←` / `→` | Seek −30 s / +30 s |
| `L` | Toggle loop on the active deck |

> Deck C is controlled with its own buttons, not the A/B keyboard shortcuts.

---

[← Prev: Library & Tracks](./03-library-and-tracks.md) · [Back to User Guide](./README.md) · [Next: The Crossfader →](./05-crossfader.md)
