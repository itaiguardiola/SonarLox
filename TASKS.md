# Codebase Audit Tasks

Generated 2026-03-05 by cloud Claude audit pass. All tasks completed same day.

**Result: 38 ESLint warnings -> 0. Typecheck clean.**

---

## Phase 1: Mechanical Cleanup (16 tasks)

### TASK-001: Remove unused imports in ExportDialog.tsx [DONE]
**Files:** `src/renderer/components/ExportDialog.tsx`
Removed `useRef`, `exportBinauralWav`, unused `progress`/`setExportProgress` state.

### TASK-002: Remove unused imports in PluginEditor.tsx [DONE]
**Files:** `src/renderer/components/PluginEditor.tsx`
Removed unused `useState` import.

### TASK-003: Remove unused variables in SourcePropertiesSection.tsx [DONE]
**Files:** `src/renderer/components/sections/SourcePropertiesSection.tsx`
Removed `isPlaying`, `useTransportStore` import, and `isMidiSource`.

### TASK-004: Remove unused type imports in projectSerializer.ts [DONE]
**Files:** `src/renderer/audio/projectSerializer.ts`
Removed `SourcePosition` and `EasingType` type imports.

### TASK-005: Remove unused constants in SoundSource.tsx [DONE]
**Files:** `src/renderer/components/SoundSource.tsx`
Removed `MIN_BOUNDS` and `MAX_BOUNDS` constants.

### TASK-006: Remove unused constants in TimelinePanel.tsx [DONE]
**Files:** `src/renderer/components/TimelinePanel.tsx`
Removed `HEADER_WIDTH` and `PLAYHEAD_GLOW` constants.

### TASK-007: Remove unused catch parameter in App.tsx [DONE]
**Files:** `src/renderer/App.tsx`
Changed `catch (err)` to bare `catch`.

### TASK-008: Remove dead export export51WavSingle in Exporter.ts [DONE]
**Files:** `src/renderer/audio/Exporter.ts`
Removed entire unused function (never imported anywhere).

### TASK-009: Extract shared clamp utility [DONE]
**Files:** `src/renderer/utils/math.ts` (new), `SoundSource.tsx`, `VideoScreen.tsx`
Extracted duplicate `clamp()` and `THROTTLE_MS` to shared utils.

### TASK-010: Fix `any` types in PluginVisualizers.tsx [DONE]
**Files:** `src/renderer/components/PluginVisualizers.tsx`
Typed props as `PluginInstance` and `AudioSource[]`.

### TASK-011: Fix `any` casts in PluginPanel.tsx [DONE]
**Files:** `src/renderer/components/PluginPanel.tsx`
Replaced `as any` with `as SourceId | 'master'`, added SourceId import.

### TASK-012: Fix `any` type in PluginParameterDef [DONE]
**Files:** `src/renderer/plugins/types.ts`
Changed `defaultValue: any` to `defaultValue: PluginParameterValue`.

### TASK-013: Fix `any` in VisualizerData interface [DONE]
**Files:** `src/renderer/plugins/types.ts`
Changed to `import('three').BufferGeometry` and `import('three').Material`.

### TASK-014: Type the startPlayheadLoop parameters [DONE]
**Files:** `src/renderer/stores/useTransportStore.ts`
Typed `set` and `get` with `Partial<TransportState>` and `() => TransportState`.

### TASK-015: Fix Toast.tsx react-refresh warning [DONE]
**Files:** `src/renderer/components/ToastContext.ts` (new), `Toast.tsx`, 7 consumer files
Extracted context, types, and `useToast` hook. Updated all imports.

### TASK-016: Type the clonedAnimations in HistorySlice.ts [DONE]
**Files:** `src/renderer/stores/slices/HistorySlice.ts`
Changed `Record<string, any>` to `Record<SourceId, SourceAnimation>`.

---

## Phase 2: Architectural Type Fixes (7 tasks)

### TASK-017: Add getAudioContext and getMasterNodes to IAudioEngine [DONE]
**Files:** `src/renderer/audio/IAudioEngine.ts`
Added both methods to the interface (already implemented in WebAudioEngine).

### TASK-018: Type plugin API — audioEngine, transport, render props [DONE]
**Files:** `src/renderer/plugins/types.ts`
Replaced `audioEngine: any` with `IAudioEngine`, created `TransportSnapshot` type,
typed `render` props as `AudioSource[]` and `IAudioEngine`.

### TASK-019: Remove `as any` cast in effectChain.ts [DONE]
**Files:** `src/renderer/plugins/effectChain.ts`
Changed `(audioEngine as any).getMasterNodes?.()` to `audioEngine.getMasterNodes()`.

### TASK-020: Type HistorySlice plugin parameter restoration [DONE]
**Files:** `src/renderer/stores/slices/HistorySlice.ts`
Changed `val as any` to `val as PluginParameterValue` (2 occurrences).

### TASK-021: Replace `any` in projectSerializer.ts [DONE]
**Files:** `src/renderer/audio/projectSerializer.ts`
Typed `acoustics` as `Record<string, unknown> | null`, `src.type` as `SourceType`,
plugin deserialization as `Record<string, unknown>[]`.

