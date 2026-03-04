export type SourcePosition = [number, number, number]

export type SourceId = string

export const SOURCE_COLORS = [
  '#ff6622', '#2288ff', '#22cc44', '#ff2266',
  '#ffcc00', '#aa44ff', '#00cccc', '#ff8844',
] as const

export const MAX_SOURCES = 8

export interface AudioSource {
  id: SourceId
  label: string
  position: SourcePosition
  volume: number
  color: string
  audioFileName: string | null
  sineFrequency: number
  isMuted: boolean
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
  addSource: () => void
  removeSource: (id: SourceId) => void
  selectSource: (id: SourceId | null) => void
  setSourcePosition: (id: SourceId, position: SourcePosition) => void
  setSourceVolume: (id: SourceId, volume: number) => void
  setSourceAudioFileName: (id: SourceId, name: string | null) => void
  setSourceSineFrequency: (id: SourceId, freq: number) => void
  setSourceMuted: (id: SourceId, muted: boolean) => void

  // Global playback
  isPlaying: boolean
  isLooping: boolean
  listenerY: number
  setIsPlaying: (isPlaying: boolean) => void
  setIsLooping: (isLooping: boolean) => void
  setListenerY: (y: number) => void

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
  saveWavFile: (buffer: ArrayBuffer, defaultPath?: string) => Promise<SaveWavResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
