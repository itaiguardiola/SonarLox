# Scripts Documentation

This repository contains automated scripts for maintaining JSDoc documentation in the SonarLox project.

## JSDoc Loop Scripts

### jsdoc-loop.sh
A bash script that runs on a separate terminal using local Ollama + qwen3-coder to add JSDoc documentation to TypeScript files.

**Features:**
- Automatically detects files that need JSDoc documentation
- Uses local AI models for intelligent documentation generation
- Maintains existing documentation while adding new JSDoc blocks
- Commits changes automatically with appropriate commit messages

**Usage:**
```bash
./scripts/jsdoc-loop.sh
```

### jsdoc-loop.ps1
A PowerShell script that runs on a separate terminal using local Ollama + qwen3-coder to add JSDoc documentation to TypeScript files.

**Features:**
- Same functionality as the bash version but for Windows environments
- Automatically detects files that need JSDoc documentation
- Uses local AI models for intelligent documentation generation
- Maintains existing documentation while adding new JSDoc blocks
- Commits changes automatically with appropriate commit messages

**Usage:**
```powershell
.\scripts\jsdoc-loop.ps1
```

## Script Functionality

Both scripts:
1. Scan the codebase for TypeScript files
2. Check if files already have substantial JSDoc documentation
3. Add JSDoc comments to every exported function, class, interface, type, and const
4. Output the complete file with JSDoc added (every single line)
5. Commit changes automatically with descriptive commit messages

## Requirements

- Local Ollama installation
- qwen3-coder model installed
- Git repository with proper commit access
- Bash or PowerShell environment

## Log Files

The scripts generate log files in the `scripts/` directory:
- `jsdoc-loop.log` - General execution logs
- `jsdoc-loop.log` - Detailed execution logs