# SonarLox File Format Specification

**Version:** 1.0 Draft
**Date:** March 2026
**Status:** Proposed — for review before implementation

---

## Overview

SonarLox uses two proprietary file formats: a **project file** for editing sessions and a **playback file** for self-contained spatial audio experiences. Both are ZIP containers with JSON manifests and binary audio data.

| Format | Extension | Purpose | Contains editable state | Embeds audio |
|--------|-----------|---------|------------------------|--------------|
| Project | `.sonarlox` | Authoring — save/restore full editor state | Yes | Optional (reference or embedded) |
| Playback | `.snlxp` | Consumption — open-and-listen spatial audio | No | Always embedded |

### Design Principles

1. **ZIP container internally.** Renaming to `.zip` allows inspection with standard tools. Follows the precedent of `.docx`, `.pptx`, Simulink `.slx`, and Ableton `.als`.
2. **JSON manifest for metadata and state.** Human-readable, easy to parse, easy to version.
3. **Raw audio stored as binary files inside the ZIP.** Not base64-encoded — keeps file size small and allows streaming reads.
4. **Forward-compatible.** Unknown keys in JSON are ignored by older readers. New sections can be added without breaking existing parsers.
5. **Extension uniqueness verified.** Neither `.sonarlox` nor `.snlxp` conflict with any known file format as of March 2026.

---

## `.sonarlox` — Project File

The project file captures everything needed to reopen a SonarLox editing session exactly as it was saved.

### Internal ZIP Structure

```
project.sonarlox (ZIP archive)
├── manifest.json          # Project metadata + format version
├── state.json             # Full editor state (serialized Zustand store + extensions)
├── timeline.json          # Keyframe data (empty array if no timeline yet)
├── audio/                 # Audio assets
│   ├── source_0.wav       # Embedded audio (if embed mode)
│   └── source_0.meta.json # Per-source audio metadata
├── video/                 # Reserved for v2.0+ video sync
├── hrir/                  # Reserved for v1.3+ custom HRIR datasets
├── midi/                  # Reserved for v1.2+ MIDI spatial mapping
└── thumbnails/            # Optional
    └── preview.png        # 3D viewport screenshot for file browser preview
```

### manifest.json

