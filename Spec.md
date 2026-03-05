# SonarLox v1.0 — Updated Spec

## Product Vision

A desktop application that lets you visually place multiple audio sources in a 3D room and hear HRTF binaural spatialization in real time through headphones. Load stems from a song, position each in 3D space, and export the result as a single binaural stereo WAV — or load a MIDI file and hear each instrument track spatialized automatically.

**License:** MIT

---

## What Changed From the Original MVP Spec

The original MVP was single-source: one audio file, one draggable sphere, one export. Based on the target workflow — splitting a song into parts, positioning them in 3D, and exporting as a single spatial file — v1.0 now includes:

- Multi-source (up to 8 simultaneous sources)
- Global transport with playhead (minimal timeline)
- MIDI file import with auto-split to tracks
- Mixed and per-source binaural export
- Output device selector
- Audio engine abstraction layer (IAudioEngine)
- Visual feedback (distance rings, analyser, front/back cue)
- UI/design polish

The original single-source functionality is preserved as a subset — loading one file and dragging it around still works exactly as before.

---

## Core Workflows

### Workflow 1: Manual Stems

1. User clicks "Add Source" up to 8 times, each time picking a WAV/MP3 file
2. Each source appears as a color-coded sphere in the 3D room
3. All sources share a global transport — play/pause/stop keeps everything in sync
4. User drags each sphere to position instruments in 3D space
5. Per-source controls: volume slider, mute, solo
6. Timeline panel shows waveform per track with a shared playhead
7. Export → single binaural stereo WAV mixing all sources, or per-source WAVs

### Workflow 2: MIDI Import

1. User clicks "Load MIDI" and picks a .mid file
2. SonarLox parses the file, creates one source per track/channel (up to 8)
3. Each source auto-assigned a color and default position (semicircle around listener)
4. Basic synth generates audio per channel (oscillator-based, mapped to GM program numbers)
5. Optionally, user loads a SoundFont (.sf2) for higher quality instrument sounds
6. Same 3D positioning, transport, and export as Workflow 1

### Workflow 3: Single Source (Original MVP)

1. Load one audio file or select a test tone
2. Drag in 3D, hear HRTF spatialization
3. Export as binaural stereo WAV

All three workflows share the same underlying multi-source engine. Workflow 3 is just Workflow 1 with one source.

---

## Multi-Source Audio Engine

### Architecture

Each source gets its own audio processing chain, all feeding into a shared output:

```
Source 1: AudioBuffer → GainNode(1) → PannerNode(1, HRTF) ─┐
Source 2: AudioBuffer → GainNode(2) → PannerNode(2, HRTF) ─┤
Source 3: AudioBuffer → GainNode(3) → PannerNode(3, HRTF) ─┼──► MasterGain → AnalyserNode → destination
  ...                                                        │
Source 8: AudioBuffer → GainNode(8) → PannerNode(8, HRTF) ─┘
```

All sources share a single `AudioContext`. Each source has:
- Its own `AudioBufferSourceNode` (or oscillator for MIDI/test tones)
- Its own `GainNode` for per-source volume and mute
- Its own `PannerNode` with HRTF for independent spatial positioning
- A unique color for visual identification

### Source Data Model

```typescript
interface AudioSource {
  id: string                          // Unique identifier (uuid or incrementing)
  name: string                        // Display name ("Vocals", "Track 3", "Sine 440Hz")
  color: string                       // Hex color for sphere and UI
  position: [number, number, number]  // [x, y, z] in room units
  volume: number                      // 0.0 to 1.0
  isMuted: boolean
  isSoloed: boolean
  type: 'file' | 'test-tone' | 'midi-track'
  // Internal — not exposed to UI
  buffer: AudioBuffer | null          // Decoded audio data
  sourceNode: AudioBufferSourceNode | OscillatorNode | null
  gainNode: GainNode | null
  pannerNode: PannerNode | null
}
```

### Source Limit