### TASK-022: Add roomSize to SoundSource dependency array [DONE]
**Files:** `src/renderer/components/SoundSource.tsx`
Added `roomSize` to `onPointerMove` useCallback deps (rarely changes, safe).

### TASK-023: Fix test mock types in setupTests.ts [DONE]
**Files:** `src/__tests__/setupTests.ts`
Used `as unknown as ElectronAPI` and `as unknown as typeof IntersectionObserver`.

---

## Commits

1. `61575bd` — ESLint error fixes (from prior session)
2. `fb6723c` — Phase 1: dead code, type safety, deduplication (TASK-001 to TASK-016)
3. `ee5dabd` — Phase 2: architectural type fixes (TASK-017 to TASK-023)

---

## Phase 20 Audit (Spatial Choreography Engine)

Generated 2026-03-05 after Phase 20 implementation.

---

### TASK-024: Simplify redundant phantomSplit phase formula [DONE]
**Files:** `src/renderer/audio/Choreography.ts`
**Instruction:** On line 490, the expression `(i / totalAlternations) * totalAlternations * Math.PI` simplifies algebraically to `i * Math.PI`. Replace it with the simplified form. No behaviour change.
**Do not:** Change any other primitive or alter the blend logic.
**Verify:** npm run typecheck passes. No behaviour change.
**Escalate if:** The simplified formula produces different results (it should not -- verify mentally that `(i/N)*N === i`).

---

### TASK-025: Add defensive guard to beatsToSeconds helper [DONE]
**Files:** `src/renderer/audio/Choreography.ts`
**Instruction:** In the `beatsToSeconds` function (around line 190), add a guard so that if `bpm` is not a finite positive number, it defaults to 120. Use: `const safeBpm = (Number.isFinite(bpm) && bpm > 0) ? bpm : 120`. Replace the direct `bpm` usage in the return with `safeBpm`. This is a belt-and-suspenders guard since `setBpm` already clamps, but protects against direct `generateKeyframes` calls with bad context.
**Do not:** Change the function signature or any callers.
**Verify:** npm run typecheck passes. No behaviour change for valid bpm values.
**Escalate if:** Typecheck fails.

---

### TASK-026: Add keyframe count cap to phantomSplit [DONE]
**Files:** `src/renderer/audio/Choreography.ts`
**Instruction:** In the `phantomSplit` function, after computing `totalAlternations` on line 476, cap it: `const cappedAlternations = Math.min(totalAlternations, 256)`. Then use `cappedAlternations` in place of `totalAlternations` in both the loop bound (`i <= cappedAlternations`) and the `t` computation (`t = i / cappedAlternations`). Keep the `phase` formula using the capped value too. This prevents degenerate inputs from creating excessively large arrays.
**Do not:** Change any other primitive. Do not change the alternationRate parameter interface.
**Verify:** npm run typecheck passes. npm run lint passes. No behaviour change for reasonable inputs (< 256 alternations).
**Escalate if:** Lint or typecheck fails.

---

### TASK-027: Remove unused individual param interface exports [DONE]
**Files:** `src/renderer/audio/Choreography.ts`
**Instruction:** The 13 individual param interfaces (ClosingWallsParams, PendulumDecayParams, StalkingShadowParams, WhisperApproachParams, BreathingRadiusParams, ArrivalSettleParams, HorizonDriftParams, FloatDescentParams, PhantomSplitParams, VertigoHelixParams, CallResponseParams, OrbitCounterpointParams, MirrorDanceParams) are all exported but only consumed through the ChoreographyBehaviour union type. Remove the `export` keyword from all 13 individual param interfaces. Keep the `export` on: `RoomBounds`, `ChoreographyContext`, `GeneratedKeyframes`, `ChoreographyBehaviour`, and `generateKeyframes`. This reduces the public API surface to only what consumers actually import.
**Do not:** Delete any interfaces. Only remove the `export` keyword.
**Verify:** npm run typecheck passes. npm run lint passes.
**Escalate if:** Any file outside of Choreography.ts imports an individual param interface (check with grep first).

---

### TASK-028: Add keyframesPerBeat alias to PhantomSplitParams [DONE]
**Files:** `src/renderer/audio/Choreography.ts`
**Instruction:** Every other param interface has `keyframesPerBeat?: number` but `PhantomSplitParams` uses `alternationRate` instead. For API consistency, add `keyframesPerBeat?: number` to `PhantomSplitParams`. In the `phantomSplit` function, if `keyframesPerBeat` is provided but `alternationRate` is not, use `keyframesPerBeat` as the alternation rate: change the line to `const alternationRate = params.alternationRate ?? params.keyframesPerBeat ?? 8`. This way either parameter works.
**Do not:** Remove `alternationRate` or change its default. Do not change any other interface.
**Verify:** npm run typecheck passes. npm run lint passes.
**Escalate if:** Typecheck fails due to union type narrowing issues.
