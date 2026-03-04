export type SourcePosition = [number, number, number]

export interface AppState {
  sourcePosition: SourcePosition
  isPlaying: boolean
  audioFileName: string | null
  volume: number
  setSourcePosition: (position: SourcePosition) => void
  setIsPlaying: (isPlaying: boolean) => void
  setAudioFileName: (name: string | null) => void
  setVolume: (volume: number) => void
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
  saveWavFile: (buffer: ArrayBuffer) => Promise<SaveWavResult>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