Maximum 8 simultaneous sources. This balances:
- Performance: 8 HRTF PannerNodes is comfortable on modern hardware
- Usability: 8 spheres in a 20x20 room is manageable without layer/visibility UI
- Practicality: covers most stem separation outputs (4-6 tracks) plus extras

### Solo/Mute Logic

Standard DAW behavior:
- **Mute**: silences that source (GainNode → 0). Independent of solo.
- **Solo**: when any source is soloed, only soloed sources play. Multiple sources can be soloed simultaneously. Muted sources stay muted even if soloed.
- Implementation: if any source has `isSoloed: true`, all non-soloed sources are silenced. A source that is both soloed and muted remains silent.

### Default Colors

Pre-assigned color palette for up to 8 sources:
```
#FF6622  (orange)     — Source 1
#22AAFF  (blue)       — Source 2
#44DD66  (green)      — Source 3
#FF44AA  (pink)       — Source 4
#FFCC22  (yellow)     — Source 5
#AA66FF  (purple)     — Source 6
#44FFDD  (cyan)       — Source 7
#FF4444  (red)        — Source 8
```

### Default Positions

When multiple sources are added, spread them in a semicircle in front of the listener at distance 3, Y=1:

```
Source count → positions (looking down, listener at origin facing -Z):

1 source:  [0, 1, -3]  (directly ahead)
2 sources: [-2, 1, -3], [2, 1, -3]
3 sources: [-3, 1, -2], [0, 1, -3], [3, 1, -2]
4+ sources: evenly spaced on a 120° arc, radius 3, centered on -Z
```

---

## Global Transport

### Requirements

- Single play/pause/stop that controls all sources simultaneously
- All sources start at the same `AudioContext.currentTime` to maintain sample-accurate sync
- Playhead position tracked in seconds from start
- Loop toggle: when enabled, all sources loop back to 0 when the longest source ends

### Implementation Notes

- On play: iterate all sources, create and start their `AudioBufferSourceNode`s at the same `context.currentTime`
- On pause: `AudioContext.suspend()` — freezes everything in place
- On resume: `AudioContext.resume()`
- On stop: stop all source nodes, reset playhead to 0
- Playhead position: `context.currentTime - transportStartTime`

### Transport State in Store

```typescript
interface TransportState {
  isPlaying: boolean
  isPaused: boolean
  playheadPosition: number    // seconds from start
  duration: number            // length of longest source
  isLooping: boolean
}
```

---

## Timeline Panel

### Scope for v1

The timeline is minimal — a transport scrubber with per-source waveform visualization. No keyframing, no automation, no position animation. Sources have static positions during playback and export.

### What it shows

- Horizontal timeline bar spanning the duration of the longest source
- Playhead indicator (vertical line) showing current position
- Click/drag on timeline to scrub playhead position
- Per-source rows, each showing:
  - Color swatch matching the source sphere
  - Source name
  - Waveform overview (rendered from AudioBuffer data)
  - Mute/solo buttons inline
- Shorter sources show their waveform left-aligned with empty space after

### Layout

The timeline panel sits below the 3D viewport, with the control panel remaining as a sidebar:

```
┌─────────────────────────────────┬──────────────┐
│                                 │              │
│          3D Viewport            │   Control    │
│                                 │   Panel      │
│                                 │              │
├─────────────────────────────────┤              │
│        Timeline Panel           │              │
│  [▶ ⏸ ⏹ 🔁]  ──●───────────── │              │
│  🟠 Vocals   ▁▃▅▇▅▃▁▃▅▇▅▃▁   │              │
│  🔵 Drums    ▇▁▇▁▇▁▇▁▇▁▇▁▇   │              │
│  🟢 Bass     ▃▃▅▅▃▃▅▅▃▃▅▅▃   │              │
└─────────────────────────────────┴──────────────┘
```

### Future (v2)

- Keyframeable source positions over time
- Position curves visualized on the timeline
- Per-source automation lanes (volume, etc.)

---

