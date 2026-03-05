# SonarLox Spec Update #001

**Date:** March 4, 2026
**Status:** Proposed
**Affects:** `AUDIO_ENGINE_SPEC.md`, `SONARLOX_FILE_FORMAT_SPEC.md`

---

## Summary

Three changes from recent design sessions: export behavior for solo state, revised v3.0 roadmap to include the spatial media player, and minor spec alignment with current codebase reality.

---

## Change 1: Export Respects Solo State (IMPLEMENTED — Phase 12)

### Current Behavior

The export functions in `ControlPanel.tsx` skip muted sources (`if (source.isMuted) continue`) but ignore solo state entirely. Both `exportBinauralWav` (single source) and `exportMixedBinauralWav` (mixed) export all non-muted sources regardless of whether solo is active.

`AudioBridge.tsx` already implements correct solo logic for live playback — if any source is soloed, non-soloed sources get `effectiveVolume = 0`.

### Problem

"What you hear" and "what you export" diverge. A user solos a source, hears only that source, hits export, and gets a full mix. This violates the principle of least surprise and contradicts every major DAW's behavior (Pro Tools, Logic, Ableton all respect solo on bounce/export).

### Change

**Export must match playback.** When any source has `isSoloed === true`, both export paths should only include soloed sources. Mute still takes priority: a source that is both soloed and muted is excluded.

The effective logic for export source inclusion becomes:

```
include = !source.isMuted && (!anySoloed || source.isSoloed)
```

This is identical to the `effectiveVolume` logic already in `AudioBridge.tsx`.

### Safety: Confirmation Dialog

To prevent accidental partial exports, the export action should show a confirmation when solo is active:

> **Solo is active**
> Only soloed sources will be exported. This matches what you're currently hearing.
> [Export Soloed Only] [Export All] [Cancel]

"Export All" temporarily ignores solo for that export only. This gives the user an escape hatch without breaking the default "what you hear is what you get" behavior.

### Files Affected

| File | Change |
|------|--------|
| `src/renderer/components/ControlPanel.tsx` | Add solo filtering to both `handleExport` and `handleExportPerSource` |
| `src/renderer/audio/Exporter.ts` | No change — receives filtered source list |
| `AUDIO_ENGINE_SPEC.md` | Update export section to document solo behavior |
| `SONARLOX_FILE_FORMAT_SPEC.md` | No change — `scene.json` already stores `solo` per source; player behavior is read-only and doesn't export |

### Spec Text Update (AUDIO_ENGINE_SPEC.md)

Add after the export section:

> **Solo and export:** Export respects the current solo state. When one or more sources are soloed, only soloed (and non-muted) sources are included in the export. This ensures the exported file matches what the user hears during playback. The UI should present a confirmation dialog when exporting with solo active, offering the option to export all non-muted sources instead.

---

## Change 2: v3.0 Roadmap — Spatial Media Player

### Context

The original v3.0 section in `SONARLOX_FILE_FORMAT_SPEC.md` listed speculative features: network sync, head tracking, collaborative editing, web player export, and spatial audio codec. These remain valid but the section lacked a flagship feature.

Following design discussion, the **MKV/multi-channel spatial media player with per-channel visualization** is now the centerpiece of v3.0. This positions SonarLox as not just an authoring tool but a spatial audio playback platform.

### Why v3.0 (Not v2.0)

v2.0 already has a defined scope: video sync (`sync.type: "video"`), stem separation (Demucs), and effects chain. These are breaking changes to the file format.

The MKV player depends on infrastructure that v2.0 delivers:

- **Video sync** (v2.0) provides the transport locking, timecode handling, and A/V panel that MKV playback needs.
- **Effects/rendering graph** (v2.0) provides per-channel processing hooks the visualizer needs.
- **Stem separation** (v2.0) proves the "multiple audio streams from one source" pattern that MKV channel unpacking reuses.

Building the MKV player on top of these avoids building two hard subsystems simultaneously and ensures the visualizer is battle-tested before adding a complex media pipeline.

### Updated v3.0 Section

Replace the current v3.0 table in `SONARLOX_FILE_FORMAT_SPEC.md` with:

> ### v3.0 — Spatial Media Player
>
> The v3.0 release transforms SonarLox from a spatial audio authoring tool into a spatial media playback platform. The flagship feature is an MKV-aware player that demuxes multi-channel audio streams, maps channels to 3D positions, and visualizes per-channel activity in real time.
>
> | Feature | Notes |
> |---------|-------|
> | MKV / multi-container playback | FFmpeg-based demuxer (main process child process). Stream selection UI showing codec, channel count, language, label per track. |
> | Multi-channel → 3D source mapping | 7.1.4 channels map to positioned sources in the scene. Each channel becomes a source with its own AnalyserNode. Output mode router re-spatializes to user's actual hardware. |
> | Per-channel visualizer | "Speaker Dome" — glowing orbs at standard speaker positions (7.1.4 layout), pulsing with RMS level per channel. Channel strip waterfall sidebar. LFE as room vibration. |
> | Atmos bed channel support | Decode TrueHD/EAC-3 to bed channels (7.1.4). Object metadata requires Dolby SDK (proprietary); bed channels are the MIT-compatible path. |
> | Channel solo in 3D | Click any speaker orb to solo that channel. |
> | Timeline energy heatmap | Horizontal bar: time on x-axis, channels stacked on y-axis, color = energy. Spatial "story" of entire content at a glance. |
> | Network sync (`sync.type: "ntp"`) | Multi-device synchronized playback. |
> | Head tracking (`sync.type: "headtracking"`) | Webcam/gyroscope → listener orientation. |
> | Collaborative editing | Operational transform on `state.json` and `timeline.json`. |
> | Web player export | Static HTML+JS bundle that plays `.snlxp` in a browser. |
> | Spatial audio codec | Compressed spatial stream format (replacing WAV + JSON timeline). |

### New Sync Types for v3.0

Add to the sync type table:

| `sync.type` | Description | Version |
|-------------|-------------|---------|
| `"mkv"` | Lock timeline to MKV container timestamps | v3.0+ |

This is distinct from `"video"` (v2.0) because MKV playback involves stream selection and channel mapping that the simpler video sync mode doesn't handle.

---

## Change 3: Spec Alignment with Codebase

Minor corrections to keep specs accurate against what's actually implemented.

### IAudioEngine Interface vs. WebAudioEngine Reality

The `AUDIO_ENGINE_SPEC.md` defines a single-source `IAudioEngine` interface (e.g., `setSourcePosition(x, y, z)`, `loadFile(buffer)`, `getAnalyserData()`). The actual `WebAudioEngine.ts` is now multi-source with channel-based methods:

| Spec (IAudioEngine) | Actual (WebAudioEngine) |
|---------------------|------------------------|
| `loadFile(buffer)` | `createChannel(id)` + per-channel audio loading |
| `setSourcePosition(x, y, z)` | `setPosition(id, x, y, z)` |
| `setVolume(volume)` | `setVolume(id, volume)` + `setMasterVolume(volume)` |
| `getAnalyserData()` | `getAnalyserSnapshot(id)` per source + master analyser |
| Single source assumed | `Map<SourceId, AudioChannel>` with up to 8 sources |

### Recommendation

Update `IAudioEngine.ts` spec to reflect multi-source reality. The interface should use `SourceId`-parameterized methods. This is a documentation update only — the code is already correct.

### AnalyserSnapshot Type

The spec defines `frequency` as `Uint8Array` (byte frequency data). The actual implementation uses `Float32Array` for both fields via `getFloatFrequencyData()`. Update the spec type:

```typescript
export interface AnalyserSnapshot {
  waveform: Float32Array    // Time-domain data
  frequency: Float32Array   // Frequency data (float, dB scale)
}
```

---

## Implementation Order

1. **Change 1 (solo export)** — DONE. Implemented in Phase 12 ExportDialog. Solo/mute filtering matches AudioBridge playback logic. Confirmation dialog was not added (export dialog makes the behavior clear).
2. **Change 3 (spec alignment)** — Documentation only. Update `AUDIO_ENGINE_SPEC.md` to match multi-source reality and correct `AnalyserSnapshot` type.
3. **Change 2 (v3.0 roadmap)** — Update `SONARLOX_FILE_FORMAT_SPEC.md` future extensions section. No code impact.
