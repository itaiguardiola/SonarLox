# SonarLox Development Plan

## Completed Phases

### Phase 1-6: Core Foundation
- Single/multi-source spatial audio with HRTF binaural panning
- 3D scene with React Three Fiber, visual feedback, distance rings
- Basic WAV export, UI polish

### Phase 7-9: Audio Engine Refactor
- WebAudioEngine singleton + SourceChannel architecture
- Solo/mute logic, transport store, timeline with waveform scrubbing
- Audio output device selection

### Phase 10-11: MIDI & SoundFont
- MIDI file import via @tonejs/midi, oscillator synth rendering
- SoundFont (SF2) support via js-synthesizer/FluidSynth WASM

### Phase 12: Export System
- Export dialog with format options (binaural stereo, 5.1 surround, stems)
- Progress tracking, cancel support, solo/listenerY in offline render

### Project Save/Load
- .sonarlox ZIP format with embedded WAV
- Ctrl+S/O/Shift+S shortcuts, dirty tracking, 3-button save dialogs

### Phase 13: Visual Enhancements
- Listener directional wedge, front/back color shift
- Distance rings with ground projection, FFT visualizer

### Phase 14: UX Polish
- Toast notification system (console-styled with LED + type badge + drain bar)
- Tooltips, window constraints, native confirmation dialogs, CSS theme

### Phase 15: Animation System
- Keyframed position automation with Catmull-Rom spline interpolation
- Automation lanes in timeline, recording mode (R key)
- Motion path preview, export with animated positions
- Project serialization v1.1.0

### Phase 16: Plugin System
- Plugin scanner, editor, panel with ON/OFF + target routing
- Audio effects (per-source or master chain), visualizers, exporters
- Error boundary, effect chain rebuild, project persistence
- Plugin directory: ~/.sonarlox/plugins/

### Phase 17: Undo/Redo & Refinements
- Undo/redo with selective state snapshots (Ctrl+Z/Y)
- Drag & drop audio/MIDI files into 3D room
- Dynamic room size, modular Zustand store slices
- Refined UI sections

### Phase 18: Video Synchronization
- Docked video panel with broadcast monitor aesthetic
- Transport sync (play/pause/seek locks video to audio timeline)
- SMPTE timecode display, frame-step controls
- Video offset (TC offset slider)
- 3D video screen in scene (fixed orientation, draggable, lockable, scalable)
- Extract audio from video
- CRT scanlines, crop marks, vignette overlays
- `buildVideoUrl` helper, `refreshDuration` transport action

### Phase 19: Control Panel Redesign (Current)
- Collapsible `Section` component with chevron toggle + accessory slot
- Sections grouped by workflow priority:
  - Always open: Session, Sources, Transport, Output
  - Collapsed by default: Environment, Video Sync, Plugins, Camera
- Source properties merged inline under Sources section
- Tighter spacing (gap: 2px between sections, 300px sidebar)
- Reusable pattern for future plugin/feature panels
- `sectionReveal` animation on expand

---

## Planned / Future

### Phase 20: Multi-Camera System
- Fixed audio camera (current) stays as default
- Additional cameras for screen controls, VR views, etc.
- Camera switching UI
- Per-camera render targets for future VR/preview modes

### Phase 21: Advanced Plugin UI
- Plugin panels use `Section` component for consistent collapsible UI
- Plugin parameter presets (save/recall)
- Plugin chain reordering via drag & drop
- Custom plugin visualizer panels docked in sidebar

### Phase 22: Collaboration & Sharing
- Export project as shareable package
- Import/merge projects
- Session notes / markers on timeline

### Phase 23: Advanced Export
- Real-time binaural preview recording
- Ambisonic export (AmbiX B-format)
- Video export with embedded spatial audio
- Batch export presets

### Phase 24: Performance & Scale
- Web Worker offloading for MIDI rendering
- Lazy section rendering (only mount when expanded)
- Virtual scrolling for large source lists
- GPU-accelerated waveform rendering

### Ongoing
- Bug fixes and UX refinements
- Plugin ecosystem growth
- Documentation and tutorials