```json
{
  "format": "sonarlox-project",
  "version": "1.0.0",
  "createdWith": "SonarLox 1.1.0",
  "createdAt": "2026-03-04T12:00:00Z",
  "updatedAt": "2026-03-04T14:30:00Z",
  "title": "My Spatial Mix",
  "author": "",
  "description": "",
  "duration": 180.5,
  "sampleRate": 44100,
  "audioEmbedMode": "embedded",
  "sourceCount": 1,
  "hasTimeline": true,
  "hasVideoSync": false,
  "monitoringMode": "headphones-hrtf"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `format` | string | Yes | Always `"sonarlox-project"` |
| `version` | semver string | Yes | Format version, not app version |
| `createdWith` | string | Yes | App name + version that wrote the file |
| `createdAt` | ISO 8601 | Yes | First save timestamp |
| `updatedAt` | ISO 8601 | Yes | Last save timestamp |
| `title` | string | No | User-defined project title |
| `author` | string | No | User-defined author name |
| `description` | string | No | Free-text description |
| `duration` | number | Yes | Total audio duration in seconds |
| `sampleRate` | number | Yes | Project sample rate in Hz |
| `audioEmbedMode` | `"embedded"` \| `"referenced"` | Yes | Whether audio is inside the ZIP or external |
| `sourceCount` | number | Yes | Number of audio sources (1 in v1.0) |
| `hasTimeline` | boolean | Yes | Whether timeline keyframes exist |
| `hasVideoSync` | boolean | Yes | Whether video sync is configured (always `false` in v1.x) |
| `monitoringMode` | string | Yes | Output mode used during editing (e.g., `"headphones-hrtf"`) |

### state.json

Captures the full editor state. This is essentially the serialized Zustand store plus any additional editor preferences.

```json
{
  "source": {
    "position": [2.5, 0.0, -1.3],
    "audioRef": "source_0",
    "type": "file",
    "testToneType": null,
    "volume": 1.0,
    "mute": false,
    "solo": false
  },
  "listener": {
    "position": [0.0, 0.0, 0.0],
    "orientation": {
      "forward": [0.0, 0.0, -1.0],
      "up": [0.0, 1.0, 0.0]
    }
  },
  "spatial": {
    "distanceModel": "inverse",
    "refDistance": 1.0,
    "maxDistance": 50.0,
    "rolloffFactor": 1.0,
    "panningModel": "HRTF"
  },
  "room": {
    "dimensions": [20.0, 8.0, 15.0],
    "showGrid": true,
    "showDistanceRings": true,
    "acoustics": null
  },
  "transport": {
    "volume": 0.85,
    "loop": true,
    "playbackPosition": 42.3
  },
  "camera": {
    "position": [5.0, 8.0, 10.0],
    "target": [0.0, 0.0, 0.0]
  },
  "rendering": {
    "monitoringMode": "headphones-hrtf",
    "outputModes": {
      "headphones-hrtf": { "enabled": true, "panningModel": "HRTF", "hrirDataset": null },
      "speakers-stereo": { "enabled": true, "panningModel": "equalpower", "crossfeedAmount": 0.0 },
      "speakers-surround": { "enabled": false, "channelLayout": null, "channelMap": null },
      "ambisonics": { "enabled": false, "order": null, "format": null }
    }
  },
  "sync": null,
  "preferences": {
    "selectedOutputDevice": null,
    "fftSize": 2048
  }
}
```

**Rendering in the project context:** `monitoringMode` indicates which output mode the editor is currently using for real-time monitoring. When the project is exported to `.snlxp`, this becomes `authoredFor` in the playback file — communicating to the listener how the mix was monitored.

**Sync reservation:** The `sync` field is `null` in v1.x. When video sync is implemented (v2.0+), this field will hold a reference to the video file and timecode configuration, mirroring the playback file's sync schema.

**Source types:**

| `type` | Meaning | `audioRef` points to |
|--------|---------|---------------------|
| `"file"` | User-loaded audio file | Entry in `audio/` directory |
| `"test-tone"` | Built-in test tone | Null — `testToneType` specifies which |

**Audio reference resolution:**

- When `audioEmbedMode` is `"embedded"`: `audioRef: "source_0"` resolves to `audio/source_0.wav` inside the ZIP.
- When `audioEmbedMode` is `"referenced"`: `audio/source_0.meta.json` contains the external file path.

### audio/source_0.meta.json

```json
{
  "originalFileName": "dialogue_take3.wav",
  "originalPath": "/Users/me/Projects/film/audio/dialogue_take3.wav",
  "format": "wav",
  "channels": 2,
  "sampleRate": 44100,
  "bitDepth": 16,
  "durationSeconds": 180.5,
  "sha256": "a1b2c3d4e5f6..."
}
```

The `sha256` hash enables integrity checking — if the referenced file has changed since the project was saved, the app can warn the user.

### timeline.json

Stores keyframe automation data for source and listener position over time.

```json
{
  "version": "1.0.0",
  "tracks": [
    {
      "id": "source_0_position",
      "target": "source.position",
      "interpolation": "catmull-rom",
      "keyframes": [
        { "time": 0.0,   "value": [-5.0, 0.0, 0.0] },
        { "time": 30.0,  "value": [0.0, 0.0, -3.0] },
        { "time": 60.0,  "value": [5.0, 0.0, 0.0] },
        { "time": 90.0,  "value": [0.0, 2.0, 3.0] }
      ]
    },
    {
      "id": "listener_0_position",
      "target": "listener.position",
      "interpolation": "linear",
      "keyframes": []
    }
  ]
}
```

**Keyframe fields:**

| Field | Type | Notes |
|-------|------|-------|
| `time` | number | Seconds from start of audio |
| `value` | `[x, y, z]` | Position in meters (room coordinate space) |

**Interpolation modes:**

| Mode | Behavior |
|------|----------|
| `"linear"` | Straight-line interpolation between keyframes |
| `"catmull-rom"` | Smooth spline through keyframe points (default) |
| `"step"` | Hold previous value until next keyframe (instant jump) |

**Track target strings:** Use dot-notation paths into `state.json`. Initially supports `source.position` and `listener.position`. Extensible to `source.volume`, `spatial.rolloffFactor`, etc. in future versions.

---

## `.snlxp` — Playback File

The playback file is a self-contained spatial audio experience. It bundles the rendered audio, timeline data, spatial parameters, and room geometry — everything needed to play back the spatial mix without any external dependencies.

### Internal ZIP Structure

```
mix.snlxp (ZIP archive)
├── manifest.json          # Playback metadata + format version
├── scene.json             # Spatial config, room, listener, rendering modes, sync
├── timeline.json          # Keyframe data (required — this is what makes it spatial)
├── audio/                 # Audio assets (always embedded)
│   └── source_0.wav       # Source audio — always present
├── video/                 # Reserved for v2.0+ video sync
├── hrir/                  # Reserved for v1.3+ custom HRIR datasets
└── thumbnails/
    └── preview.png        # Optional viewport screenshot
```

Reserved directories (`video/`, `hrir/`) are empty in v1.x but establish the namespace. Old readers ignore unknown ZIP entries per the forward compatibility rules.

### manifest.json

```json
{
  "format": "sonarlox-playback",
  "version": "1.0.0",
  "createdWith": "SonarLox 1.1.0",
  "exportedAt": "2026-03-04T15:00:00Z",
  "exportedFrom": "My Spatial Mix",
  "title": "My Spatial Mix — Spatial",
  "author": "",
  "description": "Spatial audio scene with dialogue movement across room",
  "duration": 180.5,
  "sampleRate": 44100,
  "sourceCount": 1,
  "hasTimeline": true,
  "hasVideoSync": false
}
```

Note: The title no longer says "Binaural" — because the playback file is output-mode-agnostic. The same file renders to headphones, speakers, or surround. `exportedFrom` references the project title, creating a lightweight link back to the source project without requiring the project file. `hasTimeline` and `hasVideoSync` are quick-read flags so file browsers or libraries can display capabilities without parsing the full ZIP.

### scene.json

A simplified, read-only subset of the project state — only what the player needs. Critically, this stores the spatial *intent* (positions, automation, room geometry) rather than a pre-rendered mix. The player renders in real time to whatever output mode the user selects.

```json
{
  "listener": {
    "position": [0.0, 0.0, 0.0],
    "orientation": {
      "forward": [0.0, 0.0, -1.0],
      "up": [0.0, 1.0, 0.0]
    }
  },
  "spatial": {
    "distanceModel": "inverse",
    "refDistance": 1.0,
    "maxDistance": 50.0,
    "rolloffFactor": 1.0,
    "panningModel": "HRTF"
  },
  "room": {
    "dimensions": [20.0, 8.0, 15.0],
    "acoustics": null
  },
  "sources": [
    {
      "id": "source_0",
      "audioFile": "audio/source_0.wav",
      "initialPosition": [-5.0, 0.0, 0.0],
      "volume": 1.0,
      "mute": false,
      "solo": false
    }
  ],
  "rendering": {
    "defaultOutputMode": "headphones-hrtf",
    "authoredFor": "headphones-hrtf",
    "outputModes": {
      "headphones-hrtf": {
        "enabled": true,
        "panningModel": "HRTF",
        "hrirDataset": null
      },
      "speakers-stereo": {
        "enabled": true,
        "panningModel": "equalpower",
        "crossfeedAmount": 0.0
      },
      "speakers-surround": {
        "enabled": false,
        "channelLayout": null,
        "channelMap": null
      },
      "ambisonics": {
        "enabled": false,
        "order": null,
        "format": null
      }
    }
  },
  "sync": null
}
```

#### Output Modes

The playback file stores spatial intent, not a baked mix. The player re-spatializes in real time based on which output mode the user selects. This means a single `.snlxp` file works on headphones, desktop speakers, surround systems, and future output targets.

| Mode | Key | v1.x | Description |
|------|-----|------|-------------|
| Headphones (HRTF) | `headphones-hrtf` | Implemented | Binaural 3D via HRTF convolution. Requires headphones. |
| Speakers (stereo) | `speakers-stereo` | Implemented | Stereo panning + distance attenuation for L/R desktop speakers. |
| Speakers (surround) | `speakers-surround` | Reserved | 5.1 / 7.1 channel-based panning. `channelLayout` and `channelMap` define routing. |
| Ambisonics | `ambisonics` | Reserved | B-format output for VR/360 platforms. `order` (1–3) and `format` (`FuMa` or `ACN-SN3D`). |

**`defaultOutputMode`** — what the player selects on first open. The author sets this when exporting.

**`authoredFor`** — the output mode the author was monitoring while editing. This is metadata only (informational for the listener), but helps communicate intent. A mix authored for headphones may not translate perfectly to surround without adjustment.

**`enabled`** flags indicate which modes the author has verified. A player can still attempt any mode, but should warn the user if they select a mode flagged `false`: *"This mix was authored for headphones. Surround rendering has not been verified by the author."*

**Reserved mode fields** (`channelLayout`, `channelMap`, `order`, `format`) are `null` in v1.x. Their schemas will be defined when the corresponding features are implemented. Old readers ignore unknown keys, so adding these later is a non-breaking change.

#### Rendering Pipeline (Conceptual)

```
Source audio (WAV) 
  → Timeline interpolation (position at current time)
    → Output mode router
      ├─ headphones-hrtf  → PannerNode (HRTF) or HRIR convolution → stereo out
      ├─ speakers-stereo  → StereoPannerNode (equalpower) → stereo out
      ├─ speakers-surround → channel panner → 5.1/7.1 out  [future]
      └─ ambisonics        → B-format encoder → ambi out    [future]
```

The key architectural insight: everything before the "Output mode router" is shared. Source loading, timeline evaluation, and position calculation happen once. Only the final spatialization step differs per output mode. This keeps the implementation clean and means new output modes don't require changes to the timeline, file format, or scene graph — only a new rendering backend.

#### Sync Section

The `sync` field is reserved for video and external clock synchronization. In v1.x it is always `null`. The planned schema for v2.0:

```json
{
  "sync": {
    "type": "video",
    "videoRef": "video/scene_01.mp4",
    "framerate": 23.976,
    "timecodeOffset": 0.0,
    "startFrame": 0,
    "endFrame": null,
    "dropFrame": false
  }
}
```

| `sync.type` | Description | Version |
|-------------|-------------|---------|
| `null` | No sync — freestanding spatial audio | v1.0+ |
| `"video"` | Lock timeline to video file timecode | v2.0+ |
| `"ltc"` | Lock to Linear Timecode (external clock) | v2.x+ |
| `"mtc"` | Lock to MIDI Timecode | v2.x+ |
| `"ntp"` | Network sync for multi-device playback | v3.0+ |

This is the foundation for the movie use case: a `.snlxp` file references a video, the timeline keyframes are authored against that video's timecode, and the player locks spatial audio playback to video frames. The user watches the movie with spatialized audio rendered in real time to their chosen output mode.

### timeline.json

Identical schema to the project file's `timeline.json`. The player reads this to animate source positions during playback, re-spatializing in real time through the audio engine.

### Player Behavior

When a `.snlxp` file is opened:

1. App detects file type and switches to **Player Mode** — a simplified UI with no editing controls.
2. 3D viewport shows the room, listener, and source(s).
3. **Output mode selector** — user picks headphones (HRTF), speakers (stereo), or any other enabled mode. Defaults to `rendering.defaultOutputMode`.
4. If `sync.type` is `"video"` and the video file is available, a video panel appears alongside the 3D viewport.
5. Transport controls: play, pause, stop, scrub. If video-synced, scrubbing moves both audio and video.
6. During playback, source positions animate along their timeline tracks.
7. Audio is spatialized **in real time** using the selected output mode and embedded spatial config.
8. A "headphones recommended" indicator appears when `authoredFor` is `"headphones-hrtf"` and the user has selected a speaker mode.

Player Mode is read-only. To edit, the user must have the original `.sonarlox` project file.

---

## Implementation Details

### Reading and Writing (Electron + Node.js)

Both formats are standard ZIP files. Use the `archiver` package (already MIT-licensed) for writing and `yauzl` or Node.js built-in `zlib` for reading.

```typescript
// Writing a .sonarlox file
import archiver from 'archiver'

async function saveProject(path: string, state: ProjectState): Promise<void> {
  const output = fs.createWriteStream(path)
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(output)

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
  archive.append(JSON.stringify(state, null, 2), { name: 'state.json' })
  archive.append(JSON.stringify(timeline, null, 2), { name: 'timeline.json' })

  // Embed audio if configured
  if (embedMode === 'embedded') {
    archive.file(audioFilePath, { name: 'audio/source_0.wav' })
  }
  archive.append(JSON.stringify(audioMeta, null, 2), { name: 'audio/source_0.meta.json' })

  await archive.finalize()
}
```

```typescript
// Reading a .sonarlox file
import { Open } from 'unzipper'

async function loadProject(path: string): Promise<ProjectState> {
  const directory = await Open.file(path)
  const manifestFile = directory.files.find(f => f.path === 'manifest.json')
  const manifest = JSON.parse(await manifestFile.buffer().then(b => b.toString()))

  if (manifest.format !== 'sonarlox-project') {
    throw new Error('Not a SonarLox project file')
  }
  // ... read state.json, timeline.json, audio files
}
```

### File Association (Electron)

Register both extensions in the Electron builder config:

```json
{
  "fileAssociations": [
    {
      "ext": "sonarlox",
      "name": "SonarLox Project",
      "description": "SonarLox Spatial Audio Project",
      "mimeType": "application/x-sonarlox-project",
      "role": "Editor",
      "icon": "resources/icons/sonarlox-project"
    },
    {
      "ext": "snlxp",
      "name": "SonarLox Playback",
      "description": "SonarLox Spatial Audio Playback",
      "mimeType": "application/x-sonarlox-playback",
      "role": "Viewer",
      "icon": "resources/icons/sonarlox-playback"
    }
  ]
}
```

### IPC Handlers (Main Process)

```typescript
// src/main/ipc.ts — add alongside existing file dialog handlers

ipcMain.handle('project:save', async (event, { filePath, state, timeline, audioBuffer }) => {
  // Build and write .sonarlox ZIP
})

ipcMain.handle('project:open', async (event) => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [
      { name: 'SonarLox Project', extensions: ['sonarlox'] },
      { name: 'SonarLox Playback', extensions: ['snlxp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  // Read and return parsed state
})

ipcMain.handle('project:export-playback', async (event, { filePath, scene, timeline, audioBuffer }) => {
  // Build and write .snlxp ZIP
})
```

---

## Versioning and Migration

### Semantic Versioning for Format

The `version` field in `manifest.json` follows semver:

- **Major** (2.0.0): Breaking changes — old readers cannot open new files. Example: completely restructured JSON schema.
- **Minor** (1.1.0): New fields or sections added — old readers can still open the file (unknown keys ignored). Example: adding `listener.position` tracks to timeline.
- **Patch** (1.0.1): Bug fixes to the spec, no structural changes.

### Forward Compatibility Rules

1. **Unknown JSON keys are silently ignored.** A v1.0 reader encountering a v1.1 file with extra fields will still load correctly.
2. **Unknown files in the ZIP are ignored.** Future versions can add new entries (e.g., `effects.json`) without breaking old readers.
3. **Missing optional files use defaults.** If `timeline.json` is absent, the reader assumes an empty timeline (static position).
4. **Major version mismatch = reject with clear error.** "This file requires SonarLox 2.x or later."

### Migration Path

When the app opens a file with an older format version:

```typescript
function migrateState(manifest: Manifest, state: any): ProjectState {
  if (semver.lt(manifest.version, '1.1.0')) {
    // v1.0 → v1.1: listener position was added
    state.listener = state.listener || {
      position: [0, 0, 0],
      orientation: { forward: [0, 0, -1], up: [0, 1, 0] }
    }
  }
  // ... future migrations
  return state as ProjectState
}
```

---

## Future Extensions (v1.x and beyond)

These additions would be additive (minor version bumps) and backwards-compatible unless noted:

### v1.x — Additive (non-breaking)

| Feature | Files affected | Version | Notes |
|---------|---------------|---------|-------|
| Multiple sources | `state.json` → `sources[]` array, multiple `audio/source_N.*` | 1.1.0 | Per-source volume, mute, solo |
| Speakers (stereo) output mode | `rendering.outputModes.speakers-stereo` enabled | 1.1.0 | StereoPannerNode + distance attenuation |
| MIDI spatial mapping | New `midi/mapping.json` with CC→axis config | 1.2.0 | 14-bit CC pairs for smooth positioning |
| MIDI import/export | `midi/` directory with `.mid` files | 1.2.0 | Import automation from DAW, export for reuse |
| FFmpeg export presets | New `export-presets.json` | 1.2.0 | MP3, FLAC, AAC, OGG format options |
| Room acoustics presets | `state.json` → `room.acoustics` section | 1.3.0 | Material presets, early reflections |
| Custom HRIR datasets | `hrir/` directory with impulse response WAVs | 1.3.0 | MIT KEMAR, CIPIC, or user-measured |
| Surround output mode | `rendering.outputModes.speakers-surround` | 1.4.0 | 5.1/7.1 channel mapping |
| Ambisonics output mode | `rendering.outputModes.ambisonics` | 1.4.0 | B-format for YouTube 360/VR |

### v2.0 — Breaking changes

| Feature | Files affected | Notes |
|---------|---------------|-------|
| Video sync | `sync` section populated, `video/` directory with media | Timeline locks to video timecode |
| Stem separation | Multiple `audio/stem_N.*` per source, `stems.json` manifest | AI-based (Demucs) dialogue/music/FX split |
| Effects chain | New `effects.json` with per-source and bus processing | Reverb, EQ, compression — requires new rendering graph |

### v3.0+ — Speculative

| Feature | Notes |
|---------|-------|
| Network sync (`sync.type: "ntp"`) | Multi-device synchronized playback |
| Head tracking (`sync.type: "headtracking"`) | Webcam/gyroscope → listener orientation |
| Collaborative editing | Operational transform on `state.json` and `timeline.json` |
| Web player export | Static HTML+JS bundle that plays `.snlxp` in a browser |
| Spatial audio codec | Compressed spatial stream format (replacing WAV + JSON timeline) |

---

## File Size Estimates

| Scenario | Audio | Project `.sonarlox` | Playback `.snlxp` |
|----------|-------|--------------------|--------------------|
| 30s mono WAV, 44.1kHz 16-bit | ~2.6 MB | ~2.7 MB (embedded) | ~2.7 MB |
| 3min stereo WAV, 44.1kHz 16-bit | ~31 MB | ~31 MB (embedded) | ~31 MB |
| 3min stereo WAV, referenced | ~31 MB on disk | ~5 KB (no audio) | N/A (always embeds) |
| 3min MP3 source, embedded as WAV | ~3 MB (MP3) | ~31 MB (decoded WAV) | ~31 MB |

**Note:** Audio is always stored as uncompressed WAV inside the ZIP for instant decode during playback. The ZIP's deflate compression provides ~5-15% reduction on WAV data. Future versions may support compressed audio formats inside the container to reduce file size.

---

## Security Considerations

- **Path traversal:** When extracting ZIP entries, validate that all paths are relative and within expected directories. Reject entries containing `..`, absolute paths, or symlinks.
- **File size limits:** Set a maximum total uncompressed size (e.g., 2 GB) to prevent zip bombs.
- **Manifest validation:** Verify `format` and `version` fields before processing any other content.
- **Audio integrity:** When `audioEmbedMode` is `"referenced"`, verify the `sha256` hash before loading external audio files.
- **Untrusted files:** When opening files from external sources, treat all JSON content as untrusted input — validate schema before deserializing into application state.
