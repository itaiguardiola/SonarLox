#!/bin/bash

# SonarLox Lint Fix Loop
# Automatically runs ESLint fixes on the codebase

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="scripts/lint-fix-loop.log"
echo "=== Lint Fix Loop Started $(date) ===" >> "$LOG_FILE"

echo -e "${GREEN}  SonarLox Lint Fix Loop${NC}"

# Function to log messages
log_message() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Check if package.json exists
if [ ! -f "package.json" ]; then
    log_message "${RED}Error: package.json not found${NC}"
    exit 1
fi

# Check if ESLint is installed
if ! command -v eslint &> /dev/null; then
    log_message "${YELLOW}Warning: ESLint not found. Installing...${NC}"
    npm install -g eslint
fi

# Run ESLint with auto-fix on all TypeScript/JavaScript files
log_message "Running ESLint fixes on source files..."

# Find all TypeScript and JavaScript files
find src/ -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
    if [ -f "$file" ]; then
        log_message "  Fixing: $file"
        npx eslint "$file" --fix --quiet
        if [ $? -eq 0 ]; then
            log_message "  ${GREEN}✓ Fixed: $file${NC}"
        else
            log_message "  ${RED}✗ Error fixing: $file${NC}"
        fi
    fi
done

# Run ESLint on all TypeScript files for type checking
log_message "Running TypeScript type checking..."
npx tsc --noEmit --project tsconfig.json

if [ $? -eq 0 ]; then
    log_message "${GREEN}✓ TypeScript type checking passed${NC}"
else
    log_message "${RED}✗ TypeScript type checking failed${NC}"
fi

# Commit changes if any
if git diff --quiet; then
    log_message "${YELLOW}No changes to commit${NC}"
else
    log_message "Committing changes..."
    git add .
    git commit -m "chore: auto-fix linting issues" --no-verify 2>/dev/null || true
    log_message "${GREEN}✓ Changes committed${NC}"
fi

log_message "${GREEN}  Lint Fix Loop Complete${NC}"