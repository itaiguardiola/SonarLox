import type { SourceId } from '../types'

export interface AnalyserSnapshot {
  frequency: Float32Array
  waveform: Float32Array
}

export interface IAudioEngine {
  init(): Promise<void>
  createChannel(id: SourceId): void
  removeChannel(id: SourceId): void
  loadFile(id: SourceId, arrayBuffer: ArrayBuffer): Promise<void>
  playTestTone(id: SourceId, type: 'sine' | 'pink-noise'): Promise<void>
  playAll(): void
  pauseAll(): void
  stopAll(): void
  setPosition(id: SourceId, x: number, y: number, z: number): void
  setVolume(id: SourceId, volume: number): void
  setMuted(id: SourceId, muted: boolean): void
  setSoloed(id: SourceId, soloed: boolean): void
  setLooping(loop: boolean): void
  getIsLooping(): boolean
  setListenerY(y: number): void
  setSineFrequency(id: SourceId, freq: number): void
  setMasterVolume(volume: number): void
  getAnalyserSnapshot(id: SourceId): AnalyserSnapshot | null
  getAnalyser(id: SourceId): AnalyserNode | null
  setAudioBuffer(id: SourceId, buffer: AudioBuffer): void
  getAudioBuffer(id: SourceId): AudioBuffer | null
  getChannelIds(): SourceId[]
  getDuration(): number
  getPlayheadPosition(): number
  hasAnyPaused(): boolean
  hasAnyBuffer(): boolean
  getAllBufferedSources(): {
    id: SourceId
    audioBuffer: AudioBuffer
    position: [number, number, number]
    volume: number
  }[]
  enumerateDevices(): Promise<MediaDeviceInfo[]>
  setOutputDevice(deviceId: string): Promise<void>
  dispose(): void
}
