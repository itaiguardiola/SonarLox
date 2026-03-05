# SonarLox - Gemini CLI Mandates

This file contains foundational mandates for Gemini CLI when working on the SonarLox project.

## Engineering Standards

- **Tech Stack:** Electron, React 18, TypeScript (strict), React Three Fiber, Web Audio API, Zustand.
- **Audio Engine:** `WebAudioEngine.ts` is the singleton source of truth for audio. Always use `audioEngine` for audio operations.
- **State Management:** `useAppStore` for general state, `useTransportStore` for playback timing. Use transient updates (`getState()`) in `useFrame` for performance.
- **Plugin System:** 
  - Audio effects must implement `AudioEffectPlugin` and provide `getInputNode()`/`getOutputNode()`.
  - Visualizers should provide a `render` method returning R3F JSX.
  - Exporters must return a `Promise<ArrayBuffer>` in `export()`.
- **Project Files:** `.sonarlox` projects are folders containing `manifest.json`, `state.json`, `timeline.json`, and an `audio/` directory.

## Development Workflow

- **Research:** Check `SPEC.md` and `CLAUDE.md` for phase status and architectural patterns.
- **Testing:** 
  - Verify audio changes by checking spatialization and effect processing.
  - Verify export by rendering and checking the output file (binaural or 5.1).
  - Verify plugin loading by scanning the `userData/plugins` directory.
- **Safety:** Never hardcode paths; use `app.getPath('userData')` or project-relative paths via IPC.

## Plugin Development Guidelines

- Plugins are executed in a sandbox via `new Function`.
- `React` and `THREE` (three.js) are provided as global variables to the plugin script.
- All plugins must export a constructor as `module.exports` or `module.exports.default`.
- Plugins should clean up all AudioNodes in `deactivate()`.
