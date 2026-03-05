import type { SourceId } from '../types'

/**
 * Represents a snapshot of audio analysis data for a source, including frequency and waveform data.
 */
export interface AnalyserSnapshot {
  frequency: Float32Array
  waveform: Float32Array
}

/**
 * Interface defining the contract for the audio engine used in SonarLox, managing spatial audio sources and playback.
 */
export interface IAudioEngine {
  /**
   * Initializes the audio engine, setting up the Web Audio API context and required nodes.
   */
  init(): Promise<void>
  
  /**
   * Creates a new audio channel for the given source ID, preparing it for spatial audio processing.
   */
  createChannel(id: SourceId): void
  
  /**
   * Removes the audio channel associated with the given source ID from the engine.
   */
  removeChannel(id: SourceId): void
  
  /**
   * Loads an audio file into the specified source using an ArrayBuffer.
   */
  loadFile(id: SourceId, arrayBuffer: ArrayBuffer): Promise<void>
  
  /**
   * Plays a test tone (sine or pink noise) for the specified source ID.
   */
  playTestTone(id: SourceId, type: 'sine' | 'pink-noise'): Promise<void>
  
  /**
   * Plays all active audio sources in the engine simultaneously.
   */
  playAll(): void
  
  /**
   * Pauses all active audio sources in the engine.
   */
  pauseAll(): void
  
  /**
   * Stops all active audio sources in the engine and resets their playback positions.
   */
  stopAll(): void
  
  /**
   * Sets the 3D position of the specified audio source in the spatial scene.
   */
  setPosition(id: SourceId, x: number, y: number, z: number): void
  
  /**
   * Sets the volume level for the specified audio source, ranging from 0 to 1.
   */
  setVolume(id: SourceId, volume: number): void
  
  /**
   * Mutes or unmutes the specified audio source based on the provided boolean value.
   */
  setMuted(id: SourceId, muted: boolean): void
  
  /**
   * Soloes or unsoloes the specified audio source, muting all others if solo is enabled.
   */
  setSoloed(id: SourceId, soloed: boolean): void
  
  /**
   * Enables or disables looping for all audio sources in the engine.
   */
  setLooping(loop: boolean): void
  
  /**
   * Returns whether looping is currently enabled for all audio sources in the engine.
   */
  getIsLooping(): boolean
  
  /**
   * Sets the vertical position (Y-axis) of the audio listener in the 3D scene, affecting spatialization.
   */
  setListenerY(y: number): void
  
  /**
   * Sets the frequency of the sine wave for the specified source ID, used for test tones or oscillators.
   */
  setSineFrequency(id: SourceId, freq: number): void
  
  /**
   * Sets the master volume level for all audio sources in the engine, ranging from 0 to 1.
   */
  setMasterVolume(volume: number): void
  
  /**
   * Returns a snapshot of the audio analysis data for the specified source, or null if unavailable.
   */
  getAnalyserSnapshot(id: SourceId): AnalyserSnapshot | null
  
  /**
   * Returns the AnalyserNode associated with the specified source, or null if not available.
   */
  getAnalyser(id: SourceId): AnalyserNode | null
  
  /**
   * Sets the audio buffer for the specified source, replacing its current buffer with the new one.
   */
  setAudioBuffer(id: SourceId, buffer: AudioBuffer): void
  
  /**
   * Returns the AudioBuffer associated with the specified source, or null if not available.
   */
  getAudioBuffer(id: SourceId): AudioBuffer | null
  
  /**
   * Returns an array of all active source IDs currently managed by the engine.
   */
  getChannelIds(): SourceId[]
  
  /**
   * Returns the total duration of the audio timeline in seconds.
   */
  getDuration(): number
  
  /**
   * Returns the current playhead position in seconds across all sources.
   */
  getPlayheadPosition(): number
  
  /**
   * Checks if any audio source in the engine is currently paused.
   */
  hasAnyPaused(): boolean
  
  /**
   * Checks if any audio source in the engine has an audio buffer loaded.
   */
  hasAnyBuffer(): boolean
  
  /**
   * Returns an array of all buffered sources with their audio buffer, position, and volume data.
   */
  getAllBufferedSources(): {
    id: SourceId
    audioBuffer: AudioBuffer
    position: [number, number, number]
    volume: number
  }[]
  
  /**
   * Enumerates all available input and output audio devices on the system.
   */
  enumerateDevices(): Promise<MediaDeviceInfo[]>
  
  /**
   * Sets the output audio device to the one specified by the device ID, updating the Web Audio context.
   */
  setOutputDevice(deviceId: string): Promise<void>
  
  /**
   * Disposes of all resources used by the audio engine, releasing memory and stopping audio processing.
   */
  dispose(): void
}
