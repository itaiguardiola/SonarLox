import type { SourceId } from '../types'

/**
 * Represents a snapshot of audio analysis data for a source, including frequency and waveform data.
 */
export interface AnalyserSnapshot {
  frequency: Float32Array
  waveform: Float32Array
}

/**
 * Interface defining the core capabilities of the spatial audio engine.
 */
export interface IAudioEngine {
  /**
   * Initializes the audio engine and its context.
   */
  init(): Promise<void>

  /**
   * Creates a new audio channel for a specific source.
   */
  createChannel(id: SourceId): void

  /**
   * Removes an audio channel and its resources.
   */
  removeChannel(id: SourceId): void

  /**
   * Loads an audio file into a source channel from an ArrayBuffer.
   */
  loadFile(id: SourceId, buffer: ArrayBuffer): Promise<void>

  /**
   * Plays a specific test tone through a source channel.
   */
  playTestTone(id: SourceId, type: 'sine' | 'pink-noise'): Promise<void>

  /**
   * Starts playback for all active source channels.
   */
  playAll(): void

  /**
   * Pauses playback for all active source channels.
   */
  pauseAll(): void

  /**
   * Stops playback for all active source channels and resets positions.
   */
  stopAll(): void

  /**
   * Sets the 3D position of a sound source.
   */
  setPosition(id: SourceId, x: number, y: number, z: number): void

  /**
   * Sets the volume level for a sound source.
   */
  setVolume(id: SourceId, volume: number): void

  /**
   * Sets the master volume for all audio output.
   */
  setMasterVolume(volume: number): void

  /**
   * Sets the vertical position of the listener in the 3D space.
   */
  setListenerY(y: number): void

  /**
   * Enables or disables looping for all audio sources.
   */
  setLooping(loop: boolean): void

  /**
   * Returns the current looping state.
   */
  getIsLooping(): boolean

  /**
   * Returns the total duration of the audio timeline in seconds.
   */
  getDuration(): number
  
  /**
   * Sets the current playhead position in seconds across all sources.
   */
  setPlayheadPosition(pos: number): void
  
  /**
   * Returns the current playhead position in seconds across all sources.
   */
  getPlayheadPosition(): number
  
  /**
   * Returns a snapshot of the current frequency and waveform data for a source.
   */
  getAnalyserSnapshot(id: SourceId): AnalyserSnapshot | null

  /**
   * Returns the underlying AnalyserNode for a source.
   */
  getAnalyser(id: SourceId): AnalyserNode | null

  /**
   * Sets an audio buffer directly for a source channel.
   */
  setAudioBuffer(id: SourceId, buffer: AudioBuffer): void

  /**
   * Returns the current AudioBuffer for a source channel.
   */
  getAudioBuffer(id: SourceId): AudioBuffer | null

  /**
   * Returns an array of IDs for all currently active source channels.
   */
  getChannelIds(): SourceId[]

  /**
   * Returns the AudioNodes for a source channel, used for effect chain insertion.
   */
  getChannelNodes(id: SourceId): { gainNode: GainNode; pannerNode: PannerNode } | null

  /**
   * Returns the underlying AudioContext, or null if not initialized.
   */
  getAudioContext(): AudioContext | null

  /**
   * Returns the master gain and analyser nodes for effect chain insertion.
   */
  getMasterNodes(): { masterGainNode: GainNode; masterAnalyserNode: AnalyserNode } | null

  /**
   * Disposes of all resources used by the audio engine, releasing memory and stopping audio processing.
   */
  dispose(): void
}
