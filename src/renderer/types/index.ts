export type SourcePosition = [number, number, number]

export type SourceId = string

export const SOURCE_COLORS = [
  '#ff6622', '#2288ff', '#22cc44', '#ff2266',
  '#ffcc00', '#aa44ff', '#00cccc', '#ff8844',
] as const

export const MAX_SOURCES = 8

export type SourceType = 'file' | 'tone' | 'midi-track'

export interface AudioSource {
  id: SourceId
  label: string
  sourceType: SourceType
  position: SourcePosition
  volume: number
  color: string
  audioFileName: string | null
  sineFrequency: number
  isMuted: boolean
  isSoloed: boolean
}

export interface TransportState {
  isPlaying: boolean
  isPaused: boolean
  playheadPosition: number
  duration: number
  isLooping: boolean
}

export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
}

export type CameraCommand =
  | { type: 'home' }
  | { type: 'recall'; index: number }
  | { type: 'save'; index: number }
  | null

export interface AppState {
  // Multi-source
  sources: AudioSource[]
  selectedSourceId: SourceId | null
  addSource: (type: SourceType) => void
  removeSource: (id: SourceId) => void
  selectSource: (id: SourceId | null) => void
  setSourcePosition: (id: SourceId, position: SourcePosition) => void
  setSourceVolume: (id: SourceId, volume: number) => void
  setSourceAudioFileName: (id: SourceId, name: string | null) => void
  setSourceSineFrequency: (id: SourceId, freq: number) => void
  setSourceMuted: (id: SourceId, muted: boolean) => void
  setSourceSoloed: (id: SourceId, soloed: boolean) => void
  setSourceLabel: (id: SourceId, label: string) => void

  // SoundFont
  soundFontName: string | null
  setSoundFontName: (name: string | null) => void

  // Global playback
  isPlaying: boolean
  isLooping: boolean
  listenerY: number
  setIsPlaying: (isPlaying: boolean) => void
  setIsLooping: (isLooping: boolean) => void
  setListenerY: (y: number) => void

  // Master output
  masterVolume: number
  setMasterVolume: (vol: number) => void
  selectedOutputDevice: string | null
  setSelectedOutputDevice: (id: string | null) => void

  // Export
  isExporting: boolean
  setIsExporting: (v: boolean) => void
  exportProgress: number
  setExportProgress: (p: number) => void

  // Camera
  cameraPresets: (CameraPreset | null)[]
  setCameraPreset: (index: number, preset: CameraPreset | null) => void
  cameraCommand: CameraCommand
  setCameraCommand: (cmd: CameraCommand) => void
}

export interface AudioFileResult {
  buffer: ArrayBuffer
  name: string
}

export interface SaveWavResult {
  saved: boolean
  path?: string
}

export interface ElectronAPI {
  openAudioFile: () => Promise<AudioFileResult | null>
  openMidiFile: () => Promise<AudioFileResult | null>
  openSoundFontFile: () => Promise<AudioFileResult | null>
  saveWavFile: (buffer: ArrayBuffer, defaultPath?: string) => Promise<SaveWavResult>
  selectDirectory: () => Promise<string | null>
  saveWavFileToPath: (buffer: ArrayBuffer, filePath: string, expectedDir?: string) => Promise<SaveWavResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
