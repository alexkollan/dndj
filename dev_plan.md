# DNDj Audio Engine Remake - Development Plan

This document outlines the step-by-step plan to replace the Howler.js audio engine with a modern, industry-standard Web Audio API solution using Tone.js, and to resolve the memory and looping issues currently present in DNDj.

## Phase 1: The New Audio Engine (Tone.js)
**Goal:** Replace Howler.js with Tone.js for sample-accurate looping, reliable cropping, and a solid audio graph foundation.

**Tasks:**
1. Install `tone` package.
2. Rewrite `src/audioEngine.js` to use `Tone.Player` instead of `Howl`.
3. Implement `playTrack`, `stopTrack`, `seekTrack`, `getPlaybackPosition`, and looping using Tone.js's native `loopStart`, `loopEnd`, and `loop` properties.
4. Implement `crossfade` using Tone.js routing or gain nodes.
5. Ensure the existing API signature of `audioEngine.js` is maintained as much as possible to prevent breaking other React components.

**Testing:**
- Verify that basic playback (play/pause/stop) works.
- Verify that track volume and master volume work.
- Verify that looping is now sample-accurate (no audible gap).
- Verify crossfading between tracks.

## Phase 2: Memory-Safe Waveforms
**Goal:** Stop decoding entire audio files into memory in the UI thread for waveform visualization.

**Tasks:**
1. Create a utility function (in the main process or via a separate script) to extract audio peaks (a small array of numbers) from an audio file.
2. Store or cache these peaks so they don't need to be re-calculated every time.
3. Update `src/components/WaveformEditor.jsx` to fetch and render these pre-calculated peaks instead of using `AudioContext.decodeAudioData`.

**Testing:**
- Open the Waveform Editor for a large audio file (10+ minutes).
- Verify that the app no longer freezes or crashes due to out-of-memory errors.
- Verify that the waveform renders correctly and interactively.

## Phase 3: Robust Scene Orchestration & State
**Goal:** Ensure the UI stays perfectly in sync with the audio engine without relying on rapid `setInterval` polling, and handle complex scene transitions smoothly.

**Tasks:**
1. Implement an event-driven state system within `audioEngine.js` (e.g., using an EventTarget or simple callbacks) to notify React components when a track starts, stops, or fades out completely.
2. Update `App.jsx` and `SceneList.jsx` to subscribe to these events rather than polling.
3. Enhance the scene transition logic to handle simultaneous crossfades of multiple tracks cleanly.

**Testing:**
- Switch between complex scenes with multiple tracks.
- Verify that UI play buttons accurately reflect the actual audio state (e.g., stopping when a fade finishes).
- Verify that rapid clicks do not cause UI desync or audio glitches.