## MIDI Support

### Parsing

Use a JavaScript MIDI parser library (e.g., `midi-parser-js`, `@tonejs/midi`, or `midi-file`). Extract:
- Track names (if present in meta events)
- Channel assignments
- Program change events (GM instrument number)
- Note events (note on/off, velocity, timing)

### Track → Source Mapping

Each MIDI track with note data becomes an AudioSource:
- Name: track name from MIDI metadata, or "Track N" / GM instrument name
- Color: from default palette
- Position: default semicircle layout
- Audio: generated by the synth engine

Combine tracks on the same channel into one source. Skip empty tracks. Cap at 8 sources — if the MIDI file has more, take the 8 tracks with the most note events.

### Basic Synth (Default)

Each MIDI channel gets a Web Audio oscillator-based synth:
- Map GM program numbers to basic waveforms and envelope settings
- Piano/keys → triangle wave with moderate attack/release
- Bass → sine/triangle wave, low octave
- Strings/pads → sawtooth with slow attack, long release
- Drums (channel 10) → noise bursts with short envelopes, pitched for different drums
- Everything else → square or sawtooth with default envelope

This won't sound great, but it's functional and zero-dependency. Good enough to demonstrate spatial positioning.

### SoundFont Support (Optional)

User can load a .sf2 SoundFont file for realistic instrument rendering:
- Parse .sf2 using a library like `sf2-parser` or `soundfont-player`
- Map GM program numbers to SoundFont presets
- Render notes using sampled instruments from the SoundFont
- Much higher audio quality, but requires user to provide a .sf2 file

Bundle a small GM SoundFont (~30MB) as an optional download, not included in the app binary.

### MIDI Rendering to AudioBuffers

Before playback, render each MIDI track to an `AudioBuffer`:
1. Parse MIDI → note events per track
2. For each track, use the synth (basic or SoundFont) to render all notes into a buffer
3. Store the buffer as the source's `AudioBuffer`
4. From this point, the MIDI sources behave identically to file-loaded sources

This pre-rendering approach means MIDI playback uses the same engine as WAV/MP3 — no special real-time MIDI scheduling needed.

---

## Export

### Mixed Stereo WAV (Primary)

All sources rendered through their respective HRTF PannerNodes, mixed into one stereo WAV:

1. Create an `OfflineAudioContext` (44.1kHz, stereo, duration = longest source)
2. For each source, create:
   - `AudioBufferSourceNode` with the source's buffer
   - `GainNode` with the source's volume (respect mute, ignore solo for export)
   - `PannerNode` with HRTF at the source's position
3. Connect all chains to the offline context destination
4. Start all sources at time 0
5. `offlineCtx.startRendering()` → get the mixed `AudioBuffer`
6. Convert to 44.1kHz 16-bit stereo WAV
7. Electron save dialog → write to disk

### Per-Source Export

Export each source as its own spatialized stereo WAV:

1. For each source, create a separate `OfflineAudioContext`
2. Render that single source through its PannerNode
3. Save as `[source_name]_spatial.wav`
4. Electron save dialog → choose directory, all files saved there

### Export UI

The export button opens a dialog with:
- Export type: "Full Mix" / "Individual Stems"
- Rendering mode: "Binaural (Stereo)" / "5.1 Surround" / "Both"
- For full mix: single file name (or two files if "Both")
- For individual: choose output directory
- Progress bar during rendering (for long files)

The rendering mode defaults to whatever the current monitoring mode is, but can be overridden. This lets you monitor in binaural headphones but export 5.1 for a surround system.

---

## Visual Feedback

### Distance Rings

Torus geometries emanating from each source, showing distance to listener:
- Ring radius increases with distance
- Ring opacity decreases with distance
- Color matches the source's assigned color
- Update in real time as source is dragged

### Audio Visualizer

Per-source frequency/waveform display:
- Small FFT bar display rendered as a billboard near each source sphere
- Source sphere scales/pulses with amplitude
- Uses `AnalyserSnapshot` from the engine (plain arrays, not AnalyserNode)

