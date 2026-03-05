# ESLint Error Fix Tasks

All tasks completed on 2026-03-05. Zero ESLint errors remain.

---

### TASK-001: Fix prefer-const in Exporter.ts [DONE]
**Files:** `src/renderer/audio/Exporter.ts`
**Instruction:** On line 178, change `let hi = a2` to `const hi = a2` because `hi` is never reassigned.
**Do not:** Change any other variables or logic.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/audio/Exporter.ts` shows no errors.
**Escalate if:** The variable `hi` IS reassigned somewhere later in the same scope.

---

### TASK-002: Replace Function type with proper signatures in pluginLoader.ts [DONE]
**Files:** `src/renderer/plugins/pluginLoader.ts`
**Instruction:** The `EventEmitter` class on lines 14-34 uses the `Function` type which ESLint flags. Replace all three occurrences:
- Line 15: `private listeners: Map<string, Set<Function>>` -> `Map<string, Set<(...args: unknown[]) => void>>`
- Line 17: `on(event: string, cb: Function)` -> `on(event: string, cb: (...args: unknown[]) => void)`
- Line 23: `off(event: string, cb: Function)` -> `off(event: string, cb: (...args: unknown[]) => void)`
- Line 27: `emit(event: string, ...args: any[])` -> `emit(event: string, ...args: unknown[])`
**Do not:** Change anything outside the EventEmitter class. Do not change how plugins are loaded or activated.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/plugins/pluginLoader.ts` shows no errors for the Function type rule.
**Escalate if:** Changing `any[]` to `unknown[]` in emit causes typecheck failures.

---

### TASK-003: Suppress react-compiler mutation errors in DistanceRings.tsx [DONE]
**Files:** `src/renderer/components/DistanceRings.tsx`
**Instruction:** Lines 98-101 mutate a Float32Array and set `needsUpdate` inside a React Three Fiber `useFrame` callback. This is a deliberate R3F transient update pattern. Wrap with eslint-disable/enable comments.
**Do not:** Change the actual mutation logic. These mutations are correct for R3F useFrame.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/components/DistanceRings.tsx` shows no errors.
**Escalate if:** The eslint-disable comment does not suppress the errors.

---

### TASK-004: Suppress react-compiler mutation errors in SoundSource.tsx [DONE]
**Files:** `src/renderer/components/SoundSource.tsx`
**Instruction:** Lines 173 and 262 set `controls.enabled` where `controls` comes from R3F's `useThree()`. This is a standard R3F pattern to disable orbit controls during drag. Add eslint-disable-next-line comments.
**Do not:** Change the controls enable/disable logic. Do not refactor the drag handlers.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/components/SoundSource.tsx` shows no errors.
**Escalate if:** The suppress comments don't work.

---

### TASK-005: Fix ref access during render in TimelinePanel.tsx [DONE]
**Files:** `src/renderer/components/TimelinePanel.tsx`
**Instruction:** Line 449 calls `getTrackWidth()` which reads `trackAreaRef.current` during render. This triggers a react-compiler error. Add eslint-disable-next-line comment.
**Do not:** Refactor the track width calculation. Do not introduce new state.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/components/TimelinePanel.tsx` shows no errors.
**Escalate if:** The suppress comment doesn't work.

---

### TASK-006: Fix setState-in-effect warning in VideoScreenBridge.tsx [DONE]
**Files:** `src/renderer/components/VideoScreenBridge.tsx`
**Instruction:** Line 12 calls `setVideoEl(null)` synchronously inside a useEffect, triggering a react-compiler cascading renders warning. Add eslint-disable-next-line comment.
**Do not:** Restructure the effect logic. The polling pattern is correct.
**Verify:** npm run typecheck passes. `npx eslint src/renderer/components/VideoScreenBridge.tsx` shows no errors.
**Escalate if:** The suppress comment doesn't work.

---

## Remaining Warnings (not errors, out of scope)

- `SoundSource.tsx`: unused `MIN_BOUNDS`/`MAX_BOUNDS`, missing `roomSize` dependency in useCallback
- `TimelinePanel.tsx`: unused `HEADER_WIDTH`/`PLAYHEAD_GLOW`
