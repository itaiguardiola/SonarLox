# Lint Fix Loop Documentation

This repository contains automated scripts for maintaining code quality through automatic lint fixing in the SonarLox project.

## Lint Fix Loop Scripts

### lint-fix-loop.sh
A bash script that automatically runs ESLint fixes on the entire codebase.

**Features:**
- Automatically fixes linting issues in TypeScript/JavaScript files
- Runs TypeScript type checking
- Commits changes automatically with descriptive commit messages
- Maintains a log of all operations

**Usage:**
```bash
./scripts/lint-fix-loop.sh
```

### lint-fix-loop.ps1
A PowerShell script that automatically runs ESLint fixes on the entire codebase.

**Features:**
- Same functionality as the bash version but for Windows environments
- Automatically fixes linting issues in TypeScript/JavaScript files
- Runs TypeScript type checking
- Commits changes automatically with descriptive commit messages
- Maintains a log of all operations

**Usage:**
```powershell
.\scripts\lint-fix-loop.ps1
```

## Script Functionality

Both lint fix loop scripts:
1. Run ESLint with auto-fix on all TypeScript/JavaScript files in the `src/` directory
2. Run TypeScript type checking to ensure code correctness
3. Commit changes automatically with descriptive commit messages
4. Maintain detailed logs of all operations in `scripts/lint-fix-loop.log`

## Requirements

- Git repository with proper commit access
- Bash or PowerShell environment
- Node.js and npm installed
- ESLint installed globally

## Log Files

The script generates log files in the `scripts/` directory:
- `lint-fix-loop.log` - Lint fix loop execution logs