### Front/Back Visual Cue

Help the user understand spatial orientation:
- Listener mesh shows a clear facing direction (cone or wedge extending in -Z direction)
- Source sphere color shifts slightly when behind the listener (e.g., cooler tint)
- Optional: ground-plane direction line from listener to source

---

## Rendering Modes

SonarLox supports multiple spatial rendering modes. The user selects the active mode, which determines how virtual source positions are converted to speaker output.

### Mode 1: Binaural Stereo (Default)

- HRTF PannerNode per source → stereo output
- Designed for headphones
- 2-channel output
- This is the existing MVP behavior

### Mode 2: 5.1 Surround

- Channel-based panning per source → 6-channel output
- Designed for 5.1 speaker systems (e.g., Sound Blaster Z SE with discrete outputs)
- Bypasses PannerNode entirely — uses custom gain calculations per channel
- Standard ITU-R BS.775 speaker layout assumed:

```
            Center (0°)
              ╱   ╲
    Front L (30°L)  Front R (30°R)
          │         │
          │ LISTENER│
          │         │
  Surround L (110°L)  Surround R (110°R)

  LFE: omnidirectional, receives low-passed mix (<120Hz)
```

#### 5.1 Panning Algorithm

For each virtual source, compute the angle from the listener to the source on the horizontal plane, then distribute gain across the nearest speaker pair:

```typescript
interface ChannelGains {
  frontLeft: number      // 0.0 – 1.0
  center: number
  frontRight: number
  surroundLeft: number
  surroundRight: number
  lfe: number            // Low-pass filtered, constant ~0.5 for bass content
}

function computeChannelGains(
  sourceX: number,
  sourceZ: number,
  distance: number
): ChannelGains {
  // 1. Compute angle from listener to source (atan2)
  // 2. Find the two nearest speakers flanking that angle
  // 3. Distribute gain between them using sine/cosine panning law
  // 4. Apply distance attenuation
  // 5. LFE gets a low-passed copy at reduced level
}
```

The gain computation runs every frame in the AudioBridge, same as PannerNode position updates in binaural mode.

#### 5.1 Audio Graph

```
Source 1 → GainNode(1) → ChannelSplitter ──┐
Source 2 → GainNode(2) → ChannelSplitter ──┤
  ...                                       ├──► ChannelMergerNode (6ch) → destination
Source 8 → GainNode(8) → ChannelSplitter ──┘

Each source's signal is duplicated to 6 channels with per-channel gain
applied based on VBAP panning coefficients.
```

Implementation: use `AudioContext` with `destination.channelCount = 6`. Each source feeds into a `ChannelSplitterNode` / `GainNode` array (one per output channel), then all merge via a `ChannelMergerNode` connected to the destination. The per-channel gains are updated every frame based on the source's 3D position.

#### 5.1 Audio Device

The Sound Blaster Z SE (PCIe) presents as a multi-channel audio device to the OS. On Windows, it exposes 5.1 output through WASAPI. Chromium's Web Audio API should be able to open a 6-channel AudioContext targeting this device via `sinkId` + `channelCount: 6` on the destination node.

**Verification needed:** Before building the full 5.1 renderer, run a proof-of-concept:
1. Create an `AudioContext` targeting the Sound Blaster device
2. Set `context.destination.channelCount = 6`
3. Create a 6-channel buffer, put a tone on only channel 4 (surround left)
4. Play it — should come out of only the surround left speaker
5. If this works, the approach is valid

### Mode 3: Dolby Atmos (Future — v2+)

- Object-based audio: each source is an "audio object" with position metadata
- Height channels (7.1.4 layout adds 4 overhead speakers)
- Requires Dolby Atmos renderer SDK or encoding to Dolby Digital Plus / TrueHD
- Export as Atmos ADM BWF (Broadcast Wave Format with Audio Definition Model metadata)
- Not implemented in v1, but the data model supports it — source positions in full 3D (X/Y/Z) already include height

