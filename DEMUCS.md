# DEMUCS.md — Stem Separation Integration Spec

## What This Is

Auto-spatialisation via AI stem separation. User drops any stereo audio file →
Demucs splits it into stems (drums, bass, vocals, other) → each stem is automatically
added as a SonarLox source with a sensible default 3D position → user puts on
headphones and hears the song re-spatialised in 3D. Immediately.

No manual positioning. No prior knowledge of spatial audio required.
The wow moment is available in under 30 seconds on GPU hardware.

---

## Phase / Version

**Phase 20 — v1.2.0**

Replaces the originally planned Multi-Camera System (slides to Phase 21).
This is the first feature since core HRTF that creates an explainable one-sentence
pitch: *"Drop any song, hear each instrument in a different place around your head."*

---

## User Flow

```
1. User has a source loaded (or drops a new audio file)
2. User clicks "Spatialise Stems" button in the Sources section
3. SonarLox checks for Demucs (see Detection below)
   a. Found → proceed to step 4
   b. Not found → show Setup Modal (see Setup below)
4. Progress modal opens: "Separating stems... ~15 seconds"
5. Demucs runs as a subprocess via IPC
6. On completion: 4 new sources added to the session
   - Drums  → [0,   0,  -3]   (centre, slightly forward)
   - Bass   → [0,  -1,  -2]   (centre, slightly low)
   - Vocals → [0,   0.5, -4]  (centre, slightly above, furthest forward)
   - Other  → [-2,  0,  -2]   (left, guitar/keys/etc)
7. Original source is muted (not deleted)
8. Toast: "4 stems added. Original source muted."
9. Transport plays automatically if it was already playing
```

---

## Hardware Tiers & UX

| Tier | Detection | Time (4-min song) | UX |
|------|-----------|-------------------|----|
| NVIDIA GPU (CUDA) | `torch.cuda.is_available()` | 10–30s | Silent progress bar |
| Apple Silicon (MPS) | `torch.backends.mps.is_available()` | ~12s | Silent progress bar |
| CPU only | Fallback | 3–5 minutes | Warning + background option |

For CPU-only users, show a dialog before starting:

```
Stem separation on CPU takes 3–5 minutes for a typical song.
Run in background while you work?

[ Run in Background ]  [ Cancel ]
```

Running in background: progress shown in a persistent status strip at the bottom
of the Control Panel (same aesthetic as the existing toast system). User can cancel.

---

## Demucs Detection

Detection runs once at startup and is cached in a Zustand slice (`DemucsSlice`).
Re-runs if the user manually triggers "Check again" in settings.

Detection order:

```
1. Check if Python is available: `python --version` or `python3 --version`
2. Check if demucs is importable: `python -m demucs --help`
3. Check GPU availability: run probe script (see below)
4. Store result in DemucsSlice: { available, gpuAvailable, gpuType, pythonPath }
```

Probe script (`src/main/demucs/probe.py`):

```python
import json, sys
result = {"demucs": False, "cuda": False, "mps": False}
try:
    import demucs
    result["demucs"] = True
except ImportError:
    pass
try:
    import torch
    result["cuda"] = torch.cuda.is_available()
    result["mps"] = hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
except ImportError:
    pass
print(json.dumps(result))
```

Run via IPC: `python src/main/demucs/probe.py` — parse stdout as JSON.

---

## Setup Modal

Shown when Demucs is not detected. Non-blocking — user can dismiss and use the app normally.

Content:

```
╔══════════════════════════════════════════════════╗
║  Stem Separation Setup                           ║
║                                                  ║
║  SonarLox can automatically split any audio      ║
║  into stems (drums, bass, vocals, other) and     ║
║  place each one in 3D space.                     ║
║                                                  ║
║  Requires Python 3.8+ and ~500MB download.       ║
║                                                  ║
║  [ Install Automatically ]                       ║
║  [ I'll install manually → see docs ]            ║
║  [ Not now ]                                     ║
╚══════════════════════════════════════════════════╝
```

