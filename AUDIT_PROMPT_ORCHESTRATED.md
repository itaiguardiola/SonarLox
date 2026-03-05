# SonarLox Audit Pass — With Native Subagent Orchestration

## How the orchestration actually works

Claude Code **cannot switch its own model mid-session** — the `ANTHROPIC_BASE_URL` env var
only takes effect when a new process launches. But Claude Code *does* have Bash tool access,
which means it can shell out and spawn a local `claude` process pointed at Ollama.

The flow is:
1. Cloud Claude Code runs the audit, writes `TASKS.md`
2. Cloud Claude Code loops through each task, spawning a **new local `claude` subprocess** per task
3. Each subprocess runs as Qwen3-Coder, edits the file, verifies `npm run typecheck`, exits
4. Cloud Claude reads stdout, checks for failures, decides whether to continue or escalate

Cloud Claude thinks and delegates. Qwen3-Coder executes and exits. You spend cloud tokens
only on the audit + oversight, not on mechanical edits.

---

## The Prompt

Paste into a fresh **cloud** Claude Code session at the SonarLox repo root:

```
You are the orchestrator for a SonarLox codebase audit and repair pass.

You have two tools available:
- Your own reasoning and file-reading (cloud Claude, full context)
- A local Qwen3-Coder subprocess spawnable via Bash (free, fast, 32k context)

## Phase 1 — Audit (you do this, do not delegate)

Read every file in src/renderer/ and src/main/. Look for:

1. **Duplicate logic** — same operation implemented differently across files (position clamping,
   audio node teardown, store access patterns)
2. **Dead code** — exports, hooks, types, or functions defined but never imported anywhere
3. **Inconsistent patterns** — mixed useAppStore(s => s.x) vs getState().x in wrong contexts;
   mixed pattern for audio node cleanup; inconsistent null handling
4. **Type safety holes** — `any`, non-null assertions on genuinely nullable values, missing
   return types on exported functions
5. **Architectural drift** — anything contradicting CLAUDE.md (business logic in src/main/,
   class components, CommonJS require())
6. **Oversized files** — single files over ~400 lines doing more than one job

Start by running these and noting all output:
- npm run typecheck
- npm run lint

## Phase 2 — Write TASKS.md (you do this, do not delegate)

Write a TASKS.md file to the repo root. Structure each task so Qwen3-Coder can execute it
with no more than 2-3 files in context. Use this format exactly:

---
### TASK-001: <title>
**Files:** `src/renderer/path/to/File.ts`
**Instruction:** <single paragraph, mechanical, no judgment required>
**Do not:** <explicit guardrails>
**Verify:** npm run typecheck passes. No behaviour change.
**Escalate if:** <condition under which local model should stop and return control>
---

Rules:
- 15-30 tasks max. No padding.
- Order tasks so each one's changes don't break the next.
- Mark tasks touching the audio graph or store architecture as [CLOUD ONLY] — do not
  delegate these; execute them yourself after confirming with the user.
- [CLOUD ONLY] tasks are NOT written to TASKS.md — handle them separately.

## Phase 3 — Execute via subagents (you orchestrate this loop)

After writing TASKS.md, execute each non-[CLOUD ONLY] task by spawning a local Qwen3-Coder
subprocess using your Bash tool. Use this exact pattern per task:

```bash
ANTHROPIC_BASE_URL=http://localhost:11434 \
ANTHROPIC_AUTH_TOKEN=ollama \
ANTHROPIC_API_KEY="" \
claude --model qwen3-coder \
  --allowedTools "Edit,Bash" \
  --max-turns 5 \
  --print \
  -p "$(cat <<'TASK'
You are executing a single code cleanup task on the SonarLox codebase.
Do exactly what the instruction says. Nothing more.
After making changes, run: npm run typecheck
If typecheck fails, revert your changes and output: FAILED: <reason>
If typecheck passes, output: DONE

--- TASK BELOW ---
[paste full task block from TASKS.md here]
TASK
)"
```

After each subprocess exits:
- If output contains DONE → git add the changed files, git commit -m "chore: <task title>", proceed to next task
- If output contains FAILED → log the failure, skip that task, add it to a FAILED_TASKS.md file
- If output contains unexpected changes or the subprocess timed out → escalate to the user

## Phase 4 — Summary

When all tasks are complete, output a summary:
- Tasks completed successfully
- Tasks failed (with reasons)
- [CLOUD ONLY] tasks still pending (list them and ask the user if they want to proceed)
- Final npm run typecheck and npm run lint results

## Important constraints

- Never delegate a task that touches WebAudioEngine.ts or useAppStore.ts store architecture
  without explicit user confirmation first — these are the audio graph and state core.
- Never let a subprocess run more than 5 turns (--max-turns 5 enforces this)
- Never skip the npm run typecheck verification step
- If more than 3 tasks fail in a row, stop and report to the user before continuing
- Do not run npm run dev or start the Electron app at any point
```

---

## What this costs

| Step | Model | Approx tokens | Cost |
|---|---|---|---|
| Phase 1 audit (read all files) | Cloud Claude | ~30-60k input | ~$0.15-0.30 |
| Phase 2 write TASKS.md | Cloud Claude | ~5k output | ~$0.08 |
| Phase 3 per-task oversight | Cloud Claude | ~500 tokens/task × 20 tasks | ~$0.10 |
| Phase 3 per-task execution | Qwen3-Coder local | free | $0 |
| Phase 4 summary | Cloud Claude | ~2k output | ~$0.02 |
| **Total** | | | **~$0.35-0.50** |

One-time investment. The alternative is doing this manually or having cloud Claude execute
every edit, which would run 10-20x the cloud tokens.

---

## Prerequisites

Before running the prompt, confirm:
- [ ] Ollama is running: `ollama serve`
- [ ] Qwen3-Coder is pulled: `ollama list` shows `qwen3-coder`
- [ ] You're on a clean git branch: `git checkout -b chore/audit-pass`
- [ ] The app builds cleanly: `npm run typecheck` passes (or you know what the existing errors are)
- [ ] Claude Code has Bash tool permission enabled for this session