### Rendering Mode Selector

UI: dropdown in the Control Panel under OUTPUT section:

```
─── OUTPUT ───
Mode: [Binaural ▾]     ← options: Binaural, 5.1 Surround
Device: [HyperX ▾]     ← filtered to show compatible devices for selected mode
Master Vol: ━━━●━━━
```

When mode is "5.1 Surround," the device dropdown filters to show only multi-channel devices. When mode is "Binaural," it shows all stereo+ devices.

### Export Formats by Mode

| Rendering Mode | Export Format | Channels | Description |
|---|---|---|---|
| Binaural | Stereo WAV | 2 | HRTF-processed, for headphone playback |
| 5.1 Surround | 5.1 WAV | 6 | Channel-based, for surround speaker playback |
| Both | Stereo + 5.1 WAVs | 2 + 6 | Two files exported simultaneously |

The 5.1 WAV export uses standard channel ordering: FL, FR, C, LFE, SL, SR (per WAV/SMPTE convention).

Per-source export also respects the rendering mode — each source exported as a 2-channel (binaural) or 6-channel (5.1) WAV depending on the active mode.

---

## Output Device Selector

From `AUDIO_ENGINE_SPEC.md`:
- Dropdown in control panel listing available audio output devices
- Uses `navigator.mediaDevices.enumerateDevices()` filtered to `audiooutput`
- Selected device applied via `AudioContext.setSinkId()`
- Listens for `devicechange` events (USB hot-plug)
- Persisted preference via electron-store

---

## Control Panel (Updated)

The sidebar control panel now manages multiple sources:

```
┌─────────────────────────┐
│ SonarLox                │
│                         │
│ ─── OUTPUT ───          │
│ Device: [HyperX ▾]     │
│ Master Vol: ━━━●━━━     │
│                         │
│ ─── SOURCES ───         │
│ [+ Add Audio] [+ MIDI]  │
│                         │
│ 🟠 Vocals        🔇 S  │
│    Vol: ━━━●━━━     ✕  │
│ 🔵 Drums         🔇 S  │
│    Vol: ━━━●━━━     ✕  │
│ 🟢 Bass          🔇 S  │
│    Vol: ━━━●━━━     ✕  │
│                         │
│ ─── TEST TONES ───      │
│ [Sine] [Pink Noise]     │
│                         │
│ ─── POSITION ───        │
│ Selected: Vocals        │
│ X: 2.00  Y: 1.00       │
│ Z: -3.00               │
│                         │
│ ─── EXPORT ───          │
│ [Export Mix] [Export All]│
└─────────────────────────┘
```

### Source Selection

- Click a source in the control panel or click its sphere in the 3D viewport to select it
- Selected source shows position readout and is highlighted in the 3D scene
- Only the selected source is draggable (prevents accidental moves)
- Keyboard shortcut: 1-8 to select source by index, Delete to remove selected

---

## Updated Project Structure

```
sonarlox/
├── CLAUDE.md
├── SPEC.md                          # Original MVP spec (keep for reference)
├── SPEC_V1.md                       # This file
├── AUDIO_ENGINE_SPEC.md             # Audio engine abstraction layer
├── SPEAKER_CALIBRATION_SPEC.md      # Future: speaker calibration (v3+)
├── LICENSE
├── package.json
├── tsconfig.json
├── electron-vite.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   └── ipc.ts
│   ├── preload/
│   │   └── index.ts
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx                   # Updated layout: viewport + timeline + panel
│       ├── components/
│       │   ├── Viewport.tsx
│       │   ├── Room.tsx
│       │   ├── SoundSource.tsx       # Now renders multiple spheres from store
│       │   ├── Listener.tsx          # Updated with facing direction indicator
│       │   ├── DistanceRings.tsx     # Per-source rings
│       │   ├── AudioVisualizer.tsx   # Per-source FFT billboard
│       │   ├── ControlPanel.tsx      # Updated: multi-source list, device selector
│       │   ├── TimelinePanel.tsx     # NEW: waveform timeline with playhead
│       │   ├── SourceList.tsx        # NEW: source entries with vol/mute/solo
│       │   ├── ExportDialog.tsx      # NEW: export options modal
│       │   └── AudioBridge.tsx       # Updated: syncs all source positions
│       ├── audio/
│       │   ├── IAudioEngine.ts       # Interface (from AUDIO_ENGINE_SPEC)
│       │   ├── WebAudioEngine.ts     # Renamed, now handles multi-source
│       │   ├── MidiParser.ts         # NEW: parse .mid → track data
│       │   ├── MidiSynth.ts          # NEW: basic oscillator synth for MIDI
│       │   ├── SoundFontPlayer.ts    # NEW: optional .sf2 playback
│       │   ├── TestTones.ts
│       │   └── Exporter.ts           # Updated: multi-source export
│       ├── stores/
│       │   ├── useAppStore.ts        # Updated: multi-source state
│       │   └── useTransportStore.ts  # NEW: transport/playhead state
│       └── types/
│           └── index.ts              # Updated: AudioSource, TransportState, etc.
└── resources/
```

---

## Updated Zustand Store

The store evolves from single-source to multi-source:

```typescript
interface AppState {
  // Sources
  sources: AudioSource[]
  selectedSourceId: string | null
  addSource: (source: Partial<AudioSource>) => void
  removeSource: (id: string) => void
  updateSource: (id: string, updates: Partial<AudioSource>) => void
  setSelectedSourceId: (id: string | null) => void

  // Output
  selectedOutputDevice: string | null
  masterVolume: number
  setSelectedOutputDevice: (id: string | null) => void
  setMasterVolume: (volume: number) => void
}

interface TransportState {
  isPlaying: boolean
  isPaused: boolean
  playheadPosition: number
  duration: number
  isLooping: boolean
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  toggleLoop: () => void
}
```

---

## Implementation Phases (Updated)

### Phase 7: Audio Engine Refactor (Est. 1 session) — CLOUD
- Create IAudioEngine.ts interface
- Rename AudioEngine.ts → WebAudioEngine.ts
- Implement multi-source audio graph (per-source gain + panner chains)
- getAnalyserData() returns plain arrays
- Add device enumeration and selection
- Verify: existing single-source workflow still works

### Phase 8: Multi-Source UI (Est. 2 sessions) — LOCAL
- Update Zustand store for multi-source state
- SourceList component: add/remove sources, per-source volume/mute/solo
- Update SoundSource.tsx to render multiple color-coded spheres
- Source selection: click sphere or list item to select
- Only selected source is draggable
- Update AudioBridge to sync all source positions
- Verify: load 3 WAV files, position independently, hear spatial separation

### Phase 9: Global Transport & Timeline (Est. 2 sessions) — CLOUD + LOCAL
- CLOUD: Transport sync strategy (sample-accurate multi-source start)
- LOCAL: TransportStore with play/pause/stop/seek/loop
- LOCAL: TimelinePanel component with playhead scrubber
- LOCAL: Per-source waveform rendering on timeline
- LOCAL: Playhead position updates in real time during playback
- Verify: load stems, press play, all start in sync, scrub works

### Phase 10: MIDI Support (Est. 2 sessions) — LOCAL
- MidiParser.ts: parse .mid files, extract tracks/channels/notes
- MidiSynth.ts: basic oscillator synth with GM program mapping
- Render MIDI tracks to AudioBuffers (pre-render, not real-time)
- "Load MIDI" button creates sources from parsed tracks
- Verify: load a MIDI file, hear all tracks spatialized, sounds recognizable

### Phase 11: SoundFont Support (Est. 1 session) — LOCAL
- SoundFontPlayer.ts: parse .sf2, render notes using sampled instruments
- UI: "Load SoundFont" button, indicator showing loaded font name
- Falls back to basic synth if no SoundFont loaded
- Verify: load MIDI + SoundFont, quality noticeably better than basic synth