Auto-install runs:
```bash
pip install -U demucs
```
via IPC subprocess with stdout streamed back to a progress log in the modal.

Manual install docs link: points to `docs/DEMUCS_SETUP.md` (a separate user-facing doc,
not this file).

---

## IPC Architecture

Follows the exact pattern of existing IPC handlers in `src/main/ipc.ts`.

### New IPC channels

```typescript
// Probe — runs once at startup
ipcMain.handle('demucs:probe', async () => {
  // runs probe.py, returns DemucsProbeResult
})

// Separate — main operation
ipcMain.handle('demucs:separate', async (_event, options: DemucsOptions) => {
  // spawns demucs subprocess, streams progress events
  // returns DemucsResult on completion
})

// Cancel — user aborts a running separation
ipcMain.handle('demucs:cancel', async () => {
  // kills the subprocess if running
})

// Install — auto-install flow
ipcMain.handle('demucs:install', async (_event) => {
  // runs pip install -U demucs with streamed output
})
```

Progress is streamed via `ipcMain.emit` / `webContents.send`:

```typescript
// Main process sends during separation:
event.sender.send('demucs:progress', { percent: 42, stage: 'separating' })

// Renderer listens via preload bridge:
window.api.onDemucsProgress((data) => { ... })
```

### New types (`src/renderer/types/index.ts`)

```typescript
export interface DemucsProbeResult {
  available: boolean
  gpuAvailable: boolean
  gpuType: 'cuda' | 'mps' | 'cpu'
  pythonPath: string | null
  version: string | null
}

export interface DemucsOptions {
  inputFilePath: string   // absolute path to source audio file
  outputDir: string       // temp dir, e.g. os.tmpdir()/sonarlox-stems/
  model: 'htdemucs' | 'htdemucs_ft' | 'htdemucs_6s'
  device: 'cuda' | 'mps' | 'cpu'
}

export interface DemucsStem {
  name: 'drums' | 'bass' | 'vocals' | 'other' | 'guitar' | 'piano'
  filePath: string         // absolute path to output WAV
  defaultPosition: SourcePosition
}

export interface DemucsResult {
  success: boolean
  stems: DemucsStem[]
  error?: string
  durationMs: number
}
```

### Preload bridge additions (`src/preload/index.ts`)

```typescript
demucsProbe: () => ipcRenderer.invoke('demucs:probe'),
demucsSeparate: (options: DemucsOptions) => ipcRenderer.invoke('demucs:separate', options),
demucsCancel: () => ipcRenderer.invoke('demucs:cancel'),
demucsInstall: () => ipcRenderer.invoke('demucs:install'),
onDemucsProgress: (cb: (data: { percent: number; stage: string }) => void) =>
  ipcRenderer.on('demucs:progress', (_e, data) => cb(data)),
```

---

## Main Process: Subprocess Handler (`src/main/demucs/runner.ts`)

```typescript
import { spawn, ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'

let activeProcess: ChildProcess | null = null

export async function runDemucs(
  options: DemucsOptions,
  onProgress: (percent: number, stage: string) => void
): Promise<DemucsResult> {

  const outputDir = join(tmpdir(), 'sonarlox-stems', Date.now().toString())

  const args = [
    '-m', 'demucs',
    '--out', outputDir,
    '--name', options.model,
    '--device', options.device,
    options.inputFilePath
  ]

  return new Promise((resolve, reject) => {
    activeProcess = spawn(options.pythonPath ?? 'python', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    activeProcess.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      // Demucs writes progress to stderr in format: "Separating track... 42%"
      const match = line.match(/(\d+)%/)
      if (match) onProgress(parseInt(match[1]), 'separating')
    })

    activeProcess.on('close', (code) => {
      activeProcess = null
      if (code === 0) {
        resolve(buildResult(outputDir, options))
      } else {
        reject(new Error(`Demucs exited with code ${code}`))
      }
    })
  })
}

export function cancelDemucs(): void {
  activeProcess?.kill('SIGTERM')
  activeProcess = null
}
```

