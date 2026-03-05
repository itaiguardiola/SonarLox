# SonarLox

Open-source 3D spatial audio editor (MIT License). Electron desktop app — load audio, place it in a 3D room, hear HRTF binaural spatialization in real time, export as stereo WAV.

## Stack
- Electron + electron-vite
- React 18 + TypeScript (strict mode)
- React Three Fiber (@react-three/fiber, @react-three/drei) for 3D
- Web Audio API for spatial audio (PannerNode HRTF)
- Zustand for state management
- ES modules throughout, no CommonJS

## Code Style
- Functional components only, no class components
- Named exports for components, default export for pages/layouts
- Destructure imports (`import { useState } from 'react'`)
- Avoid `any` — use proper types from src/renderer/types/
- Audio engine is a singleton class in src/renderer/audio/WebAudioEngine.ts (implements IAudioEngine interface)

## Key Architecture
- Main process (src/main/) handles file dialogs and IPC only
- Renderer process (src/renderer/) has all UI and audio logic
- Zustand stores:
  - `useAppStore` (src/renderer/stores/useAppStore.ts) — source of truth for sources, positions, volume, mute/solo, master volume, output device, camera, export state
  - `useTransportStore` (src/renderer/stores/useTransportStore.ts) — transport state (play/pause/stop/seek/loop), playhead position via rAF loop
- Audio graph (live): per-source gain -> panner(HRTF) -> analyser -> masterGain -> masterAnalyser -> destination
- Audio graph (5.1 export): per-source -> gain(volume*vbapGain) -> [LFE: 120Hz lowpass] -> channelMerger(6) -> destination
- Plugin system: 
  - Audio effects: inserted between gainNode and pannerNode (per-source) or between masterGain and masterAnalyser (master).
  - Visualizers: Rendered into R3F scene using custom `render` methods.
  - Exporters: Custom formats added to ExportDialog.
  - Serialization: Active plugins and parameters saved in project `.sonarlox` files.
- 3D source position syncs to Web Audio PannerNode on every frame via AudioBridge
- AudioBridge also handles solo logic (if any soloed, non-soloed get gain=0) and master volume
- Export respects solo/mute state (matches playback) and listener Y position
- ExportDialog (src/renderer/components/ExportDialog.tsx) handles binaural, 5.1, or both export modes
- Listener Y position syncs to Web Audio AudioListener via AudioBridge
- AnalyserNode provides waveform data for visual feedback
- TimelinePanel shows per-source waveforms with shared playhead, click-to-scrub
- Keyboard shortcuts (App.tsx): Space=play/pause, 1-8=select source, Delete=remove source (with confirmation dialog)
- Toast notifications (Toast.tsx): context-based, console-styled status strips with LED + drain bar
- Confirmation dialogs: native OS dialogs via show-confirm-dialog IPC for destructive actions

## Performance Pattern: Zustand Transient Updates
- Components that read position in useFrame use `useAppStore.getState()` (no subscription, no re-render)
- SoundSource updates mesh position directly via ref during drag, throttles store commits at ~15hz
- AudioBridge, AudioVisualizer, DistanceRings all use getState() in useFrame
- DistanceRings uses raw BufferGeometry for dynamic ground projection line, drei Line refs for static ring materials
- Never subscribe to high-frequency state (sourcePosition) in components that only need it per-frame

## Commands
- `npm run dev` — start dev server with hot reload
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npm run typecheck` — tsc --noEmit

## Verification
- After changes, always run typecheck and confirm the app renders
- Test audio: load any MP3, drag source, confirm spatial panning through headphones
- Test export: open Export dialog, select binaural, export mix, play in external player, confirm stereo spatialization
- Test export 5.1: export 5.1 mix, open in Audacity, confirm 6 channels
- Test export stems: export individual stems to directory, confirm files saved with correct names
- Test export solo: solo one source, export mix, confirm only soloed source in output
- Test pause/resume: pause mid-track, resume from same position
- Test loop toggle: turn off loop, confirm audio stops at end
- Test listener height: slide listener Y, confirm spatial audio changes
- Test solo: solo one source, only that source audible; mute+solo = silent
- Test timeline: playhead moves during playback, click to scrub, waveforms render
- Test master volume: slider affects overall output
- Test device selector: dropdown lists available audio output devices
- Test keyboard shortcuts: Space toggles play, 1-8 selects sources, Delete removes
- Test plugins: Enable "Simple Reverb" on a source, confirm effect is audible. Enable "Spectrum Visualizer" and confirm bars appear.
- Test plugin persistence: Save project with an active plugin and custom parameters, reload, confirm settings are restored.

## Model Routing

Three models available via Ollama on local RTX 3090 (24GB VRAM), plus cloud Claude:

| Model | Context | Speed | Use for |
|---|---|---|---|
| `qwen3-coder` (local) | 32k | ~70 tok/s | Scaffolding, boilerplate, component creation, file structure, tests, repetitive edits |
| `qwen2.5-coder:32b` (local) | 16-32k | ~35 tok/s | Multi-file refactors, TypeScript type wiring, debugging straightforward errors |
| `glm-4.7-flash` (local) | 32k | fastest | Quick questions, small edits, renaming, formatting, simple utilities |
| Cloud Claude (Anthropic API) | 200k | varies | Architecture decisions, audio graph design, complex debugging, OfflineAudioContext export logic, reviewing local model output, anything that needs deep reasoning |

### When to use local vs cloud

**Local (free, fast — use for ~80% of work):**
- Phase 1: Scaffold — entirely local (qwen3-coder)
- Phase 2: 3D Scene — entirely local (qwen3-coder)
- Phase 4: Visual Feedback — entirely local (qwen3-coder)
- Phase 6: Polish — entirely local (qwen3-coder or glm-4.7-flash for small fixes)
- Boilerplate, component shells, Zustand store, IPC handlers, CSS/layout
- Writing tests, adding types, simple bug fixes

**Cloud (paid, smarter — use for ~20% of work):**
- Phase 3: Audio Engine — cloud for designing the audio graph and PannerNode HRTF wiring, local for implementing the plan
- Phase 5: Export — cloud for OfflineAudioContext rendering strategy, local for implementation
- Any time local model produces code that doesn't work after 2 attempts
- Architectural questions ("how should the audio engine singleton handle cleanup?")
- Reviewing/auditing code generated by local models

### Switching models
```bash
# Local — set these env vars before running claude
export ANTHROPIC_BASE_URL=http://localhost:11434
export ANTHROPIC_AUTH_TOKEN=ollama
export ANTHROPIC_API_KEY=""
claude --model qwen3-coder

# Cloud — unset env vars
unset ANTHROPIC_BASE_URL
unset ANTHROPIC_AUTH_TOKEN
unset ANTHROPIC_API_KEY
claude
```

## Reference
- Full spec: see SPEC.md in project root
- Web Audio API spatial: use context7 for PannerNode and HRTF docs
- React Three Fiber: use context7 for current docs
- Electron + electron-vite: use context7 for current docs