### Phase 12: Export (Est. 1-2 sessions) — CLOUD + LOCAL
- CLOUD: Multi-source OfflineAudioContext rendering strategy
- LOCAL: Update Exporter.ts for multi-source mixed export
- LOCAL: Per-source individual export option
- LOCAL: ExportDialog component with options
- LOCAL: Progress indicator during render
- Verify: export mixed WAV, play in external player, hear all sources spatialized

### Phase 13: Visual Feedback (Est. 1-2 sessions) — LOCAL
- Distance rings per source (color-coded)
- Per-source FFT/amplitude visualization on sphere
- Listener facing direction indicator (cone/wedge)
- Front/back color shift on source spheres
- Verify: visual feedback reacts to audio, facing direction is clear

### Phase 13b: 5.1 Surround Rendering (Est. 2 sessions) — CLOUD + LOCAL
- CLOUD: 5.1 channel panning algorithm (VBAP with ITU speaker positions)
- LOCAL: Proof-of-concept: 6-channel AudioContext → Sound Blaster Z SE, per-channel test tone
- LOCAL: Implement channel gain computation per source per frame
- LOCAL: ChannelSplitter/Merger audio graph for 5.1 output
- LOCAL: Rendering mode selector UI in control panel
- LOCAL: Update Exporter for 6-channel WAV export
- LOCAL: Device dropdown filters by channel capability
- Verify: drag source around room, hear it move across 5.1 speakers correctly

### Phase 14: UI/Design Polish (Est. 1-2 sessions) — LOCAL
- CSS variables for theme (colors, spacing, typography)
- Consistent component styling (buttons, sliders, dropdowns)
- Hover/active/disabled states
- Layout refinement (viewport/timeline/panel proportions)
- Device selector dropdown
- Keyboard shortcuts (1-8 select source, Delete remove, Space play/pause)
- Error handling (invalid files, unsupported formats, audio context resume)
- App icon and window title
- Verify: app feels cohesive and polished, no rough edges

---

## Success Criteria (v1.0)

1. App launches showing 3D room with listener at center
2. User can add up to 8 audio sources (WAV/MP3), each appears as a colored sphere
3. All sources play in sync via global transport (play/pause/stop/loop)
4. Each source can be independently positioned in 3D with HRTF spatialization
5. Per-source volume, mute, and solo controls work correctly
6. Timeline panel shows waveforms with a functional playhead scrubber
7. MIDI file import creates sources per track with basic synth audio
8. Optional SoundFont loading improves MIDI audio quality
9. Export produces a binaural stereo WAV mixing all sources spatially
10. Per-source export produces individual spatialized WAV files
11. Output device selector allows choosing between available audio devices
12. Visual feedback: distance rings, amplitude visualization, facing direction
13. 5.1 surround rendering mode: sources pan across 5.1 speakers in real time
14. 5.1 export produces a 6-channel WAV with correct channel ordering
15. Rendering mode selector switches between binaural and 5.1
16. UI is polished with consistent design, hover states, keyboard shortcuts
17. Error handling covers invalid files, missing audio, device changes

---

## What's Deferred to v2+

- **Keyframed position animation** on the timeline (positions are static in v1 export)
- **AI stem separation** (Demucs/HTDemucs — user provides their own stems in v1)
- **Room acoustics** (configurable room dimensions, materials, convolution reverb)
- **Video sync** (import video, attach spatialized audio)
- **Multi-output routing** (different sources to different physical speakers simultaneously)
- **Speaker calibration** (see SPEAKER_CALIBRATION_SPEC.md)
- **Dolby Atmos / 7.1.4 export** (object-based audio with height channels, ADM BWF metadata)
- **Head tracking** (webcam/gyroscope listener orientation)
- **Native audio backend** (PortAudio — see AUDIO_ENGINE_SPEC.md)