---

## Default Stem Positions

These are psychoacoustically motivated defaults, not arbitrary.
User can adjust positions freely after stems are created.

```typescript
export const STEM_DEFAULTS: Record<string, { position: SourcePosition; color: string }> = {
  drums:  { position: [0,    0,   -2.5], color: '#ff4444' }, // centre, grounded
  bass:   { position: [0,   -0.8, -2],   color: '#ff8800' }, // centre, low
  vocals: { position: [0,    0.4, -4],   color: '#44aaff' }, // centre, elevated, close
  other:  { position: [-2.5, 0,  -2],   color: '#88ff44' }, // left field (guitar, keys)
  guitar: { position: [-2,   0,  -2],   color: '#ffdd00' }, // left
  piano:  { position: [2,    0,  -2],   color: '#cc88ff' }, // right
}
```

Rationale:
- **Drums at centre** — maintains mono compatibility, most natural for rhythm
- **Bass low** — low frequencies are omnidirectional in real acoustics; slight Y offset signals subwoofer-like weight without psychoacoustic confusion
- **Vocals elevated and forward** — matches natural concert/performance experience, front of the stage above the floor
- **Guitars/Other left** — standard pop mix convention, preserves familiarity while adding depth

---

## New Zustand Slice: `DemucsSlice`

Add to `src/renderer/stores/slices/DemucsSlice.ts`:

```typescript
export interface DemucsSlice {
  demucsProbe: DemucsProbeResult | null
  demucsStatus: 'idle' | 'probing' | 'separating' | 'installing' | 'error'
  demucsProgress: number  // 0-100
  demucsError: string | null

  setDemucsProbe: (probe: DemucsProbeResult) => void
  setDemucsStatus: (status: DemucsSlice['demucsStatus']) => void
  setDemucsProgress: (p: number) => void
  setDemucsError: (e: string | null) => void
}
```

---

## Renderer: `useDemucsSeparate` Hook

`src/renderer/hooks/useDemucsSeparate.ts`

This hook encapsulates the full separation flow and source creation.

```typescript
export function useDemucsSeparate() {
  const addSource = useAppStore(s => s.addSource)
  const setMuted = useAppStore(s => s.setSourceMuted)
  const { setDemucsStatus, setDemucsProgress } = useAppStore(s => s)
  const probe = useAppStore(s => s.demucsProbe)

  const separate = useCallback(async (sourceId: string, filePath: string) => {
    setDemucsStatus('separating')
    setDemucsProgress(0)

    window.api.onDemucsProgress(({ percent }) => setDemucsProgress(percent))

    const result = await window.api.demucsSeparate({
      inputFilePath: filePath,
      outputDir: '',  // runner determines this
      model: 'htdemucs',
      device: probe?.gpuType ?? 'cpu',
    })

    if (!result.success) {
      setDemucsStatus('error')
      return
    }

    // Mute original source
    setMuted(sourceId, true)

    // Add each stem as a new source
    for (const stem of result.stems) {
      const defaults = STEM_DEFAULTS[stem.name]
      addSource({
        label: stem.name,
        position: defaults.position,
        color: defaults.color,
        audioFilePath: stem.filePath,
        sourceType: 'file',
      })
    }

    setDemucsStatus('idle')
  }, [probe, addSource, setMuted, setDemucsStatus, setDemucsProgress])

  return { separate }
}
```

---

## UI: "Spatialise Stems" Button

Location: Sources section of the ControlPanel, below the source list.
Only visible when at least one file source is loaded.

```tsx
// In SourcesSection or similar
<button
  className="btn btn--accent"
  onClick={() => separate(selectedSourceId, selectedSource.audioFilePath)}
  disabled={demucsStatus === 'separating' || !demucsProbe?.available}
  title={!demucsProbe?.available ? 'Demucs not installed — click to set up' : undefined}
>
  {demucsStatus === 'separating'
    ? `Separating… ${demucsProgress}%`
    : '✦ Spatialise Stems'}
</button>

{!demucsProbe?.available && (
  <span className="setup-hint" onClick={openSetupModal}>
    Setup required
  </span>
)}
```

---

## File Layout

```
src/
├── main/
│   ├── demucs/
│   │   ├── probe.py          # Hardware/availability probe script
│   │   └── runner.ts         # Subprocess spawn + progress streaming
│   └── ipc.ts                # Add new demucs:* handlers here
├── renderer/
│   ├── hooks/
│   │   └── useDemucsSeparate.ts
│   └── stores/
│       └── slices/
│           └── DemucsSlice.ts
docs/
└── DEMUCS_SETUP.md           # User-facing setup guide (separate file)
```

---

## Model Selection

Default model: `htdemucs` (4 stems: drums, bass, vocals, other).
Fast, well-tested, works on all hardware tiers.

Optional upgrade path (not in v1.2, noted for future):
- `htdemucs_ft` — fine-tuned, slightly better quality, same stems
- `htdemucs_6s` — adds guitar + piano stems, requires more VRAM

Do not expose model selection in the UI for v1.2. Use `htdemucs` always.
Model selection can be added to Settings in a later phase once the feature is stable.

---

## Temp File Cleanup

Stem WAV files are written to `os.tmpdir()/sonarlox-stems/<timestamp>/`.

Cleanup strategy:
- On session close (`app.on('before-quit')`): delete all dirs under `sonarlox-stems/`
- On new separation: delete dirs older than 24 hours
- Do NOT delete on source removal — user may re-add the source from undo

---

## Error States

| Error | Message shown | Recovery |
|-------|--------------|----------|
| Python not found | "Python 3.8+ required. Install Python then restart SonarLox." | Link to python.org |
| Demucs not installed | Show Setup Modal | Auto-install button |
| Out of memory (CUDA) | "GPU out of memory. Retry on CPU?" | Retry button with device=cpu |
| Input file not accessible | "Cannot read source file. Re-add the source and try again." | Dismiss |
| Subprocess crash (exit ≠ 0) | "Stem separation failed. Check that the audio file is a valid MP3 or WAV." | Dismiss |

---

## Testing Checklist

- [ ] Probe returns correct result on CUDA machine
- [ ] Probe returns correct result on CPU-only machine  
- [ ] Probe returns correct result on Mac with Apple Silicon
- [ ] Setup modal appears when Demucs not installed
- [ ] Auto-install completes and re-runs probe
- [ ] Separation completes on GPU, 4 stems added, original muted
- [ ] Separation completes on CPU, progress shown in status strip
- [ ] Cancel mid-separation kills subprocess, no partial sources added
- [ ] Temp files cleaned on app quit
- [ ] All 4 stem sources play correctly in spatial audio
- [ ] Undo after stem addition removes all 4 stems and un-mutes original
- [ ] Error modal shows on OOM, retry on CPU succeeds

---

## Implementation Order (for Claude Code)

1. `src/main/demucs/probe.py` — Python probe script
2. `src/main/demucs/runner.ts` — subprocess runner
3. `DemucsSlice.ts` — Zustand slice
4. New IPC handlers in `src/main/ipc.ts`
5. Preload bridge additions in `src/preload/index.ts`
6. `ElectronAPI` type additions in `src/renderer/types/index.ts`
7. `useDemucsSeparate.ts` hook
8. UI button in Sources section
9. Setup modal component
10. Startup probe call in app init

Each step is independently testable. Steps 1-6 are pure plumbing with
no visual output. Steps 7-10 are where the feature becomes visible.

Steps 1-6 are good candidates for local model execution.
Steps 7-10 benefit from cloud review since they touch existing UI components.
