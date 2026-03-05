#!/bin/bash
# ============================================================================
# SonarLox JSDoc Documentation Loop
# 
# Runs on a separate terminal using local Ollama + qwen3-coder to add JSDoc
# comments to all TypeScript source files. Non-destructive — only adds
# comments, never modifies logic.
#
# Prerequisites:
#   - Ollama running locally with qwen3-coder pulled
#   - jq installed (sudo apt install jq / brew install jq)
#   - Run from the sonarlox project root
#
# Usage:
#   chmod +x scripts/jsdoc-loop.sh
#   ./scripts/jsdoc-loop.sh
#
# To run on a specific file:
#   ./scripts/jsdoc-loop.sh src/renderer/audio/WebAudioEngine.ts
# ============================================================================

set -euo pipefail

# --- Windows PATH fix (winget-installed jq) ---
export PATH="$HOME/AppData/Local/Microsoft/WinGet/Links:$PATH"

# --- Config ---
OLLAMA_URL="http://localhost:11434/api/generate"
MODEL="qwen3-coder"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH_NAME="chores/jsdoc"
LOG_FILE="$PROJECT_ROOT/scripts/jsdoc-loop.log"
MAX_RETRIES=2
DELAY_BETWEEN_FILES=3

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- File list ---
# Order: types first, then audio engine, then components, then stores
TARGET_FILES=(
  "src/renderer/types/index.ts"
  "src/renderer/audio/IAudioEngine.ts"
  "src/renderer/audio/WebAudioEngine.ts"
  "src/renderer/audio/TestTones.ts"
  "src/renderer/audio/Exporter.ts"
  "src/renderer/audio/encodeWav.ts"
  "src/renderer/stores/useAppStore.ts"
  "src/renderer/stores/useTransportStore.ts"
  "src/renderer/components/AudioBridge.tsx"
  "src/renderer/components/Viewport.tsx"
  "src/renderer/components/Room.tsx"
  "src/renderer/components/SoundSource.tsx"
  "src/renderer/components/Listener.tsx"
  "src/renderer/components/DistanceRings.tsx"
  "src/renderer/components/AudioVisualizer.tsx"
  "src/renderer/components/ControlPanel.tsx"
  "src/renderer/components/SourceList.tsx"
  "src/renderer/components/TimelinePanel.tsx"
  "src/renderer/App.tsx"
  "src/main/index.ts"
  "src/main/ipc.ts"
  "src/preload/index.ts"
)

# --- Functions ---

log() {
  local msg="[$(date '+%H:%M:%S')] $1"
  echo -e "$msg"
  echo "$msg" >> "$LOG_FILE"
}

check_ollama() {
  if ! curl -s "$OLLAMA_URL" > /dev/null 2>&1; then
    # Try the base URL instead
    if ! curl -s "http://localhost:11434/api/tags" > /dev/null 2>&1; then
      echo -e "${RED}ERROR: Ollama not running at localhost:11434${NC}"
      echo "Start it with: ollama serve"
      exit 1
    fi
  fi
  
  # Check model is available
  if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo -e "${RED}ERROR: Model '$MODEL' not found${NC}"
    echo "Pull it with: ollama pull $MODEL"
    exit 1
  fi
}

has_jsdoc() {
  # Returns 0 if file already has substantial JSDoc (more than 3 JSDoc blocks)
  local file="$1"
  local count
  count=$(grep -c '^\s*/\*\*' "$file" 2>/dev/null | tr -d '\r\n' || echo "0")
  [ "$count" -gt 3 ]
}

count_exports() {
  # Count exported functions, classes, interfaces, types
  local file="$1"
  grep -cE '^\s*export\s+(function|class|interface|type|const|async function|enum)' "$file" 2>/dev/null | tr -d '\r\n' || echo "0"
}

add_jsdoc_to_file() {
  local file="$1"
  local filepath="$PROJECT_ROOT/$file"
  
  if [ ! -f "$filepath" ]; then
    log "${YELLOW}SKIP: $file (not found)${NC}"
    return 0
  fi
  
  if has_jsdoc "$filepath"; then
    log "${BLUE}SKIP: $file (already documented)${NC}"
    return 0
  fi
  
  local exports
  exports=$(count_exports "$filepath")
  if [ "$exports" -eq 0 ]; then
    log "${BLUE}SKIP: $file (no exports to document)${NC}"
    return 0
  fi
  
  log "${GREEN}DOCUMENTING: $file ($exports exports)${NC}"
  
  local content
  content=$(cat "$filepath")
  
  # Build the prompt
  local prompt
  prompt=$(cat <<'PROMPT_END'
You are adding JSDoc documentation to a TypeScript file from the SonarLox spatial audio editor.

RULES:
1. Add JSDoc comments (/** ... */) to every exported function, class, interface, type, and const
2. DO NOT modify any code logic, imports, or structure
3. DO NOT remove or change existing comments
4. DO NOT add @param or @returns if the types already make it obvious
5. Keep descriptions concise — one line for simple things, 2-3 lines max for complex
6. For audio/spatial concepts, briefly explain what they do in spatial audio terms
7. Output the COMPLETE file with JSDoc added — every single line, not just the changed parts
8. Do NOT wrap output in markdown code fences
9. Do NOT add /no_think or any preamble — output ONLY the file content

CONTEXT:
- SonarLox is a 3D spatial audio editor built with Electron + React + Three.js + Web Audio API
- Sources are audio objects positioned in 3D space with HRTF binaural spatialization
- The app uses Zustand for state, React Three Fiber for 3D, Web Audio for audio

Here is the file to document:

PROMPT_END
)

  # Call Ollama
  local response
  local retry=0
  
  while [ $retry -lt $MAX_RETRIES ]; do
    response=$(curl -s --max-time 120 "$OLLAMA_URL" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
        --arg model "$MODEL" \
        --arg prompt "$prompt$content" \
        '{
          model: $model,
          prompt: $prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 16384,
            num_ctx: 32768
          }
        }')" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
      break
    fi
    
    retry=$((retry + 1))
    log "${YELLOW}  Retry $retry/$MAX_RETRIES for $file${NC}"
    sleep 5
  done
  
  if [ -z "$response" ]; then
    log "${RED}  FAILED: No response from Ollama for $file${NC}"
    return 1
  fi
  
  # Extract the generated text
  local generated
  generated=$(echo "$response" | jq -r '.response // empty' 2>/dev/null)
  
  if [ -z "$generated" ]; then
    log "${RED}  FAILED: Empty response for $file${NC}"
    return 1
  fi
  
  # Strip markdown fences if the model added them anyway
  generated=$(echo "$generated" | sed '/^```typescript$/d' | sed '/^```ts$/d' | sed '/^```$/d' | sed '/^\/no_think$/d')
  
  # Safety checks before writing
  local orig_lines new_lines orig_exports new_exports
  orig_lines=$(wc -l < "$filepath")
  new_lines=$(echo "$generated" | wc -l)
  orig_exports=$(count_exports "$filepath")
  new_exports=$(echo "$generated" | grep -cE '^\s*export\s+(function|class|interface|type|const|async function|enum)' | tr -d '\r\n' || echo "0")
  
  # New file should be longer (added comments) and have same exports
  if [ "$new_lines" -lt "$orig_lines" ]; then
    log "${RED}  REJECTED: Output shorter than original ($new_lines < $orig_lines lines) for $file${NC}"
    return 1
  fi
  
  if [ "$new_exports" -lt "$orig_exports" ]; then
    log "${RED}  REJECTED: Lost exports ($new_exports < $orig_exports) for $file${NC}"
    return 1
  fi
  
  # Write the file
  echo "$generated" > "$filepath"
  log "${GREEN}  DONE: $file (+$((new_lines - orig_lines)) lines of docs)${NC}"
  
  return 0
}

verify_typecheck() {
  log "${BLUE}Running typecheck...${NC}"
  cd "$PROJECT_ROOT"
  
  if npm run typecheck 2>&1; then
    log "${GREEN}Typecheck passed${NC}"
    return 0
  else
    log "${RED}Typecheck FAILED — reverting last file${NC}"
    return 1
  fi
}

# --- Main ---

echo -e "${GREEN}"
echo "============================================"
echo "  SonarLox JSDoc Documentation Loop"
echo "  Model: $MODEL"
echo "  Files: ${#TARGET_FILES[@]}"
echo "============================================"
echo -e "${NC}"

# Prereq checks
check_ollama
cd "$PROJECT_ROOT"

# Create log file
mkdir -p "$(dirname "$LOG_FILE")"
echo "=== JSDoc Loop Started $(date) ===" >> "$LOG_FILE"

# Create and switch to chores branch (or stay on current if specified)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "$BRANCH_NAME" ]; then
  log "${YELLOW}Current branch: $CURRENT_BRANCH${NC}"
  echo -e "${YELLOW}Create branch '$BRANCH_NAME' and switch to it? (y/n)${NC}"
  read -r answer
  if [ "$answer" = "y" ]; then
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
  else
    log "Staying on $CURRENT_BRANCH"
  fi
fi

# If a specific file was passed as argument, just do that one
if [ $# -gt 0 ]; then
  TARGET_FILES=("$1")
  log "Single file mode: $1"
fi

# Process each file
SUCCEEDED=0
SKIPPED=0
FAILED=0

for file in "${TARGET_FILES[@]}"; do
  echo ""
  
  # Backup the file
  filepath="$PROJECT_ROOT/$file"
  if [ -f "$filepath" ]; then
    cp "$filepath" "$filepath.bak"
  fi
  
  if add_jsdoc_to_file "$file"; then
    # Verify typecheck after each file
    if [ -f "$filepath" ] && [ -f "$filepath.bak" ]; then
      if ! verify_typecheck; then
        # Revert on failure
        cp "$filepath.bak" "$filepath"
        log "${YELLOW}  Reverted $file${NC}"
        FAILED=$((FAILED + 1))
      else
        # Commit the change
        git add "$file" 2>/dev/null
        git commit -m "docs: add JSDoc to $(basename "$file")" --no-verify 2>/dev/null || true
        SUCCEEDED=$((SUCCEEDED + 1))
      fi
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  else
    SKIPPED=$((SKIPPED + 1))
  fi
  
  # Cleanup backup
  rm -f "$filepath.bak"
  
  # Delay between files to avoid hammering the GPU
  sleep $DELAY_BETWEEN_FILES
done

# Summary
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  JSDoc Loop Complete${NC}"
echo -e "${GREEN}  Succeeded: $SUCCEEDED${NC}"
echo -e "${YELLOW}  Skipped:   $SKIPPED${NC}"
echo -e "${RED}  Failed:    $FAILED${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Results on branch: ${BLUE}$(git branch --show-current 2>/dev/null)${NC}"
echo -e "Log: ${BLUE}$LOG_FILE${NC}"
echo ""
echo "When ready, merge with:"
echo "  git checkout main"
echo "  git merge $BRANCH_NAME"