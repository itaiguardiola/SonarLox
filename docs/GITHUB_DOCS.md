# SonarLox Documentation

## Overview

SonarLox is a desktop application that provides a 3D spatial audio editing environment with real-time binaural spatialization. The application allows users to create, edit, and visualize audio sources in a 3D space, with realistic spatial audio effects using Head-Related Transfer Functions (HRTFs).

## Recent Documentation Updates

This repository contains recent JSDoc documentation additions for several key components:

- `AudioVisualizer.tsx` - Audio visualization component
- `DistanceRings.tsx` - Distance ring visualization component
- `Listener.tsx` - Listener positioning component
- `SoundSource.tsx` - Audio source positioning component
- `Room.tsx` - 3D room environment component

## Features

- 3D visualization of audio sources and listener positions
- Real-time binaural spatialization using HRTF
- MIDI support for musical composition
- Audio project management and export capabilities
- Plugin architecture for audio effects
- Timeline-based editing interface

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
│   └── types/      # TypeScript types
```

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

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT