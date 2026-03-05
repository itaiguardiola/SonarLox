# SonarLox

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue.svg)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-20%2B-blue.svg)](https://www.electronjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.183%2B-blue.svg)](https://threejs.org/)

3D spatial audio editor with HRTF binaural spatialization.

## Overview

SonarLox is a desktop application that provides a 3D spatial audio editing environment with real-time binaural spatialization. The application allows users to create, edit, and visualize audio sources in a 3D space, with realistic spatial audio effects using Head-Related Transfer Functions (HRTFs).

## Features

- 3D visualization of audio sources and listener positions
- Real-time binaural spatialization using HRTF
- MIDI support for musical composition
- Audio project management and export capabilities
- Plugin architecture for audio effects
- Timeline-based editing interface
- Undo/Redo functionality
- Drag & Drop support

## Architecture

The application is built using:
- Electron for cross-platform desktop application
- React with TypeScript for the UI
- Three.js for 3D graphics rendering
- Web Audio API for audio processing
- Zustand for state management

## Project Structure

```
src/
├── main/           # Main process (Electron)
├── preload/        # Preload scripts for security
├── renderer/       # Renderer process (React/Three.js)
│   ├── components/ # React components
│   ├── audio/      # Audio processing classes
│   ├── stores/     # Zustand stores
│   ├── plugins/    # Plugin system
│   ├── hooks/      # Custom React hooks
│   ├── types/      # TypeScript types
│   └── __tests__/  # Test files
```

## Recent Updates and Phases

### Phase 15/16 - Undo/Redo, Drag & Drop, and Major Refactoring
- Implemented Undo/Redo functionality for audio editing operations
- Added Drag & Drop support for audio sources
- Major refactoring of the application architecture
- Improved plugin system with SourceChannel integration

### Phase 17 - SourceChannel and PluginLoader Updates
- Enhanced SourceChannel implementation for better audio handling
- Updated plugin loader functionality
- Additional refactoring for improved maintainability

### Phase 18 - Video Synchronization
- Added video synchronization capabilities
- Enhanced timeline-based editing interface

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Run in development mode: `npm run dev`
4. Build for production: `npm run build`

## Development

### Scripts

- `dev` - Start development server
- `build` - Build the application
- `preview` - Preview the built application
- `lint` - Run ESLint
- `typecheck` - Run TypeScript type checking
- `test` - Run tests
- `test:watch` - Run tests in watch mode

### Documentation Scripts

- `scripts/jsdoc-loop.sh` - Automated JSDoc documentation generator (Linux/macOS)
- `scripts/jsdoc-loop.ps1` - Automated JSDoc documentation generator (Windows)

These scripts use local AI models to automatically add JSDoc documentation to TypeScript files throughout the codebase.

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Documentation

Recent JSDoc documentation has been added to several key components:
- `AudioVisualizer.tsx` - Audio visualization component
- `DistanceRings.tsx` - Distance ring visualization component
- `Listener.tsx` - Listener positioning component
- `SoundSource.tsx` - Audio source positioning component
- `Room.tsx` - 3D room environment component
- `SourceChannel.ts` - Audio source channel management
- `WebAudioEngine.ts` - Core Web Audio API engine

## License